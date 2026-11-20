import { describe, expect, it } from 'vitest';
import { END, MemorySaver, Command } from '@langchain/langgraph';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { buildCampaignDirectorGraph, getHarnessContext, routeAfterAgent, routeAfterVerify } from './graph';
import type { AgentModel } from './agentModel';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: [] };
const cfg = (threadId: string) => ({ configurable: { thread_id: `jb-marks:${threadId}`, harnessContext: ctx } });
const fakeModel: AgentModel = { async invoke() { return new AIMessage('Draft briefing prepared from certified baseline.'); } };

describe('routing', () => {
  it('always re-checks policy after the agent step', () => {
    expect(routeAfterAgent()).toBe('verify_policy');
  });

  it('routes to the human gate only for a pending incident dispatch with a payload', () => {
    expect(routeAfterVerify({ pendingAction: { type: 'none' } } as never)).toBe(END);
    expect(routeAfterVerify({ pendingAction: { type: 'incident_dispatch' } } as never)).toBe(END);
    expect(
      routeAfterVerify({
        pendingAction: { type: 'incident_dispatch', payload: { incidentId: 'i', responderId: 'r', summary: 's' } },
      } as never),
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
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: fakeModel });
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
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: fakeModel });
    const r = await graph.invoke(
      { messages: [new HumanMessage('brief me')], claims: [{ claim: 'a 6% swing to the DA', kind: 'sourced', citation: 'x' }] },
      cfg('policy'),
    );
    expect(r.errors.join(' ')).toMatch(/Policy violation/);
    expect(r.briefingOutput).toBeNull();
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
      model: fakeModel,
      deps: { dispatchIncident: async () => { dispatched = true; } },
    });
    const config = cfg('reject');
    const first = await graph.invoke(dispatchArgs, config);
    // The run paused at the interrupt rather than completing.
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
      model: fakeModel,
      deps: { dispatchIncident: async () => { dispatched = true; } },
    });
    const config = cfg('approve');
    await graph.invoke(dispatchArgs, config);
    const resumed = await graph.invoke(new Command({ resume: { approved: true } }), config);
    expect(resumed.approvalStatus).toBe('approved');
    expect(dispatched).toBe(true);
  });
});
