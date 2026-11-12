import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runBot } from '../../scripts/results-bot';

const feed = (generatedAt: string, votes = 10) =>
  JSON.stringify({
    schemaVersion: 1,
    source: 'Test fixture',
    generatedAt,
    municipalities: [
      {
        code: 'NW405',
        ballot: 'PR',
        votingDistrictsReported: 1,
        votingDistrictsTotal: 108,
        parties: [{ name: 'A', votes }],
      },
    ],
  });
const NOW = Date.parse('2026-11-05T12:00:00+02:00');

describe('results bot', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'bot-'));
  const out = path.join(dir, 'results', 'feed.json');
  const reading = (text: string) => async () => text;

  it('refuses, and writes nothing, with no source configured', async () => {
    const r = await runBot({ source: undefined, out, now: NOW });
    expect(r.published).toBe(false);
    expect(existsSync(out)).toBe(false);
  });

  it('refuses unreadable, non-JSON and invalid feeds without touching the output', async () => {
    const failing = await runBot({
      source: 'x',
      out,
      now: NOW,
      read: async () => {
        throw new Error('boom');
      },
    });
    expect(failing.published).toBe(false);
    expect(
      (await runBot({ source: 'x', out, now: NOW, read: reading('not json') })).published,
    ).toBe(false);
    const bad = feed('2026-11-05T08:00:00+02:00').replace('NW405', 'ZZ999');
    expect((await runBot({ source: 'x', out, now: NOW, read: reading(bad) })).published).toBe(
      false,
    );
    expect(existsSync(out)).toBe(false);
  });

  it('publishes a valid feed, and then refuses an older one rather than going backwards', async () => {
    const first = await runBot({
      source: 'x',
      out,
      now: NOW,
      read: reading(feed('2026-11-05T09:00:00+02:00', 10)),
    });
    expect(first.published).toBe(true);
    const older = await runBot({
      source: 'x',
      out,
      now: NOW,
      read: reading(feed('2026-11-05T08:00:00+02:00', 99)),
    });
    expect(older.published).toBe(false);
    expect(JSON.parse(readFileSync(out, 'utf-8')).municipalities[0].parties[0].votes).toBe(10);
    const newer = await runBot({
      source: 'x',
      out,
      now: NOW,
      read: reading(feed('2026-11-05T10:00:00+02:00', 20)),
    });
    expect(newer.published).toBe(true);
    expect(JSON.parse(readFileSync(out, 'utf-8')).municipalities[0].parties[0].votes).toBe(20);
  });

  it('reads a local file source', async () => {
    const src = path.join(dir, 'in.json');
    writeFileSync(src, feed('2026-11-05T11:00:00+02:00', 30));
    expect((await runBot({ source: src, out, now: NOW })).published).toBe(true);
  });
});
