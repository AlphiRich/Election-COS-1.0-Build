/**
 * The screen's countdown, and its agreement with the hourly sweep.
 *
 * Proved by injection: changing a constant here, or one boundary
 * operator, fails the parity test; marking a lodged gathering as
 * needing action fails "a recorded notice needs no action".
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NOTICE_WINDOW_HOURS,
  PROHIBITION_WINDOW_HOURS,
  URGENT_WINDOW_HOURS,
  describeCountdown,
  formatRemaining,
  stageFor,
} from './rgaCountdown';

const FN = readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'functions', 'src', 'rgaNotice.ts'),
  'utf-8',
);
const fnConst = (name: string) => Number(new RegExp(`export const ${name} = (\\d+);`).exec(FN)?.[1]);

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 1, 8, 0, 0);
const at = (h: number) => new Date(NOW + h * HOUR).toISOString();

describe('agreement with functions/src/rgaNotice.ts', () => {
  it('uses the same three windows', () => {
    expect(NOTICE_WINDOW_HOURS).toBe(fnConst('NOTICE_WINDOW_HOURS'));
    expect(URGENT_WINDOW_HOURS).toBe(fnConst('URGENT_WINDOW_HOURS'));
    expect(PROHIBITION_WINDOW_HOURS).toBe(fnConst('PROHIBITION_WINDOW_HOURS'));
    expect([NOTICE_WINDOW_HOURS, URGENT_WINDOW_HOURS, PROHIBITION_WINDOW_HOURS]).toEqual([168, 72, 48]);
  });

  it('uses the same boundary operators', () => {
    // The sweep: `< 48` strict, `<= 72`, `<= 168`. A drift in any one means
    // the screen and the alerts disagree at exactly that hour.
    expect(FN).toMatch(/hoursToStart < PROHIBITION_WINDOW_HOURS\) return 'PROHIBITION_RISK'/);
    expect(FN).toMatch(/hoursToStart <= URGENT_WINDOW_HOURS\) return 'URGENT'/);
    expect(FN).toMatch(/hoursToStart <= NOTICE_WINDOW_HOURS\) return 'NOTICE_DUE'/);
    expect(stageFor(48)).toBe('URGENT');
    expect(stageFor(47.999)).toBe('PROHIBITION_RISK');
    expect(stageFor(72)).toBe('URGENT');
    expect(stageFor(168)).toBe('NOTICE_DUE');
    expect(stageFor(168.001)).toBeNull();
  });
});

describe('what a ward lead is told', () => {
  it('a recorded notice needs no action, and does not claim acceptance', () => {
    const c = describeCountdown(at(10), 'LODGED', NOW);
    expect(c.needsAction).toBe(false);
    expect(c.label).toBe('Notice recorded');
    expect(c.detail).toMatch(/does not show the responsible officer received or accepted/);
  });

  it('under 48 hours is the loudest state, and says it is statute', () => {
    const c = describeCountdown(at(20), 'NOT_LODGED', NOW);
    expect(c).toMatchObject({ tone: 'maroon', needsAction: true, stage: 'PROHIBITION_RISK' });
    expect(c.detail).toMatch(/\(statute\)/);
  });

  it('the 72-hour rung says it is house policy', () => {
    expect(describeCountdown(at(60), 'NOT_LODGED', NOW).detail).toMatch(/house policy/);
  });

  it('far-off and past gatherings raise no action', () => {
    expect(describeCountdown(at(400), 'NOT_LODGED', NOW).needsAction).toBe(false);
    expect(describeCountdown(at(-3), 'NOT_LODGED', NOW)).toMatchObject({ label: 'Held', needsAction: false });
  });

  it('an unreadable date is stated, not guessed', () => {
    expect(describeCountdown('not a date', 'NOT_LODGED', NOW)).toMatchObject({ label: 'No date', needsAction: false });
  });

  it('never calls anything lawful or compliant', () => {
    for (const h of [10, 60, 120, 400, -3]) {
      for (const s of ['NOT_LODGED', 'LODGED'] as const) {
        const t = describeCountdown(at(h), s, NOW);
        expect(`${t.label} ${t.detail}`).not.toMatch(/\b(lawful|legal|compliant|approved|permitted)\b/i);
      }
    }
  });

  it('writes time in words a person can read', () => {
    expect(formatRemaining(0.5)).toBe('30 min');
    expect(formatRemaining(20)).toBe('20 h');
    expect(formatRemaining(60)).toBe('2 d 12 h');
    expect(formatRemaining(72)).toBe('3 d');
    expect(formatRemaining(0)).toBe('');
  });
});
