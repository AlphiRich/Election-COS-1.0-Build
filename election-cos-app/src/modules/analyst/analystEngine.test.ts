import { describe, expect, it } from 'vitest';
import {
  MAX_ROWS,
  classify,
  parseCsv,
  profile,
  runAnalysis,
  screenColumns,
  withoutColumns,
} from './analystEngine';

const NOW = new Date('2026-11-02T08:00:00Z');
const sales = parseCsv(
  'ward,party,votes\n' +
    ['W1,ANC,100', 'W1,DA,40', 'W2,ANC,80', 'W2,DA,70', 'W3,ANC,90', 'W3,DA,60', 'W4,ANC,95', 'W4,DA,55', 'W5,ANC,85', 'W5,DA,65'].join('\n'),
  'votes.csv',
);

describe('parseCsv', () => {
  it('reads quoted commas, doubled quotes, CRLF and a byte-order mark', () => {
    const t = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n1,2\r\n');
    expect(t.headers).toEqual(['a', 'b']);
    expect(t.rows).toEqual([['x, y', 'say "hi"'], ['1', '2']]);
  });
  it('refuses an unclosed quote, duplicate headers and too many rows', () => {
    expect(() => parseCsv('a,b\n"oops,1')).toThrow(/never closed/);
    expect(() => parseCsv('a,a\n1,2')).toThrow(/share a name/);
    expect(() => parseCsv('a\n' + '1\n'.repeat(MAX_ROWS + 1))).toThrow(/row limit/);
  });
  it('pads short rows so every row matches the header', () => {
    expect(parseCsv('a,b,c\n1,2').rows[0]).toEqual(['1', '2', '']);
  });
});

describe('personal information screen', () => {
  const t = parseCsv('ward,contact,person\nW1,0821234567,x\nW2,0731112222,y\nW3,0841110000,z\n', 'p.csv');
  it('blocks a column by its VALUES even when the header looks harmless', () => {
    const s = screenColumns(t);
    expect(s.find((c) => c.column === 'contact')?.level).toBe('blocked');
  });
  it('blocks 13-digit ID numbers under any header', () => {
    const ids = parseCsv('ref\n8001015009087\n7506305009083\n');
    expect(screenColumns(ids)[0].level).toBe('blocked');
  });
  it('flags a column whose name looks personal, and leaves clean columns alone', () => {
    const named = parseCsv('ward,surname,votes\nW1,Smith,3\n');
    expect(screenColumns(named).map((c) => [c.column, c.level])).toEqual([['surname', 'flagged']]);
    expect(screenColumns(sales)).toEqual([]);
  });
  it('removes columns before anything else can read them', () => {
    const cut = withoutColumns(t, new Set(['contact']));
    expect(cut.headers).toEqual(['ward', 'person']);
    expect(JSON.stringify(cut)).not.toContain('0821234567');
  });
});

describe('profile', () => {
  it('types numbers and text, counts empties, and computes a median', () => {
    const p = profile(parseCsv('a,b\n1,x\n2,y\n3,\n10,x\n'));
    expect(p[0]).toMatchObject({ type: 'number', min: 1, max: 10, median: 2.5, filled: 4 });
    expect(p[1]).toMatchObject({ type: 'text', filled: 3, missing: 1, distinct: 2 });
    expect(p[1].top?.[0]).toEqual(['x', 2]);
  });
  it('reads spaced thousands as numbers', () => {
    expect(profile(parseCsv('n\n1 200\n3 400\n'))[0]).toMatchObject({ type: 'number', max: 3400 });
  });
});

describe('classify', () => {
  it('maps the three example questions and refuses the rest', () => {
    expect(classify('Summarize the key trends and the most important drivers in this data.')).toBe('summary');
    expect(classify('What are the top segments by value, and how do they differ?')).toBe('segments');
    expect(classify('Are there any anomalies or outliers I should investigate?')).toBe('anomalies');
    expect(classify('Who will win ward 7?')).toBe('unsupported');
  });
});

describe('runAnalysis', () => {
  it('segments: sums by the text column and the numbers add up', () => {
    const r = runAnalysis([sales], 'top segments by votes', [], NOW, { dimension: 'party' });
    expect(r.kind).toBe('segments');
    const bars = r.chart!.bars;
    expect(bars.map((b) => [b.label, b.value])).toEqual([['ANC', 450], ['DA', 290]]);
    expect(bars.reduce((s, b) => s + b.value, 0)).toBe(740);
    expect(r.insights[0].value).toBe('61%');
    expect(r.generatedAt).toBe('2026-11-02');
  });
  it('segments: the default is the first qualifying text column, and a choice overrides it', () => {
    expect(runAnalysis([sales], 'top segments', [], NOW).chart!.bars.map((b) => b.label)).toContain('W1');
    expect(runAnalysis([sales], 'top segments', [], NOW, { dimension: 'party' }).chart!.bars.map((b) => b.label)).toEqual(['ANC', 'DA']);
  });
  it('anomalies: finds the planted outlier and the duplicate row, and says outliers are a prompt not proof', () => {
    const t = parseCsv('id,amt\n' + [10, 11, 12, 11, 10, 12, 11, 10, 500].map((n, i) => `r${i},${n}`).join('\n') + '\nr1,11\nr1,11');
    const r = runAnalysis([t], 'any outliers?', [], NOW);
    expect(r.insights.find((i) => i.title.startsWith('Outliers in amt'))?.value).toBe('1');
    expect(r.table!.rows[0]).toEqual(['row 10', 'amt', '500']);
    expect(r.insights.find((i) => i.title === 'Duplicate rows')?.value).toBe('2');
    expect(r.summary).toMatch(/prompt to look, not proof/);
  });
  it('summary: counts rows and reports completeness', () => {
    const r = runAnalysis([sales], 'summarize this data', [], NOW);
    expect(r.insights[0].value).toBe('10');
    expect(r.insights[1].value).toBe('0.0%');
    expect(r.table!.rows).toHaveLength(3);
  });
  it('says so when the question is out of scope, and when there is nothing to group', () => {
    expect(runAnalysis([sales], 'who will win?', [], NOW).title).toMatch(/cannot answer/);
    const textOnly = parseCsv('a,b\nx,y\nz,w\n');
    expect(runAnalysis([textOnly], 'top segments', [], NOW).title).toMatch(/nothing to group/);
  });
  it('is descriptive only and states removed columns and extra tables', () => {
    const r = runAnalysis([sales, sales], 'summarize', ['surname'], NOW);
    expect(r.limitations.join(' ')).toMatch(/No model was fitted/);
    expect(r.limitations.join(' ')).toMatch(/1 column was removed/);
    expect(r.limitations.join(' ')).toMatch(/only votes.csv was analysed/);
  });
});
