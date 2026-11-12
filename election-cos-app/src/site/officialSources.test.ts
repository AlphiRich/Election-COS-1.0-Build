import { describe, expect, it } from 'vitest';
import {
  ALL_OFFICIAL_LINKS,
  IEC_LINK,
  OFFICIAL_GROUPS,
  OFFICIAL_HOSTS,
  PARTY_AGENT_RULES_IEC,
} from './officialSources';

describe('official sources', () => {
  it('lists only https addresses on the hosts we have probed, with no repeats', () => {
    const seen = new Set<string>();
    for (const l of ALL_OFFICIAL_LINKS) {
      const u = new URL(l.url);
      expect(u.protocol, l.url).toBe('https:');
      expect(OFFICIAL_HOSTS as readonly string[], l.url).toContain(u.hostname);
      expect(seen.has(l.url), `duplicate ${l.url}`).toBe(false);
      seen.add(l.url);
      expect(l.label.length).toBeGreaterThan(2);
      expect(l.about.length).toBeGreaterThan(10);
    }
    expect(OFFICIAL_GROUPS.length).toBe(5);
  });

  it('does not list the page that answered with the Commission’s own error', () => {
    expect(ALL_OFFICIAL_LINKS.some((l) => /Political-Parties-Statistics/.test(l.url))).toBe(false);
  });

  it('keeps every named address inside the list', () => {
    const listed = new Set(ALL_OFFICIAL_LINKS.map((l) => l.url));
    for (const key of [
      'partyAgents',
      'objections',
      'counting',
      'voting',
      'codeOfConduct',
      'candidateLists',
      'votingStations',
      'stationFinder',
      'forms',
      'laws',
      'results',
      'lgeDashboard',
      'disinformation',
      'real411',
      'fraud',
      'seatsExplainer',
      'voterStats',
      'votingDistricts',
      'whoIsMyCouncillor',
      'contact',
      'localOffices',
      'documentLibrary',
    ] as const) {
      expect(listed.has(IEC_LINK[key]), key).toBe(true);
    }
  });

  it('states the Commission’s no-outside-communication rule for agents', () => {
    expect(PARTY_AGENT_RULES_IEC.join(' ')).toMatch(
      /No communication with people outside the venue/,
    );
    expect(PARTY_AGENT_RULES_IEC.join(' ')).toMatch(/two agents/);
  });
});
