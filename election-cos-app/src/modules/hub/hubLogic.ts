/** Election Campaign OS — the Master Command & Media Hub: logic (pure, tested in hub.test.ts). */
import { checkTotal, formatRand, type FundingBand } from '@/site/tools/fundingCheck';
import { ASSETS, DISCIPLINE, SCRIPTS, type Asset, type AssetCategory } from './hubData';
import { HUB_AGENTS, type HubAgent } from './hubAgents';
import { transition, type OutboxMutation, type OutboxStatus } from '@/offline/outboxStatus';

/** Schedule 1 Item 12: Q = floor(A / (B - C - D)) + 1. D is ward seats won by parties with no PR list. null when nothing is left to divide by. */
export function quotaFor(a: number, b: number, c: number, d: number): number | null {
  const denominator = b - c - d;
  if (!(denominator > 0) || !Number.isFinite(a) || a < 0) return null;
  return Math.floor(a / denominator) + 1;
}

export const filterAssets = (category: AssetCategory | 'all'): Asset[] =>
  category === 'all' ? ASSETS : ASSETS.filter((a) => a.category === category);

export function searchAgents(term: string, agents: HubAgent[] = HUB_AGENTS): HubAgent[] {
  const t = term.trim().toLowerCase();
  if (!t) return agents;
  return agents.filter((a) =>
    [a.name, a.desc, a.tier, a.build, a.status].some((f) => f.toLowerCase().includes(t)),
  );
}

export type AgentState = 'built' | 'partial' | 'not-built' | 'by-design' | 'not-applicable' | 'held-back';
export function agentState(a: Pick<HubAgent, 'status'>): AgentState {
  const s = a.status.toLowerCase();
  if (s.startsWith('n/a') || s === 'n/a') return 'not-applicable';
  if (s.includes('by design')) return 'by-design';
  if (s.startsWith('not built')) return 'not-built';
  if (s.includes('held back')) return 'held-back';
  if (s.startsWith('partial') || s.includes('not wired') || s.includes('gate built')) return 'partial';
  if (s.startsWith('built')) return 'built';
  return 'partial';
}
export const agentSummary = (agents: HubAgent[] = HUB_AGENTS): Record<AgentState, number> => {
  const out: Record<AgentState, number> = { built: 0, partial: 0, 'not-built': 0, 'by-design': 0, 'not-applicable': 0, 'held-back': 0 };
  for (const a of agents) out[agentState(a)]++;
  return out;
};

/** The teleprompter's timeline: block i is lit from i * 2.5 s. */
export const PROMPTER_STEP_MS = 2500;
export function promptedBlock(scriptId: keyof typeof SCRIPTS, elapsedMs: number): number | null {
  const n = SCRIPTS[scriptId].blocks.length;
  const i = Math.floor(elapsedMs / PROMPTER_STEP_MS);
  return i < n ? i : null;
}
export const clock = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** The doorstep record's happy path through the real outbox state machine (`src/offline/outboxStatus.ts`). */
export function outboxRun(now: Date = new Date()): Array<{ status: OutboxStatus; line: string }> {
  let m: OutboxMutation = { mutationId: 'mut_17001', status: 'PENDING', retryCount: 0 };
  const steps: Array<{ status: OutboxStatus; line: string }> = [{ status: 'PENDING', line: 'Read queued mutation mut_17001 from IndexedDB.' }];
  m = transition(m, 'IN_FLIGHT', { now });
  steps.push({ status: m.status, line: 'Sending the change to the server.' });
  m = transition(m, 'APPLIED', { now });
  steps.push({ status: m.status, line: 'Accepted. The record is marked synced on the phone.' });
  return steps;
}

export interface FundingEvaluation {
  band: FundingBand;
  label: string;
  reference: string;
  description: string;
  total: string;
}
const LABELS: Record<FundingBand, { label: string; reference: string }> = {
  BELOW_WARNING: { label: 'BELOW_WARNING', reference: 'Below the warning rung (80% of the disclosure line)' },
  NEAR_DISCLOSURE: { label: 'NEAR_DISCLOSURE', reference: 'Within 20% of the disclosure line' },
  AT_OR_ABOVE_DISCLOSURE: { label: 'AT_OR_ABOVE_DISCLOSURE', reference: 'At or above the disclosure line' },
  ABOVE_ANNUAL_CAP: { label: 'ABOVE_ANNUAL_CAP', reference: 'Above the annual donor line in the proclamation' },
};
/** A position relative to the lines in the current proclamation; never "compliant" or "lawful". `rand` is whole rand. */
export function evaluateFunding(rand: number): FundingEvaluation {
  const r = checkTotal(Math.round(rand * 100));
  return { band: r.band, ...LABELS[r.band], description: r.message, total: formatRand(Math.round(rand * 100)) };
}

export const disciplineSummary = () => ({
  enforced: DISCIPLINE.filter((r) => r.kind === 'enforced').length,
  process: DISCIPLINE.filter((r) => r.kind === 'process').length,
  partial: DISCIPLINE.filter((r) => r.kind === 'partial').length,
  total: DISCIPLINE.length,
});
