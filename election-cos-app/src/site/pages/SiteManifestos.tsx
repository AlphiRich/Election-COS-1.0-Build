/**
 * Election Campaign OS — public site, find a party's manifesto
 * (`/tools/party-manifestos`)
 *
 * Builds the same two searches for any name typed. Nothing is ranked,
 * recommended or pre-selected: see `tools/manifestoLinks.ts`.
 */
import { useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { IEC_VOTER_EDUCATION_VIDEOS, manifestoLinks } from '../tools/manifestoLinks';

export function SiteManifestos() {
  const [party, setParty] = useState('');
  const links = manifestoLinks(party);

  return (
    <>
      <PageIntro
        eyebrow="Voter tool"
        title="Read and watch the manifestos"
        lead="Type any party or independent candidate’s name and open a web search or a video search for their manifesto. The same searches are built for everyone."
      />
      <SiteSection className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-4 p-8">
          <label htmlFor="party" className="font-semibold">
            Party or candidate
          </label>
          <input
            id="party"
            className="site-field"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            placeholder="Type a name"
            autoComplete="off"
          />
          <div role="status" aria-live="polite">
            {links ? (
              <p className="m-0 flex flex-wrap gap-3">
                <a href={links.web} className="site-btn-primary">
                  Search the web
                </a>
                <a href={links.video} className="site-btn-outline-ink">
                  Search YouTube
                </a>
              </p>
            ) : (
              <p className="m-0 text-site-sm text-slate">Enter at least two letters.</p>
            )}
          </div>
          <p className="m-0 text-site-caption text-slate">
            These open a search, so look for the party’s own official site or channel in the
            results. Anyone can publish a video with a party’s name on it.
          </p>
        </SiteCard>
      </SiteSection>
      <SiteSection className="pb-10">
        <SiteCard className="flex max-w-[760px] flex-col gap-2 p-8">
          <h2 className="m-0 font-site-display text-site-h5">Learn how voting works</h2>
          <p className="m-0 text-site-sm">
            The Electoral Commission publishes voter-education videos on YouTube.
          </p>
          <a href={IEC_VOTER_EDUCATION_VIDEOS} className="font-semibold text-teal">
            Search the Commission’s voter-education videos →
          </a>
        </SiteCard>
      </SiteSection>
      <SourceNote>
        This site does not endorse any party or candidate and does not rank manifestos.
      </SourceNote>
    </>
  );
}
