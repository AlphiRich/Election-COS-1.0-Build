import { describe, expect, it } from 'vitest';
import { municipality } from './lge2026Results';
import { partiesWithCandidates, partyProfile, reconcileAppCopies } from './partyProfile';

const P = partyProfile('NW405', 'ACTIONSA');

describe('ActionSA in JB Marks (NW405), candidates against results', () => {
  it('the two in-app copies of the Commission list agree row for row', () => {
    expect(reconcileAppCopies('ACTIONSA')).toEqual({ iec: 35, reference: 35, onlyIec: [], onlyReference: [] });
  });
  it('has the 35 printed rows: 34 ward candidates and a one-name PR list; 32 distinct people', () => {
    expect(P.candidates).toBe(35);
    expect(P.wardCandidates).toHaveLength(34);
    expect(P.prList).toHaveLength(1);
    expect(P.prList[0]).toMatchObject({ rank: 1, name: 'XOLILE DAVID KHAM', alsoWard: [23] });
    expect(P.distinctPeople).toBe(32);
    expect(P.duplicates.map((d) => d.name).sort()).toEqual(['FIKILE JOSEPH MOHOKA', 'LEILANIE NATASJA BARENDS', 'XOLILE DAVID KHAM']);
  });
  it('every ward candidate sits in a ward that exists and carries that ward’s real ActionSA vote', () => {
    const wards = new Map(municipality('NW405').wardResults.map((w) => [w.wardNumber, w]));
    for (const c of P.wardCandidates) {
      const w = wards.get(c.ward)!;
      expect(c.votes).toBe(w.parties.find(([p]) => p === 'ACTIONSA')![1]);
      expect(c.valid).toBe(w.valid);
    }
    expect(P.wardCandidates.reduce((s, c) => s + c.votes, 0)).toBe(P.ballots.ward.votes);
  });
  it('seats and votes are the Schedule 1 result, 5 list seats on 0 ward seats', () => {
    expect(P.seats).toMatchObject({ total: 5, ward: 0, pr: 5, quota: 2069 });
    expect(P.seats.entitlement).toBe(5);
    expect(Object.entries(P.wardPositions).reduce((s, [, n]) => s + n, 0)).toBe(34);
  });
  it('the published PR list cannot name four of the five list seats', () => {
    expect(P.listDepth).toMatchObject({ prSeats: 5, listLength: 1, eligible: 1, unfilled: 4 });
  });
  it('lists depth for every party with list seats, and each party’s ward candidates cover its ward entries', () => {
    expect(P.peers.map((p) => p.prSeats).reduce((s, n) => s + n, 0)).toBe(33); // 67 seats − 34 ward seats
    const by = Object.fromEntries(P.peers.map((p) => [p.party, p.unfilled]));
    expect(by['DEMOCRATIC ALLIANCE']).toBe(0);
    expect(by['ECONOMIC FREEDOM FIGHTERS']).toBe(4);
    expect(by['BAAGI']).toBe(2);
    expect(by['UMKHONTO WESIZWE PARTY']).toBe(0); // one seat, one name
  });
  it('the one-name list is province-wide for ActionSA: one PR entry in each of the 22 councils, and the DC40 list is one name too', () => {
    const by = Object.values(P.prEntriesByCouncil);
    expect(by).toHaveLength(22);
    expect(by.every((n) => n === 1)).toBe(true);
    expect(P.districtList).toEqual({ code: 'DC40', entries: [{ rank: 1, name: 'JOSEPHINE NOMHLOLO BANGANI' }] });
  });
  it('every party in the results has a candidate list to read', () => {
    for (const p of municipality('NW405').onPrList) expect(partiesWithCandidates('NW405')).toContain(p);
  });
  it('refuses a party with no entries rather than returning an empty profile', () => {
    expect(() => partyProfile('NW405', 'NOT A PARTY')).toThrow(/no NOT A PARTY entries/);
  });
});

import { profileFacts, profileInsights } from './partyProfile';
describe('the written facts and insights are computed from the profile, not typed', () => {
  const facts = profileFacts(P).join('\n');
  const insights = profileInsights(P).join('\n');
  it('facts carry the printed counts and the seat arithmetic', () => {
    expect(facts).toContain('35 entries');
    expect(facts).toContain('5 whole quotas and a remainder of 574');
    expect(facts).toContain('1. XOLILE DAVID KHAM');
  });
  it('insights name the list-depth gap and the province-wide pattern, and make no prediction', () => {
    expect(insights).toContain('4 seats the published list cannot name');
    expect(insights).toContain('each of the 22 North West councils');
    expect(insights).not.toMatch(/\bwill\b|forecast|likely/i);
  });
  it('a party with a complete list gets no list-depth complaint', () => {
    expect(profileInsights(partyProfile('NW405', 'DEMOCRATIC ALLIANCE')).join(' ')).not.toContain('cannot name');
  });
});
