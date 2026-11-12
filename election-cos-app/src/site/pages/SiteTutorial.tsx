/**
 * Election Campaign OS — public site, the 60-second tour (`/tutorial`)
 *
 * Six chapters, one visible at a time, with a progress bar by seconds.
 * Plain buttons and a live region: no autoplay, no motion, works without a
 * pointer. Content and the reasons for what is left out: `../tutorial.ts`.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS, TOUR_NOTE, TOUR_SECONDS } from '../tutorial';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';

const mmss = (s: number) => `0:${String(s).padStart(2, '0')}`;

export function SiteTutorial() {
  const [i, setI] = useState(0);
  const c = CHAPTERS[i]!;
  return (
    <>
      <SiteSection className="flex flex-col gap-4 pb-8 pt-[88px]">
        <Eyebrow>The Tour</Eyebrow>
        <h1 className="m-0 font-site-display text-site-h3 md:text-site-h1">
          Election Campaign OS in 60 Seconds
        </h1>
        <p className="m-0 max-w-[36em] text-site-lead">
          From the doorstep to the seat calculation, in six steps. Pick a chapter, or go in order.
        </p>
        <p className="m-0 max-w-[40em] text-site-sm text-slate">{TOUR_NOTE}</p>
      </SiteSection>

      <SiteSection labelledBy="tour-h" className="flex flex-col gap-6 pb-[88px]">
        <h2 id="tour-h" className="sr-only">
          Chapters
        </h2>
        <div role="tablist" aria-label="Tour Chapters" className="flex flex-wrap gap-2">
          {CHAPTERS.map((ch, n) => (
            <button
              key={ch.id}
              id={`tab-${ch.id}`}
              role="tab"
              type="button"
              aria-selected={n === i}
              aria-controls="tour-panel"
              onClick={() => setI(n)}
              className={n === i ? 'site-btn-primary' : 'site-btn-outline-ink'}
            >
              {mmss(ch.start)}–{mmss(ch.end)} · {n + 1}
            </button>
          ))}
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded bg-line"
          role="progressbar"
          aria-label="Position in the Tour"
          aria-valuemin={0}
          aria-valuemax={TOUR_SECONDS}
          aria-valuenow={c.end}
        >
          <div className="h-full bg-gold" style={{ width: `${(c.end / TOUR_SECONDS) * 100}%` }} />
        </div>

        <SiteCard className="flex flex-col gap-4 p-8">
          <div id="tour-panel" role="tabpanel" aria-labelledby={`tab-${c.id}`} aria-live="polite">
            <p className="m-0 text-site-caption text-slate">
              Chapter {i + 1} of {CHAPTERS.length} · {mmss(c.start)}–{mmss(c.end)}
            </p>
            <h3 className="m-0 font-site-display text-site-h4">{c.title}</h3>
            <p className="mb-0 mt-3 text-site-lead">{c.lead}</p>
            <ul className="mb-0 mt-4 flex list-disc flex-col gap-2 pl-5 text-site-base">
              {c.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {c.tryIt && (
              <p className="mb-0 mt-5">
                <Link to={c.tryIt.href} className="site-btn-outline-ink">
                  {c.tryIt.label}
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-line pt-4">
            <button
              type="button"
              className="site-btn-outline-ink"
              disabled={i === 0}
              onClick={() => setI(i - 1)}
            >
              Previous
            </button>
            {i < CHAPTERS.length - 1 ? (
              <button type="button" className="site-btn-primary" onClick={() => setI(i + 1)}>
                Next Chapter
              </button>
            ) : (
              <Link to="/book-a-demo" className="site-btn-primary">
                Book a Demo
              </Link>
            )}
          </div>
        </SiteCard>
      </SiteSection>
    </>
  );
}
