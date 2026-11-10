// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Emblem, PartyLegend } from './PartyMark';
import emblemIds from '@/data/lge2026/party-emblem-ids.json';
import { COUNCIL_CODES, council } from '@/modules/lge2026/nationalResults';

const PUBLIC = path.resolve(__dirname, '../../../public');

describe('party emblems', () => {
  it('every id with an emblem has its file, and the manifest records the Commission as the source', () => {
    for (const id of emblemIds as string[]) expect(existsSync(path.join(PUBLIC, 'party-emblems', `${id.toLowerCase()}.png`)), id).toBe(true);
    const m = JSON.parse(readFileSync(path.resolve(__dirname, '../../data/lge2026/party-emblems.json'), 'utf8'));
    expect(m.imageUrlPattern).toMatch(/^https:\/\/results\.elections\.org\.za\//);
    expect(Object.keys(m.emblems)).toHaveLength((emblemIds as string[]).length);
  });
  it('covers every party holding a seat except the three the Commission serves no image for', () => {
    const have = new Set(emblemIds as string[]);
    const without = new Set<string>();
    for (const c of COUNCIL_CODES) for (const h of council(c).holders) if (h.id !== 'TIED' && !have.has(h.id)) without.add(h.id);
    expect([...without].sort()).toEqual(['ABAFUNA_INGUBO_YESKHETHU_PARTY', 'IZWI_LABAHLALI_BEWARD', 'SAVE_SOUTH_AFRICA']);
  });
  it('draws the emblem where there is one, and an initials badge (never another party’s image) where there is not', () => {
    expect(renderToStaticMarkup(<Emblem id="ANC" name="African National Congress" />)).toContain('/party-emblems/anc.png');
    const none = renderToStaticMarkup(<Emblem id="SAVE_SOUTH_AFRICA" name="Save South Africa" />);
    expect(none).not.toContain('<img');
    expect(none).toContain('SSA');
  });
  it('the legend puts each party’s name and seats under its emblem', () => {
    const html = renderToStaticMarkup(<PartyLegend holders={[{ id: 'DA', name: 'Democratic Alliance', seats: 91 }]} />);
    expect(html).toContain('/party-emblems/da.png');
    expect(html).toContain('Democratic Alliance');
    expect(html).toContain('91');
  });
});
