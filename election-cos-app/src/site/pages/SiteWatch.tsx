/**
 * Election Campaign OS — public site, short video explainers (`/watch`).
 *
 * Read explainerVideos.ts first. A hosted video is served from this site and downloads only when played
 * (`preload="none"`). A YouTube video plays only after a click, from youtube-nocookie.com. A explainer with no recorded video shows its words and says so.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { IEC_LINK } from '../officialSources';
import { byAudience, embedUrl, fmtSeconds, hostedUrls, type Explainer } from '../explainerVideos';

function Player({ e }: { e: Explainer }) {
  const [playing, setPlaying] = useState(false);
  if (e.hosted) {
    const u = hostedUrls(e.id);
    return (
      <div className="aspect-video w-full overflow-hidden rounded-t-[10px] bg-ink">
        <video
          controls
          playsInline
          preload="none"
          poster={u.poster}
          aria-label={e.title}
          className="h-full w-full"
        >
          <source src={u.video} type="video/mp4" />
          <track kind="captions" src={u.captions} srcLang="en" label="English" default />
          The video cannot play in this browser. The words are below.
        </video>
      </div>
    );
  }
  const src = embedUrl(e.youtubeId);
  if (playing && src) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-t-[10px] bg-ink">
        <iframe
          title={e.title}
          src={src}
          className="h-full w-full border-0"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-video w-full items-center justify-center rounded-t-[10px] bg-ink">
      {src ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play: ${e.title}`}
          className="flex h-14 w-14 items-center justify-center rounded-full border-0 bg-gold"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" className="fill-ink" />
          </svg>
        </button>
      ) : (
        <span className="px-4 text-center text-site-caption text-line">
          Video not recorded yet. The words are below.
        </span>
      )}
      <span className="absolute bottom-2 right-2.5 font-mono text-site-micro text-line">
        {fmtSeconds(e.seconds)}
      </span>
    </div>
  );
}

function Card({ e }: { e: Explainer }) {
  return (
    <SiteCard className="overflow-hidden">
      <Player e={e} />
      <div className="flex flex-col gap-2 p-[18px]">
        <h3 className="m-0 font-site-display text-site-h6">{e.title}</h3>
        <p className="m-0 text-site-base">
          <strong>Read it:</strong> {e.readIt}
        </p>
      </div>
    </SiteCard>
  );
}

/** The animated case journey: pure CSS, no video, still when the device asks for reduced motion. */
function CaseJourney() {
  const steps = [
    ['1. Report', 'Logged at the door, online or offline.'],
    ['2. Triage', 'Sorted: water, electricity, roads, safety.'],
    ['3. Authorise', 'The councillor approves what goes out.'],
    ['4. Signed referral', 'A signed PDF to the right department.'],
    ['5. Resolved', 'Tracked until it is, and the resident is told.'],
  ];
  return (
    <SiteCard className="flex flex-col gap-4 p-7">
      <h2 className="m-0 font-site-display text-site-h5">
        Animation: A Case From the Doorstep to Resolved
      </h2>
      <p className="m-0 text-site-caption text-slate">
        Plays by itself, with no sound and no video file. It stops moving if your device is set to
        reduce motion.
      </p>
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3.5 p-0">
        {steps.map(([t, d], i) => (
          <li
            key={t}
            className="animate-ecos-lit rounded-lg border-[1.5px] border-line px-3.5 py-3"
            style={{ animationDelay: `${i * 2}s` }}
          >
            <strong className="font-site-display">{t}</strong>
            <br />
            <span className="text-site-caption">{d}</span>
          </li>
        ))}
      </ol>
    </SiteCard>
  );
}

export function SiteWatch() {
  return (
    <>
      <SiteSection className="flex flex-col gap-4 pb-6 pt-[88px]">
        <Eyebrow>Short Explainers</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-display">
          Watch It in Ten Seconds. Read It If You Prefer.
        </h1>
        <p className="m-0 max-w-[36em] text-site-lead">
          Each video makes one point, with the words on screen and captions on. Under every video
          are the same words as text, so nobody has to watch to know what it says.
        </p>
        <p className="m-0 flex flex-wrap gap-3">
          <a href="#voters" className="site-btn-outline-ink min-h-[44px] px-[18px]">
            For Voters
          </a>
          <a href="#parties" className="site-btn-outline-ink min-h-[44px] px-[18px]">
            For Parties and Campaigns
          </a>
          <Link to="/tutorial" className="site-btn-outline-ink min-h-[44px] px-[18px]">
            The 60-Second Tour, as Text
          </Link>
        </p>
      </SiteSection>

      <SiteSection className="pb-10">
        <CaseJourney />
      </SiteSection>

      <SiteSection id="voters" labelledBy="w-voters" className="pb-12">
        <h2 id="w-voters" className="mb-5 mt-0 font-site-display text-site-h4">
          For Voters
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {byAudience('voters').map((e) => (
            <Card key={e.id} e={e} />
          ))}
        </div>
      </SiteSection>

      <SiteSection id="parties" labelledBy="w-parties" className="pb-[72px]">
        <h2 id="w-parties" className="mb-5 mt-0 font-site-display text-site-h4">
          For Parties and Campaigns
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {byAudience('parties').map((e) => (
            <Card key={e.id} e={e} />
          ))}
        </div>
        <p className="mb-0 mt-6 max-w-[50em] text-site-caption text-slate">
          Videos are served from this site and download only when you press play, so visiting this page
          sends nothing to anyone else. Captions are on by default. Videos use invented wards and
          invented data, and say so.
        </p>
        <p className="mb-0 mt-3 max-w-[50em] text-site-caption text-slate">
          Seen something online about the elections that does not look right? Check it or report it
          at{' '}
          <a href={IEC_LINK.real411Elections} target="_blank" rel="noopener noreferrer">
            Real411
          </a>
          , the disinformation reporting service the Electoral Commission points to.
        </p>
      </SiteSection>
    </>
  );
}
