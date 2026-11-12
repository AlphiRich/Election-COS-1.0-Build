/**
 * Election Campaign OS — 15 s vertical explainer ("V1 Shot List, Voice-Over and SRT"), rendered from the spec.
 *   npx vite-node scripts/build-explainer-video.ts [--ai-voice]
 * Output: marketing/video/explainer-15s/  (mp4, srt, post copy, alt text, voice-over brief, shot list, poster frame, QA.json)
 *
 * What is NOT here, as the spec says: voice-over audio. The mp4 has no audio stream, so the "Contains AI-generated voice"
 * line is left OUT of the strip (it would be false); pass --ai-voice once a synthetic voice track is laid over it.
 * The headline "139 of 213" is the spec's figure. It matches this build's national seat table (src/data/lge2026/national/seats-2026.json,
 * `hung` flag, 12 Nov 2026): 208 councils reconciled to the Commission's reports, five not fully confirmed; see HEADLINE.
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tokens } from '../src/design/tokens';
import { SITE } from '../src/site/siteContent';

const { chromium } = createRequire(import.meta.url)('playwright') as typeof import('playwright');
const C = tokens.color;
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'marketing/video/explainer-15s');
const AI_VOICE = process.argv.includes('--ai-voice');

/** The spec's headline figure. Change here and the video, SRT, post copy and alt text all follow. Checked against the national seat table, 12 Nov 2026. */
const HEADLINE = { noMajority: 139, councils: 213, asAt: '10 Nov 2026' };
const URL_SHORT = 'electioncos.co.za';
const URL_TOOL = `${URL_SHORT}/tools/your-council`;
const W = 1080, H = 1920, FPS = 30, DURATION = 15;

const SRT: Array<[number, number, string[]]> = [
  [0, 3, ['After the 2026 elections…']],
  [3, 7, [`${HEADLINE.noMajority} of ${HEADLINE.councils} councils`, 'have no majority.']],
  [7, 11, ['Councillors must now agree', 'who governs.']],
  [11, 15, ['See your council at', URL_SHORT]],
];
const ts = (s: number) => `00:00:${String(Math.floor(s)).padStart(2, '0')},000`;
const srt = SRT.map(([a, b, l], i) => `${i + 1}\n${ts(a)} --> ${ts(b)}\n${l.join('\n')}\n`).join('\n');

const STRIP =
  `Election-COS is an independent, non-partisan service of ${SITE.entity} (${SITE.registration}). Not affiliated with the Electoral Commission of South Africa (IEC), any political party or any candidate. ` +
  `Figures: Electoral Commission certified results, LGE 2026, as at ${HEADLINE.asAt}; calculated by Election-COS, not official declarations. Coalition scenarios are what-if arithmetic, not forecasts. We do not sell personal information (POPIA).` +
  (AI_VOICE ? ' Contains AI-generated voice; people shown are not real.' : '');

const POST_COPY =
  `${HEADLINE.noMajority} of ${HEADLINE.councils} contested councils have no majority. See who could govern yours: ${URL_TOOL}. ` +
  `Election-COS is an independent, non-partisan service of ${SITE.entity} (${SITE.registration}). Not affiliated with the Electoral Commission of South Africa (IEC), any political party or any candidate. ` +
  `Results are drawn from the IEC's certified public reports; seat, coalition and councillor figures are calculated from them and are not official declarations. We do not sell personal information (POPIA). ${URL_SHORT} ` +
  `Figures: Electoral Commission certified results, LGE 2026, as at ${HEADLINE.asAt}; calculated by Election-COS. Coalition scenarios are what-if arithmetic, not forecasts.` +
  (AI_VOICE ? ' Contains AI-generated voice; people shown are not real.' : '');
const ALT = `Vertical explainer: ${HEADLINE.noMajority} of ${HEADLINE.councils} councils have no majority after the 2026 local elections.`;

const SHOTS: Array<[string, string, string, string]> = [
  ['1', '0 to 3 s', 'After the 2026 Elections…', '"After the 2026 elections…"'],
  ['2', '3 to 7 s', `${HEADLINE.noMajority} of ${HEADLINE.councils} · Councils Have No Majority · bar · qualifier and source`, `"One hundred and thirty-nine of two hundred and thirteen councils have no majority."`],
  ['3', '7 to 11 s', 'Councillors Must Now Agree Who Governs', '"Councillors must now agree who governs."'],
  ['4', '11 to 12 s', 'See Your Council · Find Your Council button · URL', '"See your council at electioncos dot co dot zed-A."'],
  ['End', '12 to 15 s', 'Mark, Election-COS, Who Governs Your Council?, URL', 'Line 4 finishes (about 14.2 s), then silence.'],
];

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const FONT = (f: string) => `file://${ROOT}/public/fonts/${f}`;
const page = (logo: string) => `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:'Public Sans';font-weight:400;src:url(${FONT('public-sans-400-normal-latin.woff2')})}
@font-face{font-family:'Public Sans';font-weight:700;src:url(${FONT('public-sans-700-normal-latin.woff2')})}
@font-face{font-family:'Archivo Narrow';font-weight:700;src:url(${FONT('archivo-narrow-700-normal-latin.woff2')})}
@font-face{font-family:'IBM Plex Mono';font-weight:500;src:url(${FONT('ibm-plex-mono-500-normal-latin.woff2')})}
*{box-sizing:border-box;margin:0}body{width:${W}px;height:${H}px;background:${C.paper};color:${C.ink};font-family:'Public Sans';position:relative;overflow:hidden}
.s{position:absolute;left:80px;right:80px;display:none}
.h{font:700 112px/1.02 'Archivo Narrow';letter-spacing:-.01em}
#s1{top:640px}#s2{top:330px}#s3{top:290px}#s4{top:430px}#end{top:330px;text-align:center}
.big{font:700 215px/0.95 'Archivo Narrow';letter-spacing:-.02em;white-space:nowrap}.lab{font:700 96px/1.04 'Archivo Narrow';margin-top:14px}
.bar{margin-top:56px;height:52px;background:${C.line};border-radius:8px;overflow:hidden}.bar i{display:block;height:100%;background:${C.ink};width:0}
.q{margin-top:34px;font:400 30px/1.4 'Public Sans';color:${C.slate}}
.btn{display:inline-block;margin-top:70px;background:${C.teal};color:${C.paper};font:700 58px 'Public Sans';padding:40px 72px;border-radius:16px}
.url{margin-top:56px;font:500 56px 'IBM Plex Mono'}
.node{position:absolute;width:150px;height:150px;border-radius:50%;background:${C.ink}}
#nodes{position:relative;height:480px;margin-top:60px}svg line{stroke:${C.ink};stroke-width:10;stroke-linecap:round}
#logo{opacity:0;margin-top:70px}#logo img{width:230px;height:230px;border-radius:44px;display:block;margin:0 auto}#logo b{display:block;margin-top:26px;font:700 76px 'Archivo Narrow';letter-spacing:.06em;text-transform:uppercase}#logo b em{font-style:normal;color:${C.gold}}
#cap{position:absolute;left:60px;right:60px;top:1290px;display:none;text-align:center}
#cap span{display:inline-block;background:${C.ink};color:${C.paper};font:700 54px/1.25 'Public Sans';padding:18px 34px;border-radius:14px}
#strip{position:absolute;left:0;right:0;top:1470px;height:290px;background:${C.ink};color:${C.paper};padding:24px 60px;font:400 25px/1.34 'Public Sans';overflow:hidden}
</style><body>
<div class=s id=s1><div class=h id=s1t>After the 2026 Elections…</div></div>
<div class=s id=s2><div class=big>${HEADLINE.noMajority} of ${HEADLINE.councils}</div><div class=lab>Councils Have No Majority</div><div class=bar><i id=fill></i></div>
<div class=q>Contested councils, LGE 2026. Electoral Commission certified results, as at ${HEADLINE.asAt}; calculated by Election-COS.</div></div>
<div class=s id=s3><div class=h>Councillors Must Now Agree Who Governs</div><div id=nodes>
<svg width=920 height=480 style="position:absolute;left:0;top:0"><line id=l1 x1=460 y1=95 x2=170 y2=395 /><line id=l2 x1=460 y1=95 x2=750 y2=395 /><line id=l3 x1=245 y1=395 x2=675 y2=395 /></svg>
<div class=node style="left:385px;top:20px"></div><div class=node style="left:95px;top:320px"></div><div class=node style="left:675px;top:320px"></div></div></div>
<div class=s id=s4><div class=h>See Your Council</div><div id=btn class=btn>Find Your Council</div><div class=url>${URL_SHORT}</div></div>
<div class=s id=end><div class=h>Who Governs Your Council?</div><div class=url>${URL_SHORT}</div><div id=logo><img src="${logo}" alt=""><b>Election-<em>COS</em></b></div></div>
<div id=cap><span id=capt></span></div>
<div id=strip>${STRIP}</div>
<script>
const CAPS=${JSON.stringify(SRT)};
const L=(id,len)=>{const e=document.getElementById(id);e.style.strokeDasharray=len;return e};
window.setT=function(t){
  const show=(id,on)=>document.getElementById(id).style.display=on?'block':'none';
  show('s1',t<3);show('s2',t>=3&&t<7);show('s3',t>=7&&t<11);show('s4',t>=11&&t<12);show('end',t>=12);
  const k=Math.min(1,t/0.22),e=1-Math.pow(1-k,3);const a=document.getElementById('s1t');a.style.transform='translateY('+(60*(1-e))+'px)';a.style.opacity=e;
  const g=Math.max(0,Math.min(1,(t-3)/0.6));document.getElementById('fill').style.width=(g*${(HEADLINE.noMajority / HEADLINE.councils) * 100})+'%';
  const n=Math.max(0,Math.min(1,(t-7)/0.25));[['l1',500],['l2',500],['l3',500]].forEach(([id,len])=>{const l=L(id,len);l.style.strokeDashoffset=len*(1-n)});
  const b=Math.max(0,Math.min(1,(t-11)/0.2)),be=1-Math.pow(1-b,3);const bt=document.getElementById('btn');bt.style.transform='translateX('+(120*(1-be))+'px)';bt.style.opacity=be;
  const r=Math.max(0,Math.min(1,(t-13)/0.3));document.getElementById('logo').style.opacity=r;
  const c=CAPS.find(x=>t>=x[0]&&t<x[1]);const cap=document.getElementById('cap');cap.style.display=c?'block':'none';if(c)document.getElementById('capt').innerHTML=c[2].join('<br>');
};
</script></body>`;

async function main() {
  mkdirSync(OUT, { recursive: true });
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'ecos-vid-'));
  const html = path.join(tmp, 'p.html');
  writeFileSync(html, page(`file://${ROOT}/public/icon-512.png`));
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await pg.goto(`file://${html}`, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  const frames = DURATION * FPS;
  for (let i = 0; i < frames; i++) {
    await pg.evaluate((t) => (window as unknown as { setT: (t: number) => void }).setT(t), i / FPS);
    await pg.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, '0')}.png`) });
  }
  await pg.evaluate((t) => (window as unknown as { setT: (t: number) => void }).setT(t), 5);
  await pg.screenshot({ path: path.join(OUT, 'poster-frame.png') });
  await browser.close();

  const mp4 = path.join(OUT, 'ecos-explainer-15s-1080x1920.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an', '-movflags', '+faststart', '-metadata', `title=Election-COS: ${ALT}`, mp4]);
  rmSync(tmp, { recursive: true, force: true });

  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate,nb_frames,codec_type:format=duration,size', '-of', 'json', mp4]).toString());
  const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  const qa = {
    file: path.basename(mp4), codec: v.codec_name, width: v.width, height: v.height, fps: v.r_frame_rate, frames: Number(v.nb_frames),
    durationS: Number(probe.format.duration), bytes: Number(probe.format.size), audioStreams: probe.streams.filter((s: { codec_type: string }) => s.codec_type === 'audio').length,
    checks: {
      '1080x1920': v.width === 1080 && v.height === 1920, '30fps': v.r_frame_rate === '30/1', 'h264': v.codec_name === 'h264',
      'duration 15 s': Math.abs(Number(probe.format.duration) - 15) < 0.05, 'under 8 MB': Number(probe.format.size) < 8 * 1024 * 1024,
    },
    contrast: {
      'ink on paper (headlines)': +contrast(C.ink, C.paper).toFixed(2), 'paper on ink (captions, strip)': +contrast(C.paper, C.ink).toFixed(2),
      'paper on blue (button)': +contrast(C.paper, C.teal).toFixed(2), 'slate on paper (qualifier)': +contrast(C.slate, C.paper).toFixed(2),
    },
    notMeasured: ['The "4.125 pt" size check in the spec: its rule is not stated in the document, so it was not measured.', 'Voice-over: not produced (spec: audio is recorded separately).'],
    verified: [`"${HEADLINE.noMajority} of ${HEADLINE.councils}" matches this build's national seat table (hung flag, and an independent count with no disagreement). 208 of the 213 councils are reconciled to the Commission's Seat Calculation reports; five are not fully confirmed (Mnquma not published, King Sabata Dalindyebo incomplete, Matjhabeng, Ray Nkonyeni and Msunduzi count not finished) and all five are counted as no majority, so 134 of the 208 reconciled councils have none. A person should confirm against the Commission's own figures before publishing.`],
    aiVoiceLineInStrip: AI_VOICE,
  };
  writeFileSync(path.join(OUT, 'QA.json'), JSON.stringify(qa, null, 2));
  writeFileSync(path.join(OUT, 'ecos-explainer-15s.srt'), srt);
  writeFileSync(path.join(OUT, 'post-copy.txt'), POST_COPY + '\n');
  writeFileSync(path.join(OUT, 'alt-text.txt'), ALT + '\n');
  writeFileSync(path.join(OUT, 'shot-list.md'), `# 15 s vertical explainer: shot list\n\n1080x1920, 30 fps, H.264, under 8 MB. Captions burned in above the disclaimer strip. No autoplaying sound on feeds.\n\n| Shot | Time | On-screen text | Voice-over (SA English) |\n|---|---|---|---|\n${SHOTS.map((s) => `| ${s.join(' | ')} |`).join('\n')}\n`);
  writeFileSync(path.join(OUT, 'voice-over-brief.md'), `# Voice-over direction\n\n- South African English. Calm, clear, newsroom tone, about 150 words a minute. Never alarmist, never celebratory.\n- Never a sound-alike of a known presenter or politician.\n- Read the figure in full. Say "zed-A" for .za.\n- If the voice is synthetic, the AI-voice line goes back in the strip and the description (rebuild with --ai-voice). If a person records it, leave it out of every strip.\n- Music: licensed instrumental only, no party, struggle or rally songs, ducked to -18 LUFS under the voice. No autoplaying sound.\n- Voice-over audio is not produced here. This is the script and brief for the recording.\n\n## Script\n\n${SHOTS.map((s) => s[3]).join('\n')}\n`);
  console.log(JSON.stringify(qa.checks), qa.bytes, 'bytes');
}
main();
