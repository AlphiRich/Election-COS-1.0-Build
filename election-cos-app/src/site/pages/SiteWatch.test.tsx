// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EXPLAINERS } from '../explainerVideos';
import { SiteWatch } from './SiteWatch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => {
    createRoot(el).render(
      <MemoryRouter>
        <SiteWatch />
      </MemoryRouter>,
    );
  });
  return el;
}

describe('the /watch page', () => {
  it('shows every explainer’s words, with a hosted video that downloads nothing until played and has captions', async () => {
    const el = await mount();
    for (const e of EXPLAINERS) expect(el.textContent).toContain(e.title);
    expect(el.querySelectorAll('iframe')).toHaveLength(0);
    const videos = [...el.querySelectorAll('video')];
    expect(videos).toHaveLength(EXPLAINERS.length);
    for (const v of videos) {
      expect(v.getAttribute('preload')).toBe('none');
      expect(v.getAttribute('poster')).toMatch(/^\/videos\/[a-z0-9-]+\.jpg$/);
      expect(v.querySelector('source')!.getAttribute('src')).toMatch(/^\/videos\/[a-z0-9-]+\.mp4$/);
      expect(v.querySelector('track[kind="captions"]')!.getAttribute('src')).toMatch(/\.vtt$/);
    }
    expect(el.textContent).not.toContain('Video not recorded yet');
  });
  it('with no video hosted and none on YouTube, builds no player and says so', async () => {
    const mod = await import('../explainerVideos');
    const first = mod.EXPLAINERS[0];
    first.hosted = false;
    try {
      const el = await mount();
      expect(el.textContent).toContain('Video not recorded yet');
      expect(el.querySelectorAll('video')).toHaveLength(EXPLAINERS.length - 1);
    } finally {
      first.hosted = true;
    }
  });
  it('contacts nothing on load', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    await mount();
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
  it('offers the animation and says it respects reduced motion', async () => {
    const el = await mount();
    expect(el.textContent).toContain('reduce motion');
    expect(el.querySelectorAll('.animate-ecos-lit')).toHaveLength(5);
  });
  it('loads the player only after a click, from the privacy-enhanced host', async () => {
    const mod = await import('../explainerVideos');
    const first = mod.EXPLAINERS[0];
    const prev = first.youtubeId;
    first.youtubeId = 'dQw4w9WgXcQ';
    first.hosted = false;
    try {
      const el = await mount();
      expect(el.querySelectorAll('iframe')).toHaveLength(0); // facade first
      const play = el.querySelector(`button[aria-label="Play: ${first.title}"]`)!;
      await act(async () => {
        play.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      const frame = el.querySelector('iframe')!;
      expect(frame.getAttribute('src')).toMatch(
        /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/,
      );
    } finally {
      first.youtubeId = prev;
      first.hosted = true;
    }
  });
  it('points to Real411 for checking or reporting election disinformation', async () => {
    const el = await mount();
    const link = [...el.querySelectorAll('a')].find((a) => a.textContent === 'Real411')!;
    expect(link.getAttribute('href')).toBe('https://real411.org.za/elections');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
