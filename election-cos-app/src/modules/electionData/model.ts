/**
 * Election Campaign OS — the election-data database: what is stored, where, and how it is made from the Commission's files.
 *
 *   elections/{electionId}                                   one document per cycle (LGE 2026 = EEID1887): date, source, retrieved
 *   elections/{electionId}/councils/{code}                   a council's totals: registered, ballots, party votes on each ballot
 *   elections/{electionId}/councils/{code}/wards/{wardId}    a ward's registered, ballots and party votes
 *   municipalProfiles/{code}/layers/{layerId}                demographic / psychographic layers, each with its own source
 *
 * Everything under `elections/` and `municipalProfiles/` is PUBLIC reference data: the Commission's published aggregates and
 * Statistics South Africa's published counts. No voter, no household, no person. It lives outside `tenants/` on purpose, so one
 * copy serves every tenant, and the rules (firestore.rules) let any signed-in user read it and nobody write it from a client.
 * Only `scripts/load-election-data.ts`, run with an administrator's credentials, writes it.
 *
 * Party votes are stored as an array of {party, votes}, not a map: party names contain spaces, '|' and apostrophes, which are
 * legal map keys but a trap in field paths. Parties are kept exactly as the Commission prints them; nothing is merged or renamed.
 *
 * A layer is refused unless it names its source, its vintage and what kind of thing it is (`census` counted, `survey` asked,
 * `model` estimated). That is how this database stays honest about demographics: a figure with no source cannot be stored.
 */
import type { NationalCouncil, ProvinceCode } from '@/modules/lge2026/nationalResults';

export const ELECTIONS = 'elections';
export const PROFILES = 'municipalProfiles';

export interface PartyVote { party: string; votes: number }
type Ballot = 'ward' | 'pr' | 'dc40';

export interface ElectionDoc {
  id: string;
  kind: 'LGE' | 'NPE' | 'PPE';
  year: number;
  /** ISO date of polling day. */
  date: string;
  publisher: string;
  retrieved: string;
  note: string;
}

export interface CouncilDoc {
  electionId: string;
  code: string;
  name: string;
  province: ProvinceCode;
  category: 'A' | 'B';
  district: string | null;
  councillors: number;
  wards: number;
  registered: number;
  ballots: Record<Ballot, { valid: number; spoilt: number }>;
  parties: Record<Ballot, PartyVote[]>;
}

export interface WardDoc {
  electionId: string;
  councilCode: string;
  province: ProvinceCode;
  wardId: string;
  wardNumber: number;
  registered: number;
  valid: number;
  spoilt: number;
  parties: PartyVote[];
}

const toVotes = (rows: ReadonlyArray<readonly [string, number]> | undefined): PartyVote[] =>
  (rows ?? []).map(([party, votes]) => ({ party, votes }));

export function councilPath(electionId: string, code: string): string {
  return `${ELECTIONS}/${electionId}/councils/${code}`;
}
export function wardPath(electionId: string, code: string, wardId: string): string {
  return `${councilPath(electionId, code)}/wards/${wardId}`;
}

/** One council, as the documents that hold it. Pure: no I/O, so the loader and the tests share it. */
export function councilDocs(
  electionId: string,
  province: ProvinceCode,
  code: string,
  c: NationalCouncil,
): { council: CouncilDoc; wards: WardDoc[] } {
  const council: CouncilDoc = {
    electionId,
    code,
    name: c.name,
    province,
    category: c.category,
    district: c.district ?? null,
    councillors: c.councillors,
    wards: c.wards,
    registered: c.registered,
    ballots: c.ballots,
    parties: { ward: toVotes(c.parties.ward as never), pr: toVotes(c.parties.pr as never), dc40: toVotes(c.parties.dc40 as never) },
  };
  const wards: WardDoc[] = c.wardResults.map((w) => ({
    electionId,
    councilCode: code,
    province,
    wardId: w.wardId,
    wardNumber: w.wardNumber,
    registered: w.registered,
    valid: w.valid,
    spoilt: w.spoilt,
    parties: toVotes(w.parties as never),
  }));
  return { council, wards };
}

export type LayerKind = 'census' | 'survey' | 'model';
export interface ProfileLayer {
  code: string;
  layerId: string;
  kind: LayerKind;
  /** Who published it, and the table or file. */
  source: string;
  /** The year or date the figures describe. */
  vintage: string;
  /** Figures by name. Numbers only: shares are 0-1, counts are whole. */
  values: Record<string, number>;
}

/** Throws on a layer that cannot say where it came from. Run by the loader before any write. */
export function assertLayer(l: ProfileLayer): void {
  if (!/^[A-Z]{2,3}\d{0,3}$/.test(l.code)) throw new Error(`Layer ${l.layerId}: "${l.code}" is not a municipal code.`);
  if (!['census', 'survey', 'model'].includes(l.kind)) throw new Error(`Layer ${l.layerId}: kind must be census, survey or model.`);
  if (!l.source.trim() || !l.vintage.trim()) throw new Error(`Layer ${l.layerId}: a source and a vintage are required.`);
  const entries = Object.entries(l.values);
  if (!entries.length) throw new Error(`Layer ${l.layerId}: no values.`);
  for (const [k, v] of entries) if (!Number.isFinite(v)) throw new Error(`Layer ${l.layerId}: "${k}" is not a number.`);
}
