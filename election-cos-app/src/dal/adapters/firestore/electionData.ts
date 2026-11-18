/**
 * Election Campaign OS — reads the public election-data collections (src/modules/electionData/model.ts).
 *
 * The only Firestore code the Voter Intelligence Instrument touches. Returns null when the database cannot answer (no
 * Firebase config, not signed in, offline, nothing loaded), so the caller falls back to the results bundled with the app
 * rather than showing an empty dashboard.
 */
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getDb } from './client';

export interface StoredWard {
  wardNumber: number;
  registered: number;
  valid: number;
  spoilt: number;
  parties: Array<{ party: string; votes: number }>;
}

export interface StoredCouncil {
  wards: StoredWard[];
  pr: Array<{ party: string; votes: number }>;
}

export const ELECTION_ID = 'EEID1887';

export async function fetchCouncil(code: string, electionId: string = ELECTION_ID): Promise<StoredCouncil | null> {
  try {
    const db = getDb();
    const base = `elections/${electionId}/councils/${code}`;
    const [wards, council] = await Promise.all([getDocs(collection(db, `${base}/wards`)), getDoc(doc(db, base))]);
    if (wards.empty || !council.exists()) return null;
    const pr = (council.data() as { parties?: { pr?: Array<{ party: string; votes: number }> } }).parties?.pr ?? [];
    return { wards: wards.docs.map((d) => d.data() as StoredWard), pr };
  } catch {
    return null;
  }
}
