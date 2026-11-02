import { describe, expect, it } from 'vitest';
import type { Incident } from '@/dal/ports/incidents';
import {
  COMPLIANCE_NOTICE,
  MIN_CELL,
  SEAT_EXPLAINER,
  buildGroundIntelligence,
  groundIntelligenceHtml,
} from './groundIntelligence';

const inc = (ward: string, category: Incident['category'], n: number, month = '2026-11') =>
  Array.from({ length: n }, (_, k) => ({
    id: `${ward}${category}${k}${month}`,
    wardCode: ward,
    category,
    createdAt: `${month}-04T08:00:00Z`,
  })) as unknown as Incident[];
const NOW = new Date('2026-11-04T12:00:00Z');

describe('daily ground intelligence', () => {
  const incidents = [
    ...inc('NW405-W01', 'ELECTRICITY', 6),
    ...inc('NW405-W01', 'WATER_SANITATION', 2), // below the minimum
    ...inc('NW405-W02', 'ROADS_TRANSPORT', 4), // below the minimum
    ...inc('NW405-W01', 'ELECTRICITY', 9, '2026-10'), // another month
  ];
  const g = buildGroundIntelligence(incidents, '2026-11', NOW);

  it('shows only groups of at least five, and counts the rest as suppressed', () => {
    expect(MIN_CELL).toBe(5);
    const w1 = g.wards.find((w) => w.wardCode === 'NW405-W01')!;
    expect(w1.shown).toEqual([{ category: 'Electricity', count: 6 }]);
    expect(w1.suppressedCells).toBe(1);
    expect(g.wards.find((w) => w.wardCode === 'NW405-W02')!.shown).toEqual([]);
  });
  it('ignores other months', () => {
    expect(g.incidentsConsidered).toBe(12);
  });
  it('never prints a suppressed count, or a ward total that would let it be recovered', () => {
    const html = groundIntelligenceHtml(g);
    expect(html).toContain('1 smaller group not shown');
    const body = html.replace(/<style>[\s\S]*?<\/style>/, '');
    expect(body).not.toMatch(/<strong>(2|4)<\/strong>/); // the suppressed counts
    expect(body).not.toMatch(/total/i); // no ward total to subtract from
  });
  it('is stand-alone: no script and no external request, and it carries the explainer and the notice', () => {
    const html = groundIntelligenceHtml(g);
    expect(html).not.toMatch(/<script|src=|href=|@import|url\(/i);
    expect(html).toContain('does not calculate official seat allocations');
    expect(html).toContain(SEAT_EXPLAINER.slice(0, 40));
    expect(html).toContain('Groups smaller than 5 are suppressed');
    expect(COMPLIANCE_NOTICE).toMatch(/not legal advice/);
    expect(html).toContain('No email is sent and no data is transmitted');
  });
  it('escapes anything it prints', () => {
    const bad = buildGroundIntelligence(inc('<img onerror=x>', 'ELECTRICITY', 5), '2026-11', NOW);
    const html = groundIntelligenceHtml(bad);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img onerror=x&gt;');
  });
  it('says so when nothing was logged', () => {
    expect(groundIntelligenceHtml(buildGroundIntelligence([], '2026-11', NOW))).toContain(
      'No field signals were logged',
    );
  });
});
