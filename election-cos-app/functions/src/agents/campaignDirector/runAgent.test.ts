import { describe, expect, it, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import { APPROVAL_REQUIRED_CAP, runAgent, type RunAgentDeps } from './runAgent';
import type { AgentModel } from './agentModel';
import type { HarnessContext } from './state';
import { buildCampaignDirectorGraph } from './graph';
import { DocStoreCheckpointSaver, memoryDocStore, type CheckpointDocStore } from './firestoreCheckpointer';
import { LEASE_TTL_MS, memoryThreadLease, type ThreadLease } from './threadLease';
import { freeMeter, submitBriefing } from './testKit';
import { CostGuardError, reserveSpend, type SpendStore } from '../../costGuardCore';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view'] };
const approver: HarnessContext = { ...ctx, capabilities: ['warroom.view', APPROVAL_REQUIRED_CAP] };

function scriptedModel(replies: BaseMessage[]): AgentModel {
  let i = 0;
  return { bindTools: () => ({ invoke: async () => replies[Math.min(i++, replies.length - 1)] }) };
}
const durable = (store: CheckpointDocStore = memoryDocStore(), lease: ThreadLease = memoryThreadLease()): RunAgentDeps => ({
  checkpointer: new DocStoreCheckpointSaver(store),
  lease,
  reserveModelCall: freeMeter,
});
const dispatch = { type: 'incident_dispatch' as const, payload: { incidentId: 'i1', responderId: 'r1', summary: 's' } };

/** Leave a dispatch paused on the user's thread, as an earlier request would. */
async function pausedThread(store: CheckpointDocStore, uid = 'u1', threadId = 'pend') {
  await buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(store), model: scriptedModel([submitBriefing('b')]) }).invoke(
    { messages: [new HumanMessage('dispatch')], pendingAction: dispatch },
    { configurable: { thread_id: `jb-marks:${uid}:${threadId}`, harnessContext: { ...ctx, uid } } },
  );
}

describe('runAgent', () => {
  it('runs the graph and returns a JSON-safe summary', async () => {
    const r = await runAgent(ctx, { threadId: 't1', prompt: 'brief me' }, {
      model: scriptedModel([submitBriefing('Briefing: steady.')]),
      reserveModelCall: freeMeter,
    });
    expect(r).toEqual({
      ok: true,
      briefing: 'Briefing: steady.',
      errors: [],
      iterationCount: 1,
      approvalStatus: 'pending',
      pendingApproval: null,
    });
    expect(() => JSON.stringify(r)).not.toThrow();
  });

  it('runs a tool and reads counters for the VERIFIED tenant only', async () => {
    const counterReader = vi.fn(async () => ({ votersCaptured: 9 }));
    const r = await runAgent(
      ctx,
      { threadId: 't2' },
      {
        model: scriptedModel([
          new AIMessage({ content: '', tool_calls: [{ name: 'get_war_room_counters', args: {}, id: 'c1' }] }),
          submitBriefing('Nine voters captured.'),
        ]),
        counterReader,
        reserveModelCall: freeMeter,
      },
    );
    expect(counterReader).toHaveBeenCalledWith('jb-marks', []);
    expect(r.ok && r.briefing).toBe('Nine voters captured.');
  });

  it('fails closed with no model and no key — nothing runs', async () => {
    expect(await runAgent(ctx, { threadId: 't3' }, {})).toEqual({ ok: false, reason: 'model-not-configured' });
    expect(await runAgent(ctx, { threadId: 't3' }, { apiKey: '   ' })).toEqual({
      ok: false,
      reason: 'model-not-configured',
    });
    // An explicit null model (no credential) wins over nothing.
    expect(await runAgent(ctx, { threadId: 't3' }, { model: null })).toEqual({
      ok: false,
      reason: 'model-not-configured',
    });
  });

  it('refuses a resume without a durable checkpointer rather than resuming nothing', async () => {
    const r = await runAgent(
      approver,
      { threadId: 't4', resumeDecision: { approved: true } },
      { model: scriptedModel([submitBriefing('x')]), reserveModelCall: freeMeter },
    );
    expect(r).toEqual({ ok: false, reason: 'resume-requires-durable-checkpointer' });
  });

  it('with a durable checkpointer, refuses a resume when nothing is paused (no silent no-op)', async () => {
    const r = await runAgent(
      approver,
      { threadId: 't5', resumeDecision: { approved: false } },
      { model: scriptedModel([submitBriefing('x')]), ...durable() },
    );
    expect(r).toEqual({ ok: false, reason: 'nothing-to-resume' });
  });

  it('refuses a durable checkpointer with no lease, rather than run unguarded', async () => {
    const r = await runAgent(ctx, { threadId: 't6' }, {
      model: scriptedModel([submitBriefing('x')]),
      checkpointer: new MemorySaver(),
      reserveModelCall: freeMeter,
    });
    expect(r).toEqual({ ok: false, reason: 'lease-not-configured' });
  });
});

describe('a thread belongs to its user', () => {
  it("a colleague in the same tenant with the same threadId reaches a different, empty thread", async () => {
    const store = memoryDocStore();
    await pausedThread(store, 'u1', 'shared');
    const colleague: HarnessContext = { ...approver, uid: 'u2' };
    // u1's paused dispatch is invisible to u2: there is nothing for u2 to resume…
    expect(
      await runAgent(colleague, { threadId: 'shared', resumeDecision: { approved: true } }, { model: scriptedModel([]), ...durable(store) }),
    ).toEqual({ ok: false, reason: 'nothing-to-resume' });
    // …and u2's new prompt starts afresh instead of hitting u1's pending approval.
    expect(
      await runAgent(colleague, { threadId: 'shared', prompt: 'hi' }, { model: scriptedModel([submitBriefing('fresh')]), ...durable(store) }),
    ).toMatchObject({ ok: true, briefing: 'fresh' });
    expect(store.paths().some((p) => p.startsWith('tenants/jb-marks/agentCheckpoints/u2:shared/'))).toBe(true);
  });

  it(`deciding a paused dispatch needs ${APPROVAL_REQUIRED_CAP}`, async () => {
    const store = memoryDocStore();
    await pausedThread(store);
    const viewerOnly = await runAgent(ctx, { threadId: 'pend', resumeDecision: { approved: true } }, {
      model: scriptedModel([]),
      ...durable(store),
    });
    expect(viewerOnly).toEqual({ ok: false, reason: 'approval-not-permitted' });
    const decided = await runAgent(approver, { threadId: 'pend', resumeDecision: { approved: true } }, {
      model: scriptedModel([]),
      ...durable(store),
    });
    expect(decided).toMatchObject({ ok: true, approvalStatus: 'approved' });
  });
});

describe('one run per durable thread', () => {
  it('refuses a second request while the first holds the lease, and releases it after', async () => {
    const store = memoryDocStore();
    const lease = memoryThreadLease();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const slow: AgentModel = { bindTools: () => ({ invoke: async () => (await gate, submitBriefing('first')) }) };

    const first = runAgent(ctx, { threadId: 'busy', prompt: 'a' }, { model: slow, ...durable(store, lease) });
    await new Promise((r) => setTimeout(r, 10)); // let the first take the lease
    const second = await runAgent(ctx, { threadId: 'busy', prompt: 'b' }, {
      model: scriptedModel([submitBriefing('second')]),
      ...durable(store, lease),
    });
    expect(second).toEqual({ ok: false, reason: 'thread-busy' });

    release();
    expect(await first).toMatchObject({ ok: true, briefing: 'first' });
    // Released: the next request runs.
    expect(
      await runAgent(ctx, { threadId: 'busy', prompt: 'c' }, { model: scriptedModel([submitBriefing('third')]), ...durable(store, lease) }),
    ).toMatchObject({ ok: true, briefing: 'third' });
  });

  it('a resume cannot dispatch twice when two arrive together', async () => {
    const store = memoryDocStore();
    await pausedThread(store);
    const lease = memoryThreadLease();
    const dispatched: string[] = [];
    // Both requests race for the lease; only one may run the resume.
    const run = () =>
      runAgent(approver, { threadId: 'pend', resumeDecision: { approved: true } }, {
        model: scriptedModel([]),
        ...durable(store, lease),
      }).then((r) => (r.ok && r.approvalStatus === 'approved' && dispatched.push('x'), r));
    const results = await Promise.all([run(), run()]);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.reason)).toEqual(['thread-busy']);
    expect(dispatched).toHaveLength(1);
  });

  it('releases the lease even when the run throws', async () => {
    const lease = memoryThreadLease();
    const boom: AgentModel = { bindTools: () => ({ invoke: async () => { throw new Error('model down'); } }) };
    await expect(runAgent(ctx, { threadId: 'err', prompt: 'a' }, { model: boom, ...durable(memoryDocStore(), lease) })).rejects.toThrow(/model down/);
    expect(await lease.acquire('jb-marks:u1:err', Date.now())).not.toBeNull();
  });

  it('an expired lease is taken over, so a dead run cannot lock a thread for ever', async () => {
    const lease = memoryThreadLease();
    expect(await lease.acquire('jb-marks:u1:x', 0)).not.toBeNull();
    expect(await lease.acquire('jb-marks:u1:x', LEASE_TTL_MS - 1)).toBeNull();
    expect(await lease.acquire('jb-marks:u1:x', LEASE_TTL_MS + 1)).not.toBeNull();
  });
});

describe('every model call is metered', () => {
  const ledger = (spent = 0): SpendStore & { spent: () => number } => {
    let cents = spent;
    return {
      spent: () => cents,
      runTransaction: (fn) =>
        fn({ getSpent: async () => cents, getApproval: async () => null, setSpent: (_p, c) => void (cents = c) }),
    };
  };

  it('refuses to run with no meter', async () => {
    expect(await runAgent(ctx, { threadId: 'm0' }, { model: scriptedModel([submitBriefing('x')]) })).toEqual({
      ok: false,
      reason: 'cost-guard-not-configured',
    });
  });

  it('reserves each call against the monthly ledger', async () => {
    const store = ledger();
    const r = await runAgent(ctx, { threadId: 'm1' }, {
      model: scriptedModel([
        new AIMessage({ content: '', tool_calls: [{ name: 'get_war_room_counters', args: {}, id: 'c' }] }),
        submitBriefing('ok'),
      ]),
      reserveModelCall: async () => void (await reserveSpend(store, 30, new Date())),
    });
    expect(r).toMatchObject({ ok: true, iterationCount: 2 });
    expect(store.spent()).toBe(60);
  });

  it('stops at the ceiling with a clear refusal, and makes no call past it', async () => {
    const store = ledger(49_990); // R499.90 of R500 spent
    const invoke = vi.fn(async () => submitBriefing('x'));
    const r = await runAgent(ctx, { threadId: 'm2' }, {
      model: { bindTools: () => ({ invoke }) },
      reserveModelCall: async () => void (await reserveSpend(store, 30, new Date())),
    });
    expect(r).toEqual({ ok: false, reason: 'spend-ceiling-reached' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('an unset price is a configuration refusal, not a free call', async () => {
    const r = await runAgent(ctx, { threadId: 'm3' }, {
      model: scriptedModel([submitBriefing('x')]),
      reserveModelCall: async () => {
        throw new CostGuardError('PRICE_NOT_CONFIGURED', 'no price');
      },
    });
    expect(r).toEqual({ ok: false, reason: 'cost-guard-not-configured' });
  });
});
