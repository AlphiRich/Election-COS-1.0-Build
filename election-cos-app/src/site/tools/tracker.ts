/**
 * Election Campaign OS — public site, Coalition Tracker arithmetic
 *
 * Seat arithmetic over a council's certified seats (src/data/lge2026/national/seats-2026.json): which small groups of
 * parties hold more than half the council, how short the largest party is, and which parties appear in those groups.
 * Like coalition.ts it says nothing about which coalition is likely, lawful or agreed; it counts seats.
 *
 * WHY A SEPARATE SEARCH. coalition.ts lists every minimal majority and gives up above 14 parties. A metro council has
 * more parties than that with a seat (Johannesburg has over 20), and the coalitions that are actually negotiated have a
 * handful of members. This lists every minimal majority of up to `maxParties` parties, which stays fast for any council.
 *
 * Seats held by one merged "Independent ward councillors" holder (id IND) are not a party: each independent decides
 * alone. They count toward the council's size but are never put into a group here. An undecided tied seat (id TIED)
 * likewise counts toward the size and is never in a group.
 */
import { majorityThreshold, type SeatHolder } from './coalition';

export const NOT_A_PARTY = new Set(['IND', 'TIED']);

export interface Coalition {
  ids: string[];
  seats: number;
}

/**
 * Every group of at most `maxParties` parties holding a majority of `councillors`, keeping only minimal groups (drop any
 * member and it falls short). Fewest parties first, then most seats.
 */
export function smallMajorities(holders: SeatHolder[], councillors: number, maxParties = 4): Coalition[] {
  const need = majorityThreshold(councillors);
  const parties = holders.filter((h) => h.seats > 0 && !NOT_A_PARTY.has(h.id)).sort((a, b) => b.seats - a.seats);
  const out: Coalition[] = [];
  const pick: number[] = [];
  const walk = (start: number, seats: number) => {
    if (seats >= need) {
      const minimal = pick.every((i) => seats - parties[i].seats < need);
      if (minimal) out.push({ ids: pick.map((i) => parties[i].id), seats });
      return; // adding more members can never be minimal
    }
    if (pick.length === maxParties) return;
    for (let i = start; i < parties.length; i++) {
      pick.push(i);
      walk(i + 1, seats + parties[i].seats);
      pick.pop();
    }
  };
  walk(0, 0);
  return out.sort((a, b) => a.ids.length - b.ids.length || b.seats - a.seats || a.ids.join().localeCompare(b.ids.join()));
}

/** The fewest parties that together hold a majority (1 when one party does), or null if no group of `maxParties` does. */
export function fewestPartiesToGovern(holders: SeatHolder[], councillors: number, maxParties = 4): number | null {
  const sets = smallMajorities(holders, councillors, maxParties);
  return sets.length ? sets[0].ids.length : null;
}

/** Seats the largest party is short of a majority (0 when it has one). */
export function seatsShort(holders: SeatHolder[], councillors: number): number {
  const largest = Math.max(0, ...holders.filter((h) => !NOT_A_PARTY.has(h.id)).map((h) => h.seats));
  return Math.max(0, majorityThreshold(councillors) - largest);
}

/**
 * How many of the smallest winning groups each party belongs to. Counts only the groups with the fewest members, so a
 * party that can complete a two-party majority is not drowned out by four-party combinations.
 */
export function inSmallestGroups(holders: SeatHolder[], councillors: number, maxParties = 4): Map<string, number> {
  const sets = smallMajorities(holders, councillors, maxParties);
  const counts = new Map<string, number>();
  if (!sets.length) return counts;
  const k = sets[0].ids.length;
  for (const s of sets.filter((x) => x.ids.length === k)) for (const id of s.ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}
