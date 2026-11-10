/**
 * Election Campaign OS — a party's candidates in one municipality, set against its LGE 2026 result.
 *
 * Joins two things that were ingested separately and never put side by side: the Commission's published candidate list
 * (23 Oct 2026 certified list as supplemented, src/data/iec) and the Commission's results (lge2026Results.ts). Every
 * figure is read from those, not typed here.
 *
 * WHAT IT DOES NOT CLAIM
 *  - Who the elected PR councillors are. Seats follow from the votes; WHICH names fill them follows the party's list as
 *    the Commission published it, and the list can be shorter than the seats the party won (see `listDepth`). Where it
 *    is, the profile says how many seats the published list cannot name, and does not invent the rest.
 *  - Anything about a person beyond the name and place the Commission printed. The ID column is never read here.
 *  - A ward "winner" other than the ward's top-polling party. The councillor is the candidate that party fielded.
 */
import iecRaw from '@/data/iec/candidates-lge2026-iec-nw-23102026.json';
import refRaw from '@/data/reference/nw405-candidates.json';
import { councilHolders, municipality, partyId, partyLabel, seatAllocation2026, wardOutcomes } from './lge2026Results';

interface IecEntry {
  municipalityCode: string;
  party: string;
  fullName: string;
  surname: string;
  kind: 'WARD' | 'PR';
  wardNumber?: number;
  listRank?: number;
}
export const LIST_PROVENANCE = (iecRaw as unknown as { provenance: { url: string; sha256: string; bytes: number; fetchedOn: string; pdfTitle: string } }).provenance;
const IEC = (iecRaw as unknown as { entries: IecEntry[] }).entries;
const REF = (refRaw as unknown as { entries: Array<{ party: string; fullName: string; surname: string; kind: 'WARD' | 'PR'; ward?: number; rank?: number }> }).entries;

export interface WardCandidate {
  ward: number;
  name: string;
  votes: number;
  valid: number;
  share: number; // % of the ward's valid votes
  position: number; // 1 = led the ward
  winner: string;
  winnerVotes: number;
  gapToWinner: number; // votes behind the ward leader; 0 for the leader
  alsoOn: string[]; // other places this same name is printed in the party's list
}
export interface ListEntry {
  rank: number;
  name: string;
  alsoWard: number[];
  wonWard: boolean;
}
export interface ListDepthRow {
  party: string;
  prSeats: number;
  listLength: number;
  eligible: number;
  unfilled: number; // PR seats the published list has no name for
}
export interface PartyProfile {
  code: string;
  municipality: string;
  party: string;
  label: string;
  candidates: number;
  distinctPeople: number;
  wardCandidates: WardCandidate[];
  prList: ListEntry[];
  duplicates: Array<{ name: string; places: string[] }>;
  ballots: Record<'ward' | 'pr' | 'dc40', { votes: number; sharePct: number }>;
  seats: { total: number; ward: number; pr: number; quota: number; remainder: number; entitlement: number; lowestRoundTwoRemainder: number | null };
  wardPositions: Record<number, number>; // position -> number of wards
  listDepth: ListDepthRow;
  peers: ListDepthRow[];
  /** The district council's separate PR list (the "DC 40%" ballot): a different ballot from the local PR list. */
  districtList: { code: string; entries: Array<{ rank: number; name: string }> };
  /** PR entries this party has in every North West council in the same publication: a province-wide pattern or not. */
  prEntriesByCouncil: Record<string, number>;
}

const fullName = (e: { fullName: string; surname: string }) => `${e.fullName} ${e.surname}`.trim();

export function partiesWithCandidates(code: string): string[] {
  return [...new Set(IEC.filter((e) => e.municipalityCode === code).map((e) => e.party))].sort();
}

export function partyProfile(code: string, party: string): PartyProfile {
  const m = municipality(code);
  const entries = IEC.filter((e) => e.municipalityCode === code && e.party === party);
  if (!entries.length) throw new Error(`The published candidate list has no ${party} entries for ${code}.`);

  const place = (e: IecEntry) => (e.kind === 'WARD' ? `Ward ${e.wardNumber}` : `PR list ${e.listRank}`);
  const byName = new Map<string, string[]>();
  for (const e of entries) byName.set(fullName(e), [...(byName.get(fullName(e)) ?? []), place(e)]);
  const duplicates = [...byName].filter(([, p]) => p.length > 1).map(([name, places]) => ({ name, places }));

  const outcomes = new Map(wardOutcomes(code).map((o) => [o.wardNumber, o]));
  const wardRows = new Map(m.wardResults.map((w) => [w.wardNumber, w]));
  const wardCandidates: WardCandidate[] = entries
    .filter((e) => e.kind === 'WARD')
    .map((e) => {
      const w = wardRows.get(e.wardNumber!)!;
      const o = outcomes.get(e.wardNumber!)!;
      const votes = w.parties.find(([p]) => p === party)?.[1] ?? 0;
      const position = [...w.parties].sort((a, b) => b[1] - a[1]).findIndex(([p]) => p === party) + 1;
      return {
        ward: e.wardNumber!,
        name: fullName(e),
        votes,
        valid: w.valid,
        share: (votes / w.valid) * 100,
        position: position || w.parties.length + 1,
        winner: o.winner,
        winnerVotes: o.winnerVotes,
        gapToWinner: o.winnerVotes - votes,
        alsoOn: (byName.get(fullName(e)) ?? []).filter((x) => x !== place(e)),
      };
    })
    .sort((a, b) => a.ward - b.ward);
  const wonWards = new Set(wardCandidates.filter((c) => c.position === 1).map((c) => c.name));

  const prList: ListEntry[] = entries
    .filter((e) => e.kind === 'PR')
    .map((e) => ({
      rank: e.listRank!,
      name: fullName(e),
      alsoWard: entries.filter((x) => x.kind === 'WARD' && fullName(x) === fullName(e)).map((x) => x.wardNumber!),
      wonWard: wonWards.has(fullName(e)),
    }))
    .sort((a, b) => a.rank - b.rank);

  const ballot = (k: 'ward' | 'pr' | 'dc40') => {
    const votes = m.parties[k].find(([p]) => p === party)?.[1] ?? 0;
    return { votes, sharePct: (votes / m.ballots[k].valid) * 100 };
  };

  const alloc = seatAllocation2026(code);
  const row = alloc.parties.find((p) => p.id === partyId(party));
  const holder = councilHolders(code).find((h) => h.id === partyId(party));
  const seats = {
    total: holder?.seats ?? 0,
    ward: holder?.wardSeats ?? 0,
    pr: (holder?.seats ?? 0) - (holder?.wardSeats ?? 0),
    quota: alloc.quota,
    remainder: row?.remainder ?? 0,
    entitlement: row?.quotaEntitlement ?? 0,
    // Round two hands out the seats left after whole quotas, to the largest remainders: the smallest winning one is the bar.
    lowestRoundTwoRemainder: (() => {
      const won = alloc.parties.filter((p) => p.totalSeats > p.quotaEntitlement);
      return won.length ? Math.round(Math.min(...won.map((p) => p.remainder))) : null;
    })(),
  };

  const depth = (p: string): ListDepthRow => {
    const list = IEC.filter((e) => e.municipalityCode === code && e.party === p && e.kind === 'PR');
    const wards = new Set(
      wardOutcomes(code)
        .filter((o) => o.winner === p)
        .map((o) => o.wardNumber),
    );
    const winners = new Set(IEC.filter((e) => e.municipalityCode === code && e.party === p && e.kind === 'WARD' && wards.has(e.wardNumber!)).map(fullName));
    const eligible = list.filter((e) => !winners.has(fullName(e))).length;
    const h = councilHolders(code).find((x) => x.id === partyId(p));
    const prSeats = (h?.seats ?? 0) - (h?.wardSeats ?? 0);
    return { party: p, prSeats, listLength: list.length, eligible, unfilled: Math.max(0, prSeats - eligible) };
  };
  const peers = m.onPrList
    .map(depth)
    .filter((d) => d.prSeats > 0)
    .sort((a, b) => b.prSeats - a.prSeats || a.party.localeCompare(b.party));

  const wardPositions: Record<number, number> = {};
  for (const c of wardCandidates) wardPositions[c.position] = (wardPositions[c.position] ?? 0) + 1;

  return {
    code,
    municipality: m.name,
    party,
    label: partyLabel(party),
    candidates: entries.length,
    distinctPeople: byName.size,
    wardCandidates,
    prList,
    duplicates,
    ballots: { ward: ballot('ward'), pr: ballot('pr'), dc40: ballot('dc40') },
    seats,
    wardPositions,
    listDepth: depth(party),
    peers,
    districtList: {
      code: `DC${code.slice(2, 4)}`,
      entries: IEC.filter((e) => e.municipalityCode === `DC${code.slice(2, 4)}` && e.party === party && e.kind === 'PR')
        .map((e) => ({ rank: e.listRank!, name: fullName(e) }))
        .sort((a, b) => a.rank - b.rank),
    },
    prEntriesByCouncil: IEC.filter((e) => e.party === party && e.kind === 'PR').reduce<Record<string, number>>((acc, e) => {
      acc[e.municipalityCode] = (acc[e.municipalityCode] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

/** The two in-app copies of the NW405 list, compared row for row. Both ingest the same Commission PDF. */
export function reconcileAppCopies(party: string): { iec: number; reference: number; onlyIec: string[]; onlyReference: string[] } {
  const k = (kind: string, n: number | undefined, name: string, surname: string) => `${kind}|${n}|${name}|${surname}`;
  const a = IEC.filter((e) => e.municipalityCode === 'NW405' && e.party === party).map((e) => k(e.kind, e.wardNumber ?? e.listRank, e.fullName, e.surname));
  const b = REF.filter((e) => e.party === party).map((e) => k(e.kind, e.ward ?? e.rank, e.fullName, e.surname));
  const count = (xs: string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const ca = count(a);
  const cb = count(b);
  const diff = (x: Map<string, number>, y: Map<string, number>) => [...x].filter(([key, n]) => n > (y.get(key) ?? 0)).map(([key]) => key);
  return { iec: a.length, reference: b.length, onlyIec: diff(ca, cb), onlyReference: diff(cb, ca) };
}

const n = (v: number) => v.toLocaleString('en-ZA');
const p1 = (v: number) => v.toFixed(1);

/** Facts first: what the Commission printed and what the count recorded. Nothing here is interpretation. */
export function profileFacts(P: PartyProfile): string[] {
  const pos = Object.entries(P.wardPositions)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([k, v]) => `${v} × ${k}${['th', 'st', 'nd', 'rd'][Number(k) % 10 > 3 || Math.floor(Number(k) / 10) === 1 ? 0 : Number(k) % 10]}`)
    .join(', ');
  return [
    `${P.label} has ${P.candidates} entries in the Commission's ${P.code} ${P.municipality} list: ${P.wardCandidates.length} ward candidates and ${P.prList.length} PR-list ${P.prList.length === 1 ? 'entry' : 'entries'} (${P.distinctPeople} different people).`,
    `Ward ballot ${n(P.ballots.ward.votes)} votes (${p1(P.ballots.ward.sharePct)}%); PR ballot ${n(P.ballots.pr.votes)} (${p1(P.ballots.pr.sharePct)}%); district 40% ballot ${n(P.ballots.dc40.votes)} (${p1(P.ballots.dc40.sharePct)}%).`,
    `Ward finishing positions: ${pos}.`,
    `Seats: ${P.seats.total} (${P.seats.ward} ward, ${P.seats.pr} list) on a quota of ${n(P.seats.quota)}: ${P.seats.entitlement} whole quotas and a remainder of ${n(P.seats.remainder)}.`,
    `PR list as published: ${P.prList.map((e) => `${e.rank}. ${e.name}`).join('; ') || 'none'}.`,
    ...(P.duplicates.length ? [`Printed more than once: ${P.duplicates.map((d) => `${d.name} (${d.places.join(' and ')})`).join('; ')}.`] : []),
  ];
}

/** Then the reading of them. Each line states the figure it rests on, and none predicts anything. */
export function profileInsights(P: PartyProfile): string[] {
  const out: string[] = [];
  const w = P.wardCandidates;
  const won = w.filter((c) => c.position === 1).length;
  const second = w.filter((c) => c.position === 2);
  const best = [...w].sort((a, b) => b.share - a.share)[0];
  const closest = [...w].filter((c) => c.position > 1).sort((a, b) => a.gapToWinner - b.gapToWinner)[0];
  const mean = w.reduce((s, c) => s + c.share, 0) / w.length;
  out.push(
    won === 0
      ? `Reach without a win: a candidate in ${w.length} wards and no ward led. The ${P.seats.total} seats came entirely from the list vote, so the PR list, not the ward slate, is what fills the council benches.`
      : `${won} ward${won === 1 ? '' : 's'} led of ${w.length} contested.`,
  );
  if (best) out.push(`Best ward: ${best.ward} (${best.name}) at ${p1(best.share)}%, ${n(best.gapToWinner)} votes behind the leader. Average across wards ${p1(mean)}%, so the strongest ward is ${p1(best.share / mean)} times the typical one: support is concentrated, not even.`);
  if (closest) out.push(`Closest to a ward win: ward ${closest.ward} (${closest.name}), ${n(closest.gapToWinner)} votes behind ${partyLabel(closest.winner)}. ${second.length} ward${second.length === 1 ? '' : 's'} finished second.`);
  const diff = P.ballots.pr.votes - P.ballots.ward.votes;
  out.push(`Ward and list votes were close (${diff >= 0 ? '+' : '−'}${n(Math.abs(diff))} on the list): which suggests the vote followed the party more than individual ward candidates (an inference, not a measurement).`);
  if (P.seats.lowestRoundTwoRemainder !== null)
    out.push(`The last round-two seat went on a remainder of ${n(P.seats.lowestRoundTwoRemainder)}; ${P.label}'s was ${n(P.seats.remainder)}, ${P.seats.remainder < P.seats.lowestRoundTwoRemainder ? 'so it missed an extra seat on the remainders' : 'enough for one'}.`);
  const d = P.listDepth;
  if (d.unfilled > 0)
    out.push(`List depth: ${d.prSeats} list seats against ${d.eligible} eligible name${d.eligible === 1 ? '' : 's'} on the published list: ${d.unfilled} seat${d.unfilled === 1 ? '' : 's'} the published list cannot name. This is the Commission's list as printed; how the party fills those seats is for the party and the Commission, not this application.`);
  const councils = Object.values(P.prEntriesByCouncil);
  if (councils.length > 1 && councils.every((c) => c === councils[0]))
    out.push(`The same shape recurs: exactly ${councils[0]} PR entr${councils[0] === 1 ? 'y' : 'ies'} in each of the ${councils.length} North West councils, so it is how the list was filed or published, not a ${P.municipality} quirk.`);
  return out;
}
