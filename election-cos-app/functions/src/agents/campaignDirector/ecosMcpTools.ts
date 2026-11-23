/**
 * Election Campaign OS — Campaign Director: the deterministic ECOS tools.
 *
 * The tool LOGIC, as plain tested functions. `mcpServer.ts` and
 * `ecosLangchainTools.ts` register these for a model to call; keeping the logic
 * here means the honesty rules are proven without a transport or a model.
 *
 * The seat figures come from the REAL, mirrored Schedule 1 engine
 * (`./engine/seatCalculator` — `allocateSeats`, the Item 12 quota) and the REAL
 * NW405 2021 result (`./engine/nw405Example`), copied into this package by
 * `npm run gen:agent-engine` and guarded against drift by
 * `agentEngineMirror.test.ts`. The statutory formula is never reimplemented; a
 * scenario swing is a transparent, labelled USER ASSUMPTION applied on top of
 * it (build rule 2; the provenance gate forbids calling a swing "sourced").
 *
 * What this runtime holds is NW405 (JB Marks). Anything else — another
 * municipality, or 2026 certified results, which are not mirrored here — FAILS
 * CLOSED rather than returning a figure it cannot stand behind.
 */
import type { HarnessContext } from './state';
import { allocateSeats, type SeatAllocationResult } from './engine/seatCalculator';
import { NW405_2021_EXAMPLE } from './engine/nw405Example';

/** The MCP tool result shape (a subset of CallToolResult; the index signature
 * keeps it assignable to the SDK's CallToolResult without pulling its type in). */
export interface McpToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
  [x: string]: unknown;
}

function textResult(text: string, isError = false): McpToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function seatSummary(res: SeatAllocationResult) {
  return {
    quota: res.quota,
    newQuota: res.newQuota,
    councilSizeFinal: res.councilSizeFinal,
    totalSeatsAllocated: res.totalSeatsAllocated,
    pendingSeats: res.pendingSeats,
    excessiveParties: res.excessiveParties,
    notes: res.notes,
    delimitationId: res.delimitationId,
    parties: res.parties.map((p) => ({
      id: p.id,
      name: p.name,
      votes: p.votes,
      wardSeats: p.wardSeatsWon,
      prSeats: p.prSeats,
      totalSeats: p.totalSeats,
    })),
  };
}

const BASE = NW405_2021_EXAMPLE;
const baseParties = () => BASE.parties.map((p) => ({ id: p.id, name: p.name, votes: p.votes, wardSeatsWon: p.wardSeatsWon }));

// ---- Reader: war-room counters -------------------------------------------

/**
 * Reads tenant-scoped war-room counters. Injected so the tool is tested without
 * Firestore and can never read outside its tenant (the reader is handed only
 * `ctx.tenantId`).
 */
export type CounterReader = (tenantId: string, wardIds: string[]) => Promise<Record<string, number>>;

export async function getWarRoomCountersTool(
  ctx: HarnessContext,
  reader: CounterReader,
  wardIds: string[] = [],
): Promise<McpToolResult> {
  const counters = await reader(ctx.tenantId, wardIds);
  // Honest empty state: an empty object is reported as-is, never interpolated.
  return textResult(JSON.stringify({ tenantId: ctx.tenantId, wardIds, counters }));
}

// ---- Certified baseline ---------------------------------------------------

export interface CertifiedBaselineInput {
  municipality_code: string;
  election_year?: '2026' | '2021';
}

/**
 * The certified result for a municipality, run through the real Schedule 1
 * engine. Only NW405 2021 is mirrored into this runtime; everything else fails
 * closed rather than inventing a figure.
 */
export function getCertifiedBaselineTool(input: CertifiedBaselineInput): McpToolResult {
  const code = input.municipality_code?.trim().toUpperCase();
  const year = input.election_year ?? '2026';
  if (code !== 'NW405' || year !== '2021') {
    return textResult(
      `No certified baseline is held in this runtime for ${code ?? '(none)'} ${year}. ` +
        'Only NW405 (JB Marks) 2021 is mirrored into the Cloud Functions package; 2026 certified ' +
        'results and other municipalities are not, so this refuses rather than returning an unverified figure.',
      true,
    );
  }
  const res = allocateSeats({
    totalValidVotes: BASE.totalValidVotes,
    totalSeats: BASE.totalSeats,
    independentWardSeats: BASE.independentWardSeats,
    noPRListWardSeats: BASE.noPRListWardSeats,
    delimitationId: BASE.delimitationId,
    parties: baseParties(),
  });
  return textResult(
    JSON.stringify({
      municipality_code: 'NW405',
      election_year: '2021',
      source: 'IEC Seat Calculation Detail for NW405 (2021 LGE), transcribed — see docs/nw405-seed-data.md',
      totalValidVotes: BASE.totalValidVotes,
      totalSeats: BASE.totalSeats,
      ...seatSummary(res),
    }),
  );
}

// ---- Schedule 1 scenario --------------------------------------------------

export interface Schedule1ScenarioInput {
  municipality_code: string;
  seed?: number;
  turnout_delta_pct?: number;
  party_swings_pct?: Record<string, number>;
  assumption_acknowledged_by_user?: boolean;
}

/**
 * Propagate user-stated swings and a turnout delta through the authoritative
 * Schedule 1 quota formula. A simple proportional swing on the 2021 PR votes —
 * a USER ASSUMPTION, never presented as sourced — with ward seats held at their
 * 2021 values. It is a PR-seat scenario, not a ward-by-ward flip simulation
 * (that richer model stays in the app). Only NW405 is supported here.
 */
export function runSchedule1ScenarioTool(input: Schedule1ScenarioInput): McpToolResult {
  const code = input.municipality_code?.trim().toUpperCase();
  if (code !== 'NW405') {
    return textResult(
      `Scenario is only available for NW405 (JB Marks) in this runtime; ${code ?? '(none)'} is not mirrored here.`,
      true,
    );
  }
  if (input.assumption_acknowledged_by_user !== true) {
    return textResult(
      'Scenario requires assumption_acknowledged_by_user: true — a swing and turnout delta are your ' +
        'assumptions, not sourced figures, and the run will not proceed without that acknowledgement.',
      true,
    );
  }

  const swings = input.party_swings_pct ?? {};
  const turnoutFactor = 1 + (input.turnout_delta_pct ?? 0) / 100;
  const parties = BASE.parties.map((p) => {
    const swingPct = swings[p.id] ?? 0;
    const votes = Math.max(0, Math.round(p.votes * (1 + swingPct / 100) * turnoutFactor));
    return { id: p.id, name: p.name, votes, wardSeatsWon: p.wardSeatsWon };
  });
  const totalValidVotes = parties.reduce((s, p) => s + p.votes, 0);

  const res = allocateSeats({
    totalValidVotes,
    totalSeats: BASE.totalSeats,
    independentWardSeats: BASE.independentWardSeats,
    noPRListWardSeats: BASE.noPRListWardSeats,
    delimitationId: BASE.delimitationId,
    parties,
  });

  return textResult(
    JSON.stringify({
      municipality_code: 'NW405',
      seed: input.seed ?? null,
      provenance: 'user_assumption_propagated_via_schedule1',
      model_note:
        'Simple proportional swing applied to the 2021 PR votes (a user assumption), then the real ' +
        'Schedule 1 Item 12 quota. Ward seats held at their 2021 values; this is a PR-seat scenario, not a ' +
        'ward-by-ward flip simulation. Deterministic — the seed does not affect the result.',
      turnout_delta_pct: input.turnout_delta_pct ?? 0,
      party_swings_pct: swings,
      totalValidVotes,
      ...seatSummary(res),
    }),
  );
}
