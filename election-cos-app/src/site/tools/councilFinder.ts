/**
 * Election Campaign OS — public site, "your council and your ballot"
 *
 * Pure functions over the proclaimed delimitation baseline
 * (`municipalRegister.ts`, Annexure A to IEC Circular 1 of 2025). Nothing
 * here is computed from a source other than that register, and nothing is
 * a prediction: it says how big a council is and how its seats are made up.
 *
 * PR SEATS ARE A SUBTRACTION, NOT A FORMULA
 *
 * In a council with wards, every ward elects one councillor and the rest
 * of the council is elected by proportional representation. So the PR
 * count is councillors − wards. It is shown as that sum on the page so a
 * reader can see it is arithmetic.
 *
 * DISTRICTS
 *
 * A category C district council has no wards and its seats are allocated
 * under Schedule 2, which this site does not explain, so the finder says
 * that and stops rather than showing a ward figure it does not have.
 */
import {
  REGISTER_ENTRIES,
  type MunicipalRegisterEntry,
} from '@/modules/reference/municipalRegister';

export interface CouncilSummary {
  code: string;
  name: string;
  province: string;
  category: 'A' | 'B' | 'C';
  categoryLabel: string;
  councillors: number;
  registeredVoters: number;
  /** Null for a district council, which has no wards. */
  wards: number | null;
  /** councillors − wards. Null for a district council. */
  prCouncillors: number | null;
  /** The delimitation's own average ward size. Null for a district. */
  averageVotersPerWard: number | null;
}

const LABELS: Record<string, string> = {
  A: 'Metropolitan municipality',
  B: 'Local municipality',
  C: 'District municipality',
};

function summarise(m: MunicipalRegisterEntry): CouncilSummary {
  const category = (m.category === 'A' || m.category === 'B' || m.category === 'C' ? m.category : 'B') as
    | 'A'
    | 'B'
    | 'C';
  const warded = typeof m.wards === 'number' && m.wards > 0;
  return {
    code: m.code,
    name: m.name,
    province: m.province,
    category,
    categoryLabel: LABELS[category],
    councillors: m.councillors,
    registeredVoters: m.registeredVoters,
    wards: warded ? (m.wards as number) : null,
    prCouncillors: warded ? m.councillors - (m.wards as number) : null,
    averageVotersPerWard: warded && typeof m.norm === 'number' ? m.norm : null,
  };
}

/** Every municipality, ordered by province then name. */
export function allCouncils(): CouncilSummary[] {
  return REGISTER_ENTRIES.map(summarise).sort(
    (a, b) => a.province.localeCompare(b.province) || a.name.localeCompare(b.name),
  );
}

export function findCouncil(code: string): CouncilSummary | null {
  const m = REGISTER_ENTRIES.find((e) => e.code === code.trim().toUpperCase());
  return m ? summarise(m) : null;
}

/** Case-insensitive match on name, code or province. Empty query matches all. */
export function searchCouncils(query: string): CouncilSummary[] {
  const q = query.trim().toLowerCase();
  const all = allCouncils();
  if (q === '') return all;
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase() === q ||
      c.province.toLowerCase().includes(q),
  );
}

export interface BallotLine {
  title: string;
  detail: string;
}

/**
 * What a voter in this council area is voting for. General description of
 * the ballot arrangement, not statute, and the page says to confirm the
 * detail with the Electoral Commission.
 */
export function ballotsFor(c: CouncilSummary): BallotLine[] {
  if (c.category === 'C') {
    return [
      {
        title: 'District Council',
        detail:
          'A district council has no wards. You do not vote for a district council on its own; it is covered by the ballots in the local municipality you live in.',
      },
    ];
  }
  const lines: BallotLine[] = [
    {
      title: 'Ward Ballot',
      detail: 'You choose one ward councillor from the candidates standing in your ward.',
    },
    {
      title: 'Proportional (PR) Ballot',
      detail:
        'You choose a party. Parties win PR seats in proportion to their votes, filled from the party’s submitted list.',
    },
  ];
  if (c.category === 'B') {
    lines.push({
      title: 'District Council Ballot',
      detail:
        'You also vote for the district council that covers your local municipality. This ballot is for a party.',
    });
  }
  return lines;
}
