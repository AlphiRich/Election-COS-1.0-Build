/**
 * RLS_AUDIT (agent 15), static form: reads firestore.rules as text and fails if any tenant
 * collection lets a request through without tying it to the caller's tenant.
 *
 * It does not run the rules; the emulator suite does that (tools/voters-roll/appRules.emulator.ts).
 * What this catches is the edit that matters most and is easiest to make: a new or loosened
 * `allow` that forgets `tenantOK(tid)`, or an `if true`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

export interface Block {
  path: string;
  body: string;
}
const strip = (s: string) => s.replace(/\/\/.*$/gm, '');

export function blocks(rules: string): Block[] {
  const src = strip(rules);
  const out: Block[] = [];
  const re = /match\s+(\/[^\s{]*(?:\{[^}]*\}[^\s{]*)*)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < src.length) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    out.push({ path: m[1], body: src.slice(re.lastIndex, i - 1) });
  }
  return out;
}

/** The `allow` statements directly in a block (not in nested matches). */
export function allows(body: string): string[] {
  const noNested = body.replace(/match\s+[^{]*\{[\s\S]*\}/g, '');
  return noNested.match(/allow\s+[^;]*;/g) ?? [];
}

const rules = readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf-8');

describe('firestore.rules tenant isolation (static audit)', () => {
  const all = blocks(rules);
  const tenantBlocks = all.filter(
    (b) => b.path.startsWith('/tenants/{tid}/') && !b.path.includes('{document=**}'),
  );

  it('finds the collections (guards the parser itself)', () => {
    expect(tenantBlocks.length).toBeGreaterThanOrEqual(25);
  });

  it('keeps a deny-everything catch-all for the tenant tree', () => {
    const catchAll = all.find((b) => b.path === '/tenants/{tid}/{document=**}');
    expect(catchAll).toBeTruthy();
    expect(allows(catchAll!.body).join(' ')).toMatch(/read, write: if false/);
  });

  it('never allows an unconditional request', () => {
    expect(strip(rules)).not.toMatch(/:\s*if\s+true/);
  });

  it('ties every non-denied allow in a tenant collection to the caller’s tenant', () => {
    const offenders: string[] = [];
    for (const b of tenantBlocks) {
      for (const a of allows(b.body)) {
        if (/if\s+false\s*;/.test(a)) continue;
        if (!/tenantOK\(tid\)/.test(a)) offenders.push(`${b.path}: ${a.replace(/\s+/g, ' ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * Configuration collections whose editors may delete (`allow write`). Found by this audit,
   * left as they are: removing a ward or the tenant profile is a configuration act, not loss of
   * campaign records, and the owner has not asked for it to change. Any other collection must
   * deny delete explicitly. Review before adding to this list.
   */
  const DELETE_ALLOWED = new Set([
    '/tenants/{tid}/profile/{docId}',
    '/tenants/{tid}/wards/{wardCode}',
    '/tenants/{tid}/votingDistricts/{vdCode}',
  ]);

  it('never allows a hard delete of a tenant record, except the listed configuration collections', () => {
    const offenders: string[] = [];
    for (const b of tenantBlocks) {
      if (DELETE_ALLOWED.has(b.path)) continue;
      for (const a of allows(b.body)) {
        const kinds = /allow\s+([^:]*):/.exec(a)![1];
        if (/\b(delete|write)\b/.test(kinds) && !/if\s+false\s*;/.test(a)) {
          // `write` includes delete; it must be paired with an explicit delete denial in the block
          if (!/allow\s+delete:\s*if\s+false/.test(b.body)) offenders.push(`${b.path}: ${kinds}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps the public enquiries collection closed to every client', () => {
    const e = all.find((b) => b.path === '/enquiries/{enquiryId}');
    expect(e).toBeTruthy();
    expect(allows(e!.body).join(' ')).toMatch(/if false/);
  });

  it('keeps server-only collections closed to client writes', () => {
    for (const name of [
      'auditLog',
      'counters',
      'counterEvents',
      'membershipOtpChallenges',
      'entitlements',
    ]) {
      const b = tenantBlocks.find((x) => x.path.includes(`/${name}/`));
      expect(b, name).toBeTruthy();
      const writes = allows(b!.body).filter((a) =>
        /\b(create|update|write|delete)\b/.test(/allow\s+([^:]*):/.exec(a)![1]),
      );
      for (const w of writes) expect(w, `${name}: ${w}`).toMatch(/if\s+false\s*;/);
    }
  });
});
