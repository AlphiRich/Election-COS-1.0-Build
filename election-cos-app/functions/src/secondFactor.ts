/**
 * Election Campaign OS — second sign-in factor, the whole of the logic
 *
 * The owner's rule (session 54): sign in with an email identity, then — for every role ABOVE the
 * volunteer / canvasser tier — enter a one-time code sent to the number on that person's staff
 * profile. The canvasser is the only role that skips the second step.
 *
 * WHY THIS IS NOT FIREBASE'S BUILT-IN SMS MFA
 *
 * Firebase multi-factor stores the enrolled phone number in the Auth record. `firebaseAuth.ts`
 * holds the Auth record to uid + email only (§4.3, phone is a FORBIDDEN Auth field), and the
 * built-in route also needs Identity Platform billing. So the code goes to the number already on
 * the staff profile in Firestore (africa-south1), the same place the role lives. A bonus: the
 * person cannot choose where the code goes. An attacker who owns a staff email still has to hold
 * the handset the administrator recorded.
 *
 * WHAT A PASSED SECOND FACTOR LOOKS LIKE
 *
 * A custom claim `mfaUntil` (epoch seconds) on the ID token. `firestore.rules` reads it
 * (`mfaOK()`), so enforcement is server-side, not a hidden button. `resolveCapabilities` rewrites
 * the whole claims object whenever the staff record changes, which drops `mfaUntil` — changing a
 * person's role, scope or number therefore forces a fresh code, which is the desired behaviour.
 *
 * The code, hash, salt, attempts, expiry and constant-time compare are `membershipOtp.ts`'s; they
 * were reviewed there and are not re-implemented.
 */
import { MAX_ATTEMPTS, canResend, generateOtp, hashOtp, newSalt, toE164ZA, maskPhone, verifyOtp } from './membershipOtp';
import type { OtpChallenge, VerifyOutcome } from './membershipOtp';

/** The only role that signs in with email alone. Everything else, known or not, needs the code. */
export const SECOND_FACTOR_EXEMPT_ROLES: readonly string[] = ['canvasser'];

/** How long a login code is good for. Shorter than the membership code: the person is at a screen. */
export const SECOND_FACTOR_CODE_TTL_MS = 5 * 60 * 1000;

/** How long a passed second factor lasts before the next sign-in step. One working day. */
export const SECOND_FACTOR_SESSION_SECONDS = 12 * 60 * 60;

/** Fail closed: an unknown or missing role id requires the second factor. */
export function requiresSecondFactor(roleId: unknown): boolean {
  return !(typeof roleId === 'string' && SECOND_FACTOR_EXEMPT_ROLES.includes(roleId));
}

export interface SecondFactorChallenge extends OtpChallenge {
  uid: string;
}

export interface SecondFactorStore {
  /** The staff phone as recorded on the profile, or null. Read server-side only. */
  staffPhone(tenantId: string, uid: string): Promise<string | null>;
  latest(tenantId: string, uid: string): Promise<SecondFactorChallenge | null>;
  create(tenantId: string, challenge: SecondFactorChallenge): Promise<string>;
  get(tenantId: string, id: string): Promise<SecondFactorChallenge | null>;
  update(tenantId: string, id: string, patch: Partial<SecondFactorChallenge>): Promise<void>;
}

/** Sends the code. Throws `SmsNotConfigured` when no provider is wired. */
export type SmsSender = (to: string, message: string) => Promise<boolean>;

export class SmsNotConfigured extends Error {
  constructor() {
    super('No SMS provider is configured on this project.');
    this.name = 'SmsNotConfigured';
  }
}

export type RequestResult =
  | { kind: 'SENT'; challengeId: string; phoneMasked: string; expiresAt: number }
  | { kind: 'NOT_REQUIRED' }
  | { kind: 'NO_PHONE' }
  | { kind: 'COOLDOWN' }
  | { kind: 'NOT_CONFIGURED' }
  | { kind: 'DELIVERY_FAILED' };

export interface Deps {
  store: SecondFactorStore;
  send: SmsSender;
  now: () => number;
}

export function loginMessage(code: string): string {
  return `Election-COS sign-in code: ${code}. Valid for 5 minutes. Never share it.`;
}

export async function requestSecondFactor(
  deps: Deps,
  who: { tenantId: string; uid: string; roleId: unknown },
): Promise<RequestResult> {
  if (!requiresSecondFactor(who.roleId)) return { kind: 'NOT_REQUIRED' };

  const raw = await deps.store.staffPhone(who.tenantId, who.uid);
  const e164 = raw ? toE164ZA(raw) : null;
  if (!e164) return { kind: 'NO_PHONE' };

  const now = deps.now();
  if (!canResend(await deps.store.latest(who.tenantId, who.uid), now)) return { kind: 'COOLDOWN' };

  const code = generateOtp();
  const salt = newSalt();
  const challenge: SecondFactorChallenge = {
    tenantId: who.tenantId,
    uid: who.uid,
    voterId: '', // unused for staff; keeps the shared challenge shape
    phoneMasked: maskPhone(e164),
    codeHash: await hashOtp(code, salt),
    salt,
    createdAt: now,
    expiresAt: now + SECOND_FACTOR_CODE_TTL_MS,
    attempts: 0,
    status: 'PENDING_DELIVERY',
    requestedByUid: who.uid,
  };
  // Written before the send, so a code that goes out is always one we can verify.
  const id = await deps.store.create(who.tenantId, challenge);

  try {
    const ok = await deps.send(e164, loginMessage(code));
    await deps.store.update(who.tenantId, id, { status: ok ? 'SENT' : 'DELIVERY_FAILED' });
    return ok
      ? { kind: 'SENT', challengeId: id, phoneMasked: challenge.phoneMasked, expiresAt: challenge.expiresAt }
      : { kind: 'DELIVERY_FAILED' };
  } catch (error) {
    await deps.store.update(who.tenantId, id, { status: 'DELIVERY_FAILED' });
    if (error instanceof SmsNotConfigured) return { kind: 'NOT_CONFIGURED' };
    throw error;
  }
}

export type VerifyResult =
  | { kind: 'VERIFIED'; mfaUntil: number }
  | { kind: 'NOT_FOUND' }
  | Exclude<VerifyOutcome, { kind: 'VERIFIED' }>;

/**
 * Checks a submitted code against one challenge. The challenge must belong to THIS uid: a code
 * requested by one account never verifies another, whatever id is submitted.
 */
export async function verifySecondFactor(
  deps: Deps,
  who: { tenantId: string; uid: string },
  challengeId: string,
  code: string,
): Promise<VerifyResult> {
  const challenge = await deps.store.get(who.tenantId, challengeId);
  if (!challenge || challenge.uid !== who.uid || challenge.tenantId !== who.tenantId) {
    return { kind: 'NOT_FOUND' };
  }
  const now = deps.now();
  const outcome = await verifyOtp(challenge, code, now);
  if (outcome.kind === 'VERIFIED') {
    await deps.store.update(who.tenantId, challengeId, { status: 'VERIFIED' });
    return { kind: 'VERIFIED', mfaUntil: Math.floor(now / 1000) + SECOND_FACTOR_SESSION_SECONDS };
  }
  if (outcome.kind === 'WRONG') {
    await deps.store.update(who.tenantId, challengeId, { attempts: challenge.attempts + 1 });
  } else if (outcome.kind === 'LOCKED' && challenge.status !== 'LOCKED') {
    await deps.store.update(who.tenantId, challengeId, {
      attempts: Math.min(challenge.attempts + 1, MAX_ATTEMPTS),
      status: 'LOCKED',
    });
  }
  return outcome;
}
