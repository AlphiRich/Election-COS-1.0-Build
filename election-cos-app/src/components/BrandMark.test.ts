/**
 * One brand mark everywhere: the header mark, the favicon and the PWA icons.
 *
 * Proved by injection, then reverted clean: editing a shape in brandMarkSvg.ts
 * without re-running `npm run build:icons` fails "public/icon.svg is the mark".
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_MARK_SVG, brandMarkSquareSvg } from './brandMarkSvg';
import { tokens } from '@/design/tokens';

const PUBLIC = path.resolve(__dirname, '..', '..', 'public');

describe('brand mark', () => {
  it('public/icon.svg is the mark (re-run npm run build:icons after changing it)', () => {
    // Line endings normalised: a Windows checkout may hold the file as CRLF.
    expect(readFileSync(path.join(PUBLIC, 'icon.svg'), 'utf8').replace(/
/g, '
')).toBe(BRAND_MARK_SVG);
  });

  it('is the ballot box and node network, not the retired ballot-cross square', () => {
    const svg = readFileSync(path.join(PUBLIC, 'icon.svg'), 'utf8');
    expect(svg).toContain('M5 33V78H62V33');
    expect(svg).not.toContain('Ballot-cross');
  });

  it('uses only design-token colours', () => {
    const allowed = new Set(Object.values(tokens.color).map((c) => String(c).toLowerCase()));
    for (const hex of BRAND_MARK_SVG.match(/#[0-9a-f]{6}/gi) ?? []) {
      expect(allowed.has(hex.toLowerCase()), hex).toBe(true);
    }
  });

  it('keeps the whole mark inside the maskable safe zone (central 80 % circle)', () => {
    const px = 512;
    const svg = brandMarkSquareSvg(px, 0.6);
    const [, tx, ty, s] = svg.match(/translate\(([\d.-]+) ([\d.-]+)\) scale\(([\d.]+)\)/)!.map(Number);
    const radius = 0.4 * px;
    for (const [x, y] of [[0, 2], [128.3, 2], [0, 106.3], [128.3, 106.3]]) {
      const dx = tx + x * s - px / 2;
      const dy = ty + y * s - px / 2;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(radius);
    }
  });
});
