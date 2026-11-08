/**
 * Election Campaign OS — second sign-in factor callables
 *
 * @deployable fails-closed
 *
 * `requestSecondFactor` refuses until an SMS provider exists: there is none on this project, and
 * this file does not invent one. `unconfiguredSms` throws `SmsNotConfigured`, the callable
 * answers `failed-precondition`, and the app tells the person the code could not be sent. Plugging
 * a provider in is replacing that one function. Until then, with `mfaOK()` in firestore.rules,
 * every role above canvasser is locked out of data. That is deliberate (no silent downgrade), and
 * it is why the owner decision "which SMS provider" is the gate to switching this on.
 *
 * Logic and guards: `secondFactor.ts`. This file is the Firestore + Auth wiring only. Caller
 * identity comes from the verified token; nothing in the payload names a user or tenant.
 */
import { onCall, HttpsError, type CallableRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { defineString } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { REGION } from './region';
import { CostGuardError, firestoreSpendStore, parseUnitCost, reserveSpend } from './costGuard';
import {
  SmsNotConfigured,
  requestSecondFactor,
  requiresSecondFactor,
  verifySecondFactor,
  type Deps,
  type SecondFactorChallenge,
  type SecondFactorStore,
  type SmsSender,
} from './secondFactor';

if (!getApps().length) initializeApp();

const COLLECTION = 'secondFactorChallenges';

/** Price per SMS in whole cents of rand. No default: the owner reads it off the provider's bill. */
export const SMS_COST_CENTS_PER_MESSAGE = defineString('SMS_COST_CENTS_PER_MESSAGE', { default: '' });

/** The seam. No provider is chosen, so this refuses rather than pretending to send. */
export const unconfiguredSms: SmsSender = async () => {
  throw new SmsNotConfigured();
};

export function firestoreStore(): SecondFactorStore {
  const db = () => getFirestore();
  const col = (t: string) => db().collection(`tenants/${t}/${COLLECTION}`);
  return {
    async staffPhone(tenantId, uid) {
      const snap = await db().doc(`tenants/${tenantId}/staff/${uid}`).get();
      const phone = snap.exists ? (snap.data() as { phone?: unknown }).phone : null;
      return typeof phone === 'string' && phone ? phone : null;
    },
    async latest(tenantId, uid) {
      const s = await col(tenantId).where('uid', '==', uid).orderBy('createdAt', 'desc').limit(1).get();
      return s.empty ? null : (s.docs[0].data() as SecondFactorChallenge);
    },
    async create(tenantId, challenge) {
      const ref = await col(tenantId).add({
        ...challenge,
        // TTL field for Firestore's expiry policy; the challenge is useless after expiresAt anyway.
        expireAt: Timestamp.fromMillis(challenge.expiresAt + 24 * 60 * 60 * 1000),
      });
      return ref.id;
    },
    async get(tenantId, id) {
      const s = await col(tenantId).doc(id).get();
      return s.exists ? (s.data() as SecondFactorChallenge) : null;
    },
    async update(tenantId, id, patch) {
      await col(tenantId).doc(id).update(patch);
    },
  };
}

function deps(send: SmsSender = unconfiguredSms): Deps {
  return { store: firestoreStore(), send, now: () => Date.now() };
}

/** Who is asking, from the verified token only. Any signed-in, tenanted account may ask for its own code. */
export function whoFrom(request: CallableRequest): { uid: string; tenantId: string; roleId: unknown } {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const t = request.auth.token as { tenantId?: unknown; roleId?: unknown };
  if (typeof t.tenantId !== 'string' || !t.tenantId) {
    throw new HttpsError('permission-denied', 'This account is not attached to a tenant.');
  }
  return { uid: request.auth.uid, tenantId: t.tenantId, roleId: t.roleId };
}

export const requestSecondFactorCode = onCall({ region: REGION }, async (request) => {
  const who = whoFrom(request);
  // A canvasser never needs a code, so never spends a reservation on one.
  if (!requiresSecondFactor(who.roleId)) return { notRequired: true };
  // Paid action: reserve before sending (costGuard.ts). Unset price or a reached ceiling stops it.
  try {
    await reserveSpend(firestoreSpendStore(), parseUnitCost(SMS_COST_CENTS_PER_MESSAGE.value()), new Date());
  } catch (error) {
    if (error instanceof CostGuardError) {
      logger.warn('requestSecondFactorCode: refused by cost guard', { code: error.code });
      throw new HttpsError('failed-precondition', 'Sign-in codes are not available on this deployment yet.');
    }
    throw error;
  }
  const result = await requestSecondFactor(deps(), who);
  switch (result.kind) {
    case 'SENT':
      return { challengeId: result.challengeId, phoneMasked: result.phoneMasked, expiresAt: result.expiresAt };
    case 'NOT_REQUIRED':
      return { notRequired: true };
    case 'NO_PHONE':
      throw new HttpsError('failed-precondition', 'No mobile number is recorded for this account. Ask your administrator to add one.');
    case 'COOLDOWN':
      throw new HttpsError('resource-exhausted', 'A code was just sent. Wait a minute before asking for another.');
    case 'NOT_CONFIGURED':
      logger.error('requestSecondFactorCode: no SMS provider configured');
      throw new HttpsError('failed-precondition', 'Sign-in codes are not available on this deployment yet.');
    default:
      throw new HttpsError('unavailable', 'The code could not be sent. Try again in a moment.');
  }
});

export const verifySecondFactorCode = onCall<{ challengeId?: unknown; code?: unknown }>(
  { region: REGION },
  async (request) => {
    const who = whoFrom(request);
    const challengeId = typeof request.data?.challengeId === 'string' ? request.data.challengeId.trim() : '';
    const code = typeof request.data?.code === 'string' ? request.data.code.trim() : '';
    if (!challengeId || !/^\d{6}$/.test(code)) throw new HttpsError('invalid-argument', 'Enter the 6-digit code.');

    const result = await verifySecondFactor(deps(), who, challengeId, code);
    if (result.kind !== 'VERIFIED') return result;

    // Merge into the existing claims; setCustomUserClaims replaces the whole object.
    const user = await getAuth().getUser(who.uid);
    await getAuth().setCustomUserClaims(who.uid, { ...(user.customClaims ?? {}), mfaUntil: result.mfaUntil });
    return { kind: 'VERIFIED' as const, mfaUntil: result.mfaUntil };
  },
);
