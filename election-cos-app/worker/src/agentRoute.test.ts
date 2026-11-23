// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { AGENT_REQUIRED_CAP, MAX_PROMPT_CHARS, handleCampaignDirector, mfaSatisfied, type AgentToken } from './agentRoute';
import type { RunAgentResult } from '../../functions/src/agents/campaignDirector/runAgent';

const NOW = 1_800_000_000;
const okToken: AgentToken = { uid: 'u1', tenantId: 'jb-marks', caps: [AGENT_REQUIRED_CAP], mfaRequired: false };
const okResult: RunAgentResult = {
  ok: true,
  briefing: 'b',
  errors: [],
  iterationCount: 1,
  approvalStatus: 'pending',
  pendingApproval: null,
};
const stubRun = (result: RunAgentResult = okResult) => vi.fn(async () => result);

describe('mfaSatisfied — the rules’ mfaOK(), absent = required', () => {
  it('passes when the second factor is not required', () => {
    expect(mfaSatisfied({ uid: 'u', mfaRequired: false }, NOW)).toBe(true);
  });
  it('passes while a passed second factor is still valid', () => {
    expect(mfaSatisfied({ uid: 'u', mfaRequired: true, mfaUntil: NOW + 60 }, NOW)).toBe(true);
  });
  it('fails closed when mfaRequired is absent, expired, or malformed', () => {
    expect(mfaSatisfied({ uid: 'u' }, NOW)).toBe(false);
    expect(mfaSatisfied({ uid: 'u', mfaRequired: true, mfaUntil: NOW - 1 }, NOW)).toBe(false);
    expect(mfaSatisfied({ uid: 'u', mfaRequired: 'false', mfaUntil: 'soon' }, NOW)).toBe(false);
  });
});

describe('handleCampaignDirector — gates', () => {
  it('refuses an account with no tenant claim, without running anything', async () => {
    const run = stubRun();
    const r = await handleCampaignDirector({ uid: 'u1', caps: [AGENT_REQUIRED_CAP], mfaRequired: false }, { threadId: 't' }, { nowSec: NOW, run });
    expect(r.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses when the second factor is required and not passed', async () => {
    const run = stubRun();
    const r = await handleCampaignDirector({ ...okToken, mfaRequired: undefined }, { threadId: 't' }, { nowSec: NOW, run });
    expect(r.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses without the warroom.view capability', async () => {
    const run = stubRun();
    const r = await handleCampaignDirector({ ...okToken, caps: ['voters.view'] }, { threadId: 't' }, { nowSec: NOW, run });
    expect(r.status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });

  it('uses the tenant from the TOKEN and ignores a tenantId in the body', async () => {
    const run = stubRun();
    await handleCampaignDirector(okToken, { threadId: 't', tenantId: 'someone-else' }, { nowSec: NOW, run });
    expect(run).toHaveBeenCalledTimes(1);
    const [ctx] = run.mock.calls[0] as unknown as [{ tenantId: string }];
    expect(ctx.tenantId).toBe('jb-marks');
  });
});

describe('handleCampaignDirector — body validation', () => {
  const call = (body: Record<string, unknown>) =>
    handleCampaignDirector(okToken, body, { nowSec: NOW, run: stubRun() });

  it('requires a well-formed threadId', async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ threadId: '' })).status).toBe(400);
    expect((await call({ threadId: 'a/b' })).status).toBe(400);
    expect((await call({ threadId: 'x'.repeat(65) })).status).toBe(400);
  });
  it('bounds the prompt', async () => {
    expect((await call({ threadId: 't', prompt: 42 })).status).toBe(400);
    expect((await call({ threadId: 't', prompt: 'x'.repeat(MAX_PROMPT_CHARS + 1) })).status).toBe(400);
    expect((await call({ threadId: 't', prompt: 'x'.repeat(MAX_PROMPT_CHARS) })).status).toBe(200);
  });
  it('checks the municipality code shape', async () => {
    expect((await call({ threadId: 't', municipalityCode: 'nw405' })).status).toBe(400);
    expect((await call({ threadId: 't', municipalityCode: 'NW405' })).status).toBe(200);
  });
  it('checks the resume decision shape', async () => {
    expect((await call({ threadId: 't', resumeDecision: { approved: 'yes' } })).status).toBe(400);
    expect((await call({ threadId: 't', resumeDecision: null })).status).toBe(400);
  });
});

describe('handleCampaignDirector — outcomes', () => {
  it('returns the run summary on success and passes the deps through', async () => {
    const run = stubRun();
    const r = await handleCampaignDirector(okToken, { threadId: 't', prompt: 'brief' }, { nowSec: NOW, run, apiKey: 'k' });
    expect(r).toEqual({ status: 200, body: okResult });
    const [, req, deps] = run.mock.calls[0] as unknown as [unknown, { prompt: string }, { apiKey: string }];
    expect(req.prompt).toBe('brief');
    expect(deps.apiKey).toBe('k');
  });
  it('maps a missing model to 503 (refuses rather than fabricates)', async () => {
    const r = await handleCampaignDirector(okToken, { threadId: 't' }, {
      nowSec: NOW,
      run: stubRun({ ok: false, reason: 'model-not-configured' }),
    });
    expect(r.status).toBe(503);
  });
  it('maps a resume without a durable checkpointer to 501', async () => {
    const r = await handleCampaignDirector(okToken, { threadId: 't', resumeDecision: { approved: true } }, {
      nowSec: NOW,
      run: stubRun({ ok: false, reason: 'resume-requires-durable-checkpointer' }),
    });
    expect(r.status).toBe(501);
  });
});
