/**
 * Guards the agent's mirrored seat engine against drift — the same arrangement
 * `roleMirror.test.ts` has for the role table. The mirror is compared to what
 * the generator renders from the live source, so an engine change that is not
 * regenerated fails the build.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_MIRRORS, renderMirror, type MirrorSpec } from './agentEngineMirror';
import { NW_SEATS_2026_DEST, renderNwSeats2026 } from './agentBaseline2026';

const ROOT = path.resolve(__dirname, '..', '..', '..'); // src/modules/analytics -> election-cos-app
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');

describe('the agent’s mirrored seat engine is in sync with the source', () => {
  for (const spec of ENGINE_MIRRORS) {
    it(`${spec.dest} — run \`npm run gen:agent-engine\` if this fails`, () => {
      expect(read(spec.dest)).toBe(renderMirror(spec, read(spec.src)));
    });
  }

  it(`${NW_SEATS_2026_DEST} matches the certified 2026 pipeline — run \`npm run gen:agent-engine\` if this fails`, () => {
    expect(read(NW_SEATS_2026_DEST)).toBe(renderNwSeats2026());
  });

  it('the 2026 snapshot covers all 18 NW local municipalities with real figures', () => {
    const snap = JSON.parse(read(NW_SEATS_2026_DEST)) as Record<string, { totalSeats: number; parties: unknown[] }>;
    expect(Object.keys(snap)).toHaveLength(18);
    for (const code of Object.keys(snap)) {
      expect(code).toMatch(/^NW\d{3}$/);
      expect(snap[code].totalSeats).toBeGreaterThan(0);
      expect(snap[code].parties.length).toBeGreaterThan(0);
    }
  });
});

describe('renderMirror', () => {
  const seatSpec = ENGINE_MIRRORS.find((s) => s.dest.endsWith('seatCalculator.ts')) as MirrorSpec;

  it('rewrites the register import to a local path', () => {
    const out = renderMirror(seatSpec, "import { allocateSeats } from '@/modules/reference/municipalRegister';\n");
    expect(out).toContain("'./municipalRegister'");
    expect(out).not.toContain('@/');
  });

  it('refuses to emit a mirror that still carries an unrewritten @/ alias', () => {
    // seatCalculator's spec does not rewrite the data-JSON alias, so an input
    // carrying it must throw rather than ship a file that cannot resolve.
    expect(() =>
      renderMirror(seatSpec, "import d from '@/data/iec/circular-1-2025-annexure-a.json';\n"),
    ).toThrow(/unrewritten/);
  });

  it('copies JSON byte-for-byte with no banner', () => {
    const jsonSpec = ENGINE_MIRRORS.find((s) => s.kind === 'json') as MirrorSpec;
    expect(renderMirror(jsonSpec, '{"a":1}')).toBe('{"a":1}');
  });
});
