/**
 * Election Campaign OS — Campaign Director: the ECOS tools as LangChain tools.
 *
 * The same deterministic logic as `ecosMcpTools.ts`, wrapped as LangChain
 * `tool`s so the model can call them inside the graph's ToolNode loop. Keeping
 * one logic source means the honesty rules (tenant-scoped reads; the
 * fail-closed baseline/scenario tools) are proven once, in `ecosMcpTools.test`.
 *
 * The war-room tool reads the verified `HarnessContext` from the run config at
 * call time, so it can only ever read the caller's own tenant — the context is
 * never passed in by the model.
 */
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import type { HarnessContext } from './state';
import {
  getCertifiedBaselineTool,
  getWarRoomCountersTool,
  runSchedule1ScenarioTool,
  type CounterReader,
} from './ecosMcpTools';

function ctxFromConfig(config: RunnableConfig | undefined): HarnessContext {
  const ctx = config?.configurable?.harnessContext as HarnessContext | undefined;
  if (!ctx?.tenantId || !ctx?.uid) throw new Error('HarnessContext missing verified tenantId/uid');
  return ctx;
}

export function buildEcosTools(counterReader: CounterReader): StructuredToolInterface[] {
  const warRoom = tool(
    async (input: { ward_ids?: string[] }, config: RunnableConfig): Promise<string> => {
      const ctx = ctxFromConfig(config);
      const r = await getWarRoomCountersTool(ctx, counterReader, input.ward_ids ?? []);
      return r.content[0].text;
    },
    {
      name: 'get_war_room_counters',
      description:
        'Read tenant-scoped war-room operational counters (voters captured, open incidents, sentiment). ' +
        'Honest empty states — never interpolated.',
      schema: z.object({ ward_ids: z.array(z.string()).max(50).optional() }),
    },
  );

  const baseline = tool(
    async (): Promise<string> => getCertifiedBaselineTool().content[0].text,
    {
      name: 'get_certified_baseline',
      description: 'Certified municipality result lookup. Currently refuses: the engine lives in the app package.',
      schema: z.object({
        municipality_code: z.string().regex(/^NW\d{3}$/),
        election_year: z.enum(['2026', '2021']).default('2026'),
      }),
    },
  );

  const scenario = tool(
    async (): Promise<string> => runSchedule1ScenarioTool().content[0].text,
    {
      name: 'run_schedule1_scenario',
      description: 'Schedule 1 seat scenario runner. Currently refuses: the engine lives in the app package.',
      schema: z.object({
        municipality_code: z.string().regex(/^NW\d{3}$/),
        seed: z.number().int(),
        turnout_delta_pct: z.number().min(-30).max(30),
        party_swings_pct: z.record(z.string(), z.number()),
        assumption_acknowledged_by_user: z.literal(true),
      }),
    },
  );

  return [warRoom, baseline, scenario] as unknown as StructuredToolInterface[];
}

/**
 * A real counter reader over Firestore: reads the tenant's pre-aggregated
 * `counters/warRoom` document and returns its numeric fields. Ward-scoped
 * counters are a later refinement; tenant-level is returned today.
 */
export function firestoreCounterReader(db: Firestore): CounterReader {
  return async (tenantId: string): Promise<Record<string, number>> => {
    const snap = await db.doc(`tenants/${tenantId}/counters/warRoom`).get();
    if (!snap.exists) return {};
    const data = snap.data() ?? {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(data)) if (typeof v === 'number') out[k] = v;
    return out;
  };
}
