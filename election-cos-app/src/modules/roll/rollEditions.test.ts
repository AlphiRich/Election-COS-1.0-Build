import { describe, expect, it } from 'vitest';
import type { RollEditionMeta } from '@/dal/ports/roll';
import { editionRows } from './rollEditions';

const ed = (edition: string, status: RollEditionMeta['status']): RollEditionMeta => ({
  edition,
  status,
  entries: 10,
  addresses: 4,
  loadedAt: '2026-11-05T00:00:00Z',
});

describe('editionRows', () => {
  const editions = [ed('2026-11', 'LOADED'), ed('2026-10', 'LOADED'), ed('2026-12', 'LOADING'), ed('2026-09', 'FAILED')];

  it('marks the active edition and never offers to re-activate it', () => {
    const rows = editionRows(editions, '2026-11');
    const active = rows.find((r) => r.edition === '2026-11')!;
    expect(active.isActive).toBe(true);
    expect(active.canActivate).toBe(false);
  });

  it('offers activation only for a LOADED, non-active edition', () => {
    const rows = editionRows(editions, '2026-11');
    expect(rows.find((r) => r.edition === '2026-10')!.canActivate).toBe(true); // LOADED, not active
    expect(rows.find((r) => r.edition === '2026-12')!.canActivate).toBe(false); // LOADING
    expect(rows.find((r) => r.edition === '2026-09')!.canActivate).toBe(false); // FAILED
  });

  it('puts the active edition first, then newest by code', () => {
    const rows = editionRows(editions, '2026-10');
    expect(rows[0].edition).toBe('2026-10');
    expect(rows.slice(1).map((r) => r.edition)).toEqual(['2026-12', '2026-11', '2026-09']);
  });

  it('handles no active edition (nothing loaded yet)', () => {
    const rows = editionRows([], null);
    expect(rows).toEqual([]);
  });
});
