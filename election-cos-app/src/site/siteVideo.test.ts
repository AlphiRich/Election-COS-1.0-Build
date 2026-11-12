import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPLAINERS } from './explainerVideos';
import { PROMO_VIDEOS } from './promoVideos';

const pages = path.resolve(__dirname, 'pages');
const used: Array<{ file: string; id: string }> = [];
for (const f of readdirSync(pages).filter((x) => x.endsWith('.tsx') && !x.includes('.test.'))) {
  const src = readFileSync(path.join(pages, f), 'utf8');
  for (const m of src.matchAll(/<(?:SiteVideo|PromoPlayer) id="([a-z0-9-]+)"/g)) used.push({ file: f, id: m[1] });
}
const known = new Set([...PROMO_VIDEOS.map((v) => v.id), ...EXPLAINERS.filter((e) => e.hosted).map((e) => e.id)]);

describe('videos placed on the site pages', () => {
  it('finds the placements (so the checks are not vacuous)', () => {
    expect(used.length).toBeGreaterThanOrEqual(15);
  });
  it('every placed id is a hosted video, so a mistyped id cannot render an empty player', () => {
    for (const u of used) expect(known.has(u.id), `${u.file}: ${u.id}`).toBe(true);
  });
  it('puts each video on a page about its subject', () => {
    const on = (id: string) => used.filter((u) => u.id === id).map((u) => u.file.replace('.tsx', ''));
    expect(on('funding-30-day')).toEqual(expect.arrayContaining(['SiteFundingChecker', 'SiteCompliance']));
    expect(on('seats-won')).toEqual(expect.arrayContaining(['SiteSeatTool', 'SiteHome']));
    expect(on('scenario-runner')).toContain('SiteSeatModel');
    expect(on('canvasser-knocks')).toContain('SiteCodeOfConduct');
    expect(on('capture-consent')).toEqual(expect.arrayContaining(['SiteCompliance']));
    expect(on('who-governs-your-council')).toEqual(expect.arrayContaining(['SiteHome', 'SiteResults', 'SiteCoalitionTracker', 'SiteCouncilFinder']));
    expect(on('roles')).toContain('SitePlatform');
  });
  it('does not put the survey promo on content pages: it belongs to the invitation and the Watch page', () => {
    expect(used.filter((u) => u.id === 'landing-survey').map((u) => u.file)).toEqual(['SiteWatch.tsx']);
  });
});
