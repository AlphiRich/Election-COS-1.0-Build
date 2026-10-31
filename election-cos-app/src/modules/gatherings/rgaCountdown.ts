/**
 * Election Campaign OS — the countdown a ward lead reads
 * IC-ECOS-BUILD-2026-V2 §6.3.
 *
 * The same three points as `functions/src/rgaNotice.ts`, kept by hand
 * because the two packages share no workspace. `rgaCountdown.test.ts`
 * reads the function's source and fails if a constant or a boundary
 * drifts, so the screen cannot say "URGENT" at an hour the sweep says
 * nothing — the same arrangement as `wardScope()` and the counter ids.
 *
 * Seven days and 48 hours are statutory (Regulation of Gatherings Act
 * 205 of 1993, s 3). The 72-hour rung is house policy and is labelled so
 * wherever it is shown. Nothing here says a gathering is lawful.
 */
import type { NoticeStatus } from '@/dal/ports/gatherings';
import type { Tone } from '@/design/toneClasses';

export const NOTICE_WINDOW_HOURS = 168;
export const URGENT_WINDOW_HOURS = 72;
export const PROHIBITION_WINDOW_HOURS = 48;

export type CountdownStage = 'NOTICE_DUE' | 'URGENT' | 'PROHIBITION_RISK';

export function stageFor(hoursToStart: number): CountdownStage | null {
  if (!Number.isFinite(hoursToStart) || hoursToStart <= 0) return null;
  if (hoursToStart < PROHIBITION_WINDOW_HOURS) return 'PROHIBITION_RISK';
  if (hoursToStart <= URGENT_WINDOW_HOURS) return 'URGENT';
  if (hoursToStart <= NOTICE_WINDOW_HOURS) return 'NOTICE_DUE';
  return null;
}

export interface Countdown {
  /** A short status word — the word carries the meaning, tone only repeats it. */
  label: string;
  tone: Tone;
  /** Time left, in words. Empty once begun. */
  remaining: string;
  /** One sentence: what this means, and whether it is statute or policy. */
  detail: string;
  stage: CountdownStage | null;
  needsAction: boolean;
}

export function formatRemaining(hours: number): string {
  if (hours <= 0) return '';
  if (hours < 1) return `${Math.max(1, Math.floor(hours * 60))} min`;
  if (hours < 48) return `${Math.floor(hours)} h`;
  const days = Math.floor(hours / 24);
  const rest = Math.floor(hours - days * 24);
  return rest > 0 ? `${days} d ${rest} h` : `${days} d`;
}

export function describeCountdown(
  startsAtISO: string,
  noticeStatus: NoticeStatus,
  nowMillis: number,
): Countdown {
  const startsAt = Date.parse(startsAtISO);
  const hours = (startsAt - nowMillis) / 3_600_000;
  const remaining = Number.isFinite(hours) ? formatRemaining(hours) : '';

  if (!Number.isFinite(hours)) {
    return { label: 'No date', tone: 'slate', remaining, stage: null, needsAction: false,
      detail: 'This gathering has no valid start time, so no countdown can be given.' };
  }
  if (hours <= 0) {
    return { label: 'Held', tone: 'slate', remaining, stage: null, needsAction: false,
      detail: 'The start time has passed. This is a record, not an alert.' };
  }
  if (noticeStatus === 'LODGED') {
    return { label: 'Notice recorded', tone: 'green', remaining, stage: null, needsAction: false,
      detail: 'The convener has recorded that notice was lodged. That is their statement; it does not show the responsible officer received or accepted it.' };
  }

  const stage = stageFor(hours);
  switch (stage) {
    case 'PROHIBITION_RISK':
      return { label: 'Under 48 hours', tone: 'maroon', remaining, stage, needsAction: true,
        detail: 'No notice recorded. Notice given under 48 hours before a gathering may be prohibited by the responsible officer (statute).' };
    case 'URGENT':
      return { label: 'Notice overdue', tone: 'gold', remaining, stage, needsAction: true,
        detail: 'No notice recorded and the seven-day point has passed. The 48-hour prohibition point is next. The 72-hour warning is house policy, not a statutory deadline.' };
    case 'NOTICE_DUE':
      return { label: 'Notice due', tone: 'gold', remaining, stage, needsAction: true,
        detail: 'No notice recorded. Written notice is due not later than seven days before the gathering (statute).' };
    default:
      return { label: 'Not yet due', tone: 'slate', remaining, stage: null, needsAction: false,
        detail: 'More than seven days to go. Notice is not yet late.' };
  }
}
