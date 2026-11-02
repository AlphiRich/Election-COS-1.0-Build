/**
 * Regulation of Gatherings Act notice countdown
 *
 * Proved by injection, each separately, then reverted clean:
 *
 *  - `<` → `<=` at the 48-hour point  → "the 48-hour cliff is strict" fails.
 *  - `<=` → `<` at the seven-day point → "fires AT seven days" fails.
 *  - alertDocId including `Date.now()` → "an alert's identity does not
 *    depend on when it was raised" and the idempotency tests fail.
 *  - dropping the fingerprint          → "two ids that sanitise alike
 *    do not share an alert" fails.
 *  - skipping the LODGED check         → "a lodged notice raises nothing" fails.
 *  - `createIfAbsent` ignoring its result in runRgaSweep → counts fail.
 */
import { describe, expect, it } from 'vitest';
import {
  STAGE_BASIS,
  alertDocId,
  hoursUntil,
  planAlerts,
  runRgaSweep,
  stageFor,
  type AlertStore,
  type GatheringRecord,
  type RgaAlert,
} from './rgaNotice';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 1, 8, 0, 0);

const gathering = (over: Partial<GatheringRecord> = {}): GatheringRecord => ({
  tenantId: 't1',
  id: 'g1',
  title: 'Ward 7 community meeting',
  wardCode: '64005007',
  startsAtMillis: NOW + 100 * HOUR,
  noticeStatus: 'NOT_LODGED',
  deleted: false,
  ...over,
});
const startingInHours = (h: number, over: Partial<GatheringRecord> = {}) =>
  gathering({ startsAtMillis: NOW + h * HOUR, ...over });

/** An atomic in-memory store: `has`-then-`add` is one synchronous step. */
function fakeStore() {
  const docs = new Map<string, RgaAlert>();
  const store: AlertStore = {
    async createIfAbsent(tenantId, docId, alert) {
      const key = `${tenantId}/${docId}`;
      if (docs.has(key)) return false;
      docs.set(key, alert);
      return true;
    },
  };
  return { store, docs };
}

describe('the stage boundaries follow the Act’s wording', () => {
  it('says nothing more than seven days out', () => {
    expect(stageFor(168.01)).toBeNull();
    expect(stageFor(500)).toBeNull();
  });

  it('fires AT seven days, as a last-moment warning, not a late one', () => {
    // "Not later than seven days before": notice at exactly 168h is still
    // in time, so the warning is raised at the point, not after it.
    expect(stageFor(168)).toBe('NOTICE_DUE');
    expect(stageFor(100)).toBe('NOTICE_DUE');
    expect(stageFor(72.01)).toBe('NOTICE_DUE');
  });

  it('the house-policy rung sits between the two statutory points', () => {
    expect(stageFor(72)).toBe('URGENT');
    expect(stageFor(60)).toBe('URGENT');
    expect(stageFor(48)).toBe('URGENT');
  });

  it('the 48-hour cliff is strict: "less than 48 hours"', () => {
    // At exactly 48.0 hours the cliff has not been crossed; a hair under has.
    expect(stageFor(48)).toBe('URGENT');
    expect(stageFor(47.999)).toBe('PROHIBITION_RISK');
    expect(stageFor(1)).toBe('PROHIBITION_RISK');
  });

  it('says nothing once the gathering has begun, or on nonsense', () => {
    expect(stageFor(0)).toBeNull();
    expect(stageFor(-5)).toBeNull();
    expect(stageFor(NaN)).toBeNull();
    expect(stageFor(Infinity)).toBeNull();
  });

  it('labels which rungs are statute and which are house policy', () => {
    expect(STAGE_BASIS).toEqual({
      NOTICE_DUE: 'STATUTE',
      URGENT: 'HOUSE_POLICY',
      PROHIBITION_RISK: 'STATUTE',
    });
  });

  it('measures hours from the clock it is given, not from the wall clock', () => {
    expect(hoursUntil(NOW + 30 * HOUR, NOW)).toBe(30);
  });
});

describe('what raises an alert and what does not', () => {
  it('a lodged notice raises nothing, however close the date', () => {
    expect(planAlerts([startingInHours(10, { noticeStatus: 'LODGED' })], NOW)).toEqual([]);
  });

  it('a deleted gathering raises nothing', () => {
    expect(planAlerts([startingInHours(10, { deleted: true })], NOW)).toEqual([]);
  });

  it('a gathering already begun, or far off, raises nothing', () => {
    expect(planAlerts([startingInHours(-2), startingInHours(400)], NOW)).toEqual([]);
  });

  it('carries severity and basis, so a screen need not re-derive them', () => {
    const [a] = planAlerts([startingInHours(20)], NOW);
    expect(a).toMatchObject({
      stage: 'PROHIBITION_RISK',
      severity: 'CRITICAL',
      basis: 'STATUTE',
      tenantId: 't1',
      gatheringId: 'g1',
      wardCode: '64005007',
    });
    expect(a.hoursToStart).toBe(20);
  });
});

describe('what the alert text claims', () => {
  const textFor = (h: number) => planAlerts([startingInHours(h)], NOW)[0].message;

  it('never says the gathering is lawful or that notice was valid', () => {
    for (const h of [20, 60, 120]) {
      expect(textFor(h)).not.toMatch(/\b(lawful|compliant|valid|accepted|approved|permitted)\b/i);
    }
  });

  it('says the 72-hour rung is not statute', () => {
    expect(textFor(60)).toMatch(/not a statutory deadline/);
  });

  it('names no legal entity, because the product is to be leased on', () => {
    for (const h of [20, 60, 120]) {
      expect(textFor(h)).not.toMatch(/Innovation Consult|Just Be Trading|\(Pty\)/i);
    }
  });

  it('names the person nowhere: only the gathering and its ward', () => {
    const a = planAlerts([startingInHours(20)], NOW)[0];
    expect(Object.keys(a).sort()).toEqual(
      [
        'basis', 'gatheringId', 'hoursToStart', 'message', 'severity',
        'stage', 'tenantId', 'title', 'wardCode',
      ].sort(),
    );
  });
});

describe('an alert’s identity is what it is about, never when it was raised', () => {
  it('is stable across calls', () => {
    expect(alertDocId('g1', 'URGENT')).toBe(alertDocId('g1', 'URGENT'));
  });

  it('differs by stage and by gathering', () => {
    expect(alertDocId('g1', 'URGENT')).not.toBe(alertDocId('g1', 'PROHIBITION_RISK'));
    expect(alertDocId('g1', 'URGENT')).not.toBe(alertDocId('g2', 'URGENT'));
  });

  it('an alert’s identity does not depend on when it was raised', () => {
    const a = alertDocId('g1', 'URGENT');
    const later = Date.now;
    Date.now = () => 1;
    try {
      expect(alertDocId('g1', 'URGENT')).toBe(a);
    } finally {
      Date.now = later;
    }
  });

  it('two ids that sanitise alike do not share an alert', () => {
    // "a/b" and "a_b" both sanitise to "a_b". Sharing a document would let
    // one gathering's alert silently suppress the other's.
    expect(alertDocId('a/b', 'URGENT')).not.toBe(alertDocId('a_b', 'URGENT'));
  });

  it('is a legal Firestore document id', () => {
    const id = alertDocId('weird/id with spaces & symbols☃'.repeat(8), 'NOTICE_DUE');
    expect(id).not.toContain('/');
    expect(id.length).toBeLessThan(1500);
    expect(id).not.toBe('.');
    expect(id).not.toMatch(/^__.*__$/);
  });
});

describe('running the sweep more than once', () => {
  it('raises the alert once however many times it runs on the same state', async () => {
    const { store, docs } = fakeStore();
    const events = [startingInHours(20)];

    const first = await runRgaSweep(events, store, NOW);
    const second = await runRgaSweep(events, store, NOW);
    const tenth = await runRgaSweep(events, store, NOW + 5 * 60_000);

    expect(first).toEqual({ considered: 1, created: 1, alreadyRaised: 0 });
    expect(second).toEqual({ considered: 1, created: 0, alreadyRaised: 1 });
    expect(tenth).toEqual({ considered: 1, created: 0, alreadyRaised: 1 });
    expect(docs.size).toBe(1);
  });

  it('overlapping runs still raise exactly one', async () => {
    // The real hazard: two sweeps in flight at once (a slow run, a retry).
    const { store, docs } = fakeStore();
    const events = [startingInHours(20)];

    const results = await Promise.all([
      runRgaSweep(events, store, NOW),
      runRgaSweep(events, store, NOW),
      runRgaSweep(events, store, NOW),
    ]);

    expect(docs.size).toBe(1);
    expect(results.reduce((n, r) => n + r.created, 0)).toBe(1);
  });

  it('a gathering that deteriorates raises one alert per stage, each once', async () => {
    const { store, docs } = fakeStore();
    // The sweep runs hourly while the gathering approaches. Same record,
    // moving clock: 120h, 119h, ... down to 1h.
    for (let remaining = 120; remaining >= 1; remaining -= 1) {
      const clock = NOW + (120 - remaining) * HOUR;
      await runRgaSweep(
        [gathering({ startsAtMillis: NOW + 120 * HOUR })],
        store,
        clock,
      );
    }

    expect([...docs.values()].map((a) => a.stage).sort()).toEqual(
      ['NOTICE_DUE', 'PROHIBITION_RISK', 'URGENT'].sort(),
    );
    expect(docs.size).toBe(3);
  });

  it('lodging notice stops further alerts without touching raised ones', async () => {
    const { store, docs } = fakeStore();
    await runRgaSweep([startingInHours(60)], store, NOW); // raises URGENT
    expect(docs.size).toBe(1);

    const lodged = startingInHours(40, { noticeStatus: 'LODGED' });
    const after = await runRgaSweep([lodged], store, NOW + 20 * HOUR);

    expect(after.considered).toBe(0);
    expect(docs.size).toBe(1); // history kept; nothing new raised
  });

  it('keeps tenants apart even when gathering ids collide', async () => {
    const { store, docs } = fakeStore();
    await runRgaSweep(
      [startingInHours(20, { tenantId: 'party-a' }), startingInHours(20, { tenantId: 'party-b' })],
      store,
      NOW,
    );
    expect(docs.size).toBe(2);
    expect([...docs.keys()].some((k) => k.startsWith('party-a/'))).toBe(true);
    expect([...docs.keys()].some((k) => k.startsWith('party-b/'))).toBe(true);
  });
});
