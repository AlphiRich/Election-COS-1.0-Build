/**
 * Election Campaign OS — voter sentiment polls: the model shared by the dashboard and the forms.
 *
 * WHAT A RESPONSE IS. A closed choice, a channel tag, an optional ward code, and a time. No name,
 * phone, ID number, free text, IP address or device id is collected, so there is nothing to link
 * an answer to a person. Political opinion is special personal information under POPIA; the
 * strongest control is to not hold it in identifiable form at all, and this design does that.
 * The server keeps COUNTS, not rows (functions/src/pollSubmit.ts).
 *
 * WHAT THE RESULTS ARE. A self-selected sample: people who saw a link and chose to answer. It is
 * not a random sample, not weighted, and not representative of the electorate, so the dashboard
 * never shows a margin of error (one would imply a representativeness that does not exist) and
 * never presents the shares as a forecast. Cells under MIN_CELL responses are hidden so a small
 * ward cannot expose how a few people answered.
 */
export const MIN_CELL = 5;

/** Options every poll carries, so a person is never forced to name a party. */
export const NEUTRAL_OPTIONS = ['UNDECIDED', 'PREFER_NOT_TO_SAY'] as const;

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
export type Channel = (typeof CHANNELS)[number];

export const SELF_SELECTED_CAVEAT =
  'These are the answers of people who chose to respond to a link. They are not a random sample ' +
  'of voters, are not weighted, and cannot be read as the views of the electorate or as a ' +
  'forecast. Differences between channels mostly show who each channel reached.';

export const POLL_NOTICE_VERSION = '[POLL-NOTICE-V1 pending attorney]';

export interface PollDefinition {
  id: string;
  publicId: string;
  question: string;
  /** Party or choice labels set by the organiser; the neutral options are added automatically. */
  options: string[];
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  closesAt?: string;
  /** 'single' = each link works once (WhatsApp invitations); 'open' = a public link anyone can use. */
  tokenMode: 'single' | 'open';
  organiser: string;
}

export class PollDefinitionError extends Error {}

export function validateDefinition(
  d: Pick<PollDefinition, 'question' | 'options' | 'organiser'>,
): void {
  if (d.question.trim().length < 8 || d.question.length > 200) {
    throw new PollDefinitionError('The question must be 8 to 200 characters.');
  }
  if (!d.organiser.trim()) throw new PollDefinitionError('Name who is running the poll.');
  const opts = d.options.map((o) => o.trim());
  if (opts.length < 2 || opts.length > 20) throw new PollDefinitionError('Give 2 to 20 options.');
  if (opts.some((o) => !o || o.length > 60))
    throw new PollDefinitionError('Each option is 1 to 60 characters.');
  if (opts.some((o) => o.includes('|'))) throw new PollDefinitionError('Options cannot contain the | character.');
  if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) {
    throw new PollDefinitionError('Options must be different from each other.');
  }
  if (
    opts.some((o) =>
      (NEUTRAL_OPTIONS as readonly string[]).includes(o.toUpperCase().replace(/ /g, '_')),
    )
  ) {
    throw new PollDefinitionError('"Undecided" and "Prefer not to say" are added for you.');
  }
}

/** Tally keys are `channel|ward|option`; ward is `-` when none was given. */
export const tallyKey = (channel: string, ward: string | undefined, option: string) =>
  `${channel}|${ward || '-'}|${option}`;

export function parseTallyKey(
  k: string,
): { channel: string; ward: string | null; option: string } | null {
  const parts = k.split('|');
  if (parts.length !== 3) return null;
  return { channel: parts[0], ward: parts[1] === '-' ? null : parts[1], option: parts[2] };
}

export interface ShareRow {
  option: string;
  count: number;
  share: number;
}
export interface PollDashboard {
  total: number;
  overall: ShareRow[];
  byChannel: Array<{ channel: string; total: number; rows: ShareRow[] | null }>;
  byWard: Array<{ ward: string; total: number; rows: ShareRow[] | null }>;
  suppressedCells: number;
  caveat: string;
}

function rowsOf(counts: Map<string, number>): ShareRow[] {
  const total = [...counts.values()].reduce((s, v) => s + v, 0);
  return [...counts.entries()]
    .map(([option, count]) => ({ option, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.option.localeCompare(b.option));
}

/** Builds the dashboard view from the stored counts, hiding any group smaller than MIN_CELL. */
export function buildDashboard(counts: Record<string, number>): PollDashboard {
  const overall = new Map<string, number>();
  const ch = new Map<string, Map<string, number>>();
  const wd = new Map<string, Map<string, number>>();
  let total = 0;
  for (const [k, n] of Object.entries(counts)) {
    const p = parseTallyKey(k);
    if (!p || !(n > 0)) continue;
    total += n;
    overall.set(p.option, (overall.get(p.option) ?? 0) + n);
    const c = ch.get(p.channel) ?? new Map();
    c.set(p.option, (c.get(p.option) ?? 0) + n);
    ch.set(p.channel, c);
    if (p.ward) {
      const w = wd.get(p.ward) ?? new Map();
      w.set(p.option, (w.get(p.option) ?? 0) + n);
      wd.set(p.ward, w);
    }
  }
  let suppressed = 0;
  const group = (m: Map<string, Map<string, number>>) =>
    [...m.entries()]
      .map(([name, opts]) => {
        const t = [...opts.values()].reduce((s, v) => s + v, 0);
        const hide = t < MIN_CELL;
        if (hide) suppressed++;
        return { name, total: t, rows: hide ? null : rowsOf(opts) };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return {
    total,
    // The overall figure is hidden too when the whole sample is tiny.
    overall: total < MIN_CELL ? [] : rowsOf(overall),
    byChannel: group(ch).map((g) => ({ channel: g.name, total: g.total, rows: g.rows })),
    byWard: group(wd).map((g) => ({ ward: g.name, total: g.total, rows: g.rows })),
    suppressedCells: suppressed,
    caveat: SELF_SELECTED_CAVEAT,
  };
}

/* ------------------------------------------------------------ share links */

export function pollUrl(
  siteOrigin: string,
  publicId: string,
  channel: Channel,
  token?: string,
): string {
  const u = new URL(`/poll/${encodeURIComponent(publicId)}`, siteOrigin);
  u.searchParams.set('c', channel);
  if (token) u.searchParams.set('t', token);
  return u.toString();
}

/**
 * Plain share links, no SDKs, no pixels. The person who taps one chooses to send it; nothing is
 * sent on anyone's behalf. Platforms with no web share URL (Instagram, TikTok, YouTube) get the
 * link to paste, not a pretend button.
 */
export function shareLinks(siteOrigin: string, publicId: string, text: string) {
  const link = (c: Channel) => pollUrl(siteOrigin, publicId, c);
  const enc = encodeURIComponent;
  return [
    {
      channel: 'whatsapp' as const,
      label: 'WhatsApp',
      href: `https://wa.me/?text=${enc(`${text} ${link('whatsapp')}`)}`,
    },
    {
      channel: 'facebook' as const,
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link('facebook'))}`,
    },
    {
      channel: 'x' as const,
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link('x'))}`,
    },
    {
      channel: 'telegram' as const,
      label: 'Telegram',
      href: `https://t.me/share/url?url=${enc(link('telegram'))}&text=${enc(text)}`,
    },
    {
      channel: 'linkedin' as const,
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(link('linkedin'))}`,
    },
    {
      channel: 'email' as const,
      label: 'Email',
      href: `mailto:?subject=${enc(text)}&body=${enc(link('email'))}`,
    },
    { channel: 'sms' as const, label: 'SMS', href: `sms:?&body=${enc(`${text} ${link('sms')}`)}` },
  ];
}
export const PASTE_ONLY: Array<{ channel: Channel; label: string }> = [
  { channel: 'instagram', label: 'Instagram (paste into bio or story)' },
  { channel: 'tiktok', label: 'TikTok (paste into bio)' },
  { channel: 'youtube', label: 'YouTube (paste into description)' },
];
