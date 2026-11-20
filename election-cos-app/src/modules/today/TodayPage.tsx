/**
 * Election Campaign OS — Today (/today), the phone home screen
 *
 * The first tab of the phone tab bar (`app/fieldTabs.ts`). Read `todayModel.ts` for what is on it and what the supplied
 * prototype had that is deliberately not. Every figure is the certified LGE 2026 result for the tenant's council.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/auth/useSession';
import { dal } from '@/dal';
import { tokens } from '@/design/tokens';
import { BasisNote, Card, DataLine, SectionLabel } from '@/components/ui';
import { COUNCIL_CODES, council } from '@/modules/lge2026/nationalResults';
import { partyName, voterIntelligence, type WardLine } from '@/modules/lge2026/voterIntelligence';
import { fieldActions, holderKey, seatDots, wardsToWatch, type SeriesSlot } from './todayModel';

const SCOPE_LABEL = { TENANT: 'All councils', MUNICIPALITY: 'Whole council', WARD: 'Your ward', VD: 'Your voting district' } as const;

const fill = (slot: SeriesSlot) => (slot === 'other' ? tokens.color.slate : tokens.color[slot]);

function SeatChart({ code }: { code: string }) {
  const c = council(code);
  const dots = useMemo(() => seatDots(c.holders), [c]);
  const key = useMemo(() => holderKey(c.holders), [c]);
  const top = key[0];
  return (
    <Card className="!bg-ink !border-ink text-paper">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-label-caps font-display uppercase text-gold">{c.name} · 2026</p>
        <DataLine className="text-paper/70">{c.councillors} seats</DataLine>
      </div>
      <div className="relative mt-2">
        <svg viewBox="0 0 300 160" className="block w-full" role="img" aria-label={`${c.councillors} council seats by party; ${c.majority} needed to govern.`}>
          {dots.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r={c.councillors > 80 ? 4 : 6} fill={fill(d.slot)} />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="font-display text-display-lg-mobile leading-none">{c.majority}</p>
          <p className="text-data-mono font-body text-paper/70">needed to govern</p>
        </div>
      </div>
      <p className="mt-3 text-body-md font-body">
        {c.hung
          ? `No party holds a majority. The largest, ${top.name}, has ${top.seats}.`
          : `${top.name} holds a majority with ${top.seats} seats.`}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {key.slice(0, 6).map((h) => (
          <li key={h.id} className="flex items-center gap-2 rounded bg-paper/10 px-2 py-1.5 text-data-mono font-body">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: fill(h.slot) }} />
            <span className="min-w-0 flex-1 truncate">{h.name}</span>
            <span className="font-display text-headline-md">{h.seats}</span>
          </li>
        ))}
      </ul>
      {key.length > 6 && (
        <p className="mt-2 text-data-mono font-body text-paper/70">
          {key.length - 6} more {key.length - 6 === 1 ? 'holder' : 'holders'} with {key.slice(6).reduce((n, h) => n + h.seats, 0)} seats
          between them.
        </p>
      )}
    </Card>
  );
}

function WardsCard({ code }: { code: string }) {
  const session = useSession();
  const [wards, setWards] = useState<WardLine[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    voterIntelligence(code).then(
      (v) => live && setWards(v.wards),
      () => live && setError(true),
    );
    return () => {
      live = false;
    };
  }, [code]);
  if (error) return null;
  if (!wards || !session) return <Card><p className="text-body-md font-body text-slate">Loading wards…</p></Card>;
  const w = wardsToWatch(wards, session, code);
  return (
    <section aria-labelledby="today-wards">
      <SectionLabel as="h2">
        <span id="today-wards">{w.heading}</span>
      </SectionLabel>
      <ul className="mt-2 space-y-2">
        {w.wards.map((ward) => (
          <li key={ward.ward} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-ink font-display text-headline-md text-paper">
              {ward.ward}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-md font-body font-semibold text-ink">{partyName(ward.leader)}</span>
              <span className="block text-data-mono font-body text-slate">
                {ward.tier} · {ward.leaderShare.toFixed(1)}% of {ward.valid.toLocaleString('en-ZA')} votes
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-display text-headline-md text-ink">{ward.margin.toFixed(1)}</span>
              <span className="block text-data-mono font-body text-slate">point lead</span>
            </span>
          </li>
        ))}
      </ul>
      <BasisNote>
        {w.own ? 'Your ward as certified on 4 November 2026.' : 'The smallest leads over the runner-up in the 2026 ward results.'}
      </BasisNote>
    </section>
  );
}

export function TodayPage() {
  const session = useSession();
  const profile = useQuery({
    queryKey: ['municipalityProfile', session?.tenantId],
    queryFn: () => dal.municipalityProfile.get(session!),
    enabled: Boolean(session),
  });
  if (!session) return null;
  const code = profile.data?.municipalityCode;
  const known = code ? COUNCIL_CODES.includes(code) : false;
  const actions = fieldActions(session.caps);
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-label-caps font-display uppercase text-slate">{SCOPE_LABEL[session.geoScope]}</p>
        <h1 className="mt-1 font-display text-display-lg-mobile text-ink">Today</h1>
      </header>

      {profile.isLoading && <Card><p className="text-body-md font-body text-slate">Loading your council…</p></Card>}
      {code && known && <SeatChart code={code} />}
      {code && known && <WardsCard code={code} />}
      {profile.isSuccess && !known && (
        <Card>
          <p className="text-body-md font-body text-ink">
            No council is set for this campaign yet, so there is nothing to show here. An administrator sets it under Settings,
            Municipality.
          </p>
        </Card>
      )}

      {actions.length > 0 && (
        <nav aria-label="Field actions" className="space-y-2">
          {actions.map((a) => (
            <Link
              key={a.route}
              to={a.route}
              className={`flex min-h-12 items-center justify-center rounded-lg px-4 text-body-md font-body font-semibold ${
                a.primary ? 'bg-gold text-ink' : 'border border-ink/20 bg-white text-ink'
              }`}
            >
              {a.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
