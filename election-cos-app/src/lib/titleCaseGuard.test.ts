/**
 * House style: every heading on the public site and in the application is
 * in Title Case (src/lib/titleCase.ts). This scans the source for literal
 * headings — <h1>–<h4> text and the `heading`/`eyebrow` fields that feed
 * them — so a new lowercase heading fails here before anyone sees it.
 *
 * Proved by injection, then reverted clean: writing <h2>Questions people ask</h2>
 * into SiteHome.tsx fails "every literal heading is in Title Case".
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isTitleCase } from './titleCase';

const SRC = path.resolve(__dirname, '..');
const DIRS = ['site', 'app', 'modules', 'components', 'auth'];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

/** A sentence that happens to sit in a heading slot (rare, long, with a full stop) is not checked. */
const isSentence = (s: string) => s.split(/\s+/).length > 9 && /\.$/.test(s);

function headingsIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/<h([1-4])\b[^<>]*>([^<>{}]+)<\/h\1>/g)) out.push(m[2]);
  for (const m of text.matchAll(/\b(?:heading|eyebrow)(?:=|\s*:\s*)(['"])([^'"\n{}]+)\1/g)) out.push(m[2]);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter((s) => /[a-z]/.test(s) && !isSentence(s));
}

describe('house Title Case', () => {
  it('every literal heading is in Title Case', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of sources(path.join(SRC, dir))) {
        for (const h of headingsIn(readFileSync(file, 'utf8'))) {
          if (!isTitleCase(h)) offenders.push(`${path.relative(SRC, file)}: ${h}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
