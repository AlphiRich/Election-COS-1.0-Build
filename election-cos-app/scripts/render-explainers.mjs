#!/usr/bin/env node
/**
 * Render the explainer videos (video-src/explainers) to silent, captioned MP4s.
 *
 *   node scripts/render-explainers.mjs [--out DIR] [--fps 24] [id ...]
 *
 * Serves video-src/explainers over HTTP (the in-browser Babel fetches the JSX), opens each page
 * in Chromium, and steps the animation stage frame by frame through its own seek hook
 * (`data-om-seek-to-time-frame`, `sync: true`), so the result is deterministic and does not depend
 * on how fast the machine runs. Frames are piped to ffmpeg (H.264, 1280x720, yuv420p, faststart).
 *
 * Needs: playwright with Chromium (NODE_PATH=$(npm root -g) works where it is installed globally),
 * ffmpeg on PATH, and network access to unpkg.com and fonts.googleapis.com, which the source pages
 * load at view time. No audio is produced.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../video-src/explainers');

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : dflt;
};
const OUT = path.resolve(opt('--out', 'dist-videos'));
const FPS = Number(opt('--fps', '24'));
const ALL = [
  'canvasser-knocks', 'poll-answer', 'seats-won', 'roles', 'command-view',
  'capture-consent', 'offline', 'funding-30-day', 'sentiment-polls', 'scenario-runner',
];
const ids = args.length ? args : ALL;
mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.jsx': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  const file = path.join(ROOT, path.normalize(new URL(req.url, 'http://x').pathname).replace(/^(\.\.[/\\])+/, ''));
  try {
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await page.goto(`${base}/${id}.html`);
  await page.waitForSelector('[data-om-sync-seek]', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  const total = await page.evaluate(() => {
    const secs = [...document.body.querySelectorAll('*')]
      .map((e) => (e.children.length === 0 ? e.textContent.trim() : ''))
      .filter((t) => /^0:\d\d\.\d\d$/.test(t))
      .map((t) => Number(t.split(':')[0]) * 60 + Number(t.split(':')[1]));
    return Math.max(...secs);
  });
  const frames = Math.round(total * FPS);
  const out = path.join(OUT, `${id}.mp4`);
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', 'crop=iw-6:ih-6:3:3,scale=1280:720:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', out,
  ]);
  ff.stderr.on('data', (d) => process.stderr.write(d));
  const stage = await page.$('[data-om-sync-seek]');
  for (let i = 0; i < frames; i++) {
    const t = Math.min(total, i / FPS);
    await page.evaluate(
      (time) =>
        document
          .querySelector('[data-om-sync-seek]')
          .dispatchEvent(new CustomEvent('data-om-seek-to-time-frame', { detail: { time, sync: true } })),
      t,
    );
    ff.stdin.write(await stage.screenshot({ type: 'jpeg', quality: 92 }));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`${id}: ${total}s, ${frames} frames, ${(statSync(out).size / 1024).toFixed(0)} KB`);
  await page.close();
}
await browser.close();
server.close();
