/**
 * Election Campaign OS — what actually moved in JB Marks between the 2021 and 2026 elections.
 *
 * A forecast needs an observation to lean on. This is the one observed swing the build has: the 2021 certified result against
 * the 2026 certified result for NW405, on the same definition of a party's vote (PR plus ward votes, independents outside A).
 * It is a description of one election pair, not an estimate of how swings are distributed, and nothing here is a probability.
 * The scenario runner shows it beside the swing and spread fields so a person can see what their assumptions are being set
 * against, and may copy it in; it is never applied by itself.
 *
 * WARD-LEVEL SWING matches wards by number across two delimitations. That is a stated correspondence, not an identity
 * (`WARD_CORRESPONDENCE_CAVEAT`), and 2021 holds only the winner and runner-up per ward, so a party's 2021 ward share is known
 * only where it finished first or second there.
 */
import { BASELINE_NW405_2021, baseline2026 } from './baselines';
import { WARD_CORRESPONDENCE_CAVEAT } from './wardResults2021';
import { municipality, partyId, turnout } from '@/modules/lge2026/lge2026Results';

export interface PartySwing {
  id: string;
  name: string;
  share2021: number;
  share2026: number;
  /** 2026 share minus 2021 share, in points of the party votes. */
  swing: number;
}

export function municipalSwing(): PartySwing[] {
  const a = BASELINE_NW405_2021;
  const b = baseline2026('NW405');
  const names = new Map<string, string>();
  const s21 = new Map<string, number>();
  const s26 = new Map<string, number>();
  for (const p of a.parties) { s21.set(p.id, (p.votes / a.totalValidVotes) * 100); names.set(p.id, p.name); }
  for (const p of b.parties) { s26.set(p.id, (p.votes / b.totalValidVotes) * 100); names.set(p.id, p.name); }
  return [...new Set([...s21.keys(), ...s26.keys()])]
    .map((id) => ({ id, name: names.get(id) ?? id, share2021: s21.get(id) ?? 0, share2026: s26.get(id) ?? 0, swing: (s26.get(id) ?? 0) - (s21.get(id) ?? 0) }))
    .filter((r) => r.share2021 >= 1 || r.share2026 >= 1)
    .sort((x, y) => y.share2026 - x.share2026);
}

export interface WardSwingSummary {
  id: string;
  /** Wards where the party was first or second in 2021, so its 2021 ward share is known. */
  wards: number;
  mean: number;
  /** Sample standard deviation across those wards, in points. */
  sd: number;
}

export function wardSwing(ids: string[] = ['ANC', 'DA']): WardSwingSummary[] {
  const w26 = municipality('NW405').wardResults;
  const out: WardSwingSummary[] = [];
  for (const id of ids) {
    const xs: number[] = [];
    for (const w of BASELINE_NW405_2021.results.wards) {
      let s21: number | null = null;
      if (w.winnerPartyId === id) s21 = (w.winnerVotes / w.wardVotes) * 100;
      else if (w.runnerUpPartyId === id) s21 = (w.runnerUpVotes / w.wardVotes) * 100;
      if (s21 === null) continue;
      const r = w26.find((x) => x.wardNumber === w.wardNumber);
      if (!r) continue;
      const v = r.parties.find(([n]) => partyId(n) === id)?.[1] ?? 0;
      xs.push((v / r.valid) * 100 - s21);
    }
    const mean = xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
    const sd = xs.length > 1 ? Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (xs.length - 1)) : 0;
    out.push({ id, wards: xs.length, mean, sd });
  }
  return out;
}

export function turnoutChange() {
  const t26 = turnout('NW405', 'pr');
  // 2021, from the Commission's export as reconciled in seatCalculator.nw405-2021.test.ts: PR valid 50,733 of 113,218 registered.
  return { registered2021: 113218, prValid2021: 50733, registered2026: t26.registered, prValid2026: t26.valid };
}

export const SWING_CAVEAT = `One election pair, described and not modelled. ${WARD_CORRESPONDENCE_CAVEAT} It is not a distribution of swings and not a forecast.`;
