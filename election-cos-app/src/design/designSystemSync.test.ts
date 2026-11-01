import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tokens } from './tokens';

/**
 * Keeps the app's palette tied to the supplied ECOS design system
 * (docs/design-system/tokens.css). The design system calls two colours by
 * different names: its `amber` is the app's `gold`, its `blue` is the app's
 * `teal`. Names stay (renaming is churn); values must not drift.
 */
const css = readFileSync(path.resolve(__dirname, '../../docs/design-system/tokens.css'), 'utf-8')
  // Comments hold example hex values; assert only on real declarations.
  .replace(/\/\*[\s\S]*?\*\//g, '');
const ds = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
  if (!m) throw new Error(`--${name} not found in the design system`);
  return m[1]!.toUpperCase();
};

describe('the app palette matches the supplied design system', () => {
  const pairs: Array<[keyof typeof tokens.color, string]> = [
    ['ink', 'ink'],
    ['paper', 'paper'],
    ['gold', 'amber'],
    ['slate', 'slate'],
    ['teal', 'blue'],
    ['green', 'green'],
    ['roadmap', 'roadmap'],
    ['line', 'line'],
  ];
  for (const [appName, dsName] of pairs) {
    it(`${appName} is ${dsName}`, () => {
      expect(tokens.color[appName].toUpperCase()).toBe(ds(dsName));
    });
  }

  it('records the one colour the app has that the design system forbids (a red), so it cannot be forgotten', () => {
    const extra = Object.keys(tokens.color).filter((k) => !pairs.some(([a]) => a === k));
    expect(extra).toEqual(['maroon']);
  });
});
