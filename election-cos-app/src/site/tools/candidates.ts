/**
 * Election Campaign OS — public site, ward candidates
 *
 * `CERTIFIED_CANDIDATES` is empty on purpose. The Electoral Commission
 * publishes the certified lists, this build has not been given one, and a
 * name typed in from anywhere else would be exactly the invented record
 * build rule 2 forbids. The lookup and validation are finished, so loading
 * a list is a data task: fill the array (or generate it with the
 * `iec-data-ingestion` skill) and the page starts showing names.
 *
 * `validateCandidates` is what stops a bad load: wards must exist in the
 * delimitation register, and a candidate may appear once.
 */
import { lookupMunicipality } from '@/modules/reference/municipalRegister';

export interface WardCandidate {
  municipalityCode: string;
  wardNumber: number;
  name: string;
  /** A registered party's name, or the word Independent. */
  party: string;
}

export const CERTIFIED_CANDIDATES: WardCandidate[] = [];

/** Where the list comes from, shown beside any names. */
export const CANDIDATE_SOURCE =
  'Final list of successful candidates published by the Electoral Commission (scheduled for 16 September 2026 in its timetable).';

export function candidatesFor(
  list: WardCandidate[],
  municipalityCode: string,
  wardNumber: number,
): WardCandidate[] {
  return list
    .filter((c) => c.municipalityCode === municipalityCode && c.wardNumber === wardNumber)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function validateCandidates(list: WardCandidate[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  list.forEach((c, i) => {
    const m = lookupMunicipality(c.municipalityCode);
    if (!m) errors.push(`[${i}] ${c.municipalityCode} is not in the delimitation register.`);
    else if (!m.wards) errors.push(`[${i}] ${m.name} has no wards.`);
    else if (!Number.isInteger(c.wardNumber) || c.wardNumber < 1 || c.wardNumber > m.wards)
      errors.push(`[${i}] ${m.name} has wards 1 to ${m.wards}, not ${c.wardNumber}.`);
    if (!c.name.trim()) errors.push(`[${i}] name is blank.`);
    if (!c.party.trim()) errors.push(`[${i}] party is blank (use Independent).`);
    const key = `${c.municipalityCode}|${c.wardNumber}|${c.name.trim().toLowerCase()}`;
    if (seen.has(key)) errors.push(`[${i}] ${c.name} appears twice in the same ward.`);
    seen.add(key);
  });
  return errors;
}
