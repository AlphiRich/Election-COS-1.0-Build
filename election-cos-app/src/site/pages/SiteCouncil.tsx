/**
 * Election Campaign OS — public site, one council (`/councils/:code`)
 *
 * The council as elected on 4 November 2026: its seats, whether anyone has a majority, the smallest groups of parties
 * that do, a simulator to try others, and the councillors-elect ward by ward and on each party's list. Seats come from the
 * certified seat table; the councillors from councillors-2026.json, loaded when the page opens.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { SourceNote } from './pageParts';
import { IecStatusNote, SeatBar, StatusPill } from './resultsParts';
import { kindOf, nf, provinceName, titleCase } from '../tools/resultsFormat';
import { TRACKER_PATH, myWardPath } from '../resultsPaths';
import { majorityThreshold } from '../tools/coalition';
import { inSmallestGroups, seatsShort, smallMajorities, NOT_A_PARTY } from '../tools/tracker';
import { AdSlot } from '../ads/AdSlot';
import { partyLabel } from '@/modules/lge2026/councilResults';
import { NATIONAL_SEATS, loadCouncillors, type CouncilCouncillors, type CouncilSeats, type WardCouncillor } from '@/modules/lge2026/nationalResults';

export function SiteCouncil({ hasConsent }: { hasConsent: boolean }) {
  const { code = '' } = useParams();
  const c = NATIONAL_SEATS.councils[code.toUpperCase()];
  if (!c) {
    return (
      <SiteSection className="pb-[88px] pt-[88px]">
        <h1 className="m-0 font-site-display text-site-h3">Council not found</h1>
        <p className="mt-3 text-site-base">
          There is no metro or local council with the code “{code}”. <Link to={TRACKER_PATH} className="font-semibold text-teal">See every council</Link>.
        </p>
      </SiteSection>
    );
  }
  return <Council c={c} hasConsent={hasConsent} />;
}

function Council({ c, hasConsent }: { c: CouncilSeats; hasConsent: boolean }) {
  const [people, setPeople] = useState<CouncilCouncillors | null>(null);
  useEffect(() => {
    let live = true;
    void loadCouncillors().then((f) => live && setPeople(f.councils[c.code] ?? null));
    return () => {
      live = false;
    };
  }, [c.code]);

  const need = c.majority;
  const groups = useMemo(() => smallMajorities(c.holders, c.councillors), [c]);
  const counts = useMemo(() => inSmallestGroups(c.holders, c.councillors), [c]);
  const name = (id: string) => c.holders.find((h) => h.id === id)?.name ?? id;
  const vacant = people?.vacant.reduce((s, v) => s + v.vacant, 0) ?? 0;

  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[860px] flex-col gap-4">
          <p className="m-0 text-site-caption">
            <Link to={TRACKER_PATH} className="text-teal">← Coalition Tracker</Link>
          </p>
          <Eyebrow>
            {kindOf(c)} · {provinceName(c.province)} · {c.code}
          </Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">{c.name}</h1>
            <StatusPill hung={c.hung} />
          </div>
          <p className="m-0 text-site-lead">
            {c.hung
              ? `No party holds a majority of the ${c.councillors} seats. ${c.holders[0].name}, the largest, has ${c.holders[0].seats}: ${seatsShort(c.holders, c.councillors)} short of the ${need} needed.`
              : `${c.holders[0].name} holds ${c.holders[0].seats} of the ${c.councillors} seats, a majority on its own.`}
          </p>
          <IecStatusNote c={c} />
        </div>
      </SiteSection>

      <SiteSection labelledBy="seats-h" className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 id="seats-h" className="m-0 font-site-display text-site-h5">The council’s {c.councillors} seats</h2>
            <SeatBar holders={c.holders} councillors={c.councillors} label={`${c.name} council`} />
            <table className="w-full border-collapse text-left text-site-sm">
              <thead>
                <tr className="border-b border-line text-site-caption text-slate">
                  <th scope="col" className="py-2 font-semibold">Party</th>
                  <th scope="col" className="py-2 text-right font-semibold">Seats</th>
                  <th scope="col" className="py-2 text-right font-semibold">Ward</th>
                  <th scope="col" className="py-2 text-right font-semibold">List</th>
                </tr>
              </thead>
              <tbody>
                {c.holders.map((h) => (
                  <tr key={h.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="py-2 pr-3 font-normal">{h.name}</th>
                    <td className="py-2 text-right font-mono font-semibold">{h.seats}</td>
                    <td className="py-2 text-right font-mono">{h.wardSeats}</td>
                    <td className="py-2 text-right font-mono">{h.seats - h.wardSeats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0 text-site-caption text-slate">
              Turnout {c.turnoutPr}% of {nf.format(c.registered)} registered voters (proportional ballot). {c.wards} wards.
              {c.holders.some((h) => h.id === 'IND') && ' Independent ward councillors are shown together; each decides separately.'}
            </p>
          </SiteCard>

          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 className="m-0 font-site-display text-site-h5">{c.hung ? 'Groups that pass half' : 'Majority'}</h2>
            {c.hung ? (
              <>
                <p className="m-0 text-site-sm">
                  The smallest groups of parties holding at least {need} seats. Every party listed is needed: take one away and
                  the group falls short.
                </p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-site-sm">
                  {groups.slice(0, 10).map((g) => (
                    <li key={g.ids.join('+')} className="rounded-md border border-line bg-white px-3 py-2">
                      {g.ids.map(name).join(' + ')} <span className="font-mono text-slate">· {g.seats} seats</span>
                    </li>
                  ))}
                </ul>
                {groups.length > 10 && <p className="m-0 text-site-caption text-slate">{groups.length - 10} more groups of up to four parties.</p>}
                {groups.filter((g) => g.ids.length === groups[0].ids.length).length > 1 && (
                  <p className="m-0 text-site-caption text-slate">
                    How often each party appears in the {groups.filter((g) => g.ids.length === groups[0].ids.length).length}{' '}
                    {groups[0].ids.length}-party groups:{' '}
                    {[...counts]
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, n]) => `${name(id)} ${n}`)
                      .join(', ')}
                    .
                  </p>
                )}
              </>
            ) : (
              <p className="m-0 text-site-sm">{c.holders[0].name} holds more than half the seats, so it can carry any vote decided by a majority of the council’s members without another party.</p>
            )}
            <p className="m-0 text-site-caption text-slate">Seat arithmetic only. It does not say which parties will agree, or what any agreement says.</p>
          </SiteCard>
        </div>
      </SiteSection>

      <Simulator c={c} />

      {vacant > 0 && people && (
        <SiteSection labelledBy="vacant-h" className="pb-8">
          <SiteCard className="flex max-w-[860px] flex-col gap-2 border-roadmap p-6">
            <h2 id="vacant-h" className="m-0 font-site-display text-site-h5">{vacant} list {vacant === 1 ? 'seat is' : 'seats are'} waiting for candidates</h2>
            <p className="m-0 text-site-sm">
              {people.vacant.map((v) => `${partyLabel(v.party)} won ${v.listSeats} list seats and has ${v.filled} ${v.filled === 1 ? 'candidate' : 'candidates'} on its list`).join('; ')}.
              The Commission marks this “Potential Forfeiture”: the party must submit a supplementary list, or the seat may be
              forfeited if leaving it vacant costs the council its quorum.
            </p>
          </SiteCard>
        </SiteSection>
      )}

      <SiteSection labelledBy="wards-h" className="pb-8">
        <div className="flex flex-col gap-4">
          <h2 id="wards-h" className="m-0 font-site-display text-site-h4">Ward councillors-elect</h2>
          {!people ? (
            <p className="m-0 text-site-sm">Loading councillors…</p>
          ) : (
            <div className="overflow-x-auto rounded-[10px] border border-line bg-white">
              <table className="w-full min-w-[640px] border-collapse text-left text-site-sm">
                <thead>
                  <tr className="border-b border-line bg-paper text-site-caption text-slate">
                    <th scope="col" className="px-4 py-3 font-semibold">Ward</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Councillor-elect</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Party</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {people.ward.map((w) => (
                    <tr key={w.ward} className="border-b border-line last:border-b-0">
                      <th scope="row" className="px-4 py-2.5 font-mono font-normal">
                        <Link to={myWardPath(c.code, w.ward)} className="text-teal">{w.ward}</Link>
                      </th>
                      <td className="px-4 py-2.5">{wardName(w)}</td>
                      <td className="px-4 py-2.5">{w.party === 'INDEPENDENT' ? 'Independent' : partyLabel(w.party)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{w.status === 'tieUnresolved' ? 'tied' : `${w.margin} pts`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="m-0 text-site-caption text-slate">
            The ward’s winning party’s candidate on the Commission’s certified list. Margin is the winner’s lead over the runner-up,
            in points of the ward’s valid votes.
          </p>
        </div>
      </SiteSection>

      {people && people.pr.length > 0 && (
        <SiteSection labelledBy="pr-h" className="pb-8">
          <div className="flex flex-col gap-3">
            <h2 id="pr-h" className="m-0 font-site-display text-site-h4">Councillors-elect from party lists</h2>
            <p className="m-0 max-w-[48em] text-site-sm text-slate">
              Each party’s list seats are filled from its certified list in order, skipping candidates who won a ward. This
              follows the list order the Commission certified; it becomes final when the Commission declares the councillors.
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
              {groupBy(people.pr, (p) => p.party).map(([party, list]) => (
                <details key={party} className="rounded-[10px] border border-line bg-white p-4" open={list.length <= 6}>
                  <summary className="cursor-pointer font-semibold">
                    {partyLabel(party)} <span className="font-mono text-slate">· {list.length}</span>
                  </summary>
                  <ol className="mb-0 mt-3 flex flex-col gap-1 pl-5 text-site-sm">
                    {list.map((p) => (
                      <li key={p.rank} value={p.rank}>{titleCase(p.name)}</li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </div>
        </SiteSection>
      )}

      <SiteSection className="pb-8">
        <AdSlot pathname={`/councils/${c.code}`} hasConsent={hasConsent} />
      </SiteSection>

      <SourceNote>
        Source: the Electoral Commission’s certified results for this council (2026 local government elections, EEID1887) and
        its certified candidate lists, retrieved {NATIONAL_SEATS.retrieved}. Seats: Schedule 1 of the Municipal Structures
        Act. Losing candidates are not listed. Councillors-elect are as derived from the certified lists until the Commission’s
        declaration.
      </SourceNote>
    </>
  );
}

function Simulator({ c }: { c: CouncilSeats }) {
  const parties = c.holders.filter((h) => !NOT_A_PARTY.has(h.id));
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const need = majorityThreshold(c.councillors);
  const held = parties.filter((p) => chosen.has(p.id)).reduce((s, p) => s + p.seats, 0);
  const reached = held >= need;
  return (
    <SiteSection labelledBy="sim-h" className="pb-8">
      <SiteCard className="flex flex-col gap-4 p-6">
        <h2 id="sim-h" className="m-0 font-site-display text-site-h5">Try a coalition</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
          <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
            <legend className="mb-2 text-site-sm font-semibold">Choose parties</legend>
            {parties.map((p) => (
              <label key={p.id} className="flex min-h-[44px] items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 flex-none accent-teal"
                  checked={chosen.has(p.id)}
                  onChange={() =>
                    setChosen((s) => {
                      const n = new Set(s);
                      if (n.has(p.id)) n.delete(p.id);
                      else n.add(p.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="font-mono">{p.seats}</span>
              </label>
            ))}
          </fieldset>
          <div role="status" aria-live="polite" className="flex flex-col gap-3">
            <p className="m-0 font-mono text-site-h3 font-medium">
              {held} of {c.councillors}
            </p>
            <div className="h-3 w-full overflow-hidden rounded-full border border-line bg-paper" role="img" aria-label={`${held} of ${need} seats needed`}>
              <div className={reached ? 'h-full bg-green' : 'h-full bg-gold'} style={{ width: `${Math.min(100, (held / need) * 100)}%` }} />
            </div>
            <p className="m-0 text-site-sm">
              {chosen.size === 0 ? `Choose parties to see whether they reach ${need}.` : reached ? `Passes half: ${held - need} more than the ${need} needed.` : `${need - held} short of the ${need} needed.`}
            </p>
            <button type="button" className="site-btn-outline-ink self-start" onClick={() => setChosen(new Set())}>
              Clear
            </button>
          </div>
        </div>
      </SiteCard>
    </SiteSection>
  );
}

const STATUS_TEXT: Record<WardCouncillor['status'], string> = {
  elected: '',
  independentNamed: '',
  independentUnnamed: 'An independent (several stood; the Commission publishes their votes together)',
  tieUnresolved: 'Tied: awaiting the Commission’s decision',
  countIncomplete: 'Count incomplete in the Commission’s file',
  noMatch: 'Not on the certified list',
};
function wardName(w: WardCouncillor): string {
  return w.name ? titleCase(w.name) : STATUS_TEXT[w.status];
}


function groupBy<T>(xs: T[], key: (x: T) => string): Array<[string, T[]]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m].sort((a, b) => b[1].length - a[1].length);
}
