// @vitest-environment node
/**
 * Stage 2 on the edge: the Firestore-REST checkpoint store, against a fake that
 * speaks Firestore's REST wire format (typed values, `documents:commit`, paged
 * listing). Proves the serialised checkpoints survive real Firestore encoding,
 * and that the route keeps a conversation and an approval across requests.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import {
  AIMessage,
  Command,
  HumanMessage,
  submitBriefing,
  type BaseMessage,
} from '../../functions/src/agents/campaignDirector/testKit';
import { restCheckpointStore, restVersionedStore, type Env } from './index';
import { versionedThreadLease } from '../../functions/src/agents/campaignDirector/threadLease';
import { optimisticSpendStore, reserveSpend } from '../../functions/src/costGuardCore';
import { AGENT_REQUIRED_CAP, handleCampaignDirector } from './agentRoute';
import { DocStoreCheckpointSaver } from '../../functions/src/agents/campaignDirector/firestoreCheckpointer';
import { buildCampaignDirectorGraph } from '../../functions/src/agents/campaignDirector/graph';
import type { AgentModel } from '../../functions/src/agents/campaignDirector/agentModel';

const PROJECT = 'test-proj';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME_PREFIX = `projects/${PROJECT}/databases/(default)/documents/`;
let saPem: string;
let store: Map<string, Record<string, unknown>>; // path → Firestore `fields`
let times: Map<string, string>; // path → updateTime
let commits: number;
let clock: number;

const env = (): Env => ({
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x.iam', private_key: saPem }),
  OWNER_EMAILS: '',
});

/** A small, strict fake of the three Firestore REST calls the store makes. */
function fakeFirestore() {
  store = new Map();
  times = new Map();
  commits = 0;
  clock = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'at', expires_in: 3600 });
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer at');

      if (url === `${DOCS}:commit` && init?.method === 'POST') {
        commits += 1;
        type W = {
          update?: { name: string; fields: Record<string, unknown> };
          delete?: string;
          currentDocument?: { exists?: boolean; updateTime?: string };
        };
        const body = JSON.parse(String(init.body)) as { writes: W[] };
        expect(body.writes.length).toBeLessThanOrEqual(500);
        const pathOf = (w: W) => {
          const name = w.update?.name ?? w.delete ?? '';
          expect(name.startsWith(NAME_PREFIX)).toBe(true);
          return name.slice(NAME_PREFIX.length);
        };
        // Preconditions first, as Firestore does: all writes or none.
        for (const w of body.writes) {
          const pre = w.currentDocument;
          if (!pre) continue;
          const exists = store.has(pathOf(w));
          if (pre.exists === false && exists) return Response.json({ error: { status: 'ALREADY_EXISTS' } }, { status: 409 });
          if (pre.updateTime !== undefined && !exists) return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
          if (pre.updateTime !== undefined && times.get(pathOf(w)) !== pre.updateTime) {
            return Response.json({ error: { status: 'FAILED_PRECONDITION' } }, { status: 400 });
          }
        }
        for (const w of body.writes) {
          const path = pathOf(w);
          if (w.delete) {
            store.delete(path);
            times.delete(path);
          } else {
            store.set(path, w.update!.fields);
            times.set(path, `2026-11-23T00:00:${String((clock += 1)).padStart(2, '0')}Z`);
          }
        }
        return Response.json({ writeResults: [] });
      }

      const [pathPart, query = ''] = url.slice(DOCS.length + 1).split('?');
      const segments = pathPart.split('/');
      if (segments.length % 2 === 0) {
        const fields = store.get(pathPart);
        return fields
          ? Response.json({ name: NAME_PREFIX + pathPart, fields, updateTime: times.get(pathPart) })
          : new Response('{}', { status: 404 });
      }
      // Collection listing, paged two at a time so pagination is exercised.
      const prefix = `${pathPart}/`;
      const all = [...store.keys()].filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).sort();
      const offset = Number(new URLSearchParams(query).get('pageToken') ?? 0);
      const page = all.slice(offset, offset + 2);
      return Response.json({
        documents: page.map((p) => ({ name: NAME_PREFIX + p, fields: store.get(p) })),
        ...(offset + 2 < all.length ? { nextPageToken: String(offset + 2) } : {}),
      });
    }),
  );
}

function scripted(replies: BaseMessage[], seen?: BaseMessage[][]): AgentModel {
  let i = 0;
  return {
    bindTools: () => ({
      invoke: async (m: BaseMessage[]) => {
        seen?.push(m);
        return replies[Math.min(i++, replies.length - 1)];
      },
    }),
  };
}

beforeAll(async () => {
  saPem = await exportPKCS8((await generateKeyPair('RS256', { extractable: true })).privateKey);
});
afterEach(() => vi.unstubAllGlobals());

describe('restCheckpointStore (Firestore REST wire format)', () => {
  it('writes a batch as one commit and reads it back typed', async () => {
    fakeFirestore();
    const s = restCheckpointStore(env());
    await s.setMany([
      { path: 'tenants/t/agentCheckpoints/x/heads/root', data: { checkpointId: 'c1', n: -3, gone: null } },
      { path: 'tenants/t/agentCheckpoints/x/checkpoints/c1', data: { blob: 'QUJD', createdAt: 1700000000000 } },
    ]);
    expect(commits).toBe(1);
    expect(await s.get('tenants/t/agentCheckpoints/x/heads/root')).toEqual({ checkpointId: 'c1', n: -3, gone: null });
    expect(await s.get('tenants/t/agentCheckpoints/x/checkpoints/missing')).toBeNull();
  });

  it('chunks a large batch under the commit cap', async () => {
    fakeFirestore();
    const writes = Array.from({ length: 450 }, (_, i) => ({ path: `c/d${i}`, data: { i } }));
    await restCheckpointStore(env()).setMany(writes);
    expect(commits).toBe(2);
  });

  it('follows pagination when listing a collection', async () => {
    fakeFirestore();
    const s = restCheckpointStore(env());
    await s.setMany(Array.from({ length: 5 }, (_, i) => ({ path: `col/doc${i}`, data: { i } })));
    await s.setMany([{ path: 'col/doc0/sub/deeper', data: { nested: true } }]);
    const listed = await s.list('col');
    expect(listed.map((d) => d.id)).toEqual(['doc0', 'doc1', 'doc2', 'doc3', 'doc4']); // direct children only
  });
});

describe('the durable saver over Firestore REST', () => {
  it('pauses for approval in one request and resumes in the next', async () => {
    fakeFirestore();
    const dispatched: string[] = [];
    const request = () =>
      buildCampaignDirectorGraph({
        checkpointer: new DocStoreCheckpointSaver(restCheckpointStore(env())),
        model: scripted([submitBriefing('ok')]),
        deps: { dispatchIncident: async (_c, p) => void dispatched.push(p.incidentId) },
      });
    const cfg = {
      configurable: { thread_id: 'jb-marks:hitl', harnessContext: { tenantId: 'jb-marks', uid: 'u', capabilities: [] } },
    };
    const first = await request().invoke(
      {
        messages: [new HumanMessage('dispatch')],
        pendingAction: { type: 'incident_dispatch', payload: { incidentId: 'i9', responderId: 'r', summary: 's' } },
      },
      cfg,
    );
    expect((first as Record<string, unknown>).__interrupt__).toBeTruthy();
    const second = await request().invoke(new Command({ resume: { approved: true } }), cfg);
    expect(second.approvalStatus).toBe('approved');
    expect(dispatched).toEqual(['i9']);
    expect([...store.keys()].every((p) => p.startsWith('tenants/jb-marks/agentCheckpoints/hitl/'))).toBe(true);
  });
});

describe('restVersionedStore (Firestore REST preconditions)', () => {
  it('create-if-absent, update-if-unchanged, delete-if-unchanged', async () => {
    fakeFirestore();
    const vs = restVersionedStore(env());
    expect(await vs.commit([{ path: 'c/a', data: { n: 1 }, ifVersion: null }])).toBe(true);
    expect(await vs.commit([{ path: 'c/a', data: { n: 2 }, ifVersion: null }])).toBe(false); // exists
    const v1 = await vs.getVersioned('c/a');
    expect(v1?.data).toEqual({ n: 1 });
    expect(await vs.commit([{ path: 'c/a', data: { n: 2 }, ifVersion: v1!.version }])).toBe(true);
    expect(await vs.commit([{ path: 'c/a', data: { n: 3 }, ifVersion: v1!.version }])).toBe(false); // stale
    const v2 = await vs.getVersioned('c/a');
    expect(await vs.commit([{ path: 'c/a', delete: true, ifVersion: v2!.version }])).toBe(true);
    expect(await vs.getVersioned('c/a')).toBeNull();
  });

  it('a REST lease admits one holder, frees on release, and is taken over on expiry', async () => {
    fakeFirestore();
    const lease = versionedThreadLease(restVersionedStore(env()));
    const t1 = await lease.acquire('jb-marks:u1:th', 1_000);
    expect(t1).not.toBeNull();
    expect([...store.keys()]).toEqual(['tenants/jb-marks/agentCheckpoints/u1:th/lease/current']);
    expect(await lease.acquire('jb-marks:u1:th', 2_000)).toBeNull();
    await lease.release('jb-marks:u1:th', 'not-the-holder');
    expect(store.size).toBe(1); // only the holder releases
    await lease.release('jb-marks:u1:th', t1!);
    expect(store.size).toBe(0);
    expect(await lease.acquire('jb-marks:u1:th', 3_000)).not.toBeNull();
    expect(await lease.acquire('jb-marks:u1:th', 3_000 + 120_001)).not.toBeNull(); // expired → taken over
  });

  it('the REST ledger counts two concurrent reservations, never one', async () => {
    fakeFirestore();
    const ledger = optimisticSpendStore(restVersionedStore(env()));
    const now = new Date('2026-11-23T10:00:00Z');
    await Promise.all([reserveSpend(ledger, 30, now), reserveSpend(ledger, 30, now)]);
    expect(store.get('platform/spend_2026-11')).toEqual({ cents: { integerValue: '60' } });
  });

  it('the REST ledger refuses past the R500 ceiling', async () => {
    fakeFirestore();
    const vs = restVersionedStore(env());
    await vs.commit([{ path: 'platform/spend_2026-11', data: { cents: 49_990 } }]);
    await expect(reserveSpend(optimisticSpendStore(vs), 30, new Date('2026-11-23T10:00:00Z'))).rejects.toThrow(/limit has been reached/);
  });
});

describe('the route keeps a conversation across requests', () => {
  const token = { uid: 'u1', tenantId: 'jb-marks', caps: [AGENT_REQUIRED_CAP], mfaRequired: false };
  /** What index.ts hands the route: REST checkpoints, REST preconditions, a price. */
  const edgeDeps = () => ({
    nowSec: 1,
    checkpointStore: restCheckpointStore(env()),
    versionedStore: restVersionedStore(env()),
    callCostCents: '30',
  });

  it('the second request sees the first exchange, and each call is on the ledger', async () => {
    fakeFirestore();
    const r1 = await handleCampaignDirector(token, { threadId: 'conv', prompt: 'First question' }, {
      ...edgeDeps(),
      model: scripted([submitBriefing('First answer')]),
    });
    expect(r1).toMatchObject({ status: 200, body: { briefing: 'First answer' } });

    const seen: BaseMessage[][] = [];
    const r2 = await handleCampaignDirector(token, { threadId: 'conv', prompt: 'Follow-up' }, {
      ...edgeDeps(),
      model: scripted([submitBriefing('Second answer')], seen),
    });
    expect(r2).toMatchObject({ status: 200, body: { briefing: 'Second answer' } });
    const [system, ...thread] = seen[0];
    expect(system._getType()).toBe('system');
    expect(thread.map((m) => m._getType())).toEqual(['human', 'ai', 'tool', 'human']);
    expect(String(thread[0].content)).toBe('First question');
    expect(String(thread[3].content)).toBe('Follow-up');
    // Two model calls at 30c, on the shared monthly ledger; the lease is released.
    expect(store.get(`platform/spend_${new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 7)}`)).toEqual({
      cents: { integerValue: '60' },
    });
    expect([...store.keys()].some((p) => p.endsWith('/lease/current'))).toBe(false);
    expect([...store.keys()].some((p) => p.startsWith('tenants/jb-marks/agentCheckpoints/u1:conv/'))).toBe(true);
  });

  it('refuses with 503 when no price per call is configured', async () => {
    fakeFirestore();
    const r = await handleCampaignDirector(token, { threadId: 'conv', prompt: 'q' }, {
      ...edgeDeps(),
      callCostCents: undefined,
      model: scripted([submitBriefing('x')]),
    });
    expect(r.status).toBe(503);
    expect(store.size).toBe(0); // nothing ran, nothing written
  });

  it('a resume on a thread with nothing waiting is a 409', async () => {
    fakeFirestore();
    const r = await handleCampaignDirector(
      { ...token, caps: [AGENT_REQUIRED_CAP, 'incidents.escalate'] },
      { threadId: 'idle', resumeDecision: { approved: true } },
      { ...edgeDeps(), model: scripted([new AIMessage('x')]) },
    );
    expect(r.status).toBe(409);
  });

  it('a resume without incidents.escalate is a 403', async () => {
    fakeFirestore();
    const r = await handleCampaignDirector(token, { threadId: 'idle', resumeDecision: { approved: true } }, {
      ...edgeDeps(),
      model: scripted([new AIMessage('x')]),
    });
    expect(r.status).toBe(403);
  });
});
