import { describe, expect, it } from 'vitest';
import {
  HARD_MAX_INPUT_BYTES,
  MAX_EDGE_PX,
  PhotoRejected,
  TARGET_MAX_BYTES,
  compressImage,
  planSize,
  type CompressDeps,
} from './photoCompress';

const jpeg = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

describe('planSize', () => {
  it('scales the long edge down to the limit and keeps the aspect ratio', () => {
    expect(planSize(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(planSize(3000, 4000)).toEqual({ w: 1200, h: 1600 });
  });
  it('never enlarges', () => {
    expect(planSize(800, 600)).toEqual({ w: 800, h: 600 });
    expect(planSize(MAX_EDGE_PX, 10)).toEqual({ w: MAX_EDGE_PX, h: 10 });
  });
  it('never returns a zero edge, and refuses an image with no size', () => {
    expect(planSize(5000, 1).h).toBe(1);
    expect(() => planSize(0, 100)).toThrow();
  });
});

describe('compressImage control flow', () => {
  const deps = (
    sizeAt: Record<number, number>,
    dims = { width: 4000, height: 3000 },
  ): CompressDeps & { calls: number[] } => {
    const calls: number[] = [];
    return {
      calls,
      decode: async () => ({ ...dims, draw: {} }),
      encode: async (_d, _w, _h, q) => {
        calls.push(q);
        return jpeg(sizeAt[q] ?? 1);
      },
    };
  };
  it('steps quality down until the result fits the target', async () => {
    const d = deps({ 0.8: 900_000, 0.7: 600_000, 0.6: 300_000 });
    const r = await compressImage(jpeg(5_000_000), d);
    expect(d.calls).toEqual([0.8, 0.7, 0.6]);
    expect(r.quality).toBe(0.6);
    expect(r.blob.size).toBeLessThanOrEqual(TARGET_MAX_BYTES);
    expect([r.width, r.height]).toEqual([1600, 1200]);
  });
  it('stops at the lowest step rather than looping, and still returns something smaller than the input', async () => {
    const d = deps({ 0.8: 900_000, 0.7: 900_000, 0.6: 900_000, 0.5: 900_000, 0.4: 900_000 });
    const r = await compressImage(jpeg(5_000_000), d);
    expect(d.calls.length).toBe(5);
    expect(r.blob.size).toBeLessThan(5_000_000);
  });
  it('keeps the original when re-encoding would make a small image bigger', async () => {
    const d = deps({ 0.8: 200_000 }, { width: 800, height: 600 });
    const input = jpeg(50_000);
    const r = await compressImage(input, d);
    expect(r.blob).toBe(input);
  });
  it('refuses a non-image and an absurdly large input', async () => {
    const d = deps({});
    await expect(compressImage(new Blob(['x'], { type: 'text/plain' }), d)).rejects.toBeInstanceOf(
      PhotoRejected,
    );
    const huge = { type: 'image/jpeg', size: HARD_MAX_INPUT_BYTES + 1 } as Blob;
    await expect(compressImage(huge, d)).rejects.toBeInstanceOf(PhotoRejected);
  });
});
