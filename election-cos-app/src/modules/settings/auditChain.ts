/**
 * Election Campaign OS — audit chain verification (client side).
 * Mirror of functions/src/auditChain.ts; see that file for what the chain does and does not prove.
 * Entries written before the chain existed carry no hash and are reported "not chained".
 */
export const GENESIS = '0'.repeat(64);

export interface ChainedEntry {
  seq?: number;
  occurredAtIso?: string;
  actorUid: string;
  action: string;
  targetType: string;
  targetId: string;
  prevHash?: string;
  hash?: string;
}

export type ChainStatus = 'verified' | 'not chained' | 'BROKEN';

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function chainHash(
  prev: string,
  e: Required<Pick<ChainedEntry, 'seq' | 'occurredAtIso'>> & ChainedEntry,
) {
  const body = JSON.stringify([
    e.seq,
    e.occurredAtIso,
    e.actorUid,
    e.action,
    e.targetType,
    e.targetId,
  ]);
  return sha256Hex(`${prev}\n${body}`);
}

/**
 * Checks the chained entries, oldest first. Each must recompute to its own hash, name the
 * previous entry's hash, and follow it by exactly one in seq (so a deleted entry shows).
 * Returns a status per input entry, in the order given.
 */
export async function verifyChain(entriesOldestFirst: ChainedEntry[]): Promise<ChainStatus[]> {
  const out: ChainStatus[] = [];
  let prev: ChainedEntry | null = null;
  for (const e of entriesOldestFirst) {
    if (!e.hash || e.seq === undefined || !e.occurredAtIso || !e.prevHash) {
      out.push('not chained');
      continue;
    }
    // The first chained entry in a window has its predecessor outside it, so only its own
    // hash can be checked; every later one must also link to, and follow, the one before.
    const linkOk = prev
      ? e.prevHash === prev.hash && e.seq === (prev.seq as number) + 1
      : e.seq !== 1 || e.prevHash === GENESIS;
    const recomputed = await chainHash(e.prevHash, e as never);
    const ok = recomputed === e.hash && linkOk;
    out.push(ok ? 'verified' : 'BROKEN');
    prev = e;
  }
  return out;
}
