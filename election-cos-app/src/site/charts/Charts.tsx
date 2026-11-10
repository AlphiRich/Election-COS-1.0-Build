/**
 * Election Campaign OS — public site, the results charts.
 *
 * Hand-drawn SVG in the site's own tokens, so a chart reads as part of the page rather than a library widget. The rules,
 * from the data-visualisation method the build follows:
 *  - colour is identity in fixed order (viz-1..viz-6, then slate for "Other"), never a party's brand; every party is also
 *    named by its emblem and label, so colour is never the only cue;
 *  - status (majority / no majority) uses the status tokens and always carries a word;
 *  - thin marks with 2px surface gaps, rounded data ends, recessive axes, one scale per chart;
 *  - every mark has a hover and focus tooltip, and every chart has a table view for screen readers and for anyone who
 *    would rather read the numbers.
 */
import { useId, useState, type ReactNode } from 'react';
import { Emblem } from '../pages/PartyMark';
import { SERIES_BG, SERIES_FILL, foldOther, type Slice } from './chartData';

function Tip({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="pointer-events-none min-h-[2.5rem] rounded-md border border-line bg-white px-3 py-2 text-site-caption shadow-sm">
      {children}
    </div>
  );
}

/** A chart, its key, and a table of the same numbers behind a disclosure. */
function Frame({ title, children, table, note }: { title: string; children: ReactNode; table: ReactNode; note?: string }) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <figcaption className="text-site-sm font-semibold">{title}</figcaption>
      {children}
      {note && <p className="m-0 text-site-caption text-slate">{note}</p>}
      <details className="text-site-caption">
        <summary className="cursor-pointer text-teal">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">{table}</div>
      </details>
    </figure>
  );
}

function SliceTable({ rows, unit }: { rows: Slice[]; unit: string }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line text-slate">
          <th scope="col" className="py-1 pr-3 font-semibold">Party</th>
          <th scope="col" className="py-1 text-right font-semibold">{unit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-line last:border-b-0">
            <th scope="row" className="py-1 pr-3 font-normal">{r.name}</th>
            <td className="py-1 text-right font-mono">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------ hemicycle */

/**
 * The council as a chamber: one dot per seat in a half circle, the largest party from the left, and a marker at the seat
 * that makes a majority. Rows of dots are spaced so each dot keeps a surface gap from its neighbours.
 */
export function Hemicycle({ holders, councillors, title }: { holders: Slice[]; councillors: number; title: string }) {
  const [active, setActive] = useState<string | null>(null);
  const slices = foldOther(holders);
  const need = Math.floor(councillors / 2) + 1;
  const W = 360;
  const R = 160;
  const rows = Math.max(3, Math.min(12, Math.round(Math.sqrt(councillors / 1.6))));
  const r0 = R * 0.38;
  const ring = (R - r0) / rows;
  // Seats per row in proportion to its arc length, adjusted so they add up exactly.
  const radii = Array.from({ length: rows }, (_, i) => r0 + ring * (i + 0.5));
  const total = radii.reduce((s, r) => s + r, 0);
  const perRow = radii.map((r) => Math.floor((councillors * r) / total));
  for (let k = 0; perRow.reduce((s, n) => s + n, 0) < councillors; k = (k + 1) % rows) perRow[rows - 1 - k]++;
  const pts: Array<{ x: number; y: number; a: number }> = [];
  radii.forEach((r, i) => {
    const n = perRow[i];
    for (let j = 0; j < n; j++) {
      const a = Math.PI - (Math.PI * (j + 0.5)) / n;
      pts.push({ x: W / 2 + r * Math.cos(a), y: R + 8 - r * Math.sin(a), a });
    }
  });
  pts.sort((p, q) => q.a - p.a); // left to right across the chamber
  const dot = Math.max(2.2, Math.min(7, ring * 0.36));
  let k = 0;
  const owner = pts.map(() => '');
  slices.forEach((s) => {
    for (let n = 0; n < s.value; n++) owner[k++] = s.id;
  });
  const majorityAngle = Math.PI - (Math.PI * need) / councillors;
  const tip = slices.find((s) => s.id === active);
  return (
    <Frame title={title} table={<SliceTable rows={slices} unit="Seats" />} note={`One dot per seat. The line marks a majority: ${need} of ${councillors}.`}>
      <svg viewBox={`0 0 ${W} ${R + 16}`} className="h-auto w-full max-w-[420px]" role="img" aria-label={`${title}. ${slices.map((s) => `${s.name} ${s.value}`).join(', ')}.`}>
        {pts.map((p, i) => {
          const si = slices.findIndex((s) => s.id === owner[i]);
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={dot}
              className={`${SERIES_FILL[Math.min(si, 6)]} stroke-white`}
              strokeWidth={1}
              opacity={active && active !== owner[i] ? 0.25 : 1}
              onMouseEnter={() => setActive(owner[i])}
              onMouseLeave={() => setActive(null)}
            />
          );
        })}
        <line x1={W / 2} y1={R + 8} x2={W / 2 + (R + 4) * Math.cos(majorityAngle)} y2={R + 8 - (R + 4) * Math.sin(majorityAngle)} className="stroke-maroon" strokeWidth={1.5} strokeDasharray="3 3" />
        <text x={W / 2} y={R + 2} textAnchor="middle" className="fill-ink font-mono font-semibold" fontSize={18}>{councillors}</text>
      </svg>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-site-caption">
        {slices.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="flex min-h-[32px] items-center gap-2 rounded-md px-1 text-left"
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(s.id)}
              onBlur={() => setActive(null)}
            >
              <span className={`h-3 w-3 flex-none rounded-full ${SERIES_BG[Math.min(i, 6)]}`} aria-hidden="true" />
              {s.id !== 'OTHER' && <Emblem id={s.id} name={s.name} size={20} />}
              <span>{s.name}</span>
              <span className="font-mono font-semibold">{s.value}</span>
            </button>
          </li>
        ))}
      </ul>
      {tip && (
        <Tip>
          <strong>{tip.name}</strong>: {tip.value} of {councillors} seats ({Math.round((tip.value / councillors) * 1000) / 10}%)
        </Tip>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------- bar list */

export interface BarRow {
  id: string;
  name: string;
  /** One value per series, in series order. */
  values: number[];
  /** Draw the party's emblem beside the label. */
  emblem?: boolean;
}

/**
 * Horizontal bars, one row per item, on one shared scale. With one series the bar is ink; with two or more each series
 * takes its slot in fixed order and the key names them. Each row is one hit target, the full row high.
 */
export function BarList({ rows, series, title, unit, format = (v) => `${v}`, note, stacked = false }: { rows: BarRow[]; series: string[]; title: string; unit: string; format?: (v: number) => string; note?: string; stacked?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const id = useId();
  const max = Math.max(1, ...rows.map((r) => (stacked ? r.values.reduce((a, b) => a + b, 0) : Math.max(...r.values))));
  const single = series.length === 1;
  const fill = (k: number) => (single ? 'bg-ink' : SERIES_BG[k]);
  const tip = rows.find((r) => r.id === active);
  return (
    <Frame
      title={title}
      note={note}
      table={
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-slate">
              <th scope="col" className="py-1 pr-3 font-semibold">{unit}</th>
              {series.map((s) => (
                <th key={s} scope="col" className="py-1 text-right font-semibold">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-1 pr-3 font-normal">{r.name}</th>
                {r.values.map((v, k) => (
                  <td key={k} className="py-1 text-right font-mono">{format(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {!single && (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-site-caption" aria-label="Key">
          {series.map((s, k) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-sm ${fill(k)}`} aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-describedby={id}>
        {rows.map((r) => (
          <li
            key={r.id}
            tabIndex={0}
            className={`grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-teal ${active === r.id ? 'bg-paper' : ''}`}
            onMouseEnter={() => setActive(r.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(r.id)}
            onBlur={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2 text-site-caption">
              {r.emblem && <Emblem id={r.id} name={r.name} size={22} />}
              <span className="truncate">{r.name}</span>
            </span>
            <span className={`flex min-w-0 items-center gap-2 ${stacked ? '' : 'flex-col items-stretch gap-[2px]'}`}>
              {stacked ? (
                <>
                  <span className="flex h-3 min-w-0 flex-1 gap-[2px]">
                    {r.values.map((v, k) =>
                      v > 0 ? <span key={k} className={`h-full rounded-[3px] ${fill(k)}`} style={{ width: `${(v / max) * 100}%` }} /> : null,
                    )}
                  </span>
                  <span className="flex-none font-mono text-site-caption">{format(r.values.reduce((a, b) => a + b, 0))}</span>
                </>
              ) : (
                r.values.map((v, k) => (
                  <span key={k} className="flex items-center gap-2">
                    <span className={`h-3 rounded-r-[3px] ${fill(k)}`} style={{ width: `${Math.max(0.5, (v / max) * 100)}%` }} />
                    <span className="flex-none font-mono text-site-caption">{format(v)}</span>
                  </span>
                ))
              )}
            </span>
          </li>
        ))}
      </ul>
      <p id={id} className="sr-only">{`${title}: ${rows.map((r) => `${r.name} ${r.values.map(format).join(' and ')}`).join('; ')}.`}</p>
      {tip && (
        <Tip>
          <strong>{tip.name}</strong>: {tip.values.map((v, k) => `${single ? '' : `${series[k]} `}${format(v)}`).join(' · ')}
        </Tip>
      )}
    </Frame>
  );
}

/* --------------------------------------------------- status by province */

/**
 * Councils with and without a majority, one row per province, as a split bar. Status colours with the words beside them,
 * never colour alone.
 */
export function StatusSplit({ rows, title }: { rows: Array<{ id: string; name: string; majority: number; hung: number }>; title: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...rows.map((r) => r.majority + r.hung));
  const tip = rows.find((r) => r.id === active);
  return (
    <Frame
      title={title}
      table={
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-slate">
              <th scope="col" className="py-1 pr-3 font-semibold">Province</th>
              <th scope="col" className="py-1 text-right font-semibold">No majority</th>
              <th scope="col" className="py-1 text-right font-semibold">Majority</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-b-0">
                <th scope="row" className="py-1 pr-3 font-normal">{r.name}</th>
                <td className="py-1 text-right font-mono">{r.hung}</td>
                <td className="py-1 text-right font-mono">{r.majority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-site-caption" aria-label="Key">
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-maroon" aria-hidden="true" />No majority (coalition needed)</li>
        <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-green" aria-hidden="true" />One party has a majority</li>
      </ul>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {rows.map((r) => (
          <li
            key={r.id}
            tabIndex={0}
            className={`grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-teal ${active === r.id ? 'bg-paper' : ''}`}
            onMouseEnter={() => setActive(r.id)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(r.id)}
            onBlur={() => setActive(null)}
          >
            <span className="truncate text-site-caption">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className="flex h-3.5 min-w-0 flex-1 gap-[2px]" style={{ maxWidth: `${((r.majority + r.hung) / max) * 100}%` }}>
                {r.hung > 0 && <span className="h-full rounded-l-[3px] bg-maroon" style={{ flex: r.hung }} />}
                {r.majority > 0 && <span className="h-full rounded-r-[3px] bg-green" style={{ flex: r.majority }} />}
              </span>
              <span className="flex-none font-mono text-site-caption">
                {r.hung}/{r.majority + r.hung}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {tip && (
        <Tip>
          <strong>{tip.name}</strong>: {tip.hung} of {tip.majority + tip.hung} councils with no majority; {tip.majority} with one
        </Tip>
      )}
    </Frame>
  );
}
