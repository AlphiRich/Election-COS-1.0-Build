/**
 * Election Campaign OS — the certified 2026 seat inputs, snapshotted for the agent.
 *
 * The Campaign Director's `get_certified_baseline` / `run_schedule1_scenario`
 * tools run in the functions package, which cannot import the `lge2026` results
 * pipeline (big data JSON + its module tree). Rather than mirror all of that,
 * this snapshots only what the tools need: the Commission's seat-calculation
 * INPUT for each North West local municipality — party PR+ward votes, ward
 * seats won, the council size and total valid votes — computed from the app's
 * own tested `seatInput(code)`.
 *
 * It is derived, not hand-typed: `npm run gen:agent-engine` writes
 * `functions/.../engine/nw-seat-inputs-2026.json` from `renderNwSeats2026()`,
 * and `agentEngineMirror.test.ts` recomputes it and compares byte-for-byte, so
 * the snapshot can never drift from the certified results. No figure is
 * fabricated — every number is the app pipeline's reading of `nw-results.json`.
 */
import { MUNICIPALITY_CODES, municipality, seatInput } from '@/modules/lge2026/lge2026Results';

export const NW_SEATS_2026_DEST = 'functions/src/agents/campaignDirector/engine/nw-seat-inputs-2026.json';

export interface CertifiedSeatInput2026 {
  code: string;
  name: string;
  delimitationId: string;
  totalSeats: number;
  totalValidVotes: number;
  independentWardSeats: number;
  noPRListWardSeats: number;
  parties: { id: string; name: string; votes: number; wardSeatsWon: number }[];
}

export function buildNwSeats2026(): Record<string, CertifiedSeatInput2026> {
  const out: Record<string, CertifiedSeatInput2026> = {};
  for (const code of MUNICIPALITY_CODES) {
    const m = municipality(code);
    const s = seatInput(code);
    out[code] = {
      code,
      name: m.name,
      delimitationId: 'LGE-2026-PROCLAIMED',
      totalSeats: s.totalSeats,
      totalValidVotes: s.totalValidVotes,
      independentWardSeats: s.independentWardSeats,
      noPRListWardSeats: s.noPRListWardSeats,
      parties: s.parties.map((p) => ({ id: p.id, name: p.name, votes: p.votes, wardSeatsWon: p.wardSeatsWon })),
    };
  }
  return out;
}

export function renderNwSeats2026(): string {
  return `${JSON.stringify(buildNwSeats2026(), null, 2)}\n`;
}
