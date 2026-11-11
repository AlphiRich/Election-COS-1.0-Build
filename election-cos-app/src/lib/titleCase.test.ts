import { describe, expect, it } from 'vitest';
import { isTitleCase, titleCase } from './titleCase';

describe('house Title Case', () => {
  it('the owner’s examples', () => {
    expect(titleCase('139 of 213 councils have no majority')).toBe('139 of 213 Councils Have No Majority');
    expect(titleCase('For campaigns')).toBe('For Campaigns');
    expect(titleCase('Questions people ask')).toBe('Questions People Ask');
    expect(titleCase('How a municipal council is made up')).toBe('How a Municipal Council Is Made Up');
    expect(titleCase('Informative and nothing more')).toBe('Informative and Nothing More');
  });

  it('keeps short words lower case in the middle, capitalised at either end or after a colon', () => {
    expect(titleCase('the state of the councils')).toBe('The State of the Councils');
    expect(titleCase('what the seats are for')).toBe('What the Seats Are For');
    expect(titleCase('Results: a guide to the count')).toBe('Results: A Guide to the Count');
    expect(titleCase('Who governs — and how')).toBe('Who Governs — And How');
  });

  it('never lowers acronyms, codes, brands, numbers or addresses', () => {
    expect(titleCase('IEC results for NW405 and JHB')).toBe('IEC Results for NW405 and JHB');
    expect(titleCase('POPIA and the PPFA')).toBe('POPIA and the PPFA');
    expect(titleCase('councils in eThekwini')).toBe('Councils in eThekwini');
    expect(titleCase('visit electioncos.co.za')).toBe('Visit electioncos.co.za');
    expect(titleCase('R2,500 per ward a month')).toBe('R2,500 per Ward a Month');
  });

  it('capitalises each part of a hyphenated word, and leaves dashes alone', () => {
    expect(titleCase('ward councillors-elect')).toBe('Ward Councillors-Elect');
    expect(titleCase('Election-COS sign-in')).toBe('Election-COS Sign-In');
    expect(titleCase('2026 bottom-of-funnel')).toBe('2026 Bottom-of-Funnel');
    expect(titleCase('incident-to-council escalation')).toBe('Incident-to-Council Escalation');
  });

  it('keeps punctuation and apostrophes', () => {
    expect(titleCase("what's in the app?")).toBe("What's in the App?");
    expect(titleCase('One price list, published for everyone.')).toBe('One Price List, Published for Everyone.');
  });

  it('is stable', () => {
    for (const s of ['How a Municipal Council Is Made Up', '139 of 213 Councils Have No Majority']) {
      expect(isTitleCase(s)).toBe(true);
      expect(titleCase(titleCase(s))).toBe(titleCase(s));
    }
  });
});
