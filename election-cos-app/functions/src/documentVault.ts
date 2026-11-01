/**
 * Election Campaign OS — document vault envelope encryption (agent 10, DOCUMENT_VAULT).
 *
 * Each document gets its own random 256-bit data key; the document is sealed with AES-256-GCM
 * under that key, and the data key is itself sealed (wrapped) under the key-encryption key (KEK).
 * Only the wrapped key travels with the document. Rotating the KEK means re-wrapping 32-byte keys,
 * not re-encrypting documents.
 *
 * The KEK is SUPPLIED, never generated or defaulted here: a secret (VAULT_KEK, 32 bytes, base64)
 * or, better, a call out to Cloud KMS wrapped behind `KeyWrapper`. With no KEK configured, every
 * operation REFUSES (`VaultKeyMissing`); nothing is ever written in the clear as a fallback.
 * GCM authenticates: a flipped bit anywhere, or the wrong KEK, fails to open rather than returning junk.
 *
 * NOT WIRED to storage yet. It needs the owner's key decision (Cloud KMS vs a secret) and the
 * Storage upload path to call `sealDocument`. The primitive is built and tested so that wiring is small.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class VaultKeyMissing extends Error {
  constructor() {
    super('No vault key is configured. Nothing is stored without one.');
    this.name = 'VaultKeyMissing';
  }
}
export class VaultOpenFailed extends Error {
  constructor() {
    super('The document could not be opened: wrong key, or it has been altered.');
    this.name = 'VaultOpenFailed';
  }
}

export interface Sealed {
  v: 1;
  /** data key wrapped under the KEK: iv(12) | tag(16) | ciphertext(32), base64 */
  wrappedKey: string;
  /** iv(12) | tag(16) | ciphertext, base64 */
  data: string;
  /** which KEK sealed it, so rotation can find what is still on the old one */
  kekId: string;
}

export interface KeyWrapper {
  readonly kekId: string;
  wrap(dataKey: Buffer): Buffer;
  unwrap(wrapped: Buffer): Buffer;
}

function gcmSeal(key: Buffer, plain: Buffer, aad: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aad);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]);
}
function gcmOpen(key: Buffer, blob: Buffer, aad: Buffer): Buffer {
  if (blob.length < 28) throw new VaultOpenFailed();
  try {
    const d = createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
    d.setAAD(aad);
    d.setAuthTag(blob.subarray(12, 28));
    return Buffer.concat([d.update(blob.subarray(28)), d.final()]);
  } catch {
    throw new VaultOpenFailed();
  }
}

/** A wrapper over a locally supplied 32-byte KEK (base64). Returns null if none/invalid: caller must refuse. */
export function localKeyWrapper(
  kekBase64: string | undefined,
  kekId = 'local-1',
): KeyWrapper | null {
  if (!kekBase64) return null;
  const kek = Buffer.from(kekBase64, 'base64');
  if (kek.length !== 32) return null;
  const aad = Buffer.from(`vault-key:${kekId}`);
  return {
    kekId,
    wrap: (k) => gcmSeal(kek, k, aad),
    unwrap: (w) => gcmOpen(kek, w, aad),
  };
}

/** `context` (tenant + document id) is bound in as authenticated data: a sealed blob cannot be moved to another record. */
export function sealDocument(wrapper: KeyWrapper | null, plain: Buffer, context: string): Sealed {
  if (!wrapper) throw new VaultKeyMissing();
  const dataKey = randomBytes(32);
  const aad = Buffer.from(context);
  return {
    v: 1,
    kekId: wrapper.kekId,
    wrappedKey: wrapper.wrap(dataKey).toString('base64'),
    data: gcmSeal(dataKey, plain, aad).toString('base64'),
  };
}

export function openDocument(wrapper: KeyWrapper | null, sealed: Sealed, context: string): Buffer {
  if (!wrapper) throw new VaultKeyMissing();
  if (sealed.kekId !== wrapper.kekId) throw new VaultOpenFailed();
  const dataKey = wrapper.unwrap(Buffer.from(sealed.wrappedKey, 'base64'));
  return gcmOpen(dataKey, Buffer.from(sealed.data, 'base64'), Buffer.from(context));
}
