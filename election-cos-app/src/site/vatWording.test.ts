/**
 * Innovation Consult is not registered for VAT (below the SARS compulsory
 * registration threshold), so it may not charge VAT or describe a price as
 * excluding it. The published price is the whole price.
 *
 * Proved by injection, then reverted clean: restoring "excluding VAT at the
 * prevailing statutory rate" in SitePackages.tsx fails the first test.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VAT_NOTE } from './siteContent';

const SITE = __dirname;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : [];
  });
}

describe('prices carry no VAT', () => {
  it('no page says a price excludes, includes or adds VAT', () => {
    const bad = /\b(excl(?:\.|uding|udes?)?|incl(?:\.|uding|udes?)?|plus|\+)\s+VAT\b/i;
    for (const file of sources(SITE)) {
      const hit = readFileSync(file, 'utf8').match(bad);
      expect(hit?.[0], path.relative(SITE, file)).toBeUndefined();
    }
  });

  it('the price note says no VAT is charged', () => {
    expect(VAT_NOTE).toMatch(/no VAT is charged/i);
    expect(VAT_NOTE).toMatch(/not registered for VAT/i);
  });
});
