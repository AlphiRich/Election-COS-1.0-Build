/**
 * Election Campaign OS — public site, registered voters by area
 *
 * Everything here is addition over the proclaimed delimitation register
 * (Annexure A to IEC Circular 1 of 2025) and, for JB Marks, the MDB ward
 * notice. It reports the roll the delimitation was drawn against, which is
 * smaller than today's roll, and says so.
 *
 * WHAT IS DELIBERATELY NOT HERE: age. Annexure A carries a voter total per
 * municipality and nothing about age, and no voting-district file for the
 * rest of the country is held. An age model built from this would be a
 * guess dressed as a statistic, so there is none. The Electoral Commission
 * publishes age breakdowns of the roll; loading one is a data task, not a
 * modelling one.
 */
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { allCouncils } from './councilFinder';

export interface ProvinceTotals {
  province: string;
  municipalities: number;
  councillors: number;
  wards: number;
  registeredVoters: number;
}

export function provinceTotals(): ProvinceTotals[] {
  const by = new Map<string, ProvinceTotals>();
  for (const m of REGISTER_ENTRIES) {
    const t = by.get(m.province) ?? {
      province: m.province,
      municipalities: 0,
      councillors: 0,
      wards: 0,
      registeredVoters: 0,
    };
    t.municipalities += 1;
    t.councillors += m.councillors;
    t.wards += m.wards ?? 0;
    // District councils repeat voters already counted in their local
    // municipalities, so they are left out of the voter total.
    if (m.category !== 'C') t.registeredVoters += m.registeredVoters;
    by.set(m.province, t);
  }
  return [...by.values()].sort((a, b) => a.province.localeCompare(b.province));
}

export function nationalVoters(): number {
  return provinceTotals().reduce((n, p) => n + p.registeredVoters, 0);
}

export type BandPosition = 'below' | 'within' | 'above';

/** Where a ward sits against the delimitation's own band for its municipality. */
export function bandPosition(voters: number, min: number, max: number): BandPosition {
  if (voters < min) return 'below';
  if (voters > max) return 'above';
  return 'within';
}

export function councilsInProvince(province: string) {
  return allCouncils().filter((c) => c.province === province);
}
