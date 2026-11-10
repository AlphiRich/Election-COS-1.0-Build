/**
 * Election Campaign OS — public site, your ward (`/my-ward?council=CODE&ward=N`)
 *
 * Pick a province, council and ward: the ward councillor-elect, how every party did in the ward, and the council the ward
 * belongs to. The selection is in the address, so a result can be shared. The ward's votes come from the province's
 * results file, loaded on demand; the councillor from councillors-2026.json.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { StatusPill } from './resultsParts';
import { nf, provinceName, titleCase } from '../tools/resultsFormat';
import { councilPath, TRACKER_PATH } from '../resultsPaths';
import { AdSlot } from '../ads/AdSlot';
import { partyId as partyIdOf, partyLabel, type PartyVotes } from '@/modules/lge2026/councilResults';
import {
  COUNCIL_CODES,
  NATIONAL_SEATS,
  PROVINCE_CODES,
  council,
  loadCouncillors,
  loadProvince,
  type CouncilCouncillors,
  type NationalCouncil,
  type ProvinceCode,
} from '@/modules/lge2026/nationalResults';

export function SiteMyWard({ hasConsent }: { hasConsent: boolean }) {
  const [params, setParams] = useSearchParams();
  const code = (params.get('council') ?? '').toUpperCase();
  const c = NATIONAL_SEATS.councils[code];
  const ward = Number(params.get('ward')) || 0;
  const [province, setProvince] = useState<ProvinceCode | ''>(c?.province ?? '');
  const [results, setResults] = useState<NationalCouncil | null>(null);
  const [people, setPeople] = useState<CouncilCouncillors | null>(null);

  useEffect(() => {
    if (c) setProvince(c.province);
  }, [c]);
  useEffect(() => {
    let live = true;
    setResults(null);
    setPeople(null);
    if (!c) return;
    void loadProvince(c.province).then((p) => live && setResults(p.municipalities[c.code] ?? null));
    void loadCouncillors().then((f) => live && setPeople(f.councils[c.code] ?? null));
    return () => {
      live = false;
    };
  }, [c]);

  const councils = useMemo(() => COUNCIL_CODES.map(council).filter((x) => x.province === province).sort((a, b) => a.name.localeCompare(b.name)), [province]);
  const wardResult = results?.wardResults.find((w) => w.wardNumber === ward) ?? null;
  const prHolders = c ? c.holders.filter((h) => h.seats > h.wardSeats && h.id !== 'IND' && h.id !== 'TIED') : [];
  const prSeats = prHolders.reduce((s, h) => s + h.seats - h.wardSeats, 0);
  const councillor = people?.ward.find((w) => w.ward === ward) ?? null;
  const set = (next: { council?: string; ward?: number }) => {
    const p = new URLSearchParams();
    if (next.council) p.set('council', next.council);
    if (next.council && next.ward) p.set('ward', String(next.ward));
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageIntro
        eyebrow="Local government elections 2026 · certified results"
        title="Your ward and your councillor"
        lead="Choose your municipality and ward to see who was elected, how every party did in your ward, and who now holds your council’s seats."
      />

      <SiteSection labelledBy="pick-h" className="pb-8">
        <SiteCard className="flex flex-col gap-4 p-6">
          <h2 id="pick-h" className="m-0 font-site-display text-site-h5">Find your ward</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
            <label className="flex flex-col gap-1 text-site-caption text-slate" htmlFor="mw-province">
              Province
              <select
                id="mw-province"
                className="site-field min-h-[44px]"
                value={province}
                onChange={(e) => {
                  setProvince(e.target.value as ProvinceCode);
                  set({});
                }}
              >
                <option value="">Choose a province</option>
                {PROVINCE_CODES.map((p) => (
                  <option key={p} value={p}>
                    {provinceName(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-site-caption text-slate" htmlFor="mw-council">
              Municipality
              <select id="mw-council" className="site-field min-h-[44px]" value={c ? c.code : ''} disabled={!province} onChange={(e) => set({ council: e.target.value })}>
                <option value="">Choose a municipality</option>
                {councils.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-site-caption text-slate" htmlFor="mw-ward">
              Ward
              <select id="mw-ward" className="site-field min-h-[44px]" value={ward || ''} disabled={!c} onChange={(e) => set({ council: c?.code, ward: Number(e.target.value) })}>
                <option value="">Choose a ward</option>
                {c && Array.from({ length: c.wards }, (_, i) => results?.wardResults[i]?.wardNumber ?? i + 1).map((n) => (
                  <option key={n} value={n}>
                    Ward {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="m-0 text-site-caption text-slate">
            Not sure of your ward number? Your municipality’s ward map, or the Commission’s voter registration check, will tell
            you. Then choose it here.
          </p>
        </SiteCard>
      </SiteSection>

      {c && ward > 0 && (
        <SiteSection labelledBy="ward-h" className="pb-8">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
            <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
              <p className="m-0 font-mono text-site-micro uppercase tracking-[0.08em] text-slate">
                {c.name} · Ward {ward}
              </p>
              <h2 id="ward-h" className="m-0 font-site-display text-site-h4">
                {!councillor ? 'Loading…' : councillor.name ? titleCase(councillor.name) : 'Not yet named'}
              </h2>
              {councillor && (
                <p className="m-0 text-site-base">
                  {councillor.party === 'INDEPENDENT' ? 'Independent' : partyLabel(councillor.party)}
                  {councillor.status === 'elected' || councillor.status === 'independentNamed' ? ', ward councillor-elect' : ''}
                </p>
              )}
              {councillor?.status === 'tieUnresolved' && <p className="m-0 text-site-sm text-roadmap">The top two candidates tied. The Commission has not yet recorded how the ward was decided.</p>}
              {councillor?.status === 'countIncomplete' && <p className="m-0 text-site-sm text-roadmap">The Commission’s results file is missing a voting district’s ward-ballot count for this ward, so the leader shown may change.</p>}
              {councillor?.status === 'independentUnnamed' && <p className="m-0 text-site-sm text-roadmap">An independent candidate won. Several stood, and the Commission publishes independents’ votes together, so the winner cannot be named from its file.</p>}
              {wardResult && (
                <p className="m-0 text-site-caption text-slate">
                  {nf.format(wardResult.valid)} valid votes from {nf.format(wardResult.registered)} registered voters ({Math.round(((wardResult.valid + wardResult.spoilt) / wardResult.registered) * 1000) / 10}% turnout).
                  {councillor && councillor.status !== 'tieUnresolved' ? ` Won by ${councillor.margin} points.` : ''}
                </p>
              )}
            </SiteCard>

            <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
              <h2 className="m-0 font-site-display text-site-h5">How the ward voted</h2>
              {!wardResult ? (
                <p className="m-0 text-site-sm">{results ? `Ward ${ward} is not in ${c.name}’s results.` : 'Loading…'}</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5">
                  <div className="flex min-w-0 flex-col gap-2">
                    <h3 className="m-0 text-site-sm font-semibold">Ward ballot (the candidate)</h3>
                    <VoteBars parties={wardResult.parties} valid={wardResult.valid} />
                  </div>
                  {wardResult.pr && (
                    <div className="flex min-w-0 flex-col gap-2">
                      <h3 className="m-0 text-site-sm font-semibold">PR ballot (the party)</h3>
                      <VoteBars parties={wardResult.pr.parties} valid={wardResult.pr.valid} />
                    </div>
                  )}
                </div>
              )}
              <p className="m-0 text-site-caption text-slate">
                Shares of the valid votes cast in this ward on each ballot. The PR ballot is counted across the whole municipality
                to share out the council’s list seats.
              </p>
            </SiteCard>
          </div>
        </SiteSection>
      )}

      {c && people && (
        <SiteSection labelledBy="pr-h" className="pb-8">
          <SiteCard className="flex flex-col gap-4 p-6">
            <h2 id="pr-h" className="m-0 font-site-display text-site-h5">Your PR councillors</h2>
            <p className="m-0 max-w-[52em] text-site-sm">
              Besides your ward councillor, {prSeats} of {c.name}’s {c.councillors} seats are filled from party lists, shared
              out by each party’s votes on the PR ballot across the municipality. These councillors represent the whole
              municipality, so they are yours as much as any other ward’s.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-site-sm">
                <thead>
                  <tr className="border-b border-line text-site-caption text-slate">
                    <th scope="col" className="py-2 pr-3 font-semibold">Party</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">PR seats</th>
                    <th scope="col" className="py-2 font-semibold">PR councillors-elect</th>
                  </tr>
                </thead>
                <tbody>
                  {prHolders.map((h) => {
                    const named = people.pr.filter((p) => partyIdOf(p.party) === h.id);
                    const gap = people.vacant.find((v) => partyIdOf(v.party) === h.id);
                    return (
                      <tr key={h.id} className="border-b border-line align-top last:border-b-0">
                        <th scope="row" className="py-2.5 pr-3 font-normal">{h.name}</th>
                        <td className="py-2.5 pr-3 text-right font-mono font-semibold">{h.seats - h.wardSeats}</td>
                        <td className="py-2.5">
                          {named.map((p) => titleCase(p.name)).join(', ')}
                          {gap && (
                            <span className="block text-site-caption text-roadmap">
                              {gap.vacant} {gap.vacant === 1 ? 'seat' : 'seats'} vacant: the party has too few candidates on its list
                              (“Potential Forfeiture”) and must submit more.
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-site-caption text-slate">
              Named in each party’s certified list order, skipping candidates who won a ward; final when the Commission declares
              the councillors.
            </p>
          </SiteCard>
        </SiteSection>
      )}

      {c && (
        <SiteSection labelledBy="council-h" className="pb-8">
          <SiteCard className="flex flex-col gap-3 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="council-h" className="m-0 font-site-display text-site-h5">{c.name} council</h2>
              <StatusPill hung={c.hung} />
            </div>
            <p className="m-0 text-site-sm">
              {c.hung
                ? `No party has a majority of the ${c.councillors} seats; the largest, ${c.holders[0].name}, has ${c.holders[0].seats} of the ${c.majority} needed.`
                : `${c.holders[0].name} holds ${c.holders[0].seats} of ${c.councillors} seats, a majority.`}
            </p>
            <p className="m-0">
              <Link to={councilPath(c.code)} className="site-btn-primary">
                See the council and every councillor
              </Link>
            </p>
          </SiteCard>
        </SiteSection>
      )}

      <SiteSection className="pb-8">
        <AdSlot pathname="/my-ward" hasConsent={hasConsent} />
      </SiteSection>

      <SourceNote>
        Source: the Electoral Commission’s certified results and candidate lists for the 2026 local government elections
        (EEID1887), retrieved {NATIONAL_SEATS.retrieved}. The councillor shown is the winning party’s ward candidate on the
        certified list. See every council on the <Link to={TRACKER_PATH} className="text-teal">Coalition Tracker</Link>.
      </SourceNote>
    </>
  );
}

function VoteBars({ parties, valid }: { parties: PartyVotes; valid: number }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {parties.slice(0, 8).map(([p, v]) => {
        const pct = Math.round((v / valid) * 1000) / 10;
        return (
          <li key={p}>
            <div className="flex justify-between gap-3 text-site-sm">
              <span className="min-w-0 truncate">{p === 'INDEPENDENT' ? 'Independent candidates' : partyLabel(p)}</span>
              <span className="font-mono">
                {nf.format(v)} · {pct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-paper">
              <div className="h-2 rounded-full bg-ink" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
