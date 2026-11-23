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
import { submitBriefing } from './testKit';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: [] };
const cfg = (threadId: string) => ({ configurable: { thread_id: `jb-marks:${threadId}`, harnessContext: ctx } });

/** A scripted model: returns the given messages in order, repeating the last. */
function scriptedModel(replies: BaseMessage[]): AgentModel {
  let i = 0;
  return { bindTools: () => ({ invoke: async () => replies[Math.min(i++, replies.length - 1)] }) };
}
const briefing = () => scriptedModel([submitBriefing('Draft briefing prepared from certified baseline.')]);
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
    ).toBe('budget_exhausted');
  });
  it('routes a submitted briefing to capture, even alongside other tool calls', () => {
    expect(routeAfterAgent(asState({ messages: [submitBriefing('b')], iterationCount: 1 }))).toBe('submit');
    const both = new AIMessage({
      content: '',
      tool_calls: [
        { name: 'get_war_room_counters', args: {}, id: 'a' },
        { name: 'submit_briefing', args: { briefing: 'b', claims: [] }, id: 'b' },
      ],
    });
    expect(routeAfterAgent(asState({ messages: [both], iterationCount: MAX_ITERATIONS }))).toBe('submit');
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
  it('never reaches the human gate over an error', () => {
    const payload = { incidentId: 'i', responderId: 'r', summary: 's' };
    expect(routeAfterVerify(asState({ errors: ['Policy violation'], pendingAction: { type: 'incident_dispatch', payload } }))).toBe(END);
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

  it('applies the gate to the claims the model submits with its briefing', async () => {
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: scriptedModel([submitBriefing('A 6% swing wins Ward 4.', [{ claim: 'a 6% swing', kind: 'sourced', citation: 'IEC' }])]),
    });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('submitted-violation'));
    expect(r.errors.join(' ')).toMatch(/swing-marked-sourced/);
    expect(r.briefingOutput).toBeNull();
  });

  it('refuses a percentage in the briefing that no claim declares', async () => {
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: scriptedModel([
        submitBriefing('Turnout was 44.8% and the DA holds 31%.', [
          { claim: 'PR-ballot turnout 44.8%', kind: 'sourced', citation: 'IEC NW405 2021 results' },
        ]),
      ]),
    });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('undeclared'));
    expect(r.errors.join(' ')).toMatch(/not declared as claims — 31%/);
    expect(r.briefingOutput).toBeNull();
  });

  it('passes a briefing whose every figure is declared and sound', async () => {
    const graph = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: scriptedModel([
        submitBriefing('Turnout was 44.8%. If the ANC gains a 3% swing, it holds the council.', [
          { claim: 'PR-ballot turnout 44.8%', kind: 'sourced', citation: 'IEC NW405 2021 results' },
          { claim: 'a 3% swing to the ANC', kind: 'user_assumption', citation: null },
        ]),
      ]),
    });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('declared'));
    expect(r.errors).toEqual([]);
    expect(r.briefingOutput).toMatch(/^Turnout was 44.8%/);
    expect(r.claims).toHaveLength(2);
  });

  it('never ships free text: a plain reply with no submission fails closed', async () => {
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: scriptedModel([new AIMessage('Trust me.')]) });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('free-text'));
    expect(r.errors.join(' ')).toMatch(/No briefing was submitted/);
    expect(r.briefingOutput).toBeNull();
  });

  it('never ships an array-content reply either (the old empty-briefing path)', async () => {
    const arrayReply = new AIMessage({ content: [{ type: 'text', text: 'Block content.' }] });
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: scriptedModel([arrayReply]) });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('array'));
    expect(r.briefingOutput).toBeNull();
    expect(r.errors.join(' ')).toMatch(/No briefing was submitted/);
  });

  it('rejects a malformed submission', async () => {
    const bad = new AIMessage({ content: '', tool_calls: [{ name: 'submit_briefing', args: { briefing: 'x' }, id: 's' }] });
    const graph = buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model: scriptedModel([bad]) });
    const r = await graph.invoke({ messages: [new HumanMessage('brief me')] }, cfg('malformed'));
    expect(r.errors.join(' ')).toMatch(/did not match the submit_briefing schema/);
    expect(r.briefingOutput).toBeNull();
  });

  it('prepends the system prompt to every model call without storing it', async () => {
    const seen: BaseMessage[][] = [];
    const model: AgentModel = {
      bindTools: (tools) => {
        expect(tools.map((t: { name: string }) => t.name)).toContain('submit_briefing');
        return { invoke: async (m: BaseMessage[]) => (seen.push(m), submitBriefing('ok')) };
      },
    };
    const r = await buildCampaignDirectorGraph({ checkpointer: new MemorySaver(), model }).invoke(
      { messages: [new HumanMessage('brief me')] },
      cfg('system'),
    );
    expect(seen[0][0]._getType()).toBe('system');
    expect(r.messages.some((m) => m._getType() === 'system')).toBe(false);
  });

  it('reserves the cost before every model call, and a refusal stops the run', async () => {
    let reserved = 0;
    const model = scriptedModel([toolCall('get_war_room_counters'), submitBriefing('done')]);
    const ok = await buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model,
      deps: { reserveModelCall: async () => void (reserved += 1) },
    }).invoke({ messages: [new HumanMessage('brief me')] }, cfg('meter'));
    expect(reserved).toBe(2);
    expect(ok.briefingOutput).toBe('done');

    let called = false;
    const refused = buildCampaignDirectorGraph({
      checkpointer: new MemorySaver(),
      model: { bindTools: () => ({ invoke: async () => ((called = true), submitBriefing('x')) }) },
      deps: { reserveModelCall: async () => { throw Object.assign(new Error('ceiling'), { name: 'CostGuardError' }); } },
    }).invoke({ messages: [new HumanMessage('brief me')] }, cfg('meter-refused'));
    await expect(refused).rejects.toThrow(/ceiling/);
    expect(called).toBe(false); // the model was never called
  });
});

describe('tool loop', () => {
  it('runs a requested tool, feeds the result back, and finishes with a briefing', async () => {
    const model = scriptedModel([toolCall('get_war_room_counters'), submitBriefing('Final briefing: 5 voters captured.')]);
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
    // Ends with a clear error and no briefing, not a 200 with an empty one…
    expect(r.errors.join(' ')).toMatch(/iteration budget \(8\) ran out/);
    expect(r.briefingOutput).toBeNull();
    // …and the last tool call is answered, so a durable thread stays valid.
    const last = r.messages[r.messages.length - 1];
    expect(last._getType()).toBe('tool');
    expect(String(last.content)).toMatch(/Not run: the iteration budget/);
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
