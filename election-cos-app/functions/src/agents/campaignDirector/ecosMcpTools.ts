/**
 * Election Campaign OS — Campaign Director: the deterministic ECOS tools.
 *
 * The tool LOGIC, as plain tested functions. `mcpServer.ts` registers these on
 * an MCP server for a model to call; keeping the logic here means the honesty
 * rules are proven without standing up a transport or a model.
 *
 * Two of the three tools FAIL CLOSED. The certified-results seat engine
 * (`seatCalculator` / the certified baselines) lives in the APPLICATION
 * package, outside `functions`' `rootDir` — it cannot be reached from the Cloud
 * Functions runtime. Rather than return the handoff's fabricated
 * `{source:"IEC Certified Results"}` stub (which would violate build rule 2 —
 * never fabricate — and rule 6 — a tool that cannot do its job refuses), they
 * return `isError` with the reason. Wiring a shared engine into functions is the
 * prerequisite to turning them on.
 */
import type { HarnessContext } from './state';

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

const BASELINE_UNAVAILABLE =
  'Certified baseline is unavailable in the Cloud Functions runtime: the certified-results seat ' +
  'calculator lives in the application package (outside functions/ rootDir), so there is no engine ' +
  'to call here. This tool refuses rather than returning an unverified figure. Wire a shared ' +
  'Schedule 1 engine into functions before enabling it.';

const SCENARIO_UNAVAILABLE =
  'Schedule 1 scenario runner is unavailable in the Cloud Functions runtime: the Schedule 1 quota ' +
  'engine lives in the application package. This tool refuses rather than fabricating a seat ' +
  'allocation. Wire a shared engine into functions before enabling it.';

/** FAILS CLOSED — no certified-results engine in this runtime. */
export function getCertifiedBaselineTool(): McpToolResult {
  return textResult(BASELINE_UNAVAILABLE, true);
}

/** FAILS CLOSED — no Schedule 1 engine in this runtime. */
export function runSchedule1ScenarioTool(): McpToolResult {
  return textResult(SCENARIO_UNAVAILABLE, true);
}
