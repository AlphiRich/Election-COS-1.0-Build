/**
 * Election Campaign OS — client-side photo compression (agent 2, MEDIA_COMPRESSION).
 *
 * A canvasser's phone photo is 3 to 6 MB; the sync batch limit is 5 MB for the whole batch and
 * the data is metered. So a photo is downscaled and re-encoded BEFORE it is queued.
 *
 * Re-drawing onto a canvas and encoding fresh also drops EXIF, including GPS position. That is
 * deliberate and tested in a real browser: a doorstep photo must not carry the canvasser's or the
 * resident's coordinates in its metadata.
 *
 * `planSize` is pure and unit-tested. `compressImage` takes its browser pieces as dependencies so
 * the control flow is tested without a canvas, and `photoCompress.browser` (Playwright) exercises
 * the real thing.
 */
import type { PhotoQueueItem } from './db';

export const MAX_EDGE_PX = 1600;
export const TARGET_MAX_BYTES = 400 * 1024;
export const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5, 0.4] as const;
export const HARD_MAX_INPUT_BYTES = 25 * 1024 * 1024;

export function planSize(w: number, h: number, maxEdge = MAX_EDGE_PX): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) throw new Error('Image has no size.');
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

export interface CompressDeps {
  decode(blob: Blob): Promise<{ width: number; height: number; draw: unknown }>;
  encode(draw: unknown, w: number, h: number, quality: number): Promise<Blob>;
}

export class PhotoRejected extends Error {}

export async function compressImage(
  input: Blob,
  deps: CompressDeps,
): Promise<{ blob: Blob; width: number; height: number; quality: number }> {
  if (!input.type.startsWith('image/')) throw new PhotoRejected('That file is not an image.');
  if (input.size > HARD_MAX_INPUT_BYTES)
    throw new PhotoRejected('That photo is too large to process.');
  const img = await deps.decode(input);
  const { w, h } = planSize(img.width, img.height);
  let last: Blob | null = null;
  let used = QUALITY_STEPS[0] as number;
  for (const q of QUALITY_STEPS) {
    last = await deps.encode(img.draw, w, h, q);
    used = q;
    if (last.size <= TARGET_MAX_BYTES) break;
  }
  if (!last) throw new PhotoRejected('The photo could not be processed.');
  // Never queue something larger than the original: a tiny, already-small image can grow when re-encoded.
  if (last.size >= input.size && img.width <= MAX_EDGE_PX && img.height <= MAX_EDGE_PX) {
    return { blob: input, width: img.width, height: img.height, quality: 1 };
  }
  return { blob: last, width: w, height: h, quality: used };
}

/** The browser implementation. */
export const browserDeps: CompressDeps = {
  async decode(blob) {
    const bmp = await createImageBitmap(blob);
    return { width: bmp.width, height: bmp.height, draw: bmp };
  },
  async encode(draw, w, h, quality) {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoRejected('The photo could not be processed.');
    ctx.drawImage(draw as ImageBitmap, 0, 0, w, h);
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  },
};

export function toQueueItem(id: string, incidentId: string, blob: Blob): PhotoQueueItem {
  return { id, incidentId, blob, _syncState: 'PENDING' };
}
