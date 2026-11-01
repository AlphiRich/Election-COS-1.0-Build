/**
 * Election Campaign OS — public site, coalition arithmetic
 *
 * The only thing this computes is how many seats a group of parties holds
 * against the number needed for more than half of the council. It does not
 * say which coalitions are likely, lawful or stable, and it carries no
 * party's actual seat count: the seats are typed in or come from a worked
 * example the page labels as historical.
 *
 * "MORE THAN HALF" IS THE ONLY THRESHOLD USED
 *
 * floor(total / 2) + 1. How a particular decision is voted on, and what
 * counts as a quorum, are rules of the council and the law, and this
 * module does not know them.
 */
export interface SeatHolder {
  id: string;
  name: string;
  seats: number;
}

export function majorityThreshold(totalSeats: number): number {
  return Math.floor(totalSeats / 2) + 1;
}

export function seatsHeld(holders: SeatHolder[], chosen: ReadonlySet<string>): number {
  return holders.filter((h) => chosen.has(h.id)).reduce((n, h) => n + h.seats, 0);
}

export interface CoalitionSet {
  ids: string[];
  seats: number;
}

/**
 * Every smallest group of parties that reaches a majority: a group is
 * listed only if removing any one member drops it below the threshold.
 * Capped at 14 parties, because the search is exponential and a council
 * contested by more is not a case a browser tool should freeze on.
 */
export function minimalMajorities(holders: SeatHolder[]): CoalitionSet[] | null {
  const parties = holders.filter((h) => h.seats > 0);
  if (parties.length > 14) return null;
  const total = parties.reduce((n, h) => n + h.seats, 0);
  const need = majorityThreshold(total);
  const out: CoalitionSet[] = [];
  const n = parties.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let seats = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) seats += parties[i].seats;
    if (seats < need) continue;
    let minimal = true;
    for (let i = 0; i < n && minimal; i++) {
      if (mask & (1 << i) && seats - parties[i].seats >= need) minimal = false;
    }
    if (minimal) {
      out.push({ ids: parties.filter((_, i) => mask & (1 << i)).map((p) => p.id), seats });
    }
  }
  // Fewest parties first, then most seats, so the simplest options lead.
  return out.sort((a, b) => a.ids.length - b.ids.length || b.seats - a.seats);
}
