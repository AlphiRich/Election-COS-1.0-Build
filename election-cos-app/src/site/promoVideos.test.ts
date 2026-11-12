import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELD, PROMO_VIDEOS, promoUrls } from './promoVideos';

const dir = path.resolve(__dirname, '../../site-assets/videos');

describe('promo videos', () => {
  it('every hosted promo has its video, poster and WebVTT captions', () => {
    for (const v of PROMO_VIDEOS) {
      const u = promoUrls(v.id);
      for (const url of [u.video, u.captions, u.poster]) {
        const f = path.join(dir, path.basename(url));
        expect(existsSync(f), f).toBe(true);
        expect(statSync(f).size, f).toBeGreaterThan(100);
      }
      expect(readFileSync(path.join(dir, `${v.id}.vtt`), 'utf8').startsWith('WEBVTT')).toBe(true);
    }
  });
  it('captions never run past the video, and the words on the page carry no claim the product cannot back', () => {
    for (const v of PROMO_VIDEOS) {
      const vtt = readFileSync(path.join(dir, `${v.id}.vtt`), 'utf8');
      const ends = [...vtt.matchAll(/--> 00:00:(\d\d)\.(\d{3})/g)].map((m) => Number(m[1]) + Number(m[2]) / 1000);
      expect(Math.max(...ends), v.id).toBeLessThanOrEqual(v.seconds);
      expect(v.readIt + vtt, v.id).not.toMatch(/free trial|10-year|whatsapp engine|live engine/i);
    }
  });
  it('the headline figure on the council video is the verified one (139 of 213)', async () => {
    const { NATIONAL_SEATS } = await import('@/modules/lge2026/nationalResults');
    const councils = Object.values(NATIONAL_SEATS.councils);
    expect(councils.filter((c) => c.hung)).toHaveLength(139);
    expect(councils).toHaveLength(213);
    expect(PROMO_VIDEOS.find((v) => v.id === 'who-governs-your-council')!.readIt).toContain('139 of 213');
  });
  it('hosts none of the videos that were held back, and does not ship them in the site folder', () => {
    expect(HELD.length).toBeGreaterThanOrEqual(5);
    const present = readdirSync(dir);
    for (const h of HELD) expect(present, h.file).not.toContain(h.file);
    for (const h of HELD) expect(h.reason.length, h.file).toBeGreaterThan(15);
  });
});
