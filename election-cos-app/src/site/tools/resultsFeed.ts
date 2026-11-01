/**
 * Election Campaign OS — public site, results feed: schema and validation
 *
 * The dashboard shows what a feed file says and nothing it infers. The
 * feed is produced by `scripts/results-bot.ts`, which accepts a feed only
 * if it passes `validateFeed`. Nothing here knows the format the
 * Electoral Commission publishes results in, because this build has not
 * seen it. A conversion from that format into this schema is the one piece
 * left to write, and until it exists the dashboard shows an empty state
 * and sends people to the Commission.
 *
 * Validation checks relationships, not just presence (build rule 5):
 * municipality codes must exist in the delimitation register, reported
 * districts cannot exceed total districts, and a feed dated in the future
 * is refused.
 */
import { lookupMunicipality } from '@/modules/reference/municipalRegister';

export interface FeedParty {
  name: string;
  votes: number;
}

export interface FeedMunicipality {
  code: string;
  ballot: 'PR' | 'WARD' | 'DISTRICT';
  votingDistrictsReported: number;
  votingDistrictsTotal: number;
  parties: FeedParty[];
}

export interface ResultsFeed {
  schemaVersion: 1;
  /** Who produced the figures, in words, for the page. */
  source: string;
  /** ISO 8601 with offset. */
  generatedAt: string;
  municipalities: FeedMunicipality[];
}

export type FeedCheck = { ok: true; feed: ResultsFeed } | { ok: false; errors: string[] };

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

export function validateFeed(input: unknown, nowMs: number = Date.now()): FeedCheck {
  const errors: string[] = [];
  const f = input as Partial<ResultsFeed> | null;
  if (!f || typeof f !== 'object') return { ok: false, errors: ['The feed is not an object.'] };
  if (f.schemaVersion !== 1) errors.push('schemaVersion must be 1.');
  if (typeof f.source !== 'string' || f.source.trim().length < 3)
    errors.push('source must say who produced the figures.');
  const t = typeof f.generatedAt === 'string' ? Date.parse(f.generatedAt) : NaN;
  if (Number.isNaN(t)) errors.push('generatedAt must be an ISO 8601 date-time.');
  else if (t > nowMs + 5 * 60_000) errors.push('generatedAt is in the future.');
  if (!Array.isArray(f.municipalities)) errors.push('municipalities must be a list.');
  else {
    const seen = new Set<string>();
    f.municipalities.forEach((m, i) => {
      const at = `municipalities[${i}]`;
      if (!m || typeof m !== 'object') return void errors.push(`${at} is not an object.`);
      if (!lookupMunicipality(String(m.code)))
        errors.push(`${at}: ${String(m.code)} is not in the delimitation register.`);
      if (!['PR', 'WARD', 'DISTRICT'].includes(m.ballot))
        errors.push(`${at}: ballot must be PR, WARD or DISTRICT.`);
      const key = `${m.code}/${m.ballot}`;
      if (seen.has(key)) errors.push(`${at}: ${key} appears twice.`);
      seen.add(key);
      if (!isInt(m.votingDistrictsTotal) || !isInt(m.votingDistrictsReported))
        errors.push(`${at}: voting-district counts must be whole numbers.`);
      else if (m.votingDistrictsReported > m.votingDistrictsTotal)
        errors.push(`${at}: more districts reported than exist.`);
      if (!Array.isArray(m.parties)) errors.push(`${at}: parties must be a list.`);
      else
        m.parties.forEach((p, j) => {
          if (!p || typeof p.name !== 'string' || p.name.trim() === '')
            errors.push(`${at}.parties[${j}]: name is missing.`);
          if (!isInt(p?.votes))
            errors.push(`${at}.parties[${j}]: votes must be a whole number of at least 0.`);
        });
    });
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, feed: f as ResultsFeed };
}

export interface PartyShare {
  name: string;
  votes: number;
  /** Share of the votes counted so far, 0–100, one decimal. */
  percent: number;
}

/** Shares of votes counted so far. Arithmetic only: no seats, no projection. */
export function shares(parties: FeedParty[]): PartyShare[] {
  const total = parties.reduce((n, p) => n + p.votes, 0);
  return [...parties]
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
    .map((p) => ({ ...p, percent: total === 0 ? 0 : Math.round((p.votes / total) * 1000) / 10 }));
}
