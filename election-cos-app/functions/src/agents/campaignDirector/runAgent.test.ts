import { describe, expect, it, vi } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { AIMessage, type BaseMessage } from '@langchain/core/messages';
import { runAgent } from './runAgent';
import type { AgentModel } from './agentModel';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view'] };

function scriptedModel(replies: BaseMessage[]): AgentModel {
  let i = 0;
  return { bindTools: () => ({ invoke: async () => replies[Math.min(i++, replies.length - 1)] }) };
}

describe('runAgent', () => {
  it('runs the graph and returns a JSON-safe summary', async () => {
    const r = await runAgent(ctx, { threadId: 't1', prompt: 'brief me' }, {
      model: scriptedModel([new AIMessage('Briefing: steady.')]),
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
          new AIMessage('Nine voters captured.'),
        ]),
        counterReader,
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
      ctx,
      { threadId: 't4', resumeDecision: { approved: true } },
      { model: scriptedModel([new AIMessage('x')]) },
    );
    expect(r).toEqual({ ok: false, reason: 'resume-requires-durable-checkpointer' });
  });

  it('accepts a resume when a checkpointer is supplied', async () => {
    // A fresh saver holds no paused run, so the resume is a no-op — but it is
    // attempted, not refused, because the caller supplied durable state.
    const r = await runAgent(
      ctx,
      { threadId: 't5', resumeDecision: { approved: false } },
      { model: scriptedModel([new AIMessage('x')]), checkpointer: new MemorySaver() },
    );
    expect(r.ok).toBe(true);
  });
});
