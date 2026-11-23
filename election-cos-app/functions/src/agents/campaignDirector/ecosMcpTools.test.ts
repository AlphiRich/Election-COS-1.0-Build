import { describe, expect, it, vi } from 'vitest';
import {
  getCertifiedBaselineTool,
  getWarRoomCountersTool,
  runSchedule1ScenarioTool,
  type CounterReader,
} from './ecosMcpTools';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view'] };
const body = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe('get_certified_baseline — real engine, fail closed on what it does not hold', () => {
  it('returns the certified NW405 2021 allocation (ANC plurality) through the real quota', () => {
    const b = body(getCertifiedBaselineTool({ municipality_code: 'NW405', election_year: '2021' }));
    expect(b.municipality_code).toBe('NW405');
    expect(b.election_year).toBe('2021');
    expect(b.totalValidVotes).toBe(101439);
    const anc = b.parties.find((p: { id: string }) => p.id === 'ANC');
    const maxSeats = Math.max(...b.parties.map((p: { totalSeats: number }) => p.totalSeats));
    expect(anc.totalSeats).toBe(maxSeats);
    for (const p of b.parties) expect(p.totalSeats).toBe(p.wardSeats + p.prSeats);
  });

  it('serves a certified 2026 result for an NW local (the default year)', () => {
    const r = getCertifiedBaselineTool({ municipality_code: 'NW405' });
    expect(r.isError).toBeFalsy();
    const b = body(r);
    expect(b.election_year).toBe('2026');
    expect(b.quota).toBeGreaterThan(0);
    expect(b.parties.reduce((s: number, p: { totalSeats: number }) => s + p.totalSeats, 0)).toBeGreaterThan(0);
  });

  it('serves 2026 for a different NW local municipality', () => {
    expect(getCertifiedBaselineTool({ municipality_code: 'NW403', election_year: '2026' }).isError).toBeFalsy();
  });

  it('refuses a municipality it does not hold', () => {
    expect(getCertifiedBaselineTool({ municipality_code: 'NW999', election_year: '2026' }).isError).toBe(true);
    expect(getCertifiedBaselineTool({ municipality_code: 'NW403', election_year: '2021' }).isError).toBe(true); // 2021 is NW405 only
  });
});

describe('run_schedule1_scenario — real quota on a labelled user assumption', () => {
  it('a zero swing reproduces the certified baseline seats (same year)', () => {
    const base = body(getCertifiedBaselineTool({ municipality_code: 'NW405', election_year: '2021' }));
    const scen = body(
      runSchedule1ScenarioTool({
        municipality_code: 'NW405',
        election_year: '2021',
        seed: 1,
        turnout_delta_pct: 0,
        party_swings_pct: {},
        assumption_acknowledged_by_user: true,
      }),
    );
    const seatVec = (b: { parties: { id: string; totalSeats: number }[] }) =>
      Object.fromEntries(b.parties.map((p) => [p.id, p.totalSeats]));
    expect(seatVec(scen)).toEqual(seatVec(base));
    expect(scen.provenance).toBe('user_assumption_propagated_via_schedule1');
  });

  it('defaults to the 2026 baseline and propagates a swing through the quota', () => {
    const r = runSchedule1ScenarioTool({
      municipality_code: 'NW405',
      seed: 7,
      turnout_delta_pct: 5,
      party_swings_pct: { EFF: 50 },
      assumption_acknowledged_by_user: true,
    });
    expect(r.isError).toBeFalsy();
    const b = body(r);
    expect(b.election_year).toBe('2026');
    expect(b.quota).toBeGreaterThan(0);
  });

  it('refuses without the user assumption acknowledgement', () => {
    const r = runSchedule1ScenarioTool({ municipality_code: 'NW405', assumption_acknowledged_by_user: false });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/assumption/i);
  });

  it('refuses a municipality it does not hold', () => {
    expect(
      runSchedule1ScenarioTool({ municipality_code: 'NW999', assumption_acknowledged_by_user: true }).isError,
    ).toBe(true);
  });
});

describe('get_war_room_counters — real read, tenant-scoped, honest empty state', () => {
  it('passes only the caller tenant to the reader and returns its counters', async () => {
    const reader = vi.fn<CounterReader>(async () => ({ votersCaptured: 12, openIncidents: 3 }));
    const r = await getWarRoomCountersTool(ctx, reader, ['NW405-W1']);
    expect(reader).toHaveBeenCalledWith('jb-marks', ['NW405-W1']);
    const out = JSON.parse(r.content[0].text);
    expect(out).toMatchObject({ tenantId: 'jb-marks', scope: 'tenant', counters: { votersCaptured: 12, openIncidents: 3 } });
    // Tenant-wide totals are never labelled with the wards that were asked for.
    expect(out.wardIds).toBeUndefined();
    expect(out.note).toMatch(/tenant-wide totals, not figures for NW405-W1/);
  });

  it('adds no ward note when no wards were asked for', async () => {
    const r = await getWarRoomCountersTool(ctx, async () => ({ votersCaptured: 1 }));
    expect(JSON.parse(r.content[0].text)).toEqual({ tenantId: 'jb-marks', scope: 'tenant', counters: { votersCaptured: 1 } });
  });

  it('reports an empty counter set as-is, never interpolated', async () => {
    const reader: CounterReader = async () => ({});
    const r = await getWarRoomCountersTool(ctx, reader);
    expect(JSON.parse(r.content[0].text).counters).toEqual({});
  });
});
