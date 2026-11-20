/**
 * Election Campaign OS — Campaign Director: MCP server wrapping ECOS tools.
 *
 * Registers the deterministic ECOS tools (`ecosMcpTools.ts`) on an MCP server
 * with Zod input schemas, so a model's arguments are validated before they
 * reach a handler and a business-rule failure comes back as `isError` for the
 * model to self-correct. The handlers are the tested functions in
 * `ecosMcpTools.ts`; this file only wires them.
 *
 * The server is constructed per run with the verified `HarnessContext`, so the
 * counter tool can only ever read the caller's own tenant. No transport is
 * attached here — connecting a transport, and binding a model to these tools,
 * is part of the deploy phase (there is no model credential yet).
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { HarnessContext } from './state';
import {
  getCertifiedBaselineTool,
  getWarRoomCountersTool,
  runSchedule1ScenarioTool,
  type CounterReader,
} from './ecosMcpTools';

export function createEcosMcpServer(ctx: HarnessContext, counterReader: CounterReader): McpServer {
  const server = new McpServer({ name: 'ecos-campaign-director-tools', version: '1.0.0' });

  server.registerTool(
    'get_certified_baseline',
    {
      title: 'Get Certified Municipality Baseline',
      description: 'Read-only certified result lookup. Currently refuses: the engine lives in the app package.',
      inputSchema: {
        municipality_code: z.string().regex(/^NW\d{3}$/, 'Must be a North West code, e.g. NW405'),
        election_year: z.enum(['2026', '2021']).default('2026'),
      },
    },
    async () => getCertifiedBaselineTool(),
  );

  server.registerTool(
    'get_war_room_counters',
    {
      title: 'Get War Room Operational Counters',
      description: 'Reads tenant-scoped operational counters with honest empty states. Never interpolates.',
      inputSchema: {
        ward_ids: z.array(z.string()).max(50).optional(),
      },
    },
    async ({ ward_ids }) => getWarRoomCountersTool(ctx, counterReader, ward_ids ?? []),
  );

  server.registerTool(
    'run_schedule1_scenario',
    {
      title: 'Run Schedule 1 Seat Scenario',
      description: 'Propagates user-stated swings through the Schedule 1 engine. Currently refuses: engine in app package.',
      inputSchema: {
        municipality_code: z.string().regex(/^NW\d{3}$/),
        seed: z.number().int(),
        turnout_delta_pct: z.number().min(-30).max(30),
        party_swings_pct: z.record(z.string(), z.number()),
        assumption_acknowledged_by_user: z.literal(true),
      },
    },
    async () => runSchedule1ScenarioTool(),
  );

  return server;
}
