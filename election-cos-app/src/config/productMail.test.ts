import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE } from '@/site/siteContent';
import { CORPORATE_DOMAIN, PRODUCT_MAIL_DOMAIN, SITE_DOMAIN } from './publicDomain';

const ROOT = path.resolve(__dirname, '../..');
function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'dist-site' || name === '.git') continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|mjs|json|html|css)$/.test(name)) yield p;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('the product’s mail is on the product’s domain, never the corporate one', () => {
  it('the corporate domain is Innovation Consult’s and the product has its own', () => {
    expect(CORPORATE_DOMAIN).toBe('innovationconsult.co.za');
    expect(SITE_DOMAIN).toBe('electioncos.co.za');
    expect(PRODUCT_MAIL_DOMAIN).toBe(SITE_DOMAIN);
    expect(CORPORATE_DOMAIN).not.toBe(SITE_DOMAIN);
  });
  it('every company mailbox the product publishes ends with the product domain', () => {
    for (const m of SITE.mailboxes) expect(m.address.endsWith(`@${PRODUCT_MAIL_DOMAIN}`), m.address).toBe(true);
  });
  it('no source file (app, functions, scripts, site) names a mailbox on the corporate domain', () => {
    const offenders: string[] = [];
    const re = new RegExp(`[A-Za-z0-9._%+-]+@${escapeRegExp(CORPORATE_DOMAIN)}`, 'i');
    for (const base of [path.join(ROOT, 'src'), path.join(ROOT, 'functions/src'), path.join(ROOT, 'scripts'), path.join(ROOT, 'worker')]) {
      try { statSync(base); } catch { continue; }
      for (const f of walk(base)) {
        if (f.endsWith('productMail.test.ts')) continue;
        if (re.test(readFileSync(f, 'utf8'))) offenders.push(path.relative(ROOT, f));
      }
    }
    expect(offenders).toEqual([]);
  });
});
