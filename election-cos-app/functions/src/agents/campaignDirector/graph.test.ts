import { describe, expect, it } from 'vitest';
import { END, MemorySaver, Command } from '@langchain/langgraph';
import { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
import {
  MAX_ITERATIONS,
  buildCampaignDirectorGraph,
  getHarnessContext,
  routeAfterAgent,
  routeAfterVerify,
  type CampaignDirectorGraphState,
} from './graph';
import type { AgentModel } from './agentModel';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: [] };
const cfg = (threadId: string) => ({ configurable: { thread_id: `jb-marks:${threadId}`, harnessContext: ctx } });

/** A scripted model: returns the given messages in order, repeating the last. */
function scriptedModel(replies: BaseMessage[]): AgentModel {
  let i = 0;
  return { bindTools: () => ({ invoke: async () => replies[Math.min(i++, replies.length - 1)] }) };
}
const briefing = () => scriptedModel([new AIMessage('Draft briefing prepared from certified baseline.')]);
const toolCall = (name: string) =>
  new AIMessage({ content: '', tool_calls: [{ name, args: { ward_ids: [] }, id: `c-${name}` }] });
const asState = (s: Partial<CampaignDirectorGraphState>) => s as CampaignDirectorGraphState;

describe('routing', () => {
  it('loops to tools when the model asked for them and the budget is not spent', () => {
    expect(routeAfterAgent(asState({ messages: [toolCall('get_war_room_counters')], iterationCount: 1 }))).toBe('tools');
  });
  it('re-checks policy when there are no tool calls', () => {
    expect(routeAfterAgent(asState({ messages: [new HumanMessage('x')], iterationCount: 1 }))).toBe('verify_policy');
    expect(routeAfterAgent(asState({ messages: [new AIMessage('done')], iterationCount: 1 }))).toBe('verify_policy');
  });
  it('stops looping at the iteration cap even if tools were requested', () => {
    expect(
      routeAfterAgent(asState({ messages: [toolCall('get_war_room_counters')], iterationCount: MAX_ITERATIONS })),
    ).toBe('verify_policy');
  });

  it('routes to the human gate only for a pending incident dispatch with a payload', () => {
    expect(routeAfterVerify(asState({ pendingAction: { type: 'none' } }))).toBe(END);
    expect(routeAfterVerify(asState({ pendingAction: { type: 'incident_dispatch' } }))).toBe(END);
    expect(
      routeAfterVerify(
        asState({ pendingAction: { type: 'incident_dispatch', payload: { incidentId: 'i', responderId: 'r', summary: 's' } } }),
      ),
    ).toBe('execute_dispatch');
  });
});

describe('getHarnessContext — fails closed', () => {
  it('returns the verified context', () => {
    expect(getHarnessContext({ configurable: { harnessContext: ctx } })).toEqual(ctx);
  });
  it('throws when the context is missing or unverified', () => {
    expect(() => getHarnessContext(undefined)).toThrow(/HarnessContext/);
    expect(() => getHarnessContext({ configurable: {} })).toThrow(/HarnessContext/);
    expect(() => getHarnessContext({ configurable: { harnessContext: { tenantId: 't' } } })).toThrow(/HarnessContext/);
  });
});

describe('graph run', () => {
  it('produces a briefing on the happy path with a model', async () => {
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: briefing() });
    const r = await graph.invoke({ municipalityCode: 'NW405', messages: [new HumanMessage('brief me')] }, cfg('happy'));
    expect(r.briefingOutput).toMatch(/Draft briefing/);
    expect(r.errors).toEqual([]);
    expect(r.iterationCount).toBe(1);
  });

  it('fails closed with no model — records an error and ships no briefing', async () => {
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: null });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('nomodel'));
    expect(r.errors.join(' ')).toMatch(/not configured/i);
    expect(r.briefingOutput).toBeNull();
  });

  it('refuses a provenance violation (a swing marked sourced) with an error, no briefing', async () => {
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: briefing() });
    const r = await graph.invoke(
      { messages: [new HumanMessage('brief me')], claims: [{ claim: 'a 6% swing to the DA', kind: 'sourced', citation: 'x' }] },
      cfg('policy'),
    );
    expect(r.errors.join(' ')).toMatch(/Policy violation/);
    expect(r.briefingOutput).toBeNull();
  });
});

describe('tool loop', () => {
  it('runs a requested tool, feeds the result back, and finishes with a briefing', async () => {
    const model = scriptedModel([toolCall('get_war_room_counters'), new AIMessage('Final briefing: 5 voters captured.')]);
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model,
      counterReader: async (tenantId) => ({ votersCaptured: tenantId === 'jb-marks' ? 5 : 0 }),
    });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('toolloop'));
    // The tool executed and its tenant-scoped result is in the transcript.
    expect(r.messages.some((m) => typeof m.content === 'string' && m.content.includes('votersCaptured'))).toBe(true);
    expect(r.briefingOutput).toMatch(/Final briefing/);
    expect(r.iterationCount).toBe(2); // one agent turn before the tool, one after
  });

  it('stops at the iteration cap when the model never stops asking for tools', async () => {
    const model = scriptedModel([toolCall('get_war_room_counters')]); // always a tool call
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model,
      counterReader: async () => ({}),
    });
    const r = await graph.invoke({ messages: [new HumanMessage('loop')] }, cfg('cap'));
    expect(r.iterationCount).toBe(MAX_ITERATIONS); // capped, did not run away
  });
});

describe('human-in-the-loop dispatch gate', () => {
  const dispatchArgs = {
    messages: [new HumanMessage('dispatch please')],
    pendingAction: { type: 'incident_dispatch' as const, payload: { incidentId: 'i1', responderId: 'r1', summary: 's' } },
  };

  it('pauses before dispatching and does not dispatch on rejection', async () => {
    let dispatched = false;
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: briefing(),
      deps: { dispatchIncident: async () => { dispatched = true; } },
    });
    const config = cfg('reject');
    const first = await graph.invoke(dispatchArgs, config);
    expect((first as Record<string, unknown>).__interrupt__).toBeTruthy();
    expect(dispatched).toBe(false);

    const resumed = await graph.invoke(new Command({ resume: { approved: false } }), config);
    expect(resumed.approvalStatus).toBe('rejected');
    expect(dispatched).toBe(false);
  });

  it('dispatches only after human approval', async () => {
    let dispatched = false;
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: briefing(),
      deps: { dispatchIncident: async () => { dispatched = true; } },
    });
    const config = cfg('approve');
    await graph.invoke(dispatchArgs, config);
    const resumed = await graph.invoke(new Command({ resume: { approved: true } }), config);
    expect(resumed.approvalStatus).toBe('approved');
    expect(dispatched).toBe(true);
  });
});
