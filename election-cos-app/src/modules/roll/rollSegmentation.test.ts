import { describe, expect, it } from 'vitest';
import type { RollAddress } from '@/dal/ports/roll';
import type { SessionContext } from '@/dal/ports/session';
import {
  CONCENTRATION_MIN,
  SMALL_CELL,
  SegmentationRefused,
  assertCanSegment,
  segmentRoll,
  segmentRollFor,
  segmentationCsv,
} from './rollSegmentation';

const EDITION = '2026-11';

function ctx(over: Partial<SessionContext> = {}): SessionContext {
  return {
    tenantId: 't1',
    uid: 'u1',
    caps: ['roll.view', 'roll.segment'],
    geoScope: 'TENANT',
    mfaRequired: false,
    ...over,
  };
}

function addr(over: Partial<RollAddress> & Pick<RollAddress, 'id' | 'wardCode' | 'vdCode' | 'voterCount'>): RollAddress {
  return {
    rollEdition: EDITION,
    addressRaw: `addr-${over.id}`,
    ...over,
  };
}

describe('assertCanSegment — the three guardrails', () => {
  it('refuses a caller without roll.segment', () => {
    try {
      assertCanSegment(ctx({ caps: ['roll.view'] }));
      throw new Error('should have refused');
    } catch (e) {
      expect(e).toBeInstanceOf(SegmentationRefused);
      expect((e as SegmentationRefused).reason).toBe('NO_CAPABILITY');
    }
  });

  it('refuses a ward- or VD-scoped caller even with the capability', () => {
    for (const geoScope of ['WARD', 'VD'] as const) {
      try {
        assertCanSegment(ctx({ geoScope, wardScope: 'NW405-W01', vdScope: '64005001' }));
        throw new Error('should have refused');
      } catch (e) {
        expect((e as SegmentationRefused).reason).toBe('SCOPE_TOO_NARROW');
      }
    }
  });

  it('refuses when the second factor has not been passed', () => {
    // mfaRequired absent + no mfaUntil = fail closed.
    try {
      assertCanSegment(ctx({ mfaRequired: undefined }));
      throw new Error('should have refused');
    } catch (e) {
      expect((e as SegmentationRefused).reason).toBe('SECOND_FACTOR');
    }
    // A stale mfaUntil is also refused.
    expect(() => assertCanSegment(ctx({ mfaRequired: undefined, mfaUntil: 1000 }), 5_000_000)).toThrow(
      SegmentationRefused,
    );
  });

  it('allows a TENANT caller who holds the cap and a live second factor', () => {
    expect(() => assertCanSegment(ctx({ mfaRequired: undefined, mfaUntil: 9_999 }), 1_000_000)).not.toThrow();
    expect(() => assertCanSegment(ctx({ geoScope: 'MUNICIPALITY' }))).not.toThrow();
  });
});

describe('segmentRoll — aggregates only', () => {
  const addresses: RollAddress[] = [
    addr({ id: 'a1', wardCode: 'NW405-W01', vdCode: '64005001', voterCount: 3 }),
    addr({ id: 'a2', wardCode: 'NW405-W01', vdCode: '64005001', voterCount: 1 }),
    addr({ id: 'a3', wardCode: 'NW405-W01', vdCode: '64005002', voterCount: 40 }),
    addr({ id: 'a4', wardCode: 'NW405-W02', vdCode: '64005010', voterCount: 7 }),
    // An old edition — must be dropped.
    addr({ id: 'old', wardCode: 'NW405-W02', vdCode: '64005010', voterCount: 99, rollEdition: '2021-11' }),
  ];

  it('totals only the active edition', () => {
    const s = segmentRoll(addresses, EDITION);
    expect(s.totals.addresses).toBe(4);
    expect(s.totals.voters).toBe(3 + 1 + 40 + 7);
    expect(s.totals.wards).toBe(2);
    expect(s.totals.vds).toBe(3);
  });

  it('groups by ward, biggest first, with voters-per-address', () => {
    const s = segmentRoll(addresses, EDITION);
    expect(s.byWard.map((w) => w.wardCode)).toEqual(['NW405-W01', 'NW405-W02']);
    const w1 = s.byWard[0];
    expect(w1.voters).toBe(44);
    expect(w1.addresses).toBe(3);
    expect(w1.votersPerAddress).toBeCloseTo(44 / 3, 2);
  });

  it('bands addresses by density and names concentrated sites only at/above the floor', () => {
    const s = segmentRoll(addresses, EDITION);
    const single = s.density.find((d) => d.minVoters === 1 && d.maxVoters === 1)!;
    expect(single.addresses).toBe(1); // a2
    const top = s.density.find((d) => d.maxVoters === null)!;
    expect(top.addresses).toBe(1); // a3 (40)
    expect(s.concentratedAddresses).toHaveLength(1);
    expect(s.concentratedAddresses[0].voterCount).toBe(40);
    // Never lists an address below the floor.
    expect(s.concentratedAddresses.every((a) => a.voterCount >= CONCENTRATION_MIN)).toBe(true);
  });
});

describe('small-cell suppression', () => {
  it('withholds a ward/VD below the floor and counts it, never zero-fills it', () => {
    const addresses: RollAddress[] = [
      addr({ id: 'big', wardCode: 'W-BIG', vdCode: 'VD1', voterCount: 50 }),
      addr({ id: 'tiny', wardCode: 'W-TINY', vdCode: 'VD9', voterCount: SMALL_CELL - 1 }),
    ];
    const s = segmentRoll(addresses, EDITION);
    expect(s.byWard.map((w) => w.wardCode)).toEqual(['W-BIG']);
    expect(s.byVd.map((v) => v.vdCode)).toEqual(['VD1']);
    // One ward cell + one VD cell withheld.
    expect(s.suppressedCells).toBe(2);
    // The suppressed voters are still in the totals (the count is honest).
    expect(s.totals.voters).toBe(50 + (SMALL_CELL - 1));
  });
});

describe('segmentRollFor — guard before compute, real scope stamped', () => {
  it('refuses to compute for a caller who cannot segment', () => {
    expect(() => segmentRollFor(ctx({ caps: ['roll.view'] }), [], EDITION)).toThrow(SegmentationRefused);
  });
  it('stamps the caller’s own scope, not the placeholder', () => {
    const s = segmentRollFor(ctx({ geoScope: 'MUNICIPALITY' }), [], EDITION);
    expect(s.scope).toBe('MUNICIPALITY');
  });
});

describe('segmentationCsv — formula-safe, no personal data', () => {
  const s = segmentRoll(
    [
      addr({ id: 'a1', wardCode: '=W01', vdCode: '64005001', voterCount: 30 }),
      addr({ id: 'a2', wardCode: 'NW405-W02', vdCode: '64005010', voterCount: 8 }),
    ],
    EDITION,
  );

  it('neutralises a leading = so a ward code cannot run as a formula', () => {
    const csv = segmentationCsv(s);
    expect(csv).toContain(`"'=W01"`);
    expect(csv).not.toContain(`"=W01"`);
  });

  it('carries only counts — no surname, names or masked ID columns', () => {
    const csv = segmentationCsv(s).toLowerCase();
    for (const forbidden of ['surname', 'fullname', 'full name', 'idnumber', 'id number', 'masked']) {
      expect(csv).not.toContain(forbidden);
    }
  });
});
