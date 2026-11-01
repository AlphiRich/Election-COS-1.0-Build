/**
 * Election Campaign OS — poll endpoint core (decisions only; wiring is pollHttp.ts).
 *
 * PRIVACY BY CONSTRUCTION. The only data accepted is: which poll, one option from that poll's
 * own list (or UNDECIDED / PREFER_NOT_TO_SAY), a channel tag, an optional ward code, a consent
 * acknowledgement and a Turnstile token. There is no free-text field, so nothing identifying can
 * be typed into it, and unknown fields are ignored, never stored. What is stored is a COUNT in
 * `tenants/{t}/pollTallies/{poll}`; no per-response row exists, so an answer cannot be traced to
 * a person, a time or a device later. Single-use link tokens are stored only as a hash with a
 * "used" flag, in a separate document that holds no answer, so a token cannot be tied to its answer.
 *
 * LIMITS, STATED. 'open' polls (a public link) can be stuffed by someone willing to solve many
 * Turnstile challenges; the rate limit is a Cloudflare rule, not this code. 'single' polls
 * (one link per invitee) cannot be answered twice per link. Results are a self-selected sample
 * either way; the dashboard says so.
 */
import { createHash } from 'node:crypto';

export const CHANNELS = [
  'website',
  'app',
  'whatsapp',
  'facebook',
  'x',
  'instagram',
  'tiktok',
  'telegram',
  'linkedin',
  'youtube',
  'sms',
  'email',
  'other',
] as const;
export const NEUTRAL_OPTIONS = ['UNDECIDED', 'PREFER_NOT_TO_SAY'] as const;
const WARD_RE = /^[A-Z0-9][A-Z0-9-]{2,19}$/;
const POLL_ID_RE = /^[A-Za-z0-9]{8,32}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export interface StoredPoll {
  tenantId: string;
  pollId: string;
  publicId: string;
  question: string;
  options: string[];
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  closesAt?: string;
  tokenMode: 'single' | 'open';
  organiser: string;
}

export interface PollStore {
  findByPublicId(publicId: string): Promise<StoredPoll | null>;
  /**
   * Atomically: if single mode, create the token doc (false if it already exists), then add 1 to
   * the tally key. Returns false for a reused token.
   */
  record(poll: StoredPoll, key: string, tokenHash: string | null): Promise<boolean>;
}

export interface PollDeps {
  store: PollStore;
  verificationConfigured: boolean;
  verifyTurnstile: (token: string) => Promise<boolean>;
  now: () => Date;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const fail = (status: number, message: string): Reply => ({ status, body: { ok: false, message } });
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const tallyKey = (channel: string, ward: string | undefined, option: string) =>
  `${channel}|${ward || '-'}|${option}`;

function openness(p: StoredPoll, now: Date): string | null {
  if (p.status !== 'OPEN') return 'This poll is not open.';
  if (p.closesAt && now.getTime() > Date.parse(p.closesAt)) return 'This poll has closed.';
  return null;
}

/** GET: the public definition. Nothing about the tenant, and no tallies. */
export async function handleGetPoll(publicId: unknown, deps: PollDeps): Promise<Reply> {
  if (typeof publicId !== 'string' || !POLL_ID_RE.test(publicId)) return fail(404, 'No such poll.');
  const poll = await deps.store.findByPublicId(publicId);
  if (!poll) return fail(404, 'No such poll.');
  const closed = openness(poll, deps.now());
  return {
    status: 200,
    body: {
      ok: true,
      open: closed === null,
      question: poll.question,
      options: poll.options,
      organiser: poll.organiser,
      tokenMode: poll.tokenMode,
    },
  };
}

/** POST: one answer. */
export async function handleAnswer(body: unknown, deps: PollDeps): Promise<Reply> {
  if (!deps.verificationConfigured) return fail(503, 'Polling is not switched on.');
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (b.website) return { status: 200, body: { ok: true } }; // honeypot: look like success, store nothing
  if (typeof b.pollId !== 'string' || !POLL_ID_RE.test(b.pollId)) return fail(400, 'No such poll.');
  if (b.consent !== true) return fail(400, 'Please confirm that you have read the notice.');
  if (typeof b.turnstileToken !== 'string' || !(await deps.verifyTurnstile(b.turnstileToken))) {
    return fail(400, 'Please complete the check and try again.');
  }
  const poll = await deps.store.findByPublicId(b.pollId);
  if (!poll) return fail(404, 'No such poll.');
  const closed = openness(poll, deps.now());
  if (closed) return fail(409, closed);

  const allowed = new Set<string>([...poll.options, ...NEUTRAL_OPTIONS]);
  if (typeof b.option !== 'string' || !allowed.has(b.option))
    return fail(400, 'Please choose one of the options.');
  if (b.option.includes('|')) return fail(400, 'Please choose one of the options.');

  const channel =
    typeof b.channel === 'string' && (CHANNELS as readonly string[]).includes(b.channel)
      ? b.channel
      : 'other';
  const ward = typeof b.ward === 'string' && WARD_RE.test(b.ward) ? b.ward : undefined;

  let tokenHash: string | null = null;
  if (poll.tokenMode === 'single') {
    if (typeof b.token !== 'string' || !TOKEN_RE.test(b.token))
      return fail(400, 'This link is not valid.');
    tokenHash = hashToken(b.token);
  }
  const ok = await deps.store.record(poll, tallyKey(channel, ward, b.option), tokenHash);
  if (!ok) return fail(409, 'This link has already been used.');
  return { status: 200, body: { ok: true } };
}
