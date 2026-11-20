import { describe, expect, it, vi } from 'vitest';
import {
  getCertifiedBaselineTool,
  getWarRoomCountersTool,
  runSchedule1ScenarioTool,
  type CounterReader,
} from './ecosMcpTools';
import type { HarnessContext } from './state';

const ctx: HarnessContext = { tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view'] };

describe('ecos MCP tools — fail closed where no engine exists', () => {
  it('get_certified_baseline refuses rather than fabricating', () => {
    const r = getCertifiedBaselineTool();
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/unavailable|refuses/i);
    // It must NOT return a fabricated "IEC Certified Results" style figure.
    expect(r.content[0].text).not.toMatch(/IEC Certified Results/);
  });

  it('run_schedule1_scenario refuses rather than fabricating a seat allocation', () => {
    const r = runSchedule1ScenarioTool();
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/unavailable|refuses/i);
  });
});

describe('get_war_room_counters — real read, tenant-scoped, honest empty state', () => {
  it('passes only the caller tenant to the reader and returns its counters', async () => {
    const reader = vi.fn<CounterReader>(async () => ({ votersCaptured: 12, openIncidents: 3 }));
    const r = await getWarRoomCountersTool(ctx, reader, ['NW405-W1']);
    expect(reader).toHaveBeenCalledWith('jb-marks', ['NW405-W1']);
    expect(r.isError).toBeFalsy();
    const body = JSON.parse(r.content[0].text);
    expect(body).toEqual({ tenantId: 'jb-marks', wardIds: ['NW405-W1'], counters: { votersCaptured: 12, openIncidents: 3 } });
  });

  it('reports an empty counter set as-is, never interpolated', async () => {
    const reader: CounterReader = async () => ({});
    const r = await getWarRoomCountersTool(ctx, reader);
    expect(JSON.parse(r.content[0].text).counters).toEqual({});
  });
});
