/**
 * Election Campaign OS — roll verification and capture: the rules
 * Module `voter-verification`. Pure functions; the screen and the tests
 * call these, the adapter writes what they return.
 *
 * WHAT HAPPENS AT THE DOOR
 *
 * 1. The canvasser sees the people the roll lists at this address.
 * 2. VERIFY — the canvasser confirms a listed person lives here. One
 *    chargeable instance. Nothing about the person is stored by this.
 * 3. CAPTURE — only if that person gives consent, aloud, to be recorded.
 *    The canvasser must name the person back before the button works
 *    (audit §8 critical moment 1: a mis-tap at a hostile doorstep must not
 *    create consent). That creates the voter record and one chargeable
 *    instance, together.
 * 4. A refusal creates nothing. There is deliberately no "refused" record:
 *    keeping a list of people who said no is itself profiling.
 *
 * WHAT IS NEVER COPIED
 *
 * The IEC mask is not carried into the voter record. The mask helps a
 * canvasser tell two people with the same name apart on their own screen;
 * the voter record has no use for it and a leaked voter table should not
 * contain it. A test proves the voter draft has no such field.
 *
 * NO PRICES HERE
 *
 * Usage events carry a kind and a time. What a verification or a capture
 * costs is on the platform's published, identical terms and is applied at
 * invoicing, not stored against a tenant (see modules.ts).
 */
import type { RollAddress, RollEntry, UsageEvent, UsageKind } from '@/dal/ports/roll';
import type { SessionContext } from '@/dal/ports/session';
import type { VoterDraft } from '@/dal/ports/voters';

export class CaptureRefused extends Error {
  constructor(
    readonly reason:
      | 'NO_CONSENT'
      | 'NAME_NOT_CONFIRMED'
      | 'OUT_OF_SCOPE'
      | 'NO_ADDRESS'
      | 'ALREADY_RECORDED',
    message: string,
  ) {
    super(message);
  }
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

/** The name a canvasser would say aloud: first given name + surname. */
export function spokenName(e: Pick<RollEntry, 'fullNames' | 'surname'>): string {
  const first = e.fullNames.trim().split(/\s+/)[0] ?? '';
  return `${first} ${e.surname}`.trim();
}

export function usageId(kind: UsageKind, rollEntryId: string): string {
  return `${kind}::${rollEntryId}`;
}

/** Entries must sit inside the caller's own district — the rules enforce it; this refuses early. */
export function inCallerScope(
  ctx: SessionContext,
  e: Pick<RollEntry, 'wardCode' | 'vdCode'>,
): boolean {
  switch (ctx.geoScope) {
    case 'TENANT':
    case 'MUNICIPALITY':
      return true;
    case 'WARD':
      return Boolean(ctx.wardScope) && e.wardCode === ctx.wardScope;
    case 'VD':
      return (
        Boolean(ctx.wardScope) &&
        Boolean(ctx.vdScope) &&
        e.wardCode === ctx.wardScope &&
        e.vdCode === ctx.vdScope
      );
  }
}

/**
 * A person already on file is never written again from the roll.
 *
 * The voter id is deterministic (`roll-<entry>`), so a second capture would
 * overwrite the first. Worse, if the first record was soft-deleted because
 * the person asked to be erased, an overwrite would set `deletedAt` back to
 * null and bring them back. Someone who asked to go does not return because
 * a different canvasser knocked and got a yes; that is a conversation for a
 * person to have with the Information Officer, not a write.
 */
export function assertCapturable(existing: { deletedAt: string | null } | null): void {
  if (existing === null) return;
  throw new CaptureRefused(
    'ALREADY_RECORDED',
    existing.deletedAt
      ? 'This person was removed from the campaign’s records and must not be recorded again here. Tell your Ward Lead.'
      : 'This person is already recorded.',
  );
}

export function buildVerification(ctx: SessionContext, e: RollEntry, now: Date): UsageEvent {
  if (!inCallerScope(ctx, e)) {
    throw new CaptureRefused('OUT_OF_SCOPE', 'This person is outside your district.');
  }
  return {
    id: usageId('VERIFY', e.id),
    tenantId: ctx.tenantId,
    kind: 'VERIFY',
    rollEntryId: e.id,
    rollEdition: e.rollEdition,
    wardCode: e.wardCode,
    vdCode: e.vdCode,
    uid: ctx.uid,
    at: now.toISOString(),
  };
}

export interface ConsentInput {
  /** The voter said yes, aloud, to being recorded. */
  consentGiven: boolean;
  /** What the canvasser typed to confirm WHO consented. Must match the spoken name. */
  confirmedName: string;
  /** Optional, only if the voter volunteers it. */
  sentiment?: VoterDraft['sentiment'];
}

export function buildCapture(
  ctx: SessionContext,
  e: RollEntry,
  address: RollAddress | undefined,
  input: ConsentInput,
  now: Date,
) {
  if (!inCallerScope(ctx, e)) {
    throw new CaptureRefused('OUT_OF_SCOPE', 'This person is outside your district.');
  }
  if (!input.consentGiven) {
    throw new CaptureRefused('NO_CONSENT', 'No consent, nothing is recorded.');
  }
  if (norm(input.confirmedName) !== norm(spokenName(e))) {
    throw new CaptureRefused(
      'NAME_NOT_CONFIRMED',
      `Type the name of the person who agreed (${spokenName(e)}) to confirm it was them.`,
    );
  }
  if (!e.addressId || !address || address.id !== e.addressId) {
    throw new CaptureRefused(
      'NO_ADDRESS',
      'This person has no address on the roll; capture them from the household screen instead.',
    );
  }
  const householdId = `roll-${e.addressId}`;
  const at = now.toISOString();
  const voter: VoterDraft & { rollEntryId: string; rollEdition: string } = {
    id: `roll-${e.id}`,
    tenantId: ctx.tenantId,
    householdId,
    vdCode: e.vdCode,
    wardCode: e.wardCode,
    firstName: e.fullNames.trim().split(/\s+/)[0] ?? '',
    lastName: e.surname,
    phoneMasked: '',
    sentiment: input.sentiment ?? 'UNDECIDED',
    popiaConsentGiven: true,
    popiaConsentAt: at,
    popiaConsentMethod: 'VERBAL_DOORSTEP',
    popiaConsentReference: `roll:${e.rollEdition}:${e.id}:by:${ctx.uid}`,
    rollEntryId: e.id,
    rollEdition: e.rollEdition,
  };
  const household = {
    id: householdId,
    tenantId: ctx.tenantId,
    vdCode: e.vdCode,
    wardCode: e.wardCode,
    addressLine: address.addressRaw,
    dwellingType: 'OTHER' as const,
  };
  const usage: UsageEvent = {
    ...buildVerification(ctx, e, now),
    id: usageId('CAPTURE', e.id),
    kind: 'CAPTURE',
  };
  return { household, voter, usage };
}

/** Addresses with their people count, biggest first, optionally filtered by a typed fragment. */
export function findAddresses(addresses: RollAddress[], fragment: string): RollAddress[] {
  const f = norm(fragment);
  const hit = f ? addresses.filter((a) => norm(a.addressRaw).includes(f)) : addresses;
  return [...hit].sort((a, b) => a.addressRaw.localeCompare(b.addressRaw));
}

export interface UsageSummary {
  verify: number;
  capture: number;
  /** capture ÷ verify; null before the first verification. */
  captureRate: number | null;
  byVd: Record<string, { verify: number; capture: number }>;
  byHour: Record<string, { verify: number; capture: number }>;
  byUser: Record<string, { verify: number; capture: number }>;
}

/** The day's statistics, from the events alone. `tz` is fixed: SAST, so a 23:30 capture is today's. */
export function summariseUsage(events: UsageEvent[]): UsageSummary {
  const out: UsageSummary = {
    verify: 0,
    capture: 0,
    captureRate: null,
    byVd: {},
    byHour: {},
    byUser: {},
  };
  const bump = (m: UsageSummary['byVd'], k: string, kind: UsageKind) => {
    const c = (m[k] ??= { verify: 0, capture: 0 });
    if (kind === 'VERIFY') c.verify++;
    else c.capture++;
  };
  for (const e of events) {
    if (e.kind === 'VERIFY') out.verify++;
    else out.capture++;
    bump(out.byVd, `${e.wardCode}::${e.vdCode}`, e.kind);
    bump(out.byUser, e.uid, e.kind);
    const sast =
      new Date(new Date(e.at).getTime() + 2 * 3_600_000)
        .toISOString()
        .slice(0, 13)
        .replace('T', ' ') + ':00';
    bump(out.byHour, sast, e.kind);
  }
  out.captureRate = out.verify ? out.capture / out.verify : null;
  return out;
}
