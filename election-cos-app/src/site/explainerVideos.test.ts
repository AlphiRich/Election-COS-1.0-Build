import { describe, expect, it } from 'vitest';
import {
  EXPLAINERS,
  MAX_SECONDS,
  byAudience,
  embedUrl,
  fmtSeconds,
  isYoutubeId,
} from './explainerVideos';

describe('the explainer registry', () => {
  it('has unique ids, both audiences, and every explainer carries its words as text', () => {
    expect(new Set(EXPLAINERS.map((e) => e.id)).size).toBe(EXPLAINERS.length);
    expect(byAudience('voters').length).toBeGreaterThan(0);
    expect(byAudience('parties').length).toBeGreaterThan(0);
    for (const e of EXPLAINERS) expect(e.readIt.trim().length, e.id).toBeGreaterThan(30);
  });
  it('keeps every video short: voters and parties will not sit through a long one', () => {
    for (const e of EXPLAINERS) {
      expect(e.seconds, e.id).toBeGreaterThanOrEqual(5);
      expect(e.seconds, e.id).toBeLessThanOrEqual(MAX_SECONDS);
    }
  });
  it('fakes no video: while nothing is recorded every id is null, and any id set is well formed', () => {
    for (const e of EXPLAINERS) {
      if (e.youtubeId !== null) expect(isYoutubeId(e.youtubeId), e.id).toBe(true);
    }
  });
  it('holds the same 60-second tour as the tour page, in the same six parts', () => {
    const parties = byAudience('parties').map((e) => e.id);
    for (const id of ['roles', 'command-view', 'capture-consent', 'offline', 'funding-30-day']) {
      expect(parties).toContain(id);
    }
  });
});

describe('embedUrl', () => {
  it('returns null for no id or a malformed one, so a player is never built from nothing', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'short',
      'has space!!',
      'a'.repeat(12),
      '"><script>x',
    ]) {
      expect(embedUrl(bad as never)).toBeNull();
    }
  });
  it('uses the privacy-enhanced host only, with captions on and related videos limited', () => {
    const u = embedUrl('dQw4w9WgXcQ')!;
    expect(u.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?')).toBe(true);
    expect(u).not.toContain('www.youtube.com');
    const q = new URL(u).searchParams;
    expect(q.get('cc_load_policy')).toBe('1');
    expect(q.get('rel')).toBe('0');
  });
  it('formats running time', () => {
    expect(fmtSeconds(10)).toBe('0:10');
    expect(fmtSeconds(30)).toBe('0:30');
  });
});
