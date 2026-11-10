/**
 * Election Campaign OS — public site, pieces shared by the 2026 results pages (tracker, council, my ward).
 *
 * No party colours: every party is drawn in the same neutral tones, told apart by label and order. A results site that
 * paints one party in its brand colour and another in grey has taken a side before anyone reads a number.
 */
import type { ReactNode } from 'react';
import { majorityThreshold } from '../tools/coalition';
import type { CouncilSeats, IecStatus } from '@/modules/lge2026/nationalResults';

/** Alternating neutral tones for adjacent segments, so neighbours stay distinguishable. */
const TONES = ['bg-ink', 'bg-teal', 'bg-slate', 'bg-gold'];

export function SeatBar({ holders, councillors, label }: { holders: CouncilSeats['holders']; councillors: number; label: string }) {
  const need = majorityThreshold(councillors);
  const described = holders.map((h) => `${h.name} ${h.seats}`).join(', ');
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-4 w-full overflow-hidden rounded-full border border-line bg-paper" role="img" aria-label={`${label}: ${described}. Majority ${need} of ${councillors}.`}>
        <div className="flex h-full w-full">
          {holders.map((h, i) => (
            <div key={h.id} className={`${TONES[i % TONES.length]} h-full border-r border-paper last:border-r-0`} style={{ width: `${(h.seats / councillors) * 100}%` }} />
          ))}
        </div>
        <div className="absolute inset-y-0 w-0.5 bg-maroon" style={{ left: `${(need / councillors) * 100}%` }} aria-hidden="true" />
      </div>
      <p className="m-0 text-site-micro text-slate">
        The marker shows a majority: {need} of {councillors} seats.
      </p>
    </div>
  );
}

export function StatusPill({ hung }: { hung: boolean }) {
  return hung ? (
    <span className="inline-flex items-center rounded-full border border-maroon px-2.5 py-0.5 text-site-micro font-semibold uppercase tracking-[0.06em] text-maroon">No majority</span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-green px-2.5 py-0.5 text-site-micro font-semibold uppercase tracking-[0.06em] text-green">Majority</span>
  );
}

const STATUS: Record<IecStatus, { short: string; long: string }> = {
  reconciled: {
    short: 'Matches the Commission’s seat calculation',
    long: 'These seats are calculated under Schedule 1 of the Municipal Structures Act from the Commission’s certified results, and match its own Seat Calculation Detail report for this council party by party.',
  },
  laterCount: {
    short: 'Seats from the Commission’s seat calculation',
    long: 'The Commission’s seat calculation for this council was made on a slightly later count than its downloadable results file. The seats shown are the Commission’s. Ward-by-ward figures on this site come from the results file and can differ slightly.',
  },
  incomplete: {
    short: 'Commission report incomplete',
    long: 'The Commission’s published seat calculation for this council leaves some seats unallocated. The seats shown are this site’s Schedule 1 calculation from the certified votes, and will be checked again when the Commission republishes.',
  },
  notPublished: {
    short: 'Commission report not yet published',
    long: 'The Commission has not yet published a seat calculation for this council. The seats shown are this site’s Schedule 1 calculation from the certified votes, and are provisional.',
  },
};

export function IecStatusNote({ c }: { c: CouncilSeats }) {
  const s = STATUS[c.iec];
  return (
    <div className={`border-l-[3px] pl-4 ${c.iec === 'reconciled' ? 'border-green' : 'border-roadmap'}`}>
      <p className="m-0 text-site-sm font-semibold">{s.short}</p>
      <p className="mb-0 mt-1 text-site-caption text-slate">
        {s.long}
        {c.iec === 'incomplete' && c.iecUnallocated ? ` The Commission’s report leaves ${c.iecUnallocated} seats unallocated.` : ''}
      </p>
    </div>
  );
}

export function StatTile({ value, label, children }: { value: ReactNode; label: string; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-white p-5">
      <p className="m-0 font-mono text-site-h3 font-medium">{value}</p>
      <p className="m-0 text-site-sm font-semibold">{label}</p>
      {children && <p className="m-0 text-site-caption text-slate">{children}</p>}
    </div>
  );
}
