/**
 * The video sources (video-src/explainers, a Claude Design export) carry their own copy of each
 * explainer's words. This holds that copy to the registry so the video and the page say the same.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { EXPLAINERS } from './explainerVideos';

interface Source {
  id: string;
  audience: string;
  title: string;
  seconds: number;
  sentences: string[];
  total: number;
}

function loadSource(): Source[] {
  const file = path.resolve(__dirname, '../../video-src/explainers/explainers-data.js');
  const ctx: { window: { ECOS_EXPLAINERS?: Source[] } } = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf-8'), ctx);
  return ctx.window.ECOS_EXPLAINERS ?? [];
}

const norm = (s: string) => s.replace(/’/g, "'").replace(/“|”/g, '"').trim();

describe('video sources match the registry', () => {
  const src = loadSource();
  it('cover exactly the same explainers, in the same order', () => {
    expect(src.map((s) => s.id)).toEqual(EXPLAINERS.map((e) => e.id));
  });
  it('carry the same title and audience', () => {
    for (const e of EXPLAINERS) {
      const s = src.find((x) => x.id === e.id)!;
      expect(norm(s.title), e.id).toBe(norm(e.title));
      expect(s.audience, e.id).toBe(e.audience);
    }
  });
  it('say the same words: the captions joined are the page text', () => {
    for (const e of EXPLAINERS) {
      const s = src.find((x) => x.id === e.id)!;
      expect(norm(s.sentences.join(' ')), e.id).toBe(norm(e.readIt));
    }
  });
  it('run for the length the registry states, to the nearest second', () => {
    for (const e of EXPLAINERS) {
      const s = src.find((x) => x.id === e.id)!;
      expect(Math.round(s.total), e.id).toBe(e.seconds);
    }
  });
});
