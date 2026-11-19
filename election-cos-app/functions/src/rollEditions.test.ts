import { describe, expect, it } from 'vitest';
import { decideActivation, mfaSatisfied } from './rollEditions';

const LIVE = { mfaRequired: true, mfaUntil: 10_000 }; // mfaUntil*1000 = 10_000_000 ms
const NOW = 1_000_000;
const CAPS = ['roll.view', 'roll.manage'];

describe('mfaSatisfied', () => {
  it('passes an exempt token and a live second factor; fails a stale or absent one', () => {
    expect(mfaSatisfied({ mfaRequired: false }, NOW)).toBe(true);
    expect(mfaSatisfied({ mfaUntil: 10_000 }, NOW)).toBe(true);
    expect(mfaSatisfied({ mfaUntil: 1 }, NOW)).toBe(false);
    expect(mfaSatisfied({}, NOW)).toBe(false);
  });
});

describe('decideActivation', () => {
  const base = { caps: CAPS, token: LIVE, nowMs: NOW, edition: '2026-11' as string };

  it('activates a loaded edition for a capable, second-factored admin', () => {
    expect(decideActivation({ ...base, editionDoc: { status: 'LOADED' } })).toEqual({ ok: true });
  });

  it('refuses without roll.manage', () => {
    const d = decideActivation({ ...base, caps: ['roll.view'], editionDoc: { status: 'LOADED' } });
    expect(d).toMatchObject({ ok: false, code: 'permission-denied' });
  });

  it('refuses without a live second factor', () => {
    const d = decideActivation({ ...base, token: { mfaRequired: true, mfaUntil: 1 }, editionDoc: { status: 'LOADED' } });
    expect(d).toMatchObject({ ok: false, code: 'failed-precondition' });
  });

  it('refuses an edition that is not loaded', () => {
    expect(decideActivation({ ...base, editionDoc: null })).toMatchObject({ ok: false, code: 'not-found' });
    expect(decideActivation({ ...base, editionDoc: { status: 'LOADING' } })).toMatchObject({
      ok: false,
      code: 'failed-precondition',
    });
    expect(decideActivation({ ...base, editionDoc: { status: 'FAILED' } })).toMatchObject({
      ok: false,
      code: 'failed-precondition',
    });
  });

  it('refuses an empty edition or the reserved pointer id', () => {
    expect(decideActivation({ ...base, edition: '', editionDoc: { status: 'LOADED' } })).toMatchObject({
      ok: false,
      code: 'invalid-argument',
    });
    expect(decideActivation({ ...base, edition: 'active', editionDoc: { status: 'LOADED' } })).toMatchObject({
      ok: false,
      code: 'invalid-argument',
    });
  });

  it('checks capability before it reveals whether an edition exists', () => {
    // A caller without the capability must not learn load state via the error.
    const d = decideActivation({ ...base, caps: [], editionDoc: null });
    expect(d).toMatchObject({ ok: false, code: 'permission-denied' });
  });
});
