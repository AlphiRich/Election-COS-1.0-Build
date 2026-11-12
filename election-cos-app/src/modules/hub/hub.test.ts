import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { allocateSeats } from '@/modules/analytics/seatCalculator';
import { seatInput } from '@/modules/lge2026/lge2026Results';
import { ASSETS, CHANGES_FROM_MASTER, CHANNELS, DISCIPLINE, DNS_OBSERVED, DNS_SPECIFIED, FUNNEL, LEGAL_DOCS, SCRIPTS } from './hubData';
import { HUB_AGENTS } from './hubAgents';
import { agentState, agentSummary, clock, disciplineSummary, evaluateFunding, filterAssets, outboxRun, promptedBlock, quotaFor, searchAgents } from './hubLogic';

describe('the quota calculator', () => {
  it('is Item 12: floor(A / (B - C - D)) + 1, and 2021 and 2026 JB Marks give the Commission’s quotas', () => {
    expect(quotaFor(101439, 67, 0, 0)).toBe(1515);
    expect(quotaFor(138568, 67, 0, 0)).toBe(2069);
    expect(quotaFor(242845, 82, 1, 0)).toBe(2999); // Madibeng 2026, one independent
  });
  it('agrees with the engine for every input it is given', () => {
    for (const [a, b, c, d] of [[100000, 67, 0, 0], [87654, 50, 3, 1], [5000, 10, 0, 2]]) {
      expect(quotaFor(a, b, c, d)).toBe(allocateSeats({ totalValidVotes: a, totalSeats: b, independentWardSeats: c, noPRListWardSeats: d, parties: [{ id: 'X', name: 'X', votes: a, wardSeatsWon: 0 }] }).quota);
    }
  });
  it('says ERR (null) when nothing is left to divide by, rather than a number', () => {
    expect(quotaFor(1000, 5, 3, 2)).toBeNull();
    expect(quotaFor(1000, 5, 6, 0)).toBeNull();
  });
  it('computes JB Marks 2026 from the ingested ballots', () => {
    const i = seatInput('NW405');
    expect(quotaFor(i.totalValidVotes, i.totalSeats, i.independentWardSeats, i.noPRListWardSeats)).toBe(2069);
  });
});

describe('the funding position', () => {
  it('uses the gazetted lines (R200,000 and R30 million), not the master stack’s R80k and R15M', () => {
    expect(evaluateFunding(150_000).band).toBe('BELOW_WARNING');
    expect(evaluateFunding(170_000).band).toBe('NEAR_DISCLOSURE');
    expect(evaluateFunding(200_000).band).toBe('AT_OR_ABOVE_DISCLOSURE');
    expect(evaluateFunding(30_000_001).band).toBe('ABOVE_ANNUAL_CAP');
  });
  it('never says compliant, lawful or valid', () => {
    for (const r of [10_000, 170_000, 250_000, 40_000_000]) expect(evaluateFunding(r).description).not.toMatch(/compliant|lawful|valid|permitted/i);
  });
});

describe('catalogue and filters', () => {
  it('lists all 32 agents once each, with a state for every one', () => {
    expect(HUB_AGENTS).toHaveLength(32);
    expect(new Set(HUB_AGENTS.map((a) => a.id)).size).toBe(32);
    for (const a of HUB_AGENTS) { expect(a.build.length, a.name).toBeGreaterThan(5); expect(a.status.length, a.name).toBeGreaterThan(2); }
    const s = agentSummary();
    expect(Object.values(s).reduce((x, y) => x + y, 0)).toBe(32);
    expect(s.built).toBeGreaterThan(10);
    expect(agentState({ status: 'not built' })).toBe('not-built');
    expect(agentState({ status: 'by design' })).toBe('by-design');
  });
  it('names the master stack’s 18 as it names them', () => {
    expect(HUB_AGENTS.slice(0, 18).map((a) => a.name)).toEqual(['OFFLINE_SYNC_SENTINEL', 'MEDIA_COMPRESSION_AGENT', 'FIELD_CONTEXT_GUARD', 'OFFLINE_CONSENT_VALIDATOR', 'TENANT_CONTEXT_AGENT', 'SYNC_THROTTLE_AGENT', 'POPIA_MASKING_AGENT', 'SOFT_DELETE_AGENT', 'LWW_RECONCILIATION_AGENT', 'DOCUMENT_VAULT_AGENT', 'SIMULATION_ORCHESTRATOR', 'RLS_SESSION_GUARDIAN', 'POPIA_CONSENT_TRIGGER', 'INDEX_HEALTH_AGENT', 'RLS_AUDIT_AGENT', 'QUOTA_FORMULA_GUARDIAN', 'PGA_EVENT_AUDITOR', 'PPFA_AGGREGATOR']);
  });
  it('searches by name, tier, description and status, case-insensitively', () => {
    expect(searchAgents('quota').some((a) => a.name === 'QUOTA_FORMULA_GUARDIAN')).toBe(true);
    expect(searchAgents('POPIA').length).toBeGreaterThanOrEqual(3);
    expect(searchAgents('zzzzqq')).toEqual([]);
    expect(searchAgents('')).toHaveLength(32);
  });
  it('filters assets by category and keeps all seven under "all"', () => {
    expect(ASSETS).toHaveLength(7);
    expect(filterAssets('all')).toHaveLength(7);
    expect(filterAssets('digital').map((a) => a.id)).toEqual([1, 2]);
    expect(filterAssets('print')).toHaveLength(2);
    expect(filterAssets('video')).toHaveLength(3);
  });
  it('every file the hub says is built exists in the repository, and each built asset says what is open or that nothing is', () => {
    for (const a of ASSETS) {
      for (const f of a.built?.files ?? []) expect(existsSync(path.resolve(__dirname, '../../..', f)), `${a.name}: ${f}`).toBe(true);
    }
    expect(ASSETS.filter((a) => a.built === null).map((a) => a.id)).toEqual([5, 6]); // the two videos that need voice and footage
    expect(ASSETS.find((a) => a.id === 1)!.built!.flag).toMatch(/no free trial/);
    expect(ASSETS.find((a) => a.id === 7)!.built!.flag).toMatch(/not verified/);
  });
});

describe('teleprompter and outbox', () => {
  it('lights a block every 2.5 seconds and stops after the last', () => {
    expect(promptedBlock('30s', 0)).toBe(0);
    expect(promptedBlock('30s', 2499)).toBe(0);
    expect(promptedBlock('30s', 2500)).toBe(1);
    expect(promptedBlock('30s', 4 * 2500)).toBeNull();
    expect(SCRIPTS['15s'].blocks).toHaveLength(3);
    expect(clock(65_000)).toBe('01:05');
  });
  it('runs the happy path through the real state machine and no other order', () => {
    expect(outboxRun().map((s) => s.status)).toEqual(['PENDING', 'IN_FLIGHT', 'APPLIED']);
  });
});

describe('what the master stack said and this build says', () => {
  it('records every change, each with a reason', () => {
    expect(CHANGES_FROM_MASTER.length).toBeGreaterThanOrEqual(14);
    for (const c of CHANGES_FROM_MASTER) { expect(c.why.length, c.where).toBeGreaterThan(15); expect(c.here.length).toBeGreaterThan(5); }
  });
  it('258 municipalities and 4,488 wards are the register’s own sums', () => {
    expect(REGISTER_ENTRIES.length).toBe(258);
    expect(REGISTER_ENTRIES.reduce((s, m) => s + (m.wards ?? 0), 0)).toBe(4488);
  });
  it('does not claim the legal documents are published, or that 13 of 13 rules passed', () => {
    for (const d of LEGAL_DOCS) expect(d.status).not.toMatch(/published & active|v1\.0\.0/i);
    expect(LEGAL_DOCS.find((d) => d.id === 'paia')!.status).toMatch(/Not drafted/);
    const s = disciplineSummary();
    expect(s.enforced + s.process + s.partial).toBe(13);
    expect(DISCIPLINE.every((r) => r.evidence.length > 10)).toBe(true);
  });
  it('holds the master stack’s DNS specification beside what was observed, and flags the two differences', () => {
    expect(DNS_SPECIFIED).toHaveLength(4);
    expect(DNS_OBSERVED.rows.filter((r) => !r.matches).map((r) => r.type)).toEqual(['app', 'TXT']);
    const spf = DNS_OBSERVED.rows.find((r) => r.type === 'TXT')!;
    expect(spf.note).toMatch(/Do NOT replace/);
  });
  it('keeps the marketing numbers as targets and never as results, and the copy off "predictive"', () => {
    expect(CHANNELS).toHaveLength(4);
    expect(JSON.stringify(FUNNEL)).not.toMatch(/predictive/i);
    expect(FUNNEL.bofu.kpi).toMatch(/target/i);
  });
  it('has no raw colour literal in its own source apart from the Canva prompt, which quotes the brand colours as text', () => {
    const dir = path.resolve(__dirname);
    for (const f of ['hubLogic.ts', 'hubAgents.ts']) expect(readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/#[0-9A-Fa-f]{6}\b/);
  });
});
