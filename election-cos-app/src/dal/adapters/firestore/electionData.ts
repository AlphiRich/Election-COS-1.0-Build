/**
 * Election Campaign OS — reads the public election-data collections (src/modules/electionData/model.ts).
 *
 * The only Firestore code the Voter Intelligence Instrument touches. Returns null when the database cannot answer (no
 * Firebase config, not signed in, offline, nothing loaded), so the caller falls back to the results bundled with the app
 * rather than showing an empty dashboard.
 */
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from './client';

export interface StoredWard {
  wardNumber: number;
  registered: number;
  valid: number;
  spoilt: number;
  parties: Array<{ party: string; votes: number }>;
}

export const ELECTION_ID = 'EEID1887';

export async function fetchCouncilWards(code: string, electionId: string = ELECTION_ID): Promise<StoredWard[] | null> {
  try {
    const snap = await getDocs(collection(getDb(), `elections/${electionId}/councils/${code}/wards`));
    if (snap.empty) return null;
    return snap.docs.map((d) => d.data() as StoredWard);
  } catch {
    return null;
  }
}
