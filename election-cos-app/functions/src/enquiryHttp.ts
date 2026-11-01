/**
 * Election Campaign OS — enquiry endpoint (HTTP)
 *
 * @deployable fails-closed
 *
 * Fails closed on purpose: until the Cloudflare Turnstile secret
 * (`TURNSTILE_SECRET`) is set on the project it answers 503 and stores
 * nothing. All decisions are in `enquiry.ts`; this file is wiring.
 *
 * Writes `enquiries/{id}` (top-level, platform-owned, not a tenant
 * collection). `firestore.rules` denies every client read and write to it:
 * only staff with Admin access read enquiries.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { REGION } from './region';
import { ENQUIRY_ORIGINS } from './enquiryOrigins';
import { handleEnquiry } from './enquiry';

const TURNSTILE_SECRET = defineSecret('TURNSTILE_SECRET');

export const submitEnquiry = onRequest(
  { region: REGION, secrets: [TURNSTILE_SECRET], maxInstances: 5, cors: false },
  async (req, res) => {
    const origin = String(req.get('origin') ?? '');
    const allowed = (ENQUIRY_ORIGINS as readonly string[]).includes(origin);
    if (allowed) {
      res.set('Access-Control-Allow-Origin', origin);
      res.set('Vary', 'Origin');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.status(allowed ? 204 : 403).end();
      return;
    }
    if (!getApps().length) initializeApp();
    const secret = TURNSTILE_SECRET.value();
    const reply = await handleEnquiry(req.method, origin, req.body, {
      verificationConfigured: Boolean(secret),
      verifyTurnstile: async (token) => {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: token }),
        });
        const j = (await r.json()) as { success?: boolean };
        return j.success === true;
      },
      store: async (id, data) => {
        try {
          await getFirestore().collection('enquiries').doc(id).create(data);
          return true;
        } catch (e) {
          if ((e as { code?: number }).code === 6) return false; // ALREADY_EXISTS: a duplicate, not an error
          throw e;
        }
      },
      now: () => new Date(),
    });
    res.status(reply.status).json(reply.body);
  },
);
