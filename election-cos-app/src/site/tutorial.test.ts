import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_ROLES } from '@/auth/seedRoles';
import { CHAPTERS, ROLE_LINES, TOUR_SECONDS } from './tutorial';

/** Strip comments, so a guard never trips on the sentence explaining it. */
const code = readFileSync(path.resolve(__dirname, 'tutorial.ts'), 'utf-8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const copy = JSON.stringify(CHAPTERS);

describe('the 60-second tour', () => {
  it('has six chapters that run 0 to 60 seconds with no gap or overlap', () => {
    expect(CHAPTERS).toHaveLength(6);
    expect(CHAPTERS[0]!.start).toBe(0);
    expect(CHAPTERS[CHAPTERS.length - 1]!.end).toBe(TOUR_SECONDS);
    CHAPTERS.forEach((c, i) => {
      expect(c.end).toBeGreaterThan(c.start);
      if (i) expect(c.start).toBe(CHAPTERS[i - 1]!.end);
    });
  });

  it('lists every role the software has, taken from the role table, not retyped', () => {
    expect(ROLE_LINES).toHaveLength(SEED_ROLES.length);
    expect(ROLE_LINES.map((r) => r.label)).toEqual(SEED_ROLES.map((r) => r.label));
    expect(copy).toContain('Seven Roles');
    expect(SEED_ROLES).toHaveLength(7);
  });

  it('claims nothing the build does not do', () => {
    for (const bad of [
      /OCR/,
      /1\.8\s?s/,
      /Droop|Hare/,
      /R100,000/,
      /CampaignToken|token wallet/i,
      /§\s?4\.3/,
      /Monte Carlo/,
      /predict/i,
      /AWS|Postgres|Fargate/,
    ]) {
      expect(copy, String(bad)).not.toMatch(bad);
    }
  });

  it('states the funding figures that are in force, with the gazette', () => {
    expect(copy).toContain('R200,000');
    expect(copy).toContain('R30 million');
    expect(copy).toContain('53182');
    expect(copy).toMatch(/under court challenge/);
  });

  it('uses no invented persona, email or telemetry figure', () => {
    expect(copy).not.toMatch(/@|412|3,842|24\.5k|Thabo|Nomvula|Sipho|Lerato|Bongani/);
  });

  it('only links to pages the public site has', () => {
    const app = readFileSync(path.resolve(__dirname, 'SiteApp.tsx'), 'utf-8');
    const tools = readFileSync(path.resolve(__dirname, 'pages/SiteVoterTools.tsx'), 'utf-8');
    for (const c of CHAPTERS) {
      if (!c.tryIt) continue;
      const href = c.tryIt.href;
      expect(app.includes(`"${href}"`) || tools.includes(`'${href}'`), href).toBe(true);
    }
  });

  it('keeps the page script free of the things it declines to claim, comments aside', () => {
    expect(code).not.toMatch(/Math\.random|Date\.now\(\)/); // no invented live numbers
  });
});
