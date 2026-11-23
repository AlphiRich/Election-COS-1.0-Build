/**
 * Election Campaign OS — monthly paid-usage guard.
 *
 * White paper rule: "Any paid usage above R500 a month needs the founder's approval."
 * This is that rule as code. Every PAID action (today: a WhatsApp one-time-code message) must
 * reserve its cost here BEFORE it is incurred. The reservation is one transaction against a
 * month ledger, so two simultaneous sends cannot both squeeze under the ceiling.
 *
 * - The ceiling is R500 (50,000 cents) unless the founder has written an approval for THIS month
 *   (`platform/costApproval`: a ceiling, a named approver, and the month it covers). An approval
 *   with no approver, a stale month, or a ceiling at or below the default raises nothing.
 * - FAILS CLOSED on an unknown price: the per-message cost is configuration, not a guess made
 *   here. No configured price means no paid send, rather than free sends nobody is counting.
 * - Money is whole cents of rand, never floats. The month is SAST (UTC+2), matching the usage
 *   statement.
 * - A failed delivery is not refunded: the provider may still bill an attempt, and undercounting
 *   spend defeats the guard.
 *
 * This module is the pure half: no firebase-admin import, so the Cloudflare worker can bundle it
 * (the Campaign Director reserves each model call here). `costGuard.ts` re-exports it and adds the
 * Admin SDK ledger.
 */
export const DEFAULT_CEILING_CENTS = 50_000; // R500

export class CostGuardError extends Error {
  constructor(
    readonly code: 'PRICE_NOT_CONFIGURED' | 'CEILING_REACHED',
    message: string,
  ) {
    super(message);
    this.name = 'CostGuardError';
  }
}

export interface Approval {
  ceilingCents?: number;
  approvedBy?: string;
  /** SAST month it covers, YYYY-MM. */
  period?: string;
}

export function sastMonth(now: Date): string {
  return new Date(now.getTime() + 2 * 3_600_000).toISOString().slice(0, 7);
}

/** The ceiling in force this month: the default, or a valid founder approval above it. */
export function effectiveCeiling(approval: Approval | null | undefined, period: string): number {
  if (
    approval &&
    approval.approvedBy?.trim() &&
    approval.period === period &&
    Number.isInteger(approval.ceilingCents) &&
    (approval.ceilingCents as number) > DEFAULT_CEILING_CENTS
  ) {
    return approval.ceilingCents as number;
  }
  return DEFAULT_CEILING_CENTS;
}

export function parseUnitCost(raw: string | number | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isInteger(n) || n <= 0) {
    throw new CostGuardError(
      'PRICE_NOT_CONFIGURED',
      'The price of this paid action is not configured.',
    );
  }
  return n;
}

export interface SpendTx {
  getSpent(period: string): Promise<number>;
  getApproval(): Promise<Approval | null>;
  setSpent(period: string, cents: number): void;
}
export interface SpendStore {
  runTransaction<T>(fn: (tx: SpendTx) => Promise<T>): Promise<T>;
}

/** Reserve `costCents` against this month. Throws CEILING_REACHED if it would pass the ceiling. */
export async function reserveSpend(
  store: SpendStore,
  costCents: number,
  now: Date,
): Promise<{ spentCents: number; ceilingCents: number }> {
  if (!Number.isInteger(costCents) || costCents <= 0) {
    throw new CostGuardError(
      'PRICE_NOT_CONFIGURED',
      'The price of this paid action is not configured.',
    );
  }
  const period = sastMonth(now);
  return store.runTransaction(async (tx) => {
    const [spent, approval] = await Promise.all([tx.getSpent(period), tx.getApproval()]);
    const ceiling = effectiveCeiling(approval, period);
    if (spent + costCents > ceiling) {
      throw new CostGuardError(
        'CEILING_REACHED',
        'The monthly paid-usage limit has been reached. The founder must approve more before this can continue.',
      );
    }
    tx.setSpent(period, spent + costCents);
    return { spentCents: spent + costCents, ceilingCents: ceiling };
  });
}

/* -------------------------------------------- optimistic (no-transaction) ledger */
import type { VersionedDocStore } from './versionedDocStore';

export const SPEND_LEDGER_PATH = (period: string) => `platform/spend_${period}`;
export const COST_APPROVAL_PATH = 'platform/costApproval';

/**
 * The same ledger as the Admin SDK store (`platform/spend_YYYY-MM`,
 * `platform/costApproval`), for a runtime with only optimistic concurrency (the
 * worker). The month's total is written only if it is unchanged since it was
 * read; on a clash it re-reads and re-checks the ceiling. After `maxAttempts`
 * clashes it refuses, so contention can never turn into an uncounted spend.
 */
export function optimisticSpendStore(store: VersionedDocStore, maxAttempts = 5): SpendStore {
  return {
    async runTransaction(fn) {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const read = new Map<string, string | null>();
        const writes = new Map<string, number>();
        const result = await fn({
          getSpent: async (period) => {
            const path = SPEND_LEDGER_PATH(period);
            const d = await store.getVersioned(path);
            read.set(path, d?.version ?? null);
            const cents = Number(d?.data.cents ?? 0);
            return Number.isFinite(cents) ? cents : 0;
          },
          getApproval: async () => ((await store.getVersioned(COST_APPROVAL_PATH))?.data as Approval | undefined) ?? null,
          setSpent: (period, cents) => void writes.set(SPEND_LEDGER_PATH(period), cents),
        });
        if (writes.size === 0) return result;
        const ok = await store.commit(
          [...writes].map(([path, cents]) => ({ path, data: { cents }, ifVersion: read.has(path) ? read.get(path)! : null })),
        );
        if (ok) return result;
      }
      throw new Error('The paid-usage ledger is busy; refusing rather than spend uncounted.');
    },
  };
}
