import { describe, expect, it } from 'vitest';
import {
  ALL_CODE_LINES,
  CODE_CAVEAT,
  CONSEQUENCES,
  PARTY_MUST_NOT,
  STATED_RIGHTS,
  VOTING_DAY_RIGHTS,
} from './codeOfConduct';
import { HOURS_BASIS } from './electionDay';

describe('the Code of Conduct page content', () => {
  it('cites a provision on every line, and a real kind of provision', () => {
    for (const l of ALL_CODE_LINES) {
      expect(l.ref, l.text).toMatch(/^(items? \d|section \d)/);
      expect(l.text.length).toBeGreaterThan(20);
    }
  });

  it('lists all eight rights in item 4(1)(a) and all seven prohibitions in item 9', () => {
    expect(STATED_RIGHTS).toHaveLength(8);
    // 9(1)(a)–(d) and 9(2)(a), (b), (d); 9(2)(c) and (e) are voter protections.
    expect(PARTY_MUST_NOT).toHaveLength(7);
  });

  it('states the voting hours the same way the countdown does, from section 45', () => {
    const hours = VOTING_DAY_RIGHTS.find((l) => l.ref === 'section 45(1)')!;
    expect(hours.text).toContain('07:00');
    expect(hours.text).toContain('21:00');
    expect(HOURS_BASIS).toContain('07:00');
    expect(HOURS_BASIS).toContain('21:00');
  });

  it('never presents itself as the Act or as advice, and says it may be out of date', () => {
    expect(CODE_CAVEAT).toMatch(/not the text of the Act/);
    expect(CODE_CAVEAT).toMatch(/not legal advice/);
    expect(CODE_CAVEAT).toMatch(/amended/);
    expect(CONSEQUENCES).toContain('R200,000');
  });
});
