/**
 * Writes `src/data/lge2026/national/councillors-2026.json`: who was elected to each of the 213 metro and local councils,
 * derived from the Commission's certified candidate lists and its results.
 *
 *   npx vite-node scripts/build-lge2026-councillors.ts --candidates DIR
 *
 * DIR holds candidates-<prov>.json from tools/candidates/extract-iec-candidate-list.py (ID column already dropped). Only
 * the elected are written: a losing candidate is in DIR, never in the repository or on a page.
 *
 * WARD COUNCILLORS. The ward's winning party (the Commission's award where the ward was tied, tie-resolutions.json) is
 * matched to that party's one certified candidate in that ward. Status says how sure that is:
 *   elected            one candidate, unique match
 *   independentNamed   an independent led, and exactly one independent stood in the ward
 *   independentUnnamed an independent led, and several stood: the Commission merges them, so the winner is not named
 *   tieUnresolved      the ward was tied and the Commission has not recorded an award
 *   countIncomplete    the ward's result is short in the Commission's file (wardBallotGaps)
 *   noMatch            the winning party has no candidate for the ward on the list (reported, never guessed)
 *
 * PR COUNCILLORS. A party's list seats are its seats less its ward seats. They are filled from its certified PR list in
 * rank order, skipping a candidate who won a ward for the party (the list's dual nominations). These are "derived from
 * list order" until the Commission's own declaration of elected councillors is matched to them.
 *
 * VACANT SEATS. Where a party's list is shorter than its list seats, the remainder are `vacant`. The Commission's seat
 * reports mark such a party "(PF) Potential Forfeiture - this party has fewer candidates than the seats allocated. This
 * party will need to provide a supplement list of candidate(s) or the seat may be forfeited if this vacant seat results
 * with no quorum for the municipal council."
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { partyId, wardOutcomesOf, type CouncilTies } from '../src/modules/lge2026/councilResults';
import type { CouncilSeats, ProvinceFile } from '../src/modules/lge2026/nationalResults';

const args = process.argv.slice(2);
const CAND = args[args.indexOf('--candidates') + 1];
const DIR = 'src/data/lge2026/national';
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;

interface Entry { municipalityCode: string; party: string; fullName: string; surname: string; kind: 'WARD' | 'PR'; wardNumber?: number; listRank?: number }
interface CandFile { provenance: { url: string; sha256: string; fetchedOn: string; headline: string }; entries: Entry[]; dualNominated: Array<{ name: string; municipalityCode: string; party: string; ward: number; rank: number }> }

const seats = read<{ councils: Record<string, CouncilSeats> }>(path.join(DIR, 'seats-2026.json')).councils;
const ties = read<{ wards: Array<{ code: string; ward: number; awardedTo: string | null }>; remainders: Array<{ code: string; awardedTo: string[] }> }>(path.join(DIR, 'tie-resolutions.json'));
const tiesFor = (code: string): CouncilTies | undefined => {
  const w = ties.wards.filter((x) => x.code === code);
  const r = ties.remainders.find((x) => x.code === code);
  return w.length || r ? { wards: Object.fromEntries(w.map((x) => [x.ward, x.awardedTo])), remainders: r?.awardedTo } : undefined;
};

const lists: Record<string, Entry[]> = {};
const dual: Record<string, CandFile['dualNominated']> = {};
const sources: Array<{ province: string; url: string; sha256: string; fetchedOn: string; supplemented: boolean }> = [];
for (const f of readdirSync(CAND).filter((x) => /^candidates-[a-z]+\.json$/.test(x)).sort()) {
  const c = read<CandFile>(path.join(CAND, f));
  sources.push({ province: f.slice(11, -5).toUpperCase(), url: c.provenance.url, sha256: c.provenance.sha256, fetchedOn: c.provenance.fetchedOn, supplemented: /23 Oct 2026/.test(c.provenance.headline) });
  for (const e of c.entries) (lists[e.municipalityCode] ??= []).push(e);
  for (const d of c.dualNominated) (dual[d.municipalityCode] ??= []).push(d);
}

type WardStatus = 'elected' | 'independentNamed' | 'independentUnnamed' | 'tieUnresolved' | 'countIncomplete' | 'noMatch';
interface WardCouncillor { ward: number; wardId: string; party: string; name: string | null; status: WardStatus; margin: number; votes: number; valid: number }
interface PrCouncillor { party: string; rank: number; name: string }
interface Council { code: string; ward: WardCouncillor[]; pr: PrCouncillor[]; vacant: Array<{ party: string; listSeats: number; filled: number; vacant: number }> }

const name = (e: Entry) => `${e.fullName} ${e.surname}`;
const out: Record<string, Council> = {};
const stats: Record<string, number> = {};
const bump = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };

for (const f of readdirSync(DIR).filter((x) => /^[A-Z]{2}\.json$/.test(x)).sort()) {
  const file = read<ProvinceFile>(path.join(DIR, f));
  for (const m of Object.values(file.municipalities)) {
    const list = lists[m.code] ?? [];
    if (!list.length) throw new Error(`${m.code}: no certified candidate list`);
    const gaps = new Set((m.wardBallotGaps ?? []).map((g) => g.wardNumber));
    const ward: WardCouncillor[] = [];
    const wonBy = new Map<string, Set<number>>(); // party -> wards won
    for (const w of wardOutcomesOf(m, tiesFor(m.code))) {
      const inWard = list.filter((e) => e.kind === 'WARD' && e.wardNumber === w.wardNumber);
      let status: WardStatus;
      let who: Entry | undefined;
      if (gaps.has(w.wardNumber)) status = 'countIncomplete';
      else if (w.tie === 'unresolved') status = 'tieUnresolved';
      else if (w.independentLeads) {
        const ind = inWard.filter((e) => e.party === 'INDEPENDENT');
        if (ind.length === 1) { who = ind[0]; status = 'independentNamed'; } else status = 'independentUnnamed';
      } else {
        const hits = inWard.filter((e) => e.party === w.winner);
        if (hits.length === 1) { who = hits[0]; status = 'elected'; } else status = 'noMatch';
      }
      bump(status);
      if (status === 'elected') (wonBy.get(w.winner) ?? wonBy.set(w.winner, new Set()).get(w.winner)!).add(w.wardNumber);
      ward.push({ ward: w.wardNumber, wardId: w.wardId, party: w.winner, name: who ? name(who) : null, status, margin: Math.round(w.margin * 10) / 10, votes: w.winnerVotes, valid: w.valid });
    }

    // PR seats per party, from the council's holders (the Commission's own where its report is used).
    const rawNames = [...new Set([...m.parties.pr.map(([p]) => p), ...m.parties.ward.map(([p]) => p)])];
    const raw = (id: string) => rawNames.find((p) => partyId(p) === id);
    const pr: PrCouncillor[] = [];
    const vacant: Council['vacant'] = [];
    for (const h of seats[m.code].holders) {
      const listSeats = h.seats - h.wardSeats;
      if (listSeats <= 0 || h.id === 'IND' || h.id === 'TIED') continue;
      const party = raw(h.id);
      if (!party) throw new Error(`${m.code}: holder ${h.id} has no party name in the results`);
      const won = wonBy.get(party) ?? new Set<number>();
      const skip = new Set((dual[m.code] ?? []).filter((d) => d.party === party && won.has(d.ward)).map((d) => d.rank));
      const ranked = list.filter((e) => e.kind === 'PR' && e.party === party).sort((a, b) => a.listRank! - b.listRank!).filter((e) => !skip.has(e.listRank!));
      const take = ranked.slice(0, listSeats);
      for (const e of take) pr.push({ party, rank: e.listRank!, name: name(e) });
      if (take.length < listSeats) vacant.push({ party, listSeats, filled: take.length, vacant: listSeats - take.length });
      stats.prSeats = (stats.prSeats ?? 0) + listSeats;
      stats.prNamed = (stats.prNamed ?? 0) + take.length;
    }
    out[m.code] = { code: m.code, ward, pr, vacant };
  }
}

const doc = {
  source: 'Derived from the Electoral Commission LGE 2026 certified candidate lists and results (EEID1887). Ward councillors: the winning party\'s candidate in the ward. PR councillors: the party\'s list in rank order, skipping ward winners; derived from list order until the Commission\'s declaration is matched.',
  lists: sources,
  councils: out,
};
writeFileSync(path.join(DIR, 'councillors-2026.json'), JSON.stringify(doc));
const vac = Object.values(out).flatMap((c) => c.vacant);
const byParty: Record<string, number> = {};
for (const v of vac) byParty[partyId(v.party)] = (byParty[partyId(v.party)] ?? 0) + v.vacant;
console.log(JSON.stringify({ councils: Object.keys(out).length, ...stats, vacantSeats: vac.reduce((s, v) => s + v.vacant, 0), councilsWithVacancies: Object.values(out).filter((c) => c.vacant.length).length, vacantByParty: Object.fromEntries(Object.entries(byParty).sort((a, b) => b[1] - a[1]).slice(0, 12)) }, null, 1));
