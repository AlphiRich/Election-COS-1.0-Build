/**
 * Election Campaign OS — parties contesting JB Marks (NW405) in 2026, per the candidate list.
 *
 * SOURCE. `nw-province-candidate-list-2026.xlsx`, sheet "Full Candidate List", the 610 rows whose
 * municipality code is NW405. The workbook describes itself as derived from the Electoral
 * Commission's Final Candidate List (Combined) published 16 September 2026. It has NOT been
 * confirmed against the Commission's own list by a named person (docs/nw-candidate-list-2026-review.md),
 * so this module is used for one purpose only: deciding which party NAMES the scenario tools offer.
 * It is not published to voters, and its per-party counts are rows in that file, not wards
 * (the file's ward column is a per-party ordinal; see the review).
 *
 * `listName` is the name exactly as the list prints it. `displayName` is the same words in
 * readable case; a test fails if the two ever differ by anything but case, so a display name
 * cannot drift from the list.
 *
 * `id2021` links a party to its 2021 NW405 result where one exists. Matching is by exact name, in
 * this table, never by similarity. A contesting party with no 2021 result cannot be given a swing
 * from a 2021 baseline, and the tools say so rather than inventing one.
 */
export interface ContestingParty {
  listName: string;
  displayName: string;
  /** Rows in the candidate list for NW405. */
  candidates: number;
  /** Id in nw405Example.ts, when the party had a 2021 NW405 result. */
  id2021?: string;
}

export const NW405_PARTIES_2026: ContestingParty[] = [
  {
    listName: 'AFRICAN NATIONAL CONGRESS',
    displayName: 'African National Congress',
    candidates: 66,
    id2021: 'ANC',
  },
  {
    listName: 'DEMOCRATIC ALLIANCE',
    displayName: 'Democratic Alliance',
    candidates: 65,
    id2021: 'DA',
  },
  {
    listName: 'VRYHEIDSFRONT PLUS | FREEDOM FRONT PLUS',
    displayName: 'Vryheidsfront Plus | Freedom Front Plus',
    candidates: 55,
    id2021: 'VFP',
  },
  {
    listName: 'AFRICAN CHRISTIAN DEMOCRATIC PARTY',
    displayName: 'African Christian Democratic Party',
    candidates: 47,
  },
  { listName: 'BUILD ONE SOUTH AFRICA', displayName: 'Build One South Africa', candidates: 45 },
  {
    listName: 'SOUTH AFRICAN COMMUNIST PARTY',
    displayName: 'South African Communist Party',
    candidates: 39,
  },
  { listName: 'ACTIONSA', displayName: 'ActionSA', candidates: 35 },
  { listName: 'BAAGI', displayName: 'BAAGI', candidates: 35 },
  {
    listName: 'ECONOMIC FREEDOM FIGHTERS',
    displayName: 'Economic Freedom Fighters',
    candidates: 35,
    id2021: 'EFF',
  },
  { listName: 'AFRIKA MAYIBUYE MOVEMENT', displayName: 'Afrika Mayibuye Movement', candidates: 34 },
  {
    listName: 'AFRICAN CONGRESS FOR TRANSFORMATION',
    displayName: 'African Congress for Transformation',
    candidates: 29,
  },
  {
    listName: 'PATRIOTIC ALLIANCE',
    displayName: 'Patriotic Alliance',
    candidates: 26,
    id2021: 'PA',
  },
  { listName: 'UMKHONTO WESIZWE PARTY', displayName: 'Umkhonto Wesizwe Party', candidates: 23 },
  {
    listName: 'SOLIDARITY ACTION COMMITTEE COLLECTIVE',
    displayName: 'Solidarity Action Committee Collective',
    candidates: 17,
  },
  {
    listName: 'CONCERNED POTCHEFSTROOM RESIDENTS',
    displayName: 'Concerned Potchefstroom Residents',
    candidates: 15,
  },
  { listName: 'DEFENDERS OF THE PEOPLE', displayName: 'Defenders of the People', candidates: 15 },
  { listName: 'ALL CITIZENS PARTY', displayName: 'All Citizens Party', candidates: 14 },
  { listName: "PEOPLE'S FREEDOM PARTY", displayName: "People's Freedom Party", candidates: 11 },
  {
    listName: 'PAN AFRICANIST CONGRESS OF AZANIA',
    displayName: 'Pan Africanist Congress of Azania',
    candidates: 2,
  },
  {
    listName: 'UNITED AFRICANS TRANSFORMATION',
    displayName: 'United Africans Transformation',
    candidates: 2,
  },
];

export const NW405_PARTY_LIST_SOURCE =
  'Candidate list for 2026 (workbook derived from the Electoral Commission list published 16 September 2026; not yet confirmed against the Commission by a named person).';

/** Ids of 2021 parties that appear on the 2026 list. */
export const contestingIds2021 = (): Set<string> =>
  new Set(NW405_PARTIES_2026.flatMap((p) => (p.id2021 ? [p.id2021] : [])));

/** The name to show for a 2021 party id: the list's, when the party is contesting. */
export function displayNameFor(id: string, fallback: string): string {
  return NW405_PARTIES_2026.find((p) => p.id2021 === id)?.displayName ?? fallback;
}

/** 2021 parties that are NOT on the 2026 list. */
export const notOnList = (parties2021: Array<{ id: string; name: string }>) =>
  parties2021.filter((p) => !contestingIds2021().has(p.id));

/** Parties on the 2026 list with no 2021 NW405 result: they cannot be given a swing from a 2021 baseline. */
export const entrantsWithout2021 = () => NW405_PARTIES_2026.filter((p) => !p.id2021);
