/**
 * Election Campaign OS — poll endpoint (HTTP)
 *
 * @deployable fails-closed
 *
 * GET  ?poll=<publicId>  -> the public definition (question, options, organiser)
 * POST {pollId, option, channel, ward?, consent, token?, turnstileToken}  -> counts one answer
 *
 * Fails closed: without `TURNSTILE_SECRET` answers are refused with 503. Decisions live in
 * pollSubmit.ts. Data: `tenants/{t}/polls/{id}` (definition, found by its `publicId`),
 * `tenants/{t}/pollTallies/{id}` (counts only), `tenants/{t}/polls/{id}/tokens/{hash}`.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { REGION } from './region';
import { ENQUIRY_ORIGINS } from './enquiryOrigins';
import { handleAnswer, handleGetPoll, type PollStore, type StoredPoll } from './pollSubmit';

const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');

function firestoreStore(): PollStore {
  const db = getFirestore();
  return {
    async findByPublicId(publicId) {
      const snap = await db
        .collectionGroup('polls')
        .where('publicId', '==', publicId)
        .limit(1)
        .get();
      if (snap.empty) return null;
      const d = snap.docs[0];
      const tenantId = d.ref.parent.parent?.id;
      if (!tenantId) return null;
      return { ...(d.data() as Omit<StoredPoll, 'tenantId' | 'pollId'>), tenantId, pollId: d.id };
    },
    async record(poll, key, tokenHash) {
      const tally = db.doc(`tenants/${poll.tenantId}/pollTallies/${poll.pollId}`);
      return db.runTransaction(async (t) => {
        if (tokenHash) {
          const tokenRef = db.doc(
            `tenants/${poll.tenantId}/polls/${poll.pollId}/tokens/${tokenHash}`,
          );
          if ((await t.get(tokenRef)).exists) return false;
          t.create(tokenRef, { used: true });
        }
        // Nested object (not a dotted path), so a key is a literal map field name: `|` and `.` in an
        // option are harmless here. `|` is still refused at creation and on answer, as it is the key separator.
        t.set(
          tally,
          {
            counts: { [key]: FieldValue.increment(1) },
            total: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return true;
      });
    },
  };
}

export const poll = onRequest(
  { region: REGION, secrets: [TURNSTILE_SECRET], maxInstances: 5, cors: false },
  async (req, res) => {
    const origin = String(req.get('origin') ?? '');
    const allowed = (ENQUIRY_ORIGINS as readonly string[]).includes(origin);
    if (allowed) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(allowed ? 204 : 403).end();
      return;
    }
    if (!allowed) {
      res.status(403).json({ ok: false, message: 'Not allowed from here.' });
      return;
    }
    if (!getApps().length) initializeApp();
    const secret = TURNSTILE_SECRET.value();
    const deps = {
      store: firestoreStore(),
      verificationConfigured: Boolean(secret),
      verifyTurnstile: async (token: string) => {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
        });
        return ((await r.json()) as { success?: boolean }).success === true;
      },
      now: () => new Date(),
    };
    const reply =
      req.method === 'GET'
        ? await handleGetPoll(req.query.poll, deps)
        : req.method === 'POST'
          ? await handleAnswer(req.body, deps)
          : { status: 405, body: { ok: false, message: 'Method not allowed.' } };
    res.status(reply.status).json(reply.body);
  },
);
