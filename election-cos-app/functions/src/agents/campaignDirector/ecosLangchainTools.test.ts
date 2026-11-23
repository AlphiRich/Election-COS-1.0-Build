import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { buildEcosTools, firestoreCounterReader } from './ecosLangchainTools';

const config = { configurable: { harnessContext: { tenantId: 'jb-marks', uid: 'u1', capabilities: [] } } };

describe('buildEcosTools', () => {
  it('exposes the three ECOS tools by name', () => {
    const names = buildEcosTools(async () => ({})).map((t) => t.name);
    expect(names).toEqual(['get_war_room_counters', 'get_certified_baseline', 'run_schedule1_scenario']);
  });

  it('get_war_room_counters reads via the injected reader, scoped to the config tenant', async () => {
    const [warRoom] = buildEcosTools(async (tenantId) => ({ votersCaptured: tenantId === 'jb-marks' ? 7 : 0 }));
    const out = await warRoom.invoke({ ward_ids: [] }, config);
    expect(String(out)).toContain('votersCaptured');
    expect(JSON.parse(String(out))).toEqual({ tenantId: 'jb-marks', wardIds: [], counters: { votersCaptured: 7 } });
  });

  it('the baseline and scenario tools serve real figures and refuse what they do not hold', async () => {
    const [, baseline, scenario] = buildEcosTools(async () => ({}));
    // Real NW405 2021 baseline through the mirrored Schedule 1 engine.
    const ok = JSON.parse(String(await baseline.invoke({ municipality_code: 'NW405', election_year: '2021' }, config)));
    expect(ok.municipality_code).toBe('NW405');
    expect(ok.quota).toBeGreaterThan(0);
    // Real certified 2026 result for an NW local.
    const ok2026 = JSON.parse(String(await baseline.invoke({ municipality_code: 'NW403', election_year: '2026' }, config)));
    expect(ok2026.election_year).toBe('2026');
    // A code this runtime does not hold → refuses.
    expect(String(await baseline.invoke({ municipality_code: 'NW999', election_year: '2026' }, config))).toMatch(/refuses|No certified/i);
    // Scenario runs and carries the user-assumption provenance.
    const scen = JSON.parse(
      String(
        await scenario.invoke(
          { municipality_code: 'NW405', seed: 1, turnout_delta_pct: 0, party_swings_pct: {}, assumption_acknowledged_by_user: true },
          config,
        ),
      ),
    );
    expect(scen.provenance).toBe('user_assumption_propagated_via_schedule1');
  });
});

describe('firestoreCounterReader', () => {
  const fakeDb = (snap: { exists: boolean; data?: () => Record<string, unknown> }): Firestore =>
    ({ doc: () => ({ get: async () => snap }) }) as unknown as Firestore;

  it('returns only the numeric fields of the warRoom counter doc', async () => {
    const reader = firestoreCounterReader(fakeDb({ exists: true, data: () => ({ votersCaptured: 3, label: 'x', openIncidents: 1 }) }));
    expect(await reader('jb-marks', [])).toEqual({ votersCaptured: 3, openIncidents: 1 });
  });

  it('returns an honest empty object when the doc does not exist', async () => {
    const reader = firestoreCounterReader(fakeDb({ exists: false }));
    expect(await reader('jb-marks', [])).toEqual({});
  });
});
