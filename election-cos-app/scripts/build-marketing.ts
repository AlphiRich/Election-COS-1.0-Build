/**
 * Election Campaign OS — marketing collateral renderer.
 *
 * Renders the assets in the "Marketing Asset Architecture" manifest from the repo's own tokens,
 * self-hosted fonts and facts (prices, entity, number), so nothing here is typed twice:
 *   marketing/banners/*.png   BOFU + TOFU ad creative, every size in the manifest
 *   marketing/print/poster-a3.pdf, poster-a3.png
 *   marketing/video/lower-third-*.png   transparent, 1920x1080
 *
 * Run: npx vite-node scripts/build-marketing.ts
 *
 * The "Paid for by" line uses SITE.entity, the legal name settled 29 Oct 2026 (Just Be Trading 10
 * (Pty) Ltd t/a Innovation Consult). The manifest's "Innovation Consult (Pty) Ltd" is not that name.
 */
import { createRequire } from 'node:module';
// Playwright is installed in the build environment, not a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tokens } from '../src/design/tokens';
import { SITE } from '../src/site/siteContent';

const C = tokens.color;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'marketing');
const FONT = (f: string) => `file://${ROOT}/public/fonts/${f}`;
const FONTS = `
@font-face{font-family:'Public Sans';font-weight:400;src:url(${FONT('public-sans-400-normal-latin.woff2')})}
@font-face{font-family:'Public Sans';font-weight:700;src:url(${FONT('public-sans-700-normal-latin.woff2')})}
@font-face{font-family:'Archivo Narrow';font-weight:700;src:url(${FONT('archivo-narrow-700-normal-latin.woff2')})}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(${FONT('ibm-plex-mono-500-normal-latin.woff2')})}`;

/** The CTA in the manifest is "Start Free Trial". No free trial exists in the product: owner to confirm. */
const CTA_BOFU = 'Start Free Trial';
const CTA_TOFU = 'Request Demo';
const PAID_FOR = `Paid for by ${SITE.entity}. ${SITE.registration}.`;

type Kind = 'bofu' | 'tofu';
const COPY: Record<Kind, string[][]> = {
  bofu: [
    ['Manage your ward legally.', 'R1,800/ward.'],
    ['Automated POPIA consent', 'for canvassers.'],
  ],
  tofu: [
    ['Are you prepared', 'for the 2029 campaign?'],
    ['Enterprise data intelligence', 'for South African elections.'],
  ],
};

function banner(kind: Kind, w: number, h: number, copy: string[]): string {
  const wide = w / h > 2.2; // 728x90 leaderboard
  const u = wide ? 6.4 : Math.min(w, h) / 100; // a leaderboard is sized by its type, not its 90px height
  const tall = h > w * 1.4; // 9:16
  const dark = kind === 'tofu';
  const bg = dark ? C.ink : C.paper;
  const fg = dark ? C.paper : C.ink;
  const btnBg = dark ? C.teal : C.gold;
  const btnFg = dark ? C.paper : C.ink;
  const head = (wide ? 3.2 : tall ? 9 : w === 300 ? 7.2 : 8) * u;
  const bars = [38, 62, 51, 80, 66, 92, 74]
    .map((v, i) => `<i style="height:${v}%;background:${i % 2 ? C.teal : C.gold}"></i>`)
    .join('');
  return `<!doctype html><meta charset=utf-8><style>${FONTS}
*{box-sizing:border-box;margin:0}body{width:${w}px;height:${h}px;background:${bg};color:${fg};font-family:'Public Sans';overflow:hidden;position:relative}
.wrap{position:absolute;inset:0;padding:${wide ? 0.9 * u : 6 * u}px ${wide ? 3 * u : 6 * u}px;display:flex;flex-direction:${wide ? 'row' : 'column'};justify-content:${wide ? 'space-between' : 'center'};align-items:${wide ? 'center' : 'flex-start'};gap:${2.5 * u}px}
.mark{font:700 ${wide ? 2.6 * u : 3.2 * u}px 'Archivo Narrow';letter-spacing:.08em;text-transform:uppercase;color:${dark ? C.gold : C.ink}}
.mark b{color:${C.gold}}
h1{font:700 ${wide ? 3 * u : head}px/1.08 'Archivo Narrow';letter-spacing:-.01em}
h1 span{display:${wide ? 'inline' : 'block'}}
.btn{display:inline-block;background:${btnBg};color:${btnFg};font:700 ${wide ? 2.6 * u : 3.4 * u}px 'Public Sans';padding:${wide ? 1.1 * u : 2 * u}px ${wide ? 2.4 * u : 4 * u}px;border-radius:${u}px;white-space:nowrap}
.url{font:500 ${wide ? 2.2 * u : 2.8 * u}px 'IBM Plex Mono';color:${dark ? C.paper : C.ink};opacity:.85}
.viz{position:absolute;right:${6 * u}px;bottom:${tall ? 22 * u : 14 * u}px;width:${tall ? 60 * u : 34 * u}px;height:${tall ? 22 * u : 30 * u}px;display:${dark && !wide ? 'flex' : 'none'};align-items:flex-end;gap:${u}px}
.viz i{flex:1;border-radius:${0.5 * u}px ${0.5 * u}px 0 0}
.viz+.cap{position:absolute;right:${6 * u}px;bottom:${tall ? 18 * u : 10.5 * u}px;font:500 ${1.9 * u}px 'IBM Plex Mono';opacity:.7;display:${dark && !wide ? 'block' : 'none'}}
.disc{position:absolute;left:${wide ? 0.9 * u : 6 * u}px;bottom:${wide ? 0.25 * u : 2.2 * u}px;font:400 ${Math.max(8.5, wide ? 1.35 * u : 1.9 * u)}px 'Public Sans';opacity:.75;max-width:${wide ? 70 : 88}%}
.col{display:flex;flex-direction:column;gap:${wide ? 0.5 * u : 3 * u}px;align-items:flex-start}
</style><body><div class=wrap>
${wide ? '' : `<div class=mark>Election-<b>COS</b></div>`}
<div class=col>${wide ? `<div class=mark>Election-<b>COS</b></div>` : ''}<h1>${copy.map((l) => `<span>${l}</span>`).join(' ')}</h1></div>
<div class=col style="${wide ? 'flex-direction:row;align-items:center;gap:' + 2 * u + 'px' : ''}"><span class=btn>${kind === 'bofu' ? CTA_BOFU : CTA_TOFU}</span><span class=url>electioncos.co.za</span></div>
</div><div class=viz>${bars}</div><div class=cap>Illustration</div><div class=disc>${PAID_FOR}</div></body>`;
}

function poster(): string {
  const qr = readFileSync(path.join(ROOT, 'src/site/assets/whatsapp-qr.svg'), 'utf8').replace(/<svg /, '<svg style="width:100%;height:100%" ');
  return `<!doctype html><meta charset=utf-8><style>${FONTS}
@page{size:297mm 420mm;margin:0}*{box-sizing:border-box;margin:0}
body{width:297mm;height:420mm;background:${C.paper};color:${C.ink};font-family:'Public Sans';position:relative;overflow:hidden}
.top{background:${C.ink};color:${C.paper};padding:22mm 20mm 18mm;border-bottom:5mm solid ${C.gold}}
.mark{font:700 8mm 'Archivo Narrow';letter-spacing:.1em;text-transform:uppercase}.mark b{color:${C.gold}}
h1{font:700 34mm/0.95 'Archivo Narrow';letter-spacing:-.01em;margin-top:14mm;text-transform:uppercase}
h1 em{font-style:normal;color:${C.gold}}
.body{padding:16mm 20mm;display:grid;grid-template-columns:1fr 92mm;gap:14mm}
ul{list-style:none;padding:0}li{font:400 7.6mm/1.4 'Public Sans';padding:5.5mm 0;border-bottom:.4mm solid ${C.line}}
li b{font:700 7.6mm 'Public Sans'}
.qr{background:white;border:.6mm solid ${C.ink};padding:6mm;width:92mm;height:92mm}
.qrcap{font:500 5mm/1.4 'IBM Plex Mono';margin-top:4mm}
.foot{position:absolute;left:0;right:0;bottom:0;background:${C.ink};color:${C.paper};padding:9mm 20mm;display:flex;justify-content:space-between;font:400 4.2mm 'Public Sans'}
</style><body>
<div class=top><div class=mark>Election-<b>COS</b> &nbsp;·&nbsp; Field Canvasser Toolkit</div><h1>Take the War Room <em>to the Streets.</em></h1></div>
<div class=body><ul>
<li><b>Capture consent at the door.</b> POPIA consent is recorded with every voter you log, so you comply before you campaign.</li>
<li><b>Works with no signal.</b> Offline first: your work syncs when the network returns.</li>
<li><b>One war room.</b> Your ward lead sees live counts. Individual voter details stay in your scope.</li>
<li><b>Casework that is followed through.</b> Every doorstep complaint becomes a tracked referral.</li>
<li><b>Anonymous polling.</b> Closed-choice questions, counts only, small groups suppressed.</li></ul>
<div><div class=qr>${qr}</div><div class=qrcap>WhatsApp<br>${SITE.whatsApp.display}<br>${SITE.whatsApp.role}</div></div></div>
<div class=foot><span>electioncos.co.za</span><span>${PAID_FOR}</span></div></body>`;
}

function lowerThird(line1: string, line2: string): string {
  return `<!doctype html><meta charset=utf-8><style>${FONTS}
*{margin:0;box-sizing:border-box}html,body{width:1920px;height:1080px;background:transparent}
.bar{position:absolute;left:96px;bottom:120px;min-width:620px;padding:22px 40px 24px;background:rgba(26,34,70,.88);border-top:4px solid ${C.gold};color:${C.paper};font-family:'Public Sans'}
.l1{font:700 44px/1.15 'Public Sans'}.l2{font:400 28px/1.3 'Public Sans';opacity:.9;margin-top:4px}
</style><body><div class=bar><div class=l1>${line1}</div><div class=l2>${line2}</div></div></body>`;
}

const TMP = mkdtempSync(path.join(os.tmpdir(), 'ecos-mkt-'));
let n = 0;
/** `setContent` runs on about:blank, which may not read file:// fonts; a file URL can. */
async function load(page: import('playwright').Page, html: string) {
  const f = path.join(TMP, `p${n++}.html`);
  writeFileSync(f, html);
  await page.goto(`file://${f}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
}


/** The dual-funnel plan as one figure: the mechanism (what feeds what, what gates it), not a list of channels. */
function funnelPage(): string {
  const box = (x: number, y: number, w: number, t1: string, t2: string, cls = '') =>
    `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="64" rx="8"/><text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" class="t1">${t1}</text><text x="${x + w / 2}" y="${y + 47}" text-anchor="middle" class="t2">${t2}</text></g>`;
  const arrow = (x1: number, y1: number, x2: number, y2: number, label = '', dash = false) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#a)" ${dash ? 'stroke-dasharray="5 4"' : ''}/>${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 7}" text-anchor="middle" class="t2">${label}</text>` : ''}`;
  return `<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Dual-funnel plan</title><style>${FONTS}
:root{--bg:${C.paper};--fg:${C.ink};--muted:${C.slate};--accent:${C.gold};--blue:${C.teal};--line:${C.line}}
@media (prefers-color-scheme:dark){:root{--bg:${C.ink};--fg:${C.paper};--muted:${C.line};--blue:${C.gold};--accent:${C.gold}}}
body{margin:0;background:var(--bg);color:var(--fg);font-family:'Public Sans',sans-serif;padding:24px 16px}
main{max-width:980px;margin:0 auto}h1{font:700 28px 'Archivo Narrow';margin:0 0 6px}
p{color:var(--muted);max-width:70ch;line-height:1.5;font-size:15px}svg{width:100%;height:auto;display:block;margin:16px 0}
svg rect{fill:none;stroke:currentColor;stroke-width:1.5}svg line{stroke:currentColor;stroke-width:1.5}
.t1{font:700 13px 'Public Sans';fill:currentColor}.t2{font:400 11.5px 'Public Sans';fill:var(--muted)}
.lane{font:700 12px 'Archivo Narrow';letter-spacing:.1em;fill:var(--accent);text-transform:uppercase}
.hot rect{stroke:var(--accent);stroke-width:2.5}.gate rect{stroke-dasharray:6 4}.loop line,.loop{stroke:var(--accent)}
</style><main><h1>Dual-funnel plan</h1><p>One verification gate feeds two funnels. The 2026 funnel converts ward candidates now; every client it wins becomes a first-party list that seeds the 2029 funnel.</p>
<figure style="margin:0"><svg viewBox="0 0 1100 470" role="img" aria-label="A Google election-ads verification gate feeds two funnels: bottom-of-funnel search for 2026 ward candidates, and top-of-funnel demand generation for 2029 party strategists. Converted 2026 clients return as a Customer Match list that seeds the 2029 funnel.">
<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>
${box(40, 8, 420, 'Google election-ads verification', 'ID, tax and registration papers; "Paid for by" on every ad', 'gate')}
${arrow(140, 72, 140, 124)}
<path d="M40 40 L18 40 L18 362 L38 362" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#a)"/>
<text x="1060" y="112" text-anchor="end" class="lane">Bottom of funnel · 2026 · ward candidates</text>
${box(40, 124, 200, 'Search', 'exact / phrase keywords')}${arrow(240, 156, 300, 156)}
${box(300, 124, 220, 'Landing page', 'R1,800 per ward licence', 'hot')}${arrow(520, 156, 580, 156)}
${box(580, 124, 200, 'Demo / ward licence', 'conversion')}${arrow(780, 156, 830, 156)}
<text x="835" y="152" class="t1">CPA, ROAS</text><text x="835" y="168" class="t2">manual bids until 30 conv./mo</text>
<text x="1060" y="318" text-anchor="end" class="lane">Top of funnel · 2029 · party strategists</text>
${box(40, 330, 200, 'Demand Gen', 'YouTube, Discover, Gmail')}${arrow(240, 362, 300, 362)}
${box(300, 330, 220, 'Teaser + playbook', 'scale, data integrity', 'hot')}${arrow(520, 362, 580, 362)}
${box(580, 330, 200, 'Enterprise demo', 'custom SLA')}${arrow(780, 362, 830, 362)}
<text x="835" y="358" class="t1">VTCs, pipeline</text><text x="835" y="374" class="t2">brand lift, MQL to SQL</text>
<g class="loop" fill="none"><path d="M680 188 L680 245 L140 245 L140 324" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#a)"/></g>
<text x="410" y="236" text-anchor="middle" class="t1">2026 clients → Customer Match list → 2029 remarketing</text>
<text x="410" y="268" text-anchor="middle" class="t2">targeting stays contextual, geographic and first-party: no behavioural micro-targeting</text>
</svg><figcaption style="font-size:13px;color:var(--muted)">Gold outline: the creative asset each funnel turns on (banners and landing page; teaser and playbook). Dashed: consent-based first-party data only.</figcaption></figure></main>`;
}

async function main() {
  for (const d of ['banners', 'print', 'video']) mkdirSync(path.join(OUT, d), { recursive: true });
  const browser = await chromium.launch();
  const shot = async (html: string, file: string, w: number, h: number, transparent = false) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await load(page, html);
    await page.screenshot({ path: file, omitBackground: transparent });
    await page.close();
  };
  const sizes: Record<Kind, Array<[number, number]>> = {
    bofu: [[1200, 628], [1080, 1080], [300, 250], [728, 90]],
    tofu: [[1200, 628], [1080, 1080], [1080, 1920]],
  };
  for (const kind of ['bofu', 'tofu'] as Kind[])
    for (const [w, h] of sizes[kind])
      for (const [i, copy] of COPY[kind].entries())
        await shot(banner(kind, w, h, copy), path.join(OUT, 'banners', `${kind}-${w}x${h}-${'ab'[i]}.png`), w, h);

  const p = await browser.newPage();
  await load(p, poster());
  await p.pdf({ path: path.join(OUT, 'print/poster-a3.pdf'), width: '297mm', height: '420mm', printBackground: true });
  await p.setViewportSize({ width: 1123, height: 1587 });
  await p.screenshot({ path: path.join(OUT, 'print/poster-a3.png') });
  await p.close();

  const lts: Array<[string, string, string]> = [
    ['voting-districts', '108 Voting Districts', 'JB Marks Local Municipality, NW405'],
    ['url', 'electioncos.co.za', 'Election Campaign OS'],
    ['ward-licence', 'R1,800 per ward licence', 'Election Campaign OS'],
  ];
  for (const [slug, a, b] of lts) await shot(lowerThird(a, b), path.join(OUT, `video/lower-third-${slug}.png`), 1920, 1080, true);
  writeFileSync(path.join(OUT, 'dual-funnel.html'), funnelPage());
  const fp = await browser.newPage({ viewport: { width: 1000, height: 560 } });
  await load(fp, funnelPage());
  await fp.screenshot({ path: path.join(OUT, 'dual-funnel.png') });
  await browser.close();
  writeFileSync(path.join(OUT, 'README.md'), readFileSync(path.join(ROOT, 'scripts/build-marketing.ts'), 'utf8').split('*/')[0].replace('/**', '').replace(/^ \* ?/gm, ''));
}
main();
