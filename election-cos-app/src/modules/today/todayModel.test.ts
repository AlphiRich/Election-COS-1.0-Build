import { describe, expect, it } from 'vitest';
import { council } from '@/modules/lge2026/nationalResults';
import type { WardLine } from '@/modules/lge2026/voterIntelligence';
import { SEED_ROLES } from '@/auth/seedRoles';
import { fieldActions, holderKey, scopedWardNumber, seatDots, wardsToWatch } from './todayModel';

const ward = (n: number, margin: number): WardLine => ({
  ward: n,
  leader: 'A',
  leaderShare: 50,
  runnerUp: 'B',
  margin,
  tier: 'Comfortable',
  registered: 1000,
  valid: 600,
});

describe('seatDots', () => {
  it('draws one dot per certified seat, grouped by holder, for JB Marks', () => {
    const c = council('NW405');
    const dots = seatDots(c.holders);
    expect(dots).toHaveLength(c.councillors);
    expect(dots).toHaveLength(67);
    const key = holderKey(c.holders);
    for (const h of key) expect(dots.filter((d) => d.holderId === h.id), h.name).toHaveLength(h.seats);
    // A holder's seats are one contiguous run, so a party reads as one block.
    const runs = dots.map((d) => d.holderId).filter((id, i, a) => id !== a[i - 1]);
    expect(runs).toHaveLength(key.length);
  });

  it('keeps every dot inside the 300 x 160 chart for a large metro too', () => {
    const big = council('JHB');
    const dots = seatDots(big.holders);
    expect(dots).toHaveLength(big.councillors);
    expect(dots.every((d) => d.cx >= 0 && d.cx <= 300 && d.cy >= 0 && d.cy <= 160)).toBe(true);
  });

  it('gives the six largest holders the chart series and folds the rest into one neutral slot', () => {
    const key = holderKey(council('NW405').holders);
    expect(key.slice(0, 6).map((h) => h.slot)).toEqual(['viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5', 'viz-6']);
    expect(key.slice(6).every((h) => h.slot === 'other')).toBe(true);
  });
});

describe('scopedWardNumber', () => {
  it('reads both ward scope formats the build stores', () => {
    expect(scopedWardNumber({ wardScope: 'NW405-W12' }, 'NW405')).toBe(12);
    expect(scopedWardNumber({ wardScope: 'NW405012' }, 'NW405')).toBe(12);
    expect(scopedWardNumber({ wardScope: undefined }, 'NW405')).toBeNull();
  });
});

describe('wardsToWatch', () => {
  const wards = [ward(1, 30), ward(2, 2.5), ward(3, 11), ward(4, 0.4), ward(12, 18)];

  it('shows a ward lead their own ward', () => {
    const w = wardsToWatch(wards, { geoScope: 'WARD', wardScope: 'NW405-W12' }, 'NW405');
    expect(w.own).toBe(true);
    expect(w.wards.map((x) => x.ward)).toEqual([12]);
  });

  it('shows everyone else the closest races, smallest lead first', () => {
    const w = wardsToWatch(wards, { geoScope: 'MUNICIPALITY' }, 'NW405');
    expect(w.own).toBe(false);
    expect(w.wards.map((x) => x.ward)).toEqual([4, 2, 3]);
  });

  it('falls back to the closest races when the scoped ward is not in the results', () => {
    expect(wardsToWatch(wards, { geoScope: 'WARD', wardScope: 'NW405-W99' }, 'NW405').own).toBe(false);
  });
});

describe('fieldActions', () => {
  const capsOf = (id: string) => SEED_ROLES.find((r) => r.id === id)!.defaultCaps;

  it('gives a canvasser the round, the roll, an incident report and the diary', () => {
    expect(fieldActions(capsOf('canvasser')).map((a) => a.route)).toEqual(['/round', '/roll', '/incidents/new', '/diary']);
  });

  it('offers nothing a role cannot open', () => {
    const finance = fieldActions(capsOf('finance-officer'));
    expect(finance).toEqual([]);
  });

  it('makes exactly one action the primary one when there is any', () => {
    for (const r of SEED_ROLES) {
      const a = fieldActions(r.defaultCaps);
      expect(a.filter((x) => x.primary).length, r.id).toBe(a.length ? (a[0].primary ? 1 : 0) : 0);
    }
  });
});
