/**
 * Election Campaign OS — the certified result a scenario is a departure from ("the baseline").
 *
 * Until 8 Nov 2026 every model started from the 2021 NW405 result. The 2026 results are now certified and ingested for all
 * 18 North West local municipalities (`modules/lge2026`), so the simulation, the coalition tool and the forecasting helpers
 * take a `Baseline`: the 2026 ward and PR result of any North West local municipality, or the 2021 NW405 result kept for
 * history and for the swing between them. Nothing else about the maths changes; a zero swing reproduces the baseline exactly.
 *
 * A baseline carries the vote definitions the Commission's own seat calculation uses: a party's votes are PR plus ward votes,
 * and independents and parties with no PR list are outside A (their ward seats are C and D).
 */
import { NW405_2021_EXAMPLE, NW405_2021_DELIMITATION, type ExampleParty } from './nw405Example';
import { NW405_WARD_RESULTS_2021, type WardResults2021 } from './wardResults2021';
import {
  INDEPENDENT,
  municipality,
  partyId,
  seatInput,
  wardOutcomes,
} from '@/modules/lge2026/lge2026Results';

export interface Baseline {
  id: string;
  label: string;
  code: string;
  year: 2021 | 2026;
  delimitationId: string;
  totalSeats: number;
  totalValidVotes: number;
  independentWardSeats: number;
  noPRListWardSeats: number;
  /** Parties on the PR list: the ones a swing moves votes between. */
  parties: ExampleParty[];
  /** Ward results in the shape the ward projection reads (winner and runner-up). */
  results: WardResults2021;
  /** The id a ward result uses for independents, when they can win wards. */
  independentId?: string;
  /** Ids of parties that can win a ward but have no PR list. */
  noListIds: string[];
}

export const BASELINE_NW405_2021: Baseline = {
  id: 'NW405-2021',
  label: 'JB Marks, 2021 (Superseded Delimitation)',
  code: 'NW405',
  year: 2021,
  delimitationId: NW405_2021_DELIMITATION,
  totalSeats: NW405_2021_EXAMPLE.totalSeats,
  totalValidVotes: NW405_2021_EXAMPLE.totalValidVotes,
  independentWardSeats: NW405_2021_EXAMPLE.independentWardSeats,
  noPRListWardSeats: NW405_2021_EXAMPLE.noPRListWardSeats,
  parties: NW405_2021_EXAMPLE.parties,
  results: NW405_WARD_RESULTS_2021,
  noListIds: [],
};

const cache = new Map<string, Baseline>();

/** The certified 2026 result of a North West local municipality as a baseline. Throws for a code with no 2026 result. */
export function baseline2026(code: string): Baseline {
  const hit = cache.get(code);
  if (hit) return hit;
  const m = municipality(code);
  const s = seatInput(code);
  const outcomes = wardOutcomes(code);
  const wards = outcomes.map((w) => ({
    wardId: w.wardId,
    wardNumber: w.wardNumber,
    winnerPartyId: partyId(w.winner),
    winnerVotes: w.winnerVotes,
    runnerUpPartyId: w.runnerUp ? partyId(w.runnerUp) : partyId(w.winner),
    runnerUpVotes: w.runnerUpVotes,
    wardVotes: w.valid,
  }));
  const onPr = new Set(m.onPrList.map(partyId));
  const topTwo = wards.reduce((n, w) => n + w.winnerVotes + w.runnerUpVotes, 0);
  const b: Baseline = {
    id: `${code}-2026`,
    label: `${m.name}, 2026`,
    code,
    year: 2026,
    delimitationId: 'LGE-2026-PROCLAIMED',
    totalSeats: s.totalSeats,
    totalValidVotes: s.totalValidVotes,
    independentWardSeats: s.independentWardSeats,
    noPRListWardSeats: s.noPRListWardSeats,
    parties: s.parties.map((p) => ({ id: p.id, name: p.name, votes: p.votes, wardSeatsWon: p.wardSeatsWon })),
    results: {
      municipalityCode: code,
      delimitationId: 'LGE-2026-PROCLAIMED',
      electionDate: '2026-11-04',
      wardBallotVotes: m.ballots.ward.valid,
      votesNotInTopTwo: m.ballots.ward.valid - topTwo,
      independentWardSeats: s.independentWardSeats,
      independentRunnerUpWards: outcomes.filter((w) => w.runnerUp === INDEPENDENT).map((w) => w.wardId),
      wards,
    },
    independentId: partyId(INDEPENDENT),
    noListIds: [...new Set(wards.flatMap((w) => [w.winnerPartyId, w.runnerUpPartyId]))].filter(
      (id) => id !== partyId(INDEPENDENT) && !onPr.has(id),
    ),
  };
  cache.set(code, b);
  return b;
}

export const baselineFor = (code: string, year: 2021 | 2026): Baseline => {
  if (year === 2021) {
    if (code !== 'NW405') throw new Error('Only JB Marks (NW405) has a 2021 ward result in this build.');
    return BASELINE_NW405_2021;
  }
  return baseline2026(code);
};
