/**
 * Election-COS — favicon and PWA icons, rendered from the brand mark.
 *
 *   npm run build:icons
 *
 * Every icon is drawn from src/components/BrandMark.tsx, so the browser
 * tab, the home-screen icon and the header mark cannot drift apart:
 *
 *   public/icon.svg               BRAND_MARK_SVG (rounded paper tile)
 *   public/icon-192.png, -512     the same, rasterised, transparent corners
 *   public/icon-maskable-512.png  full-bleed paper, mark inside the safe zone
 *   public/apple-touch-icon.png   180 px, full-bleed paper (iOS rounds it)
 *
 * PNGs are rasterised by a local headless Chromium (Chrome or Edge). Set
 * BROWSER to its path if neither default location exists. Re-run this only
 * when the mark changes, and commit the output.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BRAND_MARK_SVG, brandMarkSquareSvg } from '../src/components/brandMarkSvg';

const PUBLIC = path.resolve(__dirname, '..', 'public');
const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((p): p is string => Boolean(p));
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) throw new Error('No headless Chromium found; set BROWSER to its path.');

const sized = (px: number) => BRAND_MARK_SVG.replace('<svg ', `<svg width="${px}" height="${px}" `);

const ICONS: { file: string; px: number; svg: string }[] = [
  { file: 'icon-192.png', px: 192, svg: sized(192) },
  { file: 'icon-512.png', px: 512, svg: sized(512) },
  { file: 'icon-maskable-512.png', px: 512, svg: brandMarkSquareSvg(512, 0.6) },
  { file: 'apple-touch-icon.png', px: 180, svg: brandMarkSquareSvg(180, 0.7) },
];

writeFileSync(path.join(PUBLIC, 'icon.svg'), BRAND_MARK_SVG);
const started = Date.now();
const work = mkdtempSync(path.join(tmpdir(), 'ecos-icons-'));
try {
  for (const { file, px, svg } of ICONS) {
    const src = path.join(work, file.replace(/\.png$/, '.svg'));
    writeFileSync(src, svg);
    execFileSync(browser, [
      '--headless=new',
      // Its own profile, so it never hands the job to a browser already open.
      `--user-data-dir=${path.join(work, 'profile')}`,
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',
      `--window-size=${px},${px}`,
      `--screenshot=${path.join(PUBLIC, file)}`,
      pathToFileURL(src).href,
    ], { stdio: 'ignore' });
    if (!existsSync(path.join(PUBLIC, file)) || statSync(path.join(PUBLIC, file)).mtimeMs < started) {
      throw new Error(`The browser did not write public/${file}.`);
    }
    console.log(`wrote public/${file} (${px}×${px})`);
  }
  console.log('wrote public/icon.svg');
} finally {
  rmSync(work, { recursive: true, force: true });
}
