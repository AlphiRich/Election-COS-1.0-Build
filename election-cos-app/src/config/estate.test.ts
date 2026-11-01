import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPERSEDED_DOMAINS } from './publicDomain';
import { ESTATE, ZONES, enquiryOrigins, proposeSubdomain } from './estate';

describe('the domain estate', () => {
  it('lists each hostname once, inside a zone we control', () => {
    const hosts = ESTATE.map((e) => e.host);
    expect(new Set(hosts).size).toBe(hosts.length);
    for (const h of hosts) {
      expect(
        ZONES.some((z) => h === z || h.endsWith(`.${z}`)),
        h,
      ).toBe(true);
    }
  });

  it('puts every hostname behind Cloudflare', () => {
    for (const e of ESTATE) expect(e.cloudflareProxied, e.host).toBe(true);
  });

  it('never revives a superseded name', () => {
    for (const e of ESTATE) expect(SUPERSEDED_DOMAINS as readonly string[]).not.toContain(e.host);
  });

  it('keeps advertising and campaign data on different origins', () => {
    const ads = ESTATE.filter((e) => e.carriesAds).map((e) => e.host);
    const data = ESTATE.filter((e) => e.handlesCampaignData).map((e) => e.host);
    expect(ads.length).toBeGreaterThan(0);
    expect(data.length).toBeGreaterThan(0);
    for (const a of ads) expect(data).not.toContain(a);
    for (const e of ESTATE) expect(e.carriesAds && e.handlesCampaignData, e.host).toBe(false);
  });

  it('serves applications from Firebase Hosting and does not guess where the company site lives', () => {
    expect(
      ESTATE.filter((e) => e.role === 'APP').every((e) => e.platform === 'FIREBASE_HOSTING'),
    ).toBe(true);
    expect(ESTATE.find((e) => e.role === 'COMPANY_SITE')!.platform).toBe(
      'UNDECIDED_GCP_OR_CLOUDFLARE',
    );
  });

  it('invents no product subdomain: only the three known hostnames exist', () => {
    expect(ESTATE.map((e) => e.host).sort()).toEqual(
      ['app.electioncos.co.za', 'electioncos.co.za', 'innovationconsult.co.za'].sort(),
    );
  });
});

describe('proposing a subdomain for a new service or product line', () => {
  it('accepts a clean label and returns the full hostname', () => {
    expect(proposeSubdomain('insights')).toEqual({
      ok: true,
      host: 'insights.innovationconsult.co.za',
      problems: [],
    });
  });
  it('refuses reserved, malformed, duplicate and party-named labels', () => {
    expect(proposeSubdomain('mail').ok).toBe(false);
    expect(proposeSubdomain('-bad').ok).toBe(false);
    expect(proposeSubdomain('Has Space').ok).toBe(false);
    expect(proposeSubdomain('x'.repeat(40)).ok).toBe(false);
    expect(proposeSubdomain('anc').ok).toBe(false);
    expect(proposeSubdomain('demo', ['demo.innovationconsult.co.za']).ok).toBe(false);
  });
});

describe('what the enquiry endpoint accepts', () => {
  it('is exactly the company site and the public site, never the application', () => {
    expect(enquiryOrigins().sort()).toEqual([
      'https://electioncos.co.za',
      'https://innovationconsult.co.za',
    ]);
  });
  it('matches the origin list the Cloud Function carries', () => {
    const fn = readFileSync(
      path.resolve(__dirname, '..', '..', 'functions', 'src', 'enquiryOrigins.ts'),
      'utf-8',
    );
    for (const o of enquiryOrigins()) expect(fn, o).toContain(`'${o}'`);
    expect(fn).not.toContain('app.electioncos.co.za');
  });
});
