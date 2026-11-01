/**
 * Election Campaign OS — outbox status machine
 *
 * From a supplied architecture note (OFFLINE_SYNC_SENTINEL): the states a
 * queued mutation can be in, and which moves between them are legal.
 * Written as a pure function so the rules can be tested without IndexedDB.
 *
 *   PENDING ──► IN_FLIGHT ──► APPLIED            (delivered)
 *      ▲            │  ├────► CONFLICT           (server found a newer write)
 *      │            │  └────► REJECTED           (server refused it)
 *      └────────────┘ (failure: back to PENDING, retryCount + 1)
 *   CONFLICT ──► APPLIED | DISCARDED             (a person decides)
 *   REJECTED ──► PENDING | DISCARDED             (edited and retried, or given up)
 *
 * THE RULE THAT MATTERS: nothing is discarded silently. DISCARDED needs a
 * person (`discardedBy`) and a time. A volunteer's record that is dropped
 * without their knowing is the failure the human-centred audit rates highest
 * for field trust (finding F1); the machine makes the silent path
 * unrepresentable rather than discouraged.
 *
 * NOT WIRED INTO THE DEXIE SCHEMA. The shipped outbox (`outbox.ts`) deletes an
 * entry when the server accepts it and marks the record, and changing a
 * stored schema days before polling is a larger risk than this fix is worth.
 * `uiState` maps these onto the states the app already shows.
 */
export type OutboxStatus =
  | 'PENDING'
  | 'IN_FLIGHT'
  | 'APPLIED'
  | 'CONFLICT'
  | 'REJECTED'
  | 'DISCARDED';

export interface OutboxMutation {
  mutationId: string;
  status: OutboxStatus;
  retryCount: number;
  rejectedReason?: string;
  discardedAt?: string;
  discardedBy?: string;
}

export const MAX_RETRIES = 5;

const ALLOWED: Record<OutboxStatus, OutboxStatus[]> = {
  PENDING: ['IN_FLIGHT'],
  IN_FLIGHT: ['APPLIED', 'CONFLICT', 'REJECTED', 'PENDING'],
  CONFLICT: ['APPLIED', 'DISCARDED'],
  REJECTED: ['PENDING', 'DISCARDED'],
  APPLIED: [],
  DISCARDED: [],
};

export class IllegalTransition extends Error {}

export interface TransitionInfo {
  now: Date;
  /** Required for DISCARDED: the person who decided. */
  by?: string;
  /** Required for REJECTED: why, in words a volunteer can act on. */
  reason?: string;
}

export function transition(
  m: OutboxMutation,
  to: OutboxStatus,
  info: TransitionInfo,
): OutboxMutation {
  if (!ALLOWED[m.status].includes(to)) {
    throw new IllegalTransition(`${m.status} → ${to} is not allowed`);
  }
  if (to === 'DISCARDED') {
    if (!info.by) throw new IllegalTransition('A discard needs the person who decided it.');
    return { ...m, status: to, discardedBy: info.by, discardedAt: info.now.toISOString() };
  }
  if (to === 'REJECTED') {
    if (!info.reason?.trim())
      throw new IllegalTransition('A rejection needs a reason a volunteer can act on.');
    return { ...m, status: to, rejectedReason: info.reason };
  }
  if (m.status === 'IN_FLIGHT' && to === 'PENDING') {
    // A failed attempt. After MAX_RETRIES it stops retrying and becomes a rejection a person sees.
    if (m.retryCount + 1 >= MAX_RETRIES) {
      return {
        ...m,
        status: 'REJECTED',
        retryCount: m.retryCount + 1,
        rejectedReason: 'Could not be delivered after several tries.',
      };
    }
    return { ...m, status: to, retryCount: m.retryCount + 1 };
  }
  return { ...m, status: to };
}

/** The states the app already shows (`SyncState` in db.ts). */
export function uiState(
  s: OutboxStatus,
): 'PENDING' | 'SYNCED' | 'CONFLICT' | 'REJECTED' | 'DISCARDED' {
  switch (s) {
    case 'PENDING':
    case 'IN_FLIGHT':
      return 'PENDING';
    case 'APPLIED':
      return 'SYNCED';
    default:
      return s;
  }
}
