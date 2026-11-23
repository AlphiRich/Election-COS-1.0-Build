// @vitest-environment node
/**
 * Stage 2 on the edge: the Firestore-REST checkpoint store, against a fake that
 * speaks Firestore's REST wire format (typed values, `documents:commit`, paged
 * listing). Proves the serialised checkpoints survive real Firestore encoding,
 * and that the route keeps a conversation and an approval across requests.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportPKCS8, generateKeyPair } from 'jose';
import { AIMessage, Command, HumanMessage, type BaseMessage } from '../../functions/src/agents/campaignDirector/testKit';
import { restCheckpointStore, type Env } from './index';
import { AGENT_REQUIRED_CAP, handleCampaignDirector } from './agentRoute';
import { DocStoreCheckpointSaver } from '../../functions/src/agents/campaignDirector/firestoreCheckpointer';
import { buildCampaignDirectorGraph } from '../../functions/src/agents/campaignDirector/graph';
import type { AgentModel } from '../../functions/src/agents/campaignDirector/agentModel';

const PROJECT = 'test-proj';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const NAME_PREFIX = `projects/${PROJECT}/databases/(default)/documents/`;
let saPem: string;
let store: Map<string, Record<string, unknown>>; // path → Firestore `fields`
let commits: number;

const env = (): Env => ({
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'sa@x.iam', private_key: saPem }),
  OWNER_EMAILS: '',
});

/** A small, strict fake of the three Firestore REST calls the store makes. */
function fakeFirestore() {
  store = new Map();
  commits = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('https://oauth2.googleapis.com/token')) return Response.json({ access_token: 'at', expires_in: 3600 });
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer at');

      if (url === `${DOCS}:commit` && init?.method === 'POST') {
        commits += 1;
        const body = JSON.parse(String(init.body)) as { writes: Array<{ update: { name: string; fields: Record<string, unknown> } }> };
        expect(body.writes.length).toBeLessThanOrEqual(500);
        for (const w of body.writes) {
          expect(w.update.name.startsWith(NAME_PREFIX)).toBe(true);
          store.set(w.update.name.slice(NAME_PREFIX.length), w.update.fields);
        }
        return Response.json({ writeResults: [] });
      }

      const [pathPart, query = ''] = url.slice(DOCS.length + 1).split('?');
      const segments = pathPart.split('/');
      if (segments.length % 2 === 0) {
        const fields = store.get(pathPart);
        return fields ? Response.json({ name: NAME_PREFIX + pathPart, fields }) : new Response('{}', { status: 404 });
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
        model: scripted([new AIMessage('ok')]),
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

describe('the route keeps a conversation across requests', () => {
  const token = { uid: 'u1', tenantId: 'jb-marks', caps: [AGENT_REQUIRED_CAP], mfaRequired: false };

  it('the second request sees the first exchange', async () => {
    fakeFirestore();
    const r1 = await handleCampaignDirector(token, { threadId: 'conv', prompt: 'First question' }, {
      nowSec: 1,
      model: scripted([new AIMessage('First answer')]),
      checkpointStore: restCheckpointStore(env()),
    });
    expect(r1.status).toBe(200);

    const seen: BaseMessage[][] = [];
    const r2 = await handleCampaignDirector(token, { threadId: 'conv', prompt: 'Follow-up' }, {
      nowSec: 1,
      model: scripted([new AIMessage('Second answer')], seen),
      checkpointStore: restCheckpointStore(env()),
    });
    expect(r2).toMatchObject({ status: 200, body: { briefing: 'Second answer' } });
    expect(seen[0].map((m) => String(m.content))).toEqual(['First question', 'First answer', 'Follow-up']);
  });

  it('a resume on a thread with nothing waiting is a 409', async () => {
    fakeFirestore();
    const r = await handleCampaignDirector(token, { threadId: 'idle', resumeDecision: { approved: true } }, {
      nowSec: 1,
      model: scripted([new AIMessage('x')]),
      checkpointStore: restCheckpointStore(env()),
    });
    expect(r.status).toBe(409);
  });
});
