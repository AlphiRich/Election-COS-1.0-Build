import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the hidden attribute', () => {
  it('still hides an element that a display utility such as flex is applied to', () => {
    // Found by looking at the rendered seat model: every tab panel showed
    // at once, because `flex` out-ranks the browser's [hidden] rule.
    const css = readFileSync(path.resolve(__dirname, 'site.css'), 'utf-8');
    expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
