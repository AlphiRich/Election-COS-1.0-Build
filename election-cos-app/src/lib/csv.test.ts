import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from './csv';

describe('csv cells', () => {
  it('quotes, escapes quotes and keeps numbers as numbers', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(NaN)).toBe('""');
  });
  it('neutralises anything a spreadsheet would run as a formula', () => {
    for (const s of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx']) {
      expect(csvCell(s), s).toBe(`"'${s}"`);
    }
    expect(csvCell('safe =text')).toBe('"safe =text"');
  });
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 1], ['b']])).toBe('"a",1\r\n"b"\r\n');
  });
});
