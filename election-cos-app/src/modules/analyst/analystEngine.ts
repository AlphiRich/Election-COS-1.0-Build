/**
 * Election Campaign OS — the War Room data analyst (engine).
 *
 * Designed from the AI Data Analyst app in the design bundle, but DELIBERATELY NOT the same machine: that app sends the
 * uploaded CSV to a hosted model. This one runs in the browser, on the device, with no model and no upload. Every number
 * in a report is computed from the rows by the functions below; no sentence is written by a model. It answers three
 * kinds of question (summary, segments, anomalies) and says plainly when a question is outside them.
 *
 * PERSONAL INFORMATION: `screenColumns` blocks a column whose VALUES look like an ID number or phone number (always),
 * and flags a column whose NAME looks personal (excluded unless the person confirms it is not about people).
 */
import { findPii } from '@/lib/piiScan';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 50_000;

export interface Table {
  name: string;
  headers: string[];
  rows: string[][];
}

/** RFC 4180-style parser: quoted fields, doubled quotes, CRLF or LF. Throws on an unterminated quote. */
export function parseCsv(text: string, name = 'data.csv'): Table {
  const src = text.replace(/^\uFEFF/, '');
  const out: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((v) => v !== '')) out.push(row);
      row = [];
    } else cur += c;
  }
  if (q) throw new Error(`${name}: a quoted value is never closed.`);
  row.push(cur);
  if (row.some((v) => v !== '')) out.push(row);
  const headers = (out.shift() ?? []).map((h) => h.trim());
  if (!headers.length || headers.every((h) => h === '')) throw new Error(`${name}: no header row.`);
  if (new Set(headers).size !== headers.length) throw new Error(`${name}: two columns share a name.`);
  if (out.length > MAX_ROWS) throw new Error(`${name}: ${out.length} rows is over the ${MAX_ROWS} row limit.`);
  return { name, headers, rows: out.map((r) => headers.map((_, i) => (r[i] ?? '').trim())) };
}

/* ------------------------------------------------------------------ personal information */

const PERSONAL_NAME =
  /(^|[^a-z])(id[\s_-]?(no|num|number)?|identity|surname|first[\s_-]?name|last[\s_-]?name|full[\s_-]?name|name|phone|cell|mobile|tel|email|e-?mail|address|street|dob|birth)([^a-z]|$)/i;

export interface ColumnScreen {
  column: string;
  /** 'blocked': values look like an ID or phone number; never analysed. 'flagged': the name looks personal. */
  level: 'blocked' | 'flagged';
  reason: string;
}

export function screenColumns(t: Table): ColumnScreen[] {
  const out: ColumnScreen[] = [];
  t.headers.forEach((h, ci) => {
    const sample = t.rows.slice(0, 2000).map((r) => r[ci]).join('\n');
    const hits = findPii(sample);
    if (hits.length) {
      out.push({
        column: h,
        level: 'blocked',
        reason: `${hits.length} value${hits.length === 1 ? '' : 's'} look like an ID number or phone number`,
      });
    } else if (PERSONAL_NAME.test(h)) {
      out.push({ column: h, level: 'flagged', reason: 'the column name looks like it describes a person' });
    }
  });
  return out;
}

/** A table with the named columns removed. Removal happens before profiling, so nothing downstream can see them. */
export function withoutColumns(t: Table, drop: Set<string>): Table {
  const keep = t.headers.map((h, i) => [h, i] as const).filter(([h]) => !drop.has(h));
  return {
    name: t.name,
    headers: keep.map(([h]) => h),
    rows: t.rows.map((r) => keep.map(([, i]) => r[i])),
  };
}

/* ------------------------------------------------------------------ profile */

export type ColType = 'number' | 'text';
export interface ColumnProfile {
  name: string;
  type: ColType;
  filled: number;
  missing: number;
  distinct: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  top?: Array<[string, number]>;
}

export const toNumber = (v: string): number | null => {
  const s = v.replace(/[\s\u00a0]/g, '').replace(/^R/, '');
  if (s === '' || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
};

export function profile(t: Table): ColumnProfile[] {
  return t.headers.map((name, ci) => {
    const vals = t.rows.map((r) => r[ci]).filter((v) => v !== '');
    const nums = vals.map(toNumber);
    const isNum = vals.length > 0 && nums.filter((n) => n !== null).length / vals.length >= 0.95;
    const base = { name, filled: vals.length, missing: t.rows.length - vals.length, distinct: new Set(vals).size };
    if (isNum) {
      const xs = (nums.filter((n) => n !== null) as number[]).sort((a, b) => a - b);
      const mid = Math.floor(xs.length / 2);
      return {
        ...base,
        type: 'number' as const,
        min: xs[0],
        max: xs[xs.length - 1],
        mean: xs.reduce((s, x) => s + x, 0) / xs.length,
        median: xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2,
      };
    }
    const counts = new Map<string, number>();
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1);
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
    return { ...base, type: 'text' as const, top };
  });
}

/* ------------------------------------------------------------------ questions */

export type QuestionKind = 'summary' | 'segments' | 'anomalies' | 'unsupported';
export const EXAMPLE_QUESTIONS = [
  'Summarize the key trends and the most important drivers in this data.',
  'What are the top segments by value, and how do they differ?',
  'Are there any anomalies or outliers I should investigate?',
];

export function classify(q: string): QuestionKind {
  const s = q.toLowerCase();
  if (/anomal|outlier|unusual|odd|duplicate|error|wrong/.test(s)) return 'anomalies';
  if (/segment|top|group|by |compare|differ|rank|largest|highest/.test(s)) return 'segments';
  if (/summar|trend|driver|overview|describe|profile|what.*(in|is) (this|the) data/.test(s)) return 'summary';
  return 'unsupported';
}

export interface Insight {
  title: string;
  detail: string;
  metric: string;
  value: string;
}
export interface Report {
  kind: QuestionKind;
  dataset: string;
  question: string;
  title: string;
  summary: string;
  insights: Insight[];
  chart?: { title: string; valueLabel: string; bars: Array<{ label: string; value: number; shown: string }> };
  table?: { title: string; columns: string[]; rows: string[][] };
  methodology: string;
  limitations: string[];
  excludedColumns: string[];
  generatedAt: string;
}

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? Math.round(n).toLocaleString('en-ZA') : Number(n.toFixed(2)).toLocaleString('en-ZA');

function numericIndex(p: ColumnProfile[]) {
  return p.map((c, i) => [c, i] as const).filter(([c]) => c.type === 'number');
}

function summary(t: Table, p: ColumnProfile[]): Pick<Report, 'title' | 'summary' | 'insights' | 'chart' | 'table'> {
  const cells = t.rows.length * t.headers.length;
  const missing = p.reduce((s, c) => s + c.missing, 0);
  const nums = p.filter((c) => c.type === 'number');
  const texts = p.filter((c) => c.type === 'text');
  const insights: Insight[] = [
    { title: 'Size', detail: `${t.rows.length.toLocaleString('en-ZA')} rows and ${t.headers.length} columns in ${t.name}.`, metric: 'Rows', value: t.rows.length.toLocaleString('en-ZA') },
    { title: 'Completeness', detail: `${missing.toLocaleString('en-ZA')} of ${cells.toLocaleString('en-ZA')} cells are empty.`, metric: 'Empty cells', value: cells ? `${((missing / cells) * 100).toFixed(1)}%` : '0%' },
  ];
  const widest = [...texts].filter((c) => c.top?.length).sort((a, b) => b.filled - a.filled)[0];
  if (widest?.top) {
    const [v, n] = widest.top[0];
    insights.push({ title: `Most common ${widest.name}`, detail: `"${v}" appears ${n.toLocaleString('en-ZA')} times of ${widest.filled.toLocaleString('en-ZA')} filled.`, metric: 'Share', value: `${((n / widest.filled) * 100).toFixed(0)}%` });
  }
  const spread = [...nums].filter((c) => c.mean).sort((a, b) => (b.max! - b.min!) / Math.abs(b.mean!) - (a.max! - a.min!) / Math.abs(a.mean!))[0];
  if (spread) insights.push({ title: `Widest spread: ${spread.name}`, detail: `Runs from ${fmt(spread.min!)} to ${fmt(spread.max!)}; mean ${fmt(spread.mean!)}, median ${fmt(spread.median!)}.`, metric: 'Median', value: fmt(spread.median!) });
  const table = {
    title: 'Column profile',
    columns: ['Column', 'Type', 'Filled', 'Distinct', 'Range or most common'],
    rows: p.map((c) => [c.name, c.type, String(c.filled), String(c.distinct), c.type === 'number' ? `${fmt(c.min!)} to ${fmt(c.max!)}` : (c.top ?? []).slice(0, 2).map(([v, n]) => `${v} (${n})`).join(', ')]),
  };
  const chartCol = widest?.top && widest.top.length > 1 ? widest : undefined;
  return {
    title: `${t.name}: ${t.rows.length.toLocaleString('en-ZA')} rows, ${nums.length} numeric and ${texts.length} text columns`,
    summary: `${t.name} holds ${t.rows.length.toLocaleString('en-ZA')} rows. ${missing === 0 ? 'No cell is empty.' : `${((missing / Math.max(cells, 1)) * 100).toFixed(1)}% of cells are empty.`}`,
    insights,
    table,
    chart: chartCol
      ? { title: `Most common values of ${chartCol.name}`, valueLabel: 'Rows', bars: chartCol.top!.map(([v, n]) => ({ label: v, value: n, shown: n.toLocaleString('en-ZA') })) }
      : undefined,
  };
}

export interface Choice {
  /** Numeric column to total. Defaults to the first numeric column. */
  measure?: string;
  /** Text column to group by (2 to 50 distinct values). Defaults to the first that qualifies. */
  dimension?: string;
}

function segments(t: Table, p: ColumnProfile[], choice: Choice = {}): ReturnType<typeof summary> | null {
  const measure = numericIndex(p).find(([c]) => !choice.measure || c.name === choice.measure);
  const dim = p
    .map((c, i) => [c, i] as const)
    .find(([c]) => c.type === 'text' && c.distinct >= 2 && c.distinct <= 50 && (!choice.dimension || c.name === choice.dimension));
  if (!measure || !dim) return null;
  const [mc, mi] = measure;
  const [dc, di] = dim;
  const sums = new Map<string, { sum: number; n: number }>();
  for (const r of t.rows) {
    const x = toNumber(r[mi]);
    if (x === null || r[di] === '') continue;
    const s = sums.get(r[di]) ?? { sum: 0, n: 0 };
    s.sum += x;
    s.n++;
    sums.set(r[di], s);
  }
  const ranked = [...sums].sort((a, b) => b[1].sum - a[1].sum || a[0].localeCompare(b[0]));
  const total = ranked.reduce((s, [, v]) => s + v.sum, 0);
  const top = ranked.slice(0, 8);
  const top2 = ranked.slice(0, 2).reduce((s, [, v]) => s + v.sum, 0);
  const insights: Insight[] = [
    { title: `Largest ${dc.name}`, detail: `${top[0][0]} holds ${fmt(top[0][1].sum)} of ${fmt(total)} total ${mc.name} across ${top[0][1].n.toLocaleString('en-ZA')} rows.`, metric: 'Share of total', value: total ? `${((top[0][1].sum / total) * 100).toFixed(0)}%` : 'n/a' },
  ];
  if (ranked.length > 2) insights.push({ title: 'Concentration', detail: `The top two of ${ranked.length} groups carry ${total ? ((top2 / total) * 100).toFixed(0) : 0}% of ${mc.name}.`, metric: 'Top-2 share', value: total ? `${((top2 / total) * 100).toFixed(0)}%` : 'n/a' });
  return {
    title: `${mc.name} by ${dc.name}: ${top[0][0]} leads`,
    summary: `Summed ${mc.name} by ${dc.name} (${ranked.length} groups). ${top[0][0]} is largest at ${fmt(top[0][1].sum)}.`,
    insights,
    chart: { title: `${mc.name} by ${dc.name}`, valueLabel: `Total ${mc.name}`, bars: top.map(([k, v]) => ({ label: k, value: v.sum, shown: fmt(v.sum) })) },
    table: { title: `${dc.name} groups`, columns: [dc.name, 'Rows', `Total ${mc.name}`, `Mean ${mc.name}`], rows: top.map(([k, v]) => [k, String(v.n), fmt(v.sum), fmt(v.sum / v.n)]) },
  };
}

function anomalies(t: Table, p: ColumnProfile[]): ReturnType<typeof summary> {
  const insights: Insight[] = [];
  const rows: string[][] = [];
  let outlierTotal = 0;
  for (const [c, i] of numericIndex(p)) {
    const xs = t.rows.map((r) => toNumber(r[i])).filter((n): n is number => n !== null).sort((a, b) => a - b);
    if (xs.length < 8) continue;
    const q = (f: number) => xs[Math.floor((xs.length - 1) * f)];
    const q1 = q(0.25);
    const q3 = q(0.75);
    const lo = q1 - 1.5 * (q3 - q1);
    const hi = q3 + 1.5 * (q3 - q1);
    const out = t.rows.map((r, ri) => ({ ri, x: toNumber(r[i]) })).filter((o) => o.x !== null && (o.x < lo || o.x > hi));
    outlierTotal += out.length;
    if (out.length) {
      insights.push({ title: `Outliers in ${c.name}`, detail: `${out.length} value${out.length === 1 ? '' : 's'} outside ${fmt(lo)} to ${fmt(hi)} (1.5 × the interquartile range).`, metric: 'Outliers', value: String(out.length) });
      for (const o of out.sort((a, b) => Math.abs(b.x! - (q1 + q3) / 2) - Math.abs(a.x! - (q1 + q3) / 2)).slice(0, 3)) rows.push([`row ${o.ri + 2}`, c.name, fmt(o.x!)]);
    }
  }
  const seen = new Set<string>();
  let dupes = 0;
  for (const r of t.rows) {
    const k = r.join('\u0001');
    if (seen.has(k)) dupes++;
    seen.add(k);
  }
  insights.push({ title: 'Duplicate rows', detail: `${dupes} row${dupes === 1 ? ' is' : 's are'} an exact copy of an earlier row.`, metric: 'Duplicates', value: String(dupes) });
  const sparse = p.filter((c) => t.rows.length && c.missing / t.rows.length > 0.2);
  if (sparse.length) insights.push({ title: 'Mostly empty columns', detail: `${sparse.map((c) => c.name).join(', ')} ${sparse.length === 1 ? 'is' : 'are'} more than 20% empty.`, metric: 'Columns', value: String(sparse.length) });
  return {
    title: outlierTotal || dupes ? `${outlierTotal} outlier value${outlierTotal === 1 ? '' : 's'} and ${dupes} duplicate row${dupes === 1 ? '' : 's'} found` : 'No outliers or duplicates found',
    summary: 'An outlier is a number more than 1.5 interquartile ranges beyond the middle half of its column. It is a prompt to look, not proof of an error.',
    insights,
    table: rows.length ? { title: 'Furthest outliers (row numbers count the header as row 1)', columns: ['Row', 'Column', 'Value'], rows } : undefined,
  };
}

export function runAnalysis(tables: Table[], question: string, excluded: string[], now = new Date(), choice: Choice = {}): Report {
  const t = tables[0];
  const kind = classify(question);
  const base = { kind, dataset: tables.map((x) => x.name).join(', '), question, excludedColumns: excluded, generatedAt: now.toISOString().slice(0, 10) };
  const limitations = [
    'Descriptive only: counts, sums, medians and ranges. No model was fitted, so nothing here predicts anything.',
    ...(tables.length > 1 ? [`${tables.length} tables were staged; only ${t.name} was analysed. Joins between tables are not done.`] : []),
    ...(excluded.length ? [`${excluded.length} column${excluded.length === 1 ? ' was' : 's were'} removed as personal information before analysis.`] : []),
  ];
  if (kind === 'unsupported') {
    return { ...base, title: 'This analyst cannot answer that question', summary: 'It answers three kinds of question: a summary of the data, the top segments by a number, and anomalies or outliers. Rephrase to one of those.', insights: [], methodology: 'No analysis was run.', limitations };
  }
  const p = profile(t);
  let body: ReturnType<typeof summary> | null;
  let methodology: string;
  if (kind === 'summary') {
    body = summary(t, p);
    methodology = 'Each column was typed (number if 95% of filled cells parse as numbers), then counted, and its range, mean, median and most common values were computed.';
  } else if (kind === 'segments') {
    body = segments(t, p, choice);
    methodology = 'The chosen (or first) numeric column was summed by the chosen (or first) text column that has 2 to 50 distinct values. Rows with an empty value in either are skipped.';
    if (!body) {
      return { ...base, title: 'This data has nothing to group', summary: 'Segments need one numeric column and one text column with 2 to 50 distinct values. This file has no such pair.', insights: [], methodology, limitations };
    }
  } else {
    body = anomalies(t, p);
    methodology = 'Outliers by the 1.5 × interquartile-range rule on every numeric column with at least 8 values; duplicates by exact match on every column.';
  }
  return { ...base, ...body, methodology, limitations };
}
