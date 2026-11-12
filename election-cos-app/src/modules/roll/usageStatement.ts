/**
 * Election Campaign OS — usage statement for invoicing
 * Module `voter-verification` (metered per use).
 *
 * The products are sold by separate operating companies, and the book-
 * keeping that invoices a party is a separate system that never reads this
 * app's database (its spec, IC-ACC-SPEC-2026-02 §9: the app calls the books,
 * not the reverse). This is the app's side of that line: a per-month
 * statement of what was counted, as a file, that a person or the books can
 * take. Quantities only.
 *
 *   NO PRICES   a price on a tenant's usage is the appearance of
 *               differential terms. The invoicing side applies the
 *               published rate.
 *   NO PEOPLE   counts by meter, ward and station. No entry id, no name,
 *               no uid: the books must never hold voter or canvasser data.
 *
 * COMPLETE ONLY FOR A TENANT-WIDE READER
 * A ward lead's session reads only their ward's events, so a statement from
 * it is a statement of that ward. `complete` says which; the invoicing side
 * must only invoice from a complete one.
 */
import type { UsageEvent } from '@/dal/ports/roll';
import type { SessionContext } from '@/dal/ports/session';
import { toCsv } from '@/lib/csv';

export const STATEMENT_SCHEMA = 'ecos.usage-statement/1';
export const METERS = { VERIFY: 'roll.verify', CAPTURE: 'roll.capture' } as const;

export interface StatementLine {
  meter: (typeof METERS)[keyof typeof METERS];
  wardCode: string;
  vdCode: string;
  quantity: number;
}

export interface UsageStatement {
  schema: typeof STATEMENT_SCHEMA;
  tenantId: string;
  period: string; // YYYY-MM, SAST
  generatedAt: string;
  complete: boolean;
  totals: Record<(typeof METERS)[keyof typeof METERS], number>;
  lines: StatementLine[];
}

/** The SAST month an instant falls in. Polling day at 23:30 is still that day. */
export function sastPeriod(iso: string): string {
  return new Date(new Date(iso).getTime() + 2 * 3_600_000).toISOString().slice(0, 7);
}

export function buildStatement(
  ctx: Pick<SessionContext, 'tenantId' | 'geoScope'>,
  events: UsageEvent[],
  period: string,
  now: Date,
): UsageStatement {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('period must be YYYY-MM');
  const byKey = new Map<string, StatementLine>();
  const totals = { [METERS.VERIFY]: 0, [METERS.CAPTURE]: 0 };
  // De-duplicate on the event id: the id is KIND::entry, so a replayed read can never double count.
  const seen = new Set<string>();
  for (const e of events) {
    if (e.tenantId !== ctx.tenantId || seen.has(e.id) || sastPeriod(e.at) !== period) continue;
    seen.add(e.id);
    const meter = METERS[e.kind];
    totals[meter]++;
    const k = `${meter}|${e.wardCode}|${e.vdCode}`;
    const line = byKey.get(k) ?? { meter, wardCode: e.wardCode, vdCode: e.vdCode, quantity: 0 };
    line.quantity++;
    byKey.set(k, line);
  }
  const lines = [...byKey.values()].sort(
    (a, b) =>
      a.meter.localeCompare(b.meter) ||
      a.wardCode.localeCompare(b.wardCode) ||
      a.vdCode.localeCompare(b.vdCode),
  );
  return {
    schema: STATEMENT_SCHEMA,
    tenantId: ctx.tenantId,
    period,
    generatedAt: now.toISOString(),
    complete: ctx.geoScope === 'TENANT',
    totals,
    lines,
  };
}

export function statementCsv(s: UsageStatement): string {
  return toCsv([
    ['Election Campaign OS usage statement', s.schema],
    ['Tenant', s.tenantId],
    ['Period (SAST)', s.period],
    ['Generated at', s.generatedAt],
    ['Complete', s.complete ? 'yes' : 'NO: ward or district scope only, do not invoice from this'],
    ['Prices', 'none held here; apply the published rate when invoicing'],
    [],
    ['meter', 'wardCode', 'vdCode', 'quantity'],
    ...s.lines.map((l) => [l.meter, l.wardCode, l.vdCode, l.quantity]),
    [],
    ['total', METERS.VERIFY, '', s.totals[METERS.VERIFY]],
    ['total', METERS.CAPTURE, '', s.totals[METERS.CAPTURE]],
  ]);
}
