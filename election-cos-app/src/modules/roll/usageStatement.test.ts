import { describe, expect, it } from 'vitest';
import type { UsageEvent } from '@/dal/ports/roll';
import {
  METERS,
  STATEMENT_SCHEMA,
  buildStatement,
  sastPeriod,
  statementCsv,
} from './usageStatement';

const ev = (over: Partial<UsageEvent>): UsageEvent => ({
  id: 'VERIFY::e1',
  tenantId: 't1',
  kind: 'VERIFY',
  rollEntryId: 'e1',
  rollEdition: 'E1',
  wardCode: 'NW405-W31',
  vdCode: '86999001',
  uid: 'u1',
  at: '2026-11-04T08:00:00Z',
  ...over,
});
const NOW = new Date('2026-11-30T12:00:00Z');

describe('the usage statement', () => {
  const events = [
    ev({}),
    ev({ id: 'CAPTURE::e1', kind: 'CAPTURE' }),
    ev({ id: 'VERIFY::e2', rollEntryId: 'e2', vdCode: '86999002' }),
    ev({ id: 'VERIFY::e2', rollEntryId: 'e2', vdCode: '86999002' }), // replayed read
    ev({ id: 'VERIFY::e3', at: '2026-10-31T21:59:00Z' }), // 23:59 SAST on 31 Oct
    ev({ id: 'VERIFY::e4', at: '2026-10-31T22:00:00Z' }), // 00:00 SAST on 1 Nov
    ev({ id: 'VERIFY::x', tenantId: 'other' }),
  ];
  const s = buildStatement({ tenantId: 't1', geoScope: 'TENANT' }, events, '2026-11', NOW);

  it('counts each event once, by SAST month, for this tenant only', () => {
    expect(s.totals).toEqual({ [METERS.VERIFY]: 3, [METERS.CAPTURE]: 1 }); // e1, e2, e4 (SAST Nov 1)
    expect(sastPeriod('2026-10-31T22:00:00Z')).toBe('2026-11');
    expect(sastPeriod('2026-10-31T21:59:00Z')).toBe('2026-10');
  });
  it('groups by meter, ward and station, sorted', () => {
    expect(s.lines.map((l) => [l.meter, l.vdCode, l.quantity])).toEqual([
      ['roll.capture', '86999001', 1],
      ['roll.verify', '86999001', 2],
      ['roll.verify', '86999002', 1],
    ]);
  });
  it('holds no price, no entry id, no uid and no name', () => {
    const keys: string[] = [];
    JSON.stringify(s, (k, v) => (keys.push(k), v));
    expect(keys.some((k) => /^(price|rate|amount|cost|fee|zar|unitPrice)/i.test(k))).toBe(false);
    const text = JSON.stringify(s) + statementCsv(s);
    expect(text).not.toMatch(/\bR\s?\d/);
    expect(text).not.toContain('e1');
    expect(text).not.toContain('u1');
    expect(s.schema).toBe(STATEMENT_SCHEMA);
  });
  it('says plainly when it is not a whole-tenant statement', () => {
    const part = buildStatement({ tenantId: 't1', geoScope: 'WARD' }, events, '2026-11', NOW);
    expect(part.complete).toBe(false);
    expect(statementCsv(part)).toMatch(/do not invoice/);
    expect(s.complete).toBe(true);
  });
  it('refuses a malformed period', () => {
    expect(() =>
      buildStatement({ tenantId: 't1', geoScope: 'TENANT' }, [], '2026-13', NOW),
    ).toThrow();
    expect(() => buildStatement({ tenantId: 't1', geoScope: 'TENANT' }, [], 'Nov', NOW)).toThrow();
  });
});
