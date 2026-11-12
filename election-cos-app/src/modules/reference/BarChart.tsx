/**
 * A single-series bar chart, built to the dataviz method: one hue (a sequential job, not categorical),
 * thin bars (24px cap) with a 4px rounded data end and a square baseline, the value printed at the tip, a
 * tooltip on hover and on keyboard focus, and a table view so nothing depends on seeing the bars.
 * A hidden (suppressed) value is drawn as no bar and says so in words; it is never drawn as zero.
 */
import { useState } from 'react';
import { Table, Td, Th } from '@/components/ui';

export interface Bar {
  label: string;
  /** null = hidden for privacy (a small cell). */
  value: number | null;
  /** The value as text, e.g. "18%" or "1,284". */
  shown: string;
  /** Extra tooltip line. */
  detail?: string;
}

interface Props {
  title: string;
  bars: Bar[];
  /** 'column' for a handful of ordered categories; 'row' for a ranked list. */
  orientation: 'column' | 'row';
  /** Column header for the value in the table view. */
  valueLabel: string;
  caption: string;
}

const BAR_MAX = 24;

export function BarChart({ title, bars, orientation, valueLabel, caption }: Props) {
  const [asTable, setAsTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  const tip = (b: Bar) =>
    `${b.label}: ${b.value === null ? 'hidden, under 10 people' : b.shown}${b.detail ? `. ${b.detail}` : ''}`;

  return (
    <figure className="m-0" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-body-md font-body font-semibold">{title}</figcaption>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="min-h-11 px-2 text-body-md font-body underline"
          aria-pressed={asTable}
        >
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <Table caption={caption}>
          <thead>
            <tr>
              <Th>Group</Th>
              <Th numeric>{valueLabel}</Th>
            </tr>
          </thead>
          <tbody>
            {bars.map((b) => (
              <tr key={b.label}>
                <Td>{b.label}</Td>
                <Td numeric>{b.value === null ? 'Hidden (under 10)' : b.shown}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : orientation === 'column' ? (
        <div role="img" aria-label={`${title}. ${bars.map(tip).join('. ')}`} className="mt-3">
          <div className="flex h-44 items-end gap-3 border-b border-ink/20 px-1">
            {bars.map((b, i) => (
              <div
                key={b.label}
                className="relative flex h-full flex-1 flex-col items-center justify-end"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                <span className="mb-1 text-caption font-mono text-ink">
                  {b.value === null ? '—' : b.shown}
                </span>
                <div
                  tabIndex={0}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={tip(b)}
                  className="bg-teal"
                  style={{
                    width: BAR_MAX,
                    height: b.value === null ? 0 : `${Math.max(2, (b.value / max) * 85)}%`,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                {active === i && (
                  <span
                    role="tooltip"
                    className="absolute -top-2 z-10 rounded bg-ink px-2 py-1 text-caption text-paper whitespace-nowrap"
                  >
                    {tip(b)}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 px-1 pt-1">
            {bars.map((b) => (
              <span key={b.label} className="flex-1 text-center text-caption font-body text-slate">
                {b.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <ul className="m-0 mt-3 list-none space-y-1.5 p-0" aria-label={`${title}. ${caption}`}>
          {bars.map((b, i) => (
            <li
              key={b.label}
              className="relative grid grid-cols-[5rem_1fr_4rem] items-center gap-3"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="text-caption font-body text-slate">{b.label}</span>
              <div className="h-6">
                <div
                  tabIndex={0}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={tip(b)}
                  className="h-full bg-teal"
                  style={{
                    width: b.value === null ? 0 : `${Math.max(1, (b.value / max) * 100)}%`,
                    borderRadius: '0 4px 4px 0',
                    maxHeight: BAR_MAX,
                  }}
                />
              </div>
              <span className="text-caption font-mono text-ink">
                {b.value === null ? 'hidden' : b.shown}
              </span>
              {active === i && (
                <span
                  role="tooltip"
                  className="absolute left-20 -top-6 z-10 rounded bg-ink px-2 py-1 text-caption text-paper whitespace-nowrap"
                >
                  {tip(b)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
