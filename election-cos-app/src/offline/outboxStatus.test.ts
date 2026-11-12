import { describe, expect, it } from 'vitest';
import {
  IllegalTransition,
  MAX_RETRIES,
  transition,
  uiState,
  type OutboxMutation,
  type OutboxStatus,
} from './outboxStatus';

const NOW = new Date('2026-11-04T08:00:00Z');
const m = (status: OutboxStatus, over: Partial<OutboxMutation> = {}): OutboxMutation => ({
  mutationId: 'm1',
  status,
  retryCount: 0,
  ...over,
});

describe('the outbox status machine', () => {
  it('walks the happy path PENDING → IN_FLIGHT → APPLIED', () => {
    const a = transition(m('PENDING'), 'IN_FLIGHT', { now: NOW });
    expect(transition(a, 'APPLIED', { now: NOW }).status).toBe('APPLIED');
  });
  it('refuses every move not in the table, and anything out of a finished state', () => {
    for (const [from, to] of [
      ['PENDING', 'APPLIED'],
      ['APPLIED', 'PENDING'],
      ['DISCARDED', 'PENDING'],
      ['CONFLICT', 'PENDING'],
      ['PENDING', 'DISCARDED'],
    ] as const) {
      expect(
        () => transition(m(from), to, { now: NOW, by: 'u1', reason: 'x' }),
        `${from}→${to}`,
      ).toThrow(IllegalTransition);
    }
  });
  it('will not discard without a named person, and records who and when', () => {
    expect(() => transition(m('CONFLICT'), 'DISCARDED', { now: NOW })).toThrow(/person/);
    expect(transition(m('REJECTED'), 'DISCARDED', { now: NOW, by: 'ward-lead-1' })).toMatchObject({
      status: 'DISCARDED',
      discardedBy: 'ward-lead-1',
      discardedAt: NOW.toISOString(),
    });
  });
  it('will not reject without a reason a volunteer can act on', () => {
    expect(() => transition(m('IN_FLIGHT'), 'REJECTED', { now: NOW, reason: '  ' })).toThrow(
      /reason/,
    );
  });
  it('retries a failed delivery, then stops and surfaces it as a rejection instead of looping for ever', () => {
    let cur = m('PENDING');
    for (let i = 0; i < MAX_RETRIES - 1; i++) {
      cur = transition(transition(cur, 'IN_FLIGHT', { now: NOW }), 'PENDING', { now: NOW });
      expect(cur.status).toBe('PENDING');
    }
    cur = transition(transition(cur, 'IN_FLIGHT', { now: NOW }), 'PENDING', { now: NOW });
    expect(cur.status).toBe('REJECTED');
    expect(cur.rejectedReason).toMatch(/several tries/);
  });
  it('maps onto the states the app already shows', () => {
    expect(uiState('IN_FLIGHT')).toBe('PENDING');
    expect(uiState('APPLIED')).toBe('SYNCED');
    expect(uiState('CONFLICT')).toBe('CONFLICT');
  });
});
