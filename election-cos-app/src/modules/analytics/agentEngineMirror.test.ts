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

const ROOT = path.resolve(__dirname, '..', '..', '..'); // src/modules/analytics -> election-cos-app
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n');

describe('the agent’s mirrored seat engine is in sync with the source', () => {
  for (const spec of ENGINE_MIRRORS) {
    it(`${spec.dest} — run \`npm run gen:agent-engine\` if this fails`, () => {
      expect(read(spec.dest)).toBe(renderMirror(spec, read(spec.src)));
    });
  }
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
