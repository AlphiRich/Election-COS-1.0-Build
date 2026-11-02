import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  VaultKeyMissing,
  VaultOpenFailed,
  localKeyWrapper,
  openDocument,
  sealDocument,
} from './documentVault';

const kek = () => randomBytes(32).toString('base64');
const doc = Buffer.from('Signed referral REF EX-2026-0417');
const ctx = 't1/documents/d1';

describe('document vault', () => {
  it('round-trips, and the stored form does not contain the plaintext', () => {
    const w = localKeyWrapper(kek())!;
    const s = sealDocument(w, doc, ctx);
    expect(Buffer.from(s.data, 'base64').includes(doc)).toBe(false);
    expect(openDocument(w, s, ctx).equals(doc)).toBe(true);
  });
  it('uses a fresh data key and nonce each time', () => {
    const w = localKeyWrapper(kek())!;
    const a = sealDocument(w, doc, ctx);
    const b = sealDocument(w, doc, ctx);
    expect(a.data).not.toBe(b.data);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
  });
  it('refuses with no key, a short key, or no key at all: never stores in the clear', () => {
    expect(localKeyWrapper(undefined)).toBeNull();
    expect(localKeyWrapper(randomBytes(16).toString('base64'))).toBeNull();
    expect(() => sealDocument(null, doc, ctx)).toThrow(VaultKeyMissing);
    expect(() => openDocument(null, sealDocument(localKeyWrapper(kek())!, doc, ctx), ctx)).toThrow(
      VaultKeyMissing,
    );
  });
  it('will not open under the wrong key, or if any byte was altered', () => {
    const w = localKeyWrapper(kek())!;
    const s = sealDocument(w, doc, ctx);
    expect(() => openDocument(localKeyWrapper(kek())!, s, ctx)).toThrow(VaultOpenFailed);
    const raw = Buffer.from(s.data, 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => openDocument(w, { ...s, data: raw.toString('base64') }, ctx)).toThrow(
      VaultOpenFailed,
    );
    const wk = Buffer.from(s.wrappedKey, 'base64');
    wk[20] ^= 1;
    expect(() => openDocument(w, { ...s, wrappedKey: wk.toString('base64') }, ctx)).toThrow(
      VaultOpenFailed,
    );
  });
  it('cannot be moved to another record: the context is authenticated', () => {
    const w = localKeyWrapper(kek())!;
    const s = sealDocument(w, doc, ctx);
    expect(() => openDocument(w, s, 't2/documents/d1')).toThrow(VaultOpenFailed);
  });
});
