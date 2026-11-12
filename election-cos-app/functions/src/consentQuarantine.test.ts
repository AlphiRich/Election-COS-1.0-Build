import { describe, expect, it } from 'vitest';
import { release, selectForQuarantine, type VoterConsentFields } from './consentQuarantine';

const now = new Date('2026-11-02T08:00:00Z');
const ok: VoterConsentFields = {
  id: 'ok',
  popiaConsentGiven: true,
  popiaConsentAt: '2026-11-01T10:00:00Z',
  popiaConsentMethod: 'VERBAL_DOORSTEP',
};

describe('selectForQuarantine', () => {
  it('never touches a record with complete consent', () => {
    expect(selectForQuarantine([ok], now)).toEqual([]);
  });
  it('holds a record with no consent, a missing time, or a missing method, each with its reason', () => {
    const r = selectForQuarantine(
      [
        { ...ok, id: 'a', popiaConsentGiven: false },
        { ...ok, id: 'b', popiaConsentAt: undefined },
        { ...ok, id: 'c', popiaConsentMethod: undefined },
        { id: 'd' },
      ],
      now,
    );
    expect(r.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(r[1].mark.quarantineReason).toMatch(/time/);
    expect(r[2].mark.quarantineReason).toMatch(/method/);
  });
  it('skips records already held or already soft-deleted', () => {
    const bad = { id: 'x', popiaConsentGiven: false };
    expect(
      selectForQuarantine(
        [
          { ...bad, quarantinedAt: 'earlier' },
          { ...bad, deletedAt: 'then' },
        ],
        now,
      ),
    ).toEqual([]);
  });
});

describe('release', () => {
  it('needs a named person and a reason', () => {
    expect(() => release(ok, '', 'evidence found', now)).toThrow(/person/);
    expect(() => release(ok, 'S. Mokoena', ' ', now)).toThrow(/reason/);
    expect(release(ok, 'S. Mokoena', 'Signed form located', now).releasedBy).toBe('S. Mokoena');
  });
  it('refuses to release a record that still has no valid consent', () => {
    expect(() => release({ id: 'z', popiaConsentGiven: false }, 'S. Mokoena', 'ok', now)).toThrow(
      /Cannot release/,
    );
  });
});
