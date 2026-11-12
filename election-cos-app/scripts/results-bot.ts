/**
 * Election Campaign OS — results bot
 *
 * @deployable fails-closed
 *
 * Reads a results feed, checks it against the schema and the delimitation
 * register, and writes it where the site serves `/results/feed.json`. It
 * refuses, and writes nothing, if:
 *
 *  - no source is configured (RESULTS_SOURCE is a file path or an https
 *    URL of a feed ALREADY in this schema),
 *  - the source cannot be read,
 *  - the feed fails validation, or
 *  - the feed is older than the one already published.
 *
 * What it deliberately does not do: parse the Electoral Commission's own
 * results format. This build has not seen that format, so a converter
 * would be a guess. Until one exists, the bot publishes only a feed
 * somebody has produced in this schema. It is meant to run every 30
 * minutes (see docs/results-bot.md); a refusal exits non-zero so the
 * scheduler shows it, and the previously published file stays untouched.
 *
 * Run it with `scripts/results-bot-cli.ts` (the library and the entry point
 * are separate files so importing this one, as the tests do, never runs it):
 *
 *   RESULTS_SOURCE=feed.json RESULTS_OUT=dist-site/results/feed.json \
 *     npx vite-node scripts/results-bot-cli.ts
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { validateFeed, type ResultsFeed } from '../src/site/tools/resultsFeed';

export type BotOutcome =
  | { published: true; municipalities: number; generatedAt: string }
  | { published: false; reason: string };

export async function runBot(opts: {
  source: string | undefined;
  out: string;
  now?: number;
  read?: (src: string) => Promise<string>;
}): Promise<BotOutcome> {
  const { source, out } = opts;
  if (!source)
    return {
      published: false,
      reason: 'RESULTS_SOURCE is not set, so there is nothing to publish.',
    };

  let raw: string;
  try {
    raw = opts.read
      ? await opts.read(source)
      : /^https:\/\//.test(source)
        ? await (await fetch(source)).text()
        : readFileSync(source, 'utf-8');
  } catch (e) {
    return {
      published: false,
      reason: `Could not read the source: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { published: false, reason: 'The source is not valid JSON.' };
  }

  const check = validateFeed(json, opts.now);
  if (!check.ok)
    return { published: false, reason: `Validation failed: ${check.errors.slice(0, 5).join(' ')}` };

  if (existsSync(out)) {
    try {
      const prev = JSON.parse(readFileSync(out, 'utf-8')) as ResultsFeed;
      if (Date.parse(prev.generatedAt) > Date.parse(check.feed.generatedAt)) {
        return { published: false, reason: 'The feed is older than the one already published.' };
      }
    } catch {
      /* an unreadable previous file is replaced */
    }
  }

  // Write to a temporary file and rename, so a reader never sees half a file.
  mkdirSync(path.dirname(out), { recursive: true });
  const tmp = `${out}.tmp`;
  writeFileSync(tmp, JSON.stringify(check.feed));
  renameSync(tmp, out);
  return {
    published: true,
    municipalities: check.feed.municipalities.length,
    generatedAt: check.feed.generatedAt,
  };
}
