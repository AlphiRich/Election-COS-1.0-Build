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
  it('shows every explainer’s words, and with no video recorded builds no player and no iframe', async () => {
    const el = await mount();
    for (const e of EXPLAINERS) expect(el.textContent).toContain(e.title);
    expect(el.querySelectorAll('iframe')).toHaveLength(0);
    expect(el.querySelectorAll('button[aria-label^="Play"]')).toHaveLength(0);
    expect(el.textContent).toContain('Video not recorded yet');
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
    }
  });
});
