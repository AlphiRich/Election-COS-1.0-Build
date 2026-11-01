/**
 * Election Campaign OS — public site, know your ward candidates
 * (`/tools/know-your-candidates`)
 *
 * Municipality, then ward. Names appear only from `CERTIFIED_CANDIDATES`,
 * which is empty until a certified list is loaded (see `tools/candidates.ts`
 * for why), so today the page does what it can honestly do: it takes a
 * voter to their ward and says where the names are published.
 *
 * It does not offer "use my location". Turning a location into a ward
 * needs the Municipal Demarcation Board's ward boundary maps, which this
 * build does not hold, and a guess would put somebody in the wrong ward.
 */
import { useEffect, useMemo, useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { IEC_LINK } from '../officialSources';
import { findCouncil, searchCouncils } from '../tools/councilFinder';
import { CANDIDATE_SOURCE } from '../tools/candidates';
import { findStations } from '../tools/wardFinder';

interface PublishedFile {
  municipalityCode: string;
  source: string;
  fetchedOn: string | null;
  confirmedBy: string;
  confirmedOn: string;
  wards: Record<string, Array<{ name: string; party: string }>>;
}

export function SiteCandidates() {
  const [query, setQuery] = useState('');
  const [code, setCode] = useState('');
  const [ward, setWard] = useState('');
  const matches = useMemo(() => searchCouncils(query).filter((c) => c.wards !== null), [query]);
  const council = code ? findCouncil(code) : null;
  const wardNo = Number(ward);
  // Names come from one small file per municipality that exists only once a
  // named person has confirmed the dataset (scripts/publish-candidates.ts).
  // No file means no names, and the page says why.
  const [published, setPublished] = useState<PublishedFile | null>(null);
  const code2 = council?.code;
  useEffect(() => {
    setPublished(null);
    if (!code2) return;
    let live = true;
    fetch(`${import.meta.env.BASE_URL}candidates/${code2}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (j) =>
          live && setPublished(j && j.municipalityCode === code2 ? (j as PublishedFile) : null),
      )
      .catch(() => live && setPublished(null));
    return () => {
      live = false;
    };
  }, [code2]);
  const names = published && wardNo ? (published.wards[String(wardNo)] ?? []) : [];
  const stations = council?.code === 'NW405' && wardNo ? findStations(String(wardNo)) : [];

  return (
    <>
      <PageIntro
        eyebrow="Voter tool"
        title="Know your ward candidates"
        lead="Choose your municipality, then your ward, to see who is standing for ward councillor."
      />
      <SiteSection className="pb-8">
        <SiteCard className="flex max-w-[760px] flex-col gap-4 p-8">
          <label htmlFor="cand-search" className="font-semibold">
            Search municipalities
          </label>
          <input
            id="cand-search"
            type="search"
            className="site-field"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name or province"
            autoComplete="off"
          />
          <label htmlFor="cand-muni" className="font-semibold">
            Municipality ({matches.length} shown)
          </label>
          <select
            id="cand-muni"
            className="site-field"
            value={matches.some((m) => m.code === code) ? code : ''}
            onChange={(e) => {
              setCode(e.target.value);
              setWard('');
            }}
          >
            <option value="">Choose a municipality</option>
            {matches.map((m) => (
              <option key={m.code} value={m.code}>
                {m.name} · {m.province}
              </option>
            ))}
          </select>
          {council && council.wards !== null && (
            <>
              <label htmlFor="cand-ward" className="font-semibold">
                Ward (1 to {council.wards})
              </label>
              <select
                id="cand-ward"
                className="site-field"
                value={ward}
                onChange={(e) => setWard(e.target.value)}
              >
                <option value="">Choose a ward</option>
                {Array.from({ length: council.wards }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Ward {n}
                  </option>
                ))}
              </select>
            </>
          )}
        </SiteCard>
      </SiteSection>

      {council && wardNo > 0 && (
        <SiteSection labelledBy="res-h" className="pb-8">
          <div className="flex max-w-[760px] flex-col gap-4">
            <h2 id="res-h" className="m-0 font-site-display text-site-h4">
              {council.name}, Ward {wardNo}
            </h2>
            <div role="status" aria-live="polite">
              {names.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {names.map((c) => (
                    <li
                      key={`${c.party}-${c.name}`}
                      className="rounded-[10px] border border-line bg-white p-4"
                    >
                      <span className="font-semibold">{c.name}</span> · {c.party}
                    </li>
                  ))}
                </ul>
              ) : null}
              {names.length > 0 && published ? (
                <p className="mb-0 mt-3 text-site-caption text-slate">
                  Source: {published.source}. Fetched{' '}
                  {published.fetchedOn ?? 'on a date not recorded'}; checked against the
                  Commission’s list by {published.confirmedBy} on {published.confirmedOn}. This is
                  the ward ballot only; each party’s PR list is on the Commission’s page.
                </p>
              ) : null}
              {names.length === 0 ? (
                <SiteCard className="p-6">
                  <p className="m-0 font-semibold">Candidate names are not loaded here yet</p>
                  <p className="mb-0 mt-1 text-site-sm">
                    This site shows only names from the Electoral Commission’s certified list, and
                    that list has not been loaded. See who is standing in this ward at{' '}
                    <a href={IEC_LINK.candidateLists} className="font-semibold text-teal">
                      the Commission’s certified candidate lists
                    </a>
                    .
                  </p>
                </SiteCard>
              ) : null}
            </div>
            {stations.length > 0 && (
              <p className="m-0 text-site-sm">
                Voting stations in this ward: {stations.map((s) => s.stationName).join('; ')}.
              </p>
            )}
          </div>
        </SiteSection>
      )}

      <SourceNote>
        {CANDIDATE_SOURCE} Wards come from Annexure A to IEC Circular 1 of 2025. “Use my location”
        is not offered: it needs the Municipal Demarcation Board’s ward boundary maps, which this
        site does not hold, and guessing a ward would be worse than not offering it.
      </SourceNote>
    </>
  );
}
