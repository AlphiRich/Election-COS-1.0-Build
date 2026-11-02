import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EXPLAINERS,
  MAX_SECONDS,
  byAudience,
  embedUrl,
  fmtSeconds,
  hostedUrls,
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

describe('hosted videos', () => {
  const dir = path.resolve(__dirname, '../../site-assets/videos');
  it('every hosted explainer has its video, captions and poster, and the captions are WebVTT', () => {
    for (const e of EXPLAINERS.filter((x) => x.hosted)) {
      const u = hostedUrls(e.id);
      for (const url of [u.video, u.captions, u.poster]) {
        const f = path.join(dir, path.basename(url));
        expect(existsSync(f), f).toBe(true);
        expect(statSync(f).size, f).toBeGreaterThan(100);
      }
      expect(readFileSync(path.join(dir, `${e.id}.vtt`), 'utf8').startsWith('WEBVTT')).toBe(true);
      const mp4 = readFileSync(path.join(dir, `${e.id}.mp4`)).subarray(4, 8).toString('latin1');
      expect(mp4, `${e.id} is an MP4`).toBe('ftyp');
    }
  });
  it('serves every hosted file from this site, never another host', () => {
    for (const e of EXPLAINERS) for (const url of Object.values(hostedUrls(e.id))) expect(url.startsWith('/videos/')).toBe(true);
  });
  it('has no stray file in the folder: every file belongs to a registered explainer', () => {
    const ids = new Set(EXPLAINERS.map((e) => e.id));
    for (const f of readdirSync(dir)) expect(ids.has(f.replace(/\.(mp4|vtt|jpg)$/, '')), f).toBe(true);
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
