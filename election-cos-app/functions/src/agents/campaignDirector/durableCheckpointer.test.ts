/**
 * Stage 2: the durable saver, and the agent running ACROSS requests on it.
 *
 * Every "request" below builds a fresh graph and a fresh saver over one shared
 * store — exactly what the worker does per HTTP request — so anything that only
 * worked because state lived in a process would fail here.
 */
import { describe, expect, it } from 'vitest';
import { Command, MemorySaver } from '@langchain/langgraph';
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import {
  DocStoreCheckpointSaver,
  MAX_CHECKPOINT_CHARS,
  memoryDocStore,
  parseScopedThread,
} from './firestoreCheckpointer';
import { buildCampaignDirectorGraph, MAX_ITERATIONS } from './graph';
import { runAgent, type RunAgentDeps } from './runAgent';
import { freeMeter, memoryThreadLease, submitBriefing } from './testKit';
import type { CheckpointDocStore } from './firestoreCheckpointer';
import type { AgentModel } from './agentModel';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view', 'incidents.escalate'] };
const cfg = (threadId: string, tenant = 'jb-marks') => ({
  configurable: { thread_id: `${tenant}:${threadId}`, harnessContext: { ...ctx, tenantId: tenant } },
});

function scriptedModel(replies: BaseMessage[], seen?: BaseMessage[][]): AgentModel {
  let i = 0;
  return {
    bindTools: () => ({
      invoke: async (messages: BaseMessage[]) => {
        seen?.push(messages);
        return replies[Math.min(i++, replies.length - 1)];
      },
    }),
  };
}
const brief = (text = 'Briefing.') => scriptedModel([submitBriefing(text)]);
/** What the worker hands runAgent per request: a fresh saver over the shared store, a lease, a meter. */
const lease = memoryThreadLease();
const durable = (store: CheckpointDocStore): RunAgentDeps => ({
  checkpointer: new DocStoreCheckpointSaver(store),
  lease,
  reserveModelCall: freeMeter,
});
const dispatch = {
  type: 'incident_dispatch' as const,
  payload: { incidentId: 'i1', responderId: 'r1', summary: 'water main burst, ward 12' },
};

describe('DocStoreCheckpointSaver — storage', () => {
  it('round-trips the latest state through the head pointer', async () => {
    const store = memoryDocStore();
    const g = buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(store), model: brief('Hello') });
    await g.invoke({ messages: [new HumanMessage('hi')] }, cfg('a'));

    const tuple = await new DocStoreCheckpointSaver(store).getTuple(cfg('a'));
    expect(tuple).toBeDefined();
    const values = tuple!.checkpoint.channel_values as { briefingOutput: string };
    expect(values.briefingOutput).toBe('Hello');
    expect(store.paths().some((p) => p.endsWith('/heads/root'))).toBe(true);
  });

  it('keeps tenants apart even when the raw thread id is the same', async () => {
    const store = memoryDocStore();
    const g = buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(store), model: brief() });
    await g.invoke({ messages: [new HumanMessage('hi')] }, cfg('shared'));

    expect(store.paths().every((p) => p.startsWith('tenants/jb-marks/'))).toBe(true);
    expect(await new DocStoreCheckpointSaver(store).getTuple(cfg('shared', 'other-tenant'))).toBeUndefined();
  });

  it('soft-deletes a thread: history kept, latest state gone', async () => {
    const store = memoryDocStore();
    const saver = new DocStoreCheckpointSaver(store);
    await buildCampaignDirectorGraph({ checkpointer: saver, model: brief() }).invoke(
      { messages: [new HumanMessage('hi')] },
      cfg('del'),
    );
    const before = store.paths().length;
    await saver.deleteThread('jb-marks:del');
    expect(await saver.getTuple(cfg('del'))).toBeUndefined();
    expect(store.paths().length).toBe(before); // nothing removed
  });

  it('lists history newest-first, with a limit', async () => {
    const store = memoryDocStore();
    const saver = new DocStoreCheckpointSaver(store);
    await buildCampaignDirectorGraph({ checkpointer: saver, model: brief() }).invoke(
      { messages: [new HumanMessage('hi')] },
      cfg('hist'),
    );
    const all = [];
    for await (const t of saver.list(cfg('hist'))) all.push(t.config.configurable?.checkpoint_id as string);
    expect(all.length).toBeGreaterThan(1);
    expect([...all].sort().reverse()).toEqual(all);
    const two = [];
    for await (const t of saver.list(cfg('hist'), { limit: 2 })) two.push(t);
    expect(two).toHaveLength(2);
  });

  it('refuses a checkpoint too large to store, rather than truncating it', async () => {
    const huge = scriptedModel([new AIMessage('x'.repeat(MAX_CHECKPOINT_CHARS))]);
    const g = buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(memoryDocStore()), model: huge });
    await expect(g.invoke({ messages: [new HumanMessage('hi')] }, cfg('big'))).rejects.toThrow(/CheckpointTooLargeError/);
  });

  it('refuses a pending write too large to store, too', async () => {
    const saver = new DocStoreCheckpointSaver(memoryDocStore());
    const config = { configurable: { thread_id: 'jb-marks:w', checkpoint_id: 'c1', checkpoint_ns: '' } };
    await expect(saver.putWrites(config, [['messages', 'x'.repeat(MAX_CHECKPOINT_CHARS)]], 'task')).rejects.toThrow(
      /CheckpointTooLargeError/,
    );
  });

  it('rejects a thread id that would escape its document path', () => {
    expect(() => parseScopedThread('jb-marks:a/b')).toThrow(/may not contain/);
    expect(() => parseScopedThread('jb/marks:a')).toThrow(/may not contain/);
  });
});

describe('human approval across requests (the point of stage 2)', () => {
  it('pauses in one request and resumes, approved, in the next', async () => {
    const store = memoryDocStore();
    const dispatched: string[] = [];
    const request = () =>
      buildCampaignDirectorGraph({
        checkpointer: new DocStoreCheckpointSaver(store), // fresh per request
        model: brief(),
        deps: { dispatchIncident: async (_c, p) => void dispatched.push(p.incidentId) },
      });

    const first = await request().invoke({ messages: [new HumanMessage('dispatch')], pendingAction: dispatch }, cfg('hitl'));
    expect((first as Record<string, unknown>).__interrupt__).toBeTruthy();
    expect(dispatched).toEqual([]);

    const second = await request().invoke(new Command({ resume: { approved: true } }), cfg('hitl'));
    expect(second.approvalStatus).toBe('approved');
    expect(dispatched).toEqual(['i1']);
  });

  it('a rejection in the next request dispatches nothing', async () => {
    const store = memoryDocStore();
    let dispatched = false;
    const request = () =>
      buildCampaignDirectorGraph({
        checkpointer: new DocStoreCheckpointSaver(store),
        model: brief(),
        deps: { dispatchIncident: async () => void (dispatched = true) },
      });
    await request().invoke({ messages: [new HumanMessage('dispatch')], pendingAction: dispatch }, cfg('rej'));
    const second = await request().invoke(new Command({ resume: { approved: false } }), cfg('rej'));
    expect(second.approvalStatus).toBe('rejected');
    expect(dispatched).toBe(false);
  });
});

describe('runAgent on a durable thread', () => {
  it('carries the conversation across requests', async () => {
    const store = memoryDocStore();
    await runAgent(ctx, { threadId: 'conv', prompt: 'What is the JB Marks quota?' }, {
      model: brief('First answer.'),
      ...durable(store),
    });
    const seen: BaseMessage[][] = [];
    await runAgent(ctx, { threadId: 'conv', prompt: 'And the DA seats?' }, {
      model: scriptedModel([submitBriefing('Second answer.')], seen),
      ...durable(store),
    });
    // [system prompt, first question, the submitted answer (a tool call), its ack, the follow-up]
    const [system, ...thread] = seen[0];
    expect(system._getType()).toBe('system');
    expect(thread.map((m) => m._getType())).toEqual(['human', 'ai', 'tool', 'human']);
    expect(String(thread[0].content)).toBe('What is the JB Marks quota?');
    expect((thread[1] as AIMessage).tool_calls?.[0].args.briefing).toBe('First answer.');
    expect(String(thread[3].content)).toBe('And the DA seats?');
  });

  it("resets the turn: an earlier turn's error does not block the next briefing", async () => {
    const store = memoryDocStore();
    // Turn 1 ends in a provenance violation (an error on the thread).
    await buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(store), model: brief() }).invoke(
      { messages: [new HumanMessage('t1')], claims: [{ claim: 'a 5% swing', kind: 'sourced', citation: 'x' }] },
      cfg('u1:reset'),
    );
    const r = await runAgent(ctx, { threadId: 'reset', prompt: 't2' }, {
      model: brief('Clean briefing.'),
      ...durable(store),
    });
    expect(r).toMatchObject({ ok: true, briefing: 'Clean briefing.', errors: [] });
  });

  it('applies the iteration cap per turn, not per thread', async () => {
    const store = memoryDocStore();
    const alwaysTool = scriptedModel([
      new AIMessage({ content: '', tool_calls: [{ name: 'get_war_room_counters', args: {}, id: 'c' }] }),
    ]);
    const t1 = await runAgent(ctx, { threadId: 'cap' }, { model: alwaysTool, ...durable(store) });
    expect(t1).toMatchObject({ ok: true, iterationCount: MAX_ITERATIONS, briefing: null });
    expect(t1.ok && t1.errors.join(' ')).toMatch(/iteration budget/);
    const t2 = await runAgent(ctx, { threadId: 'cap' }, { model: brief(), ...durable(store) });
    expect(t2).toMatchObject({ ok: true, iterationCount: 1, briefing: 'Briefing.', errors: [] });
  });

  it('refuses a new prompt while an approval is pending, then resumes it', async () => {
    const store = memoryDocStore();
    await buildCampaignDirectorGraph({ checkpointer: new DocStoreCheckpointSaver(store), model: brief() }).invoke(
      { messages: [new HumanMessage('dispatch')], pendingAction: dispatch },
      cfg('u1:pend'),
    );
    const blocked = await runAgent(ctx, { threadId: 'pend', prompt: 'something else' }, {
      model: brief(),
      ...durable(store),
    });
    expect(blocked).toEqual({ ok: false, reason: 'awaiting-approval' });

    const resumed = await runAgent(ctx, { threadId: 'pend', resumeDecision: { approved: true } }, {
      model: brief(),
      ...durable(store),
    });
    expect(resumed).toMatchObject({ ok: true, approvalStatus: 'approved' });
  });

  it('refuses a resume when nothing is waiting', async () => {
    const r = await runAgent(ctx, { threadId: 'none', resumeDecision: { approved: true } }, {
      model: brief(),
      ...durable(memoryDocStore()),
    });
    expect(r).toEqual({ ok: false, reason: 'nothing-to-resume' });
  });

  it('turns an oversized thread into a clear refusal', async () => {
    const r = await runAgent(ctx, { threadId: 'big' }, {
      model: scriptedModel([new AIMessage('x'.repeat(MAX_CHECKPOINT_CHARS))]),
      ...durable(memoryDocStore()),
    });
    expect(r).toEqual({ ok: false, reason: 'thread-too-long' });
  });

  it('still runs single-request with no durable saver', async () => {
    const r = await runAgent(ctx, { threadId: 'mem' }, { model: brief('ok'), reserveModelCall: freeMeter });
    expect(r).toMatchObject({ ok: true, briefing: 'ok' });
    // MemorySaver remains usable as an explicit saver too.
    expect(await runAgent(ctx, { threadId: 'mem2' }, { model: brief(), checkpointer: new MemorySaver(), lease, reserveModelCall: freeMeter })).toMatchObject({ ok: true });
  });
});
