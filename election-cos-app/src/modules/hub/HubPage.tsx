/**
 * Election Campaign OS — Master Command & Media Hub (/analytics/hub)
 *
 * The master application's six sections, built into the application: Strategy & Funnel, Media & Campaign Assets, the Agent
 * Code Stack, the Schedule 1 Seat Calculator, the Legal & Statutory Vault, and the DNS & Deployment Gate. Read hubData.ts
 * first: where the master stack's content could not be carried over as written, `CHANGES_FROM_MASTER` says what changed and why,
 * and the page shows that list.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, type Bar } from '@/modules/reference/BarChart';
import { SITE_DOMAIN } from '@/config/publicDomain';
import { HELD } from '@/site/promoVideos';
import { Button, Card, Field, PageHeader, Pill, SectionLabel, StatTile, Table, Td, Th } from '@/components/ui';
import whatsAppQr from '@/site/assets/whatsapp-qr.svg';
import { SITE } from '@/site/siteContent';
import { REGISTER_ENTRIES } from '@/modules/reference/municipalRegister';
import { buildGroundIntelligence, groundIntelligenceHtml } from '@/modules/analytics/groundIntelligence';
import { baseline2026 } from '@/modules/analytics/baselines';
import { turnoutChange } from '@/modules/analytics/swing2021to2026';
import { councilHolders, seatInput, wardOutcomes, partyLabel } from '@/modules/lge2026/lge2026Results';
import {
  CANVA_PROMPT, CHANGES_FROM_MASTER, CHANNELS, DISCIPLINE, DNS_OBSERVED, DNS_SPECIFIED, FUNNEL, LEGAL_DOCS,
  ROADMAP, SCRIPTS, TIERS, VOICE_PROFILE, type AssetCategory,
} from './hubData';
import { HUB_AGENTS } from './hubAgents';
import {
  PROMPTER_STEP_MS, agentState, agentSummary, clock, disciplineSummary, evaluateFunding, filterAssets, outboxRun,
  promptedBlock, quotaFor, searchAgents,
} from './hubLogic';

const TABS = [
  ['strategy', 'Strategy & Funnel'],
  ['assets', 'Media & Campaign Assets'],
  ['tech', '32-Agent Code Stack'],
  ['quota', 'Schedule 1 Seat Calculator'],
  ['legal', 'Legal & Statutory Vault'],
  ['dns', 'DNS & Deployment Gate'],
] as const;
type Tab = (typeof TABS)[number][0];
const n = (v: number) => v.toLocaleString('en-ZA');

/* ------------------------------------------------------------------------------------------- strategy */
function Strategy() {
  const [view, setView] = useState<'bofu' | 'tofu'>('bofu');
  const f = FUNNEL[view];
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 1: Dual-Funnel Marketing and Audience Targeting</SectionLabel>
        <p className="text-body-md font-body mt-1">
          Behavioural micro-targeting for political campaigns is restricted on the major ad networks, so ECOS relies on contextual placement,
          intent-based search queries and geotargeted campaign hubs. Toggle between the 2026 bottom-of-funnel tactical engine and the 2029
          top-of-funnel institutional builder.
        </p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionLabel as="h3">Select Campaign Funnel</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Campaign Funnel">
            {(['bofu', 'tofu'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                onClick={() => setView(k)}
                className={`min-h-11 rounded border p-3 text-left text-body-md font-body ${view === k ? 'border-gold bg-gold/10 text-ink' : 'border-ink/20 text-slate'}`}
              >
                <strong className="block">{k === 'bofu' ? '2026 BOFU' : '2029 TOFU'}</strong>
                <span className="text-caption">{k === 'bofu' ? 'Urgency campaign' : 'Institutional strategy'}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-body-md font-body" aria-live="polite">
            <p className="text-label-caps font-display uppercase">{f.title}</p>
            <p className="text-headline-md font-display">{f.headline}</p>
            <p><strong>Target:</strong> {f.target}</p>
            <p><strong>Offer:</strong> {f.offer}</p>
            <p><strong>Channel:</strong> {f.channel}</p>
            <p><strong>KPI:</strong> {f.kpi}</p>
            <p className="italic">“{f.copy}”</p>
          </div>
        </Card>
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <SectionLabel as="h3">Channel Cost per Acquisition: Planning Targets</SectionLabel>
            <BarChart
              title="Target Cost per Acquisition (R)"
              bars={CHANNELS.map<Bar>((c) => ({ label: c.label, value: c.cpaTarget, shown: `R${n(c.cpaTarget)}` }))}
              orientation="row"
              valueLabel="Target CPA (R)"
              caption="Planning targets by channel. No campaign has run, so these are not measured results."
            />
          </Card>
          <Card>
            <SectionLabel as="h3">Channel Conversion Rate: Planning Assumptions</SectionLabel>
            <BarChart
              title="Assumed Conversion Rate (%)"
              bars={CHANNELS.map<Bar>((c) => ({ label: c.label, value: c.conversionAssumption, shown: `${c.conversionAssumption}%` }))}
              orientation="row"
              valueLabel="Assumed conversion (%)"
              caption="Assumptions to test, shown on their own axis rather than against cost."
            />
            <p className="text-body-md font-body mt-2">
              <strong>Reading it:</strong> high-intent search is planned to give the lowest cost per acquisition for ward licences, while demand
              generation and LinkedIn build pipeline for party-wide deployment. Replace these with measured figures once campaigns have run.
            </p>
          </Card>
        </div>
      </div>
      <Card>
        <SectionLabel as="h3">Phased Implementation Roadmap</SectionLabel>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {ROADMAP.map((r) => (
            <div key={r.phase} className="rounded border-l-4 border-gold bg-paper p-3 space-y-1">
              <p className="text-data-mono font-mono text-roadmap">{r.phase}</p>
              <p className="text-body-md font-body font-semibold">{r.title}</p>
              <p className="text-body-md font-body">{r.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- assets */
function AssetPreview({ id, dims }: { id: number; dims: string }) {
  if (id === 1)
    return (
      <div className="aspect-square bg-paper p-4 flex flex-col items-center justify-center text-center">
        <p className="text-caption font-mono text-slate">1080x1080 (FB/IG)</p>
        <p className="text-headline-md font-display text-ink">Manage your ward legally.<br /><span className="text-roadmap">R1,800/ward.</span></p>
        <span className="mt-3 rounded bg-gold px-4 py-2 text-label-caps font-display uppercase text-ink">Start Free Trial</span>
      </div>
    );
  if (id === 2)
    return (
      <div className="aspect-video bg-ink p-4 flex flex-col items-start justify-center">
        <p className="text-caption font-mono text-paper/70">16:9 (LinkedIn/Desktop)</p>
        <p className="text-body-lg font-display text-paper">Are you prepared for the 2029 campaign?</p>
        <p className="text-caption font-mono text-paper/70">Enterprise data intelligence.</p>
        <span className="mt-3 rounded bg-teal px-4 py-2 text-label-caps font-display uppercase text-paper">Request Demo</span>
      </div>
    );
  if (id === 4)
    return (
      <div className="aspect-[3/4] bg-ink p-4 flex flex-col items-center justify-between text-center">
        <p className="self-end text-caption font-mono text-gold">A3 POSTER</p>
        <p className="text-headline-md font-display uppercase text-paper">Take the <span className="text-gold">War Room</span> to the Streets.</p>
        <div className="rounded-lg border-[3px] border-gold bg-paper p-1.5">
          <img src={whatsAppQr} alt={`QR code for WhatsApp ${SITE.whatsApp.display}, the ${SITE.whatsApp.role.toLowerCase()}`} width={96} height={96} />
        </div>
        <p className="text-caption font-mono text-paper">{SITE.whatsApp.role}: WhatsApp {SITE.whatsApp.display}</p>
      </div>
    );
  return (
    <div className="aspect-video bg-ink/5 p-4 flex items-center justify-center">
      <span className="text-data-mono font-mono text-slate">{dims}</span>
    </div>
  );
}

function Teleprompter() {
  const [scriptId, setScriptId] = useState<'30s' | '15s'>('30s');
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const script = SCRIPTS[scriptId];
  const lit = active ? promptedBlock(scriptId, elapsed) : null;
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed((e) => e + 250), 250);
    return () => clearInterval(t);
  }, [active]);
  useEffect(() => {
    if (active && promptedBlock(scriptId, elapsed) === null) setActive(false);
  }, [active, elapsed, scriptId]);
  useEffect(() => {
    if (lit !== null) refs.current[lit]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }, [lit]);
  const start = () => { setElapsed(0); setActive(true); };
  return (
    <Card>
      <SectionLabel as="h3">Interactive Promo Script Teleprompter</SectionLabel>
      <p className="text-body-md font-body text-slate">Simulates voice-over pacing and visual cut timing: a block lights every {PROMPTER_STEP_MS / 1000} seconds.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Field label="Script">
          {(props) => (
            <select {...props} value={scriptId} onChange={(e) => { setActive(false); setElapsed(0); setScriptId(e.target.value as '30s' | '15s'); }}>
              {(Object.keys(SCRIPTS) as Array<'30s' | '15s'>).map((k) => <option key={k} value={k}>{SCRIPTS[k].label}</option>)}
            </select>
          )}
        </Field>
        <Button onClick={active ? () => setActive(false) : start}>{active ? 'Stop' : 'Play simulation'}</Button>
      </div>
      <div className="mt-3 max-h-56 space-y-3 overflow-y-auto rounded bg-ink p-4 text-paper" aria-label="Teleprompter">
        {script.blocks.map((b, i) => (
          <div key={b.time} ref={(el) => { refs.current[i] = el; }} className={lit === i ? 'opacity-100' : 'opacity-50'} data-lit={lit === i}>
            <p className="text-data-mono font-mono text-gold">[{b.time}] VISUAL: {b.visual}</p>
            <p className="text-body-md font-body">{b.audio}</p>
          </div>
        ))}
      </div>
      <p className="text-data-mono font-mono text-slate mt-2" role="status">
        Status: {active ? 'Recording' : 'Stopped'} · {clock(elapsed)} / {clock(script.seconds * 1000)}
      </p>
    </Card>
  );
}

function Assets() {
  const [cat, setCat] = useState<AssetCategory | 'all'>('all');
  const [copied, setCopied] = useState(false);
  const [newsletter, setNewsletter] = useState<string | null>(null);
  const copy = async () => {
    try { await navigator.clipboard?.writeText(CANVA_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  };
  const makeNewsletter = () =>
    setNewsletter(groundIntelligenceHtml(buildGroundIntelligence([], new Date().toISOString().slice(0, 7), new Date())));
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 2: Marketing Collateral Manifest, Voice Profile and Video Teleprompter</SectionLabel>
        <p className="text-body-md font-body mt-1">Assets follow the Paper and Ink design protocol: high contrast, and an authoritative South African voice profile.</p>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel as="h3">Asset Manifest Catalogue</SectionLabel>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Asset Category">
            {([['all', 'All assets'], ['digital', 'Digital banners'], ['print', 'Print collateral'], ['video', 'Video & audio']] as const).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={cat === k} onClick={() => setCat(k)} className={`min-h-11 rounded border px-3 text-body-md font-body ${cat === k ? 'border-ink bg-ink text-paper' : 'border-ink/20'}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3" data-testid="asset-grid">
          {filterAssets(cat).map((a) => (
            <div key={a.id} className="overflow-hidden rounded border border-ink/10 bg-white">
              <AssetPreview id={a.id} dims={a.dims} />
              <div className="p-3 space-y-1">
                <p className="text-label-caps font-display uppercase text-slate">{a.category}</p>
                <p className="text-body-md font-body font-semibold">{a.name}</p>
                <p className="text-body-md font-body">{a.copy}</p>
                <p className="text-data-mono font-mono text-teal uppercase">{a.cta}</p>
                {a.built ? (
                  <div className="mt-2 border-t border-ink/10 pt-2">
                    <p className="text-label-caps font-display uppercase text-green">Built</p>
                    <ul className="list-none p-0">
                      {a.built.files.map((f) => (
                        <li key={f} className="break-all text-caption font-mono text-slate">{f}</li>
                      ))}
                    </ul>
                    {a.built.flag && <p className="mt-1 text-caption font-body text-maroon">{a.built.flag}</p>}
                    {a.watch && (
                      <p className="mt-1 text-caption font-body">
                        <a href={`https://www.${SITE_DOMAIN}${a.watch}`} target="_blank" rel="noopener noreferrer" className="text-teal underline">Watch on the public site</a>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 border-t border-ink/10 pt-2 text-label-caps font-display uppercase text-roadmap">Not built</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <details className="mt-3 rounded border border-ink/10 bg-paper p-3">
          <summary className="cursor-pointer text-label-caps font-display uppercase text-roadmap">Videos supplied but held back ({HELD.length})</summary>
          <ul className="mt-2 list-none space-y-1 p-0">
            {HELD.map((h) => (
              <li key={h.file} className="text-caption font-body"><span className="font-mono text-slate">{h.file}</span>: {h.reason}</li>
            ))}
          </ul>
        </details>
        <p className="text-caption font-body text-slate mt-2">Copy is draft. It is to be held to the claims list (docs: must-not-claim) and checked by a person before it runs.</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionLabel as="h3">South African VO Talent Profile</SectionLabel>
          <dl className="mt-2 space-y-2 text-body-md font-body">
            {VOICE_PROFILE.map(([k, v]) => (<div key={k}><dt className="text-label-caps font-display uppercase text-slate">{k}</dt><dd>{v}</dd></div>))}
          </dl>
          <div className="mt-3 rounded bg-paper p-3">
            <p className="text-label-caps font-display uppercase text-roadmap">Canva AI Magic prompt generator</p>
            <Button className="mt-2 w-full" onClick={copy}>Copy Canva Prompt</Button>
            {copied && <p role="status" className="text-caption font-body text-green mt-1 font-bold">Copied to clipboard</p>}
          </div>
        </Card>
        <div className="lg:col-span-2"><Teleprompter /></div>
      </div>
      <Card>
        <SectionLabel as="h3">Daily Ground Intelligence (Lead Magnet)</SectionLabel>
        <p className="text-body-md font-body mt-1">
          The newsletter generated in the browser from the field&rsquo;s logged signals, with small groups suppressed, the Item 12 explainer, the
          Commission&rsquo;s registration notice and the compliance notice. Nothing is sent.
        </p>
        <div className="mt-2"><Button onClick={makeNewsletter}>Generate Preview</Button></div>
        {newsletter && (
          <>
            <iframe title="Daily Ground Intelligence Preview" sandbox="" srcDoc={newsletter} className="mt-3 h-96 w-full rounded border border-ink/10 bg-white" />
            <a className="mt-2 inline-block min-h-11 underline" download="daily-ground-intelligence.html" href={`data:text/html;charset=utf-8,${encodeURIComponent(newsletter)}`}>Download the HTML file</a>
          </>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- tech */
const STATE_LABEL = { built: 'Built', partial: 'Partial', 'not-built': 'Not built', 'by-design': 'By design', 'not-applicable': 'Not applicable', 'held-back': 'Held back' } as const;

function Tech() {
  const [term, setTerm] = useState('');
  const agents = useMemo(() => searchAgents(term), [term]);
  const sum = agentSummary();
  const [log, setLog] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const simulate = () => {
    if (running) return;
    setRunning(true); setLog(['Initialising the IndexedDB sync worker.']); setCurrent(null);
    outboxRun().forEach((s, i) => {
      timers.current.push(setTimeout(() => {
        setCurrent(s.status); setLog((l) => [...l, `${s.status}: ${s.line}`]);
        if (i === 2) setRunning(false);
      }, i * 800));
    });
  };
  const STATES = [['PENDING', 'Queued in IndexedDB'], ['IN_FLIGHT', 'Transmitting'], ['APPLIED', 'Accepted by the server'], ['CONFLICT', 'Two edits clashed; a person decides'], ['REJECTED', 'Refused, with a reason'], ['DISCARDED', 'Dropped by a named person']] as const;
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 3: Topology, 32 Bounded Responsibilities and the Offline Engine</SectionLabel>
        <p className="text-body-md font-body mt-1">
          The master stack describes four tiers on AWS. This build runs on Firebase and a Cloudflare edge worker, so each tier below says what
          is actually there. Of the 32 named responsibilities, {sum.built} are built, {sum.partial} partly, {sum['not-built']} not built,{' '}
          {sum['by-design']} replaced by design, {sum['held-back']} held back and {sum['not-applicable']} not applicable.
        </p>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => (
          <Card key={t.tier}>
            <p className="text-data-mono font-mono text-teal">{t.tier} · {t.agents}</p>
            <p className="text-body-md font-body font-semibold mt-1">{t.what}</p>
            <p className="text-body-md font-body mt-1">{t.body}</p>
          </Card>
        ))}
      </div>
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionLabel as="h3">Catalogue of 32 Bounded Responsibilities</SectionLabel>
          <Field label="Search Agents (For Example POPIA, Quota, Sync)">
            {(props) => <input {...props} type="search" value={term} onChange={(e) => setTerm(e.target.value)} />}
          </Field>
        </div>
        <p className="text-body-md font-body mt-2" role="status">{agents.length} of 32 shown.</p>
        <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="agent-grid">
          {agents.map((a) => (
            <div key={a.id} className="rounded border border-ink/10 bg-paper p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-data-mono font-mono font-bold">AGENT_{a.id}</span>
                <Pill>{STATE_LABEL[agentState(a)]}</Pill>
              </div>
              <p className="text-body-md font-body font-semibold">{a.name}</p>
              <p className="text-caption font-body text-slate">{a.tier}</p>
              <p className="text-body-md font-body">{a.desc}</p>
              <p className="text-caption font-body border-t border-ink/10 pt-1"><strong>In this build:</strong> {a.build.replace(/[`*]/g, '')}</p>
              <p className="text-caption font-body text-slate"><strong>Status:</strong> {a.status}</p>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <SectionLabel as="h3">Client Offline Outbox State Machine</SectionLabel>
            <p className="text-body-md font-body text-slate">Runs the real transitions from <span className="font-mono">src/offline/outboxStatus.ts</span>, from the phone&rsquo;s local store to accepted.</p>
          </div>
          <Button onClick={simulate} disabled={running}>Simulate Field Canvass Sync</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STATES.map(([s, d], i) => (
            <div key={s} data-state={s} data-active={current === s} className={`rounded border p-3 text-center ${current === s ? 'border-2 border-gold bg-gold/10' : 'border-ink/20 opacity-70'}`}>
              <p className="text-data-mono font-mono text-slate">STATE 0{i + 1}</p>
              <p className="text-body-md font-body font-semibold">{s}</p>
              <p className="text-caption font-body">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded bg-ink p-3 text-paper font-mono text-data-mono" aria-live="polite" data-testid="outbox-log">
          {log.length === 0 ? '> Idle. Press the button to run a doorstep record through the outbox.' : log.map((l, i) => <div key={i}>&gt; {l}</div>)}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- quota */
function Quota() {
  const base = useMemo(() => baseline2026('NW405'), []);
  const input = useMemo(() => seatInput('NW405'), []);
  const [a, setA] = useState(input.totalValidVotes);
  const [c, setC] = useState(0);
  const [d, setD] = useState(0);
  const b = base.totalSeats;
  const q = quotaFor(a, b, c, d);
  const holders = useMemo(() => councilHolders('NW405'), []);
  const closest = useMemo(() => wardOutcomes('NW405').sort((x, y) => x.margin - y.margin).slice(0, 5), []);
  const t = turnoutChange();
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 4: Statutory Seat Allocation Quota Engine</SectionLabel>
        <p className="text-body-md font-body mt-1">
          Schedule 1 (Items 12 and 13) of the Municipal Structures Act: the quota is Q = floor(A / (B - C - D)) + 1. Here it starts from the
          certified 2026 result for JB Marks, which the Commission&rsquo;s own seat calculation confirms (quota 2,069, ANC 22, DA 21, VF+ 6).
        </p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionLabel as="h3">NW405 Quota Controls · Item 12 Engine</SectionLabel>
          <div className="space-y-3 mt-2">
            <Field label={`Total valid votes cast (A): ${n(a)}`}>
              {(props) => <input {...props} type="range" min={60000} max={160000} step={500} value={a} onChange={(e) => setA(Number(e.target.value))} />}
            </Field>
            <p className="text-body-md font-body"><strong>Total council seats (B):</strong> {b} (34 ward, 33 list, fixed by the delimitation)</p>
            <Field label={`Independent ward winners (C): ${c}`}>
              {(props) => <input {...props} type="range" min={0} max={5} step={1} value={c} onChange={(e) => setC(Number(e.target.value))} />}
            </Field>
            <Field label={`Ward seats won by parties with no PR list (D): ${d}`}>
              {(props) => <input {...props} type="range" min={0} max={3} step={1} value={d} onChange={(e) => setD(Number(e.target.value))} />}
            </Field>
          </div>
          <div className="mt-3 rounded border border-gold/40 bg-paper p-3">
            <p className="text-label-caps font-display uppercase text-slate">Calculated council seat quota (Q)</p>
            <p className="text-display-lg-mobile font-display" data-testid="quota-result">{q === null ? 'ERR' : n(q)}</p>
            <p className="text-data-mono font-mono text-slate">Formula: floor({a} / ({b} - {c} - {d})) + 1</p>
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <SectionLabel as="h3">Council Seats, JB Marks 2026 (Schedule 1)</SectionLabel>
          <BarChart
            title="Council Seats by Party, JB Marks 2026"
            bars={holders.slice(0, 8).map<Bar>((h) => ({ label: h.name, value: h.seats, shown: String(h.seats), detail: `${h.wardSeats} ward seats` }))}
            orientation="row"
            valueLabel="Seats"
            caption="Seats after Schedule 1, from the Commission's 4 November 2026 result. The first eight holders."
          />
          <Table caption="Ward and list seats by party.">
            <thead><tr><Th>Party</Th><Th numeric>Ward</Th><Th numeric>List</Th><Th numeric>Seats</Th></tr></thead>
            <tbody>
              {holders.slice(0, 8).map((h) => (<tr key={h.id}><Td>{h.name}</Td><Td numeric>{h.wardSeats}</Td><Td numeric>{h.seats - h.wardSeats}</Td><Td numeric>{h.seats}</Td></tr>))}
            </tbody>
          </Table>
          <p className="text-caption font-body text-slate mt-2">Item 13: each party&rsquo;s votes are divided by Q; surplus seats go to the highest remainders; ward seats are deducted to leave list seats.</p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionLabel as="h3">Voter Turnout, JB Marks: 2021 and 2026</SectionLabel>
          <BarChart
            title="Valid PR Votes as a Share of Registered Voters"
            bars={[
              { label: '2021 Local Government Election', value: (t.prValid2021 / t.registered2021) * 100, shown: `${((t.prValid2021 / t.registered2021) * 100).toFixed(1)}%` },
              { label: '2026 Local Government Election', value: (t.prValid2026 / t.registered2026) * 100, shown: `${((t.prValid2026 / t.registered2026) * 100).toFixed(1)}%` },
            ]}
            orientation="column"
            valueLabel="Share of registered (%)"
            caption="Valid PR-ballot votes divided by the registered voters the Commission lists for that election."
          />
          <p className="text-caption font-body text-slate mt-2">Two elections are all this build holds for JB Marks. No turnout is forecast.</p>
        </Card>
        <Card>
          <SectionLabel as="h3">Wards Closest to Changing Hands, 2026</SectionLabel>
          <BarChart
            title="Margin Between First and Second, in Points"
            bars={closest.map<Bar>((w) => ({ label: `Ward ${w.wardNumber}`, value: w.margin, shown: `${w.margin.toFixed(1)}`, detail: `${partyLabel(w.winner)} over ${w.runnerUp ? partyLabel(w.runnerUp) : 'no one'}` }))}
            orientation="row"
            valueLabel="Margin (points)"
            caption="The five smallest ward margins in 2026. A margin is a fact about a certified result, not a probability of a change."
          />
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- legal */
function Legal() {
  const [doc, setDoc] = useState<(typeof LEGAL_DOCS)[number]['id']>('popia');
  const [donor, setDonor] = useState('Apex Holdings (Pty) Ltd');
  const [amount, setAmount] = useState(150_000);
  const d = LEGAL_DOCS.find((x) => x.id === doc)!;
  const f = evaluateFunding(amount);
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 5: Statutory Repository, Legal Briefs and Party Funding Aggregator</SectionLabel>
        <p className="text-body-md font-body mt-1">
          Briefs for POPIA, the Political Party Funding Act, PAIA and the Public Gatherings Act. No instrument here is a binding legal document:
          each shows its real status, and the drafting is for a qualified South African attorney.
        </p>
      </Card>
      <Card>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Legal Documents">
          {LEGAL_DOCS.map((x) => (
            <button key={x.id} role="tab" aria-selected={doc === x.id} type="button" onClick={() => setDoc(x.id)} className={`min-h-11 rounded border px-3 text-body-md font-body ${doc === x.id ? 'border-ink bg-ink text-paper' : 'border-ink/20'}`}>{x.button}</button>
          ))}
        </div>
        <div className="mt-3 rounded bg-paper p-4 space-y-2" role="tabpanel" aria-live="polite">
          <p className="text-body-md font-body font-semibold">{d.title}</p>
          <p className="text-body-md font-body">{d.text}</p>
          <p className="text-data-mono font-mono text-slate">Status: <strong>{d.status}</strong></p>
        </div>
      </Card>
      <Card>
        <SectionLabel as="h3">Political Party Funding Act: Donor Threshold Position</SectionLabel>
        <p className="text-body-md font-body text-slate">Lines from Government Gazette 53182 (under court challenge): warning rung R160,000, disclosure line R200,000, annual donor line R30,000,000. This reports a position, never that anything is lawful. How donations are added across a year is an open legal question; enter a total you have worked out.</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3 items-center">
          <div className="space-y-3">
            <Field label="Donor Name or Registration (Not Stored or Sent)">
              {(props) => <input {...props} type="text" value={donor} onChange={(e) => setDonor(e.target.value)} />}
            </Field>
            <Field label={`Simulated annual donation total: ${f.total}`}>
              {(props) => <input {...props} type="range" min={10_000} max={40_000_000} step={10_000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />}
            </Field>
          </div>
          <div className="lg:col-span-2 rounded bg-paper p-4 space-y-2" aria-live="polite">
            <p className="text-label-caps font-display uppercase text-slate">Position relative to the lines</p>
            <Pill>{f.label}</Pill>
            <p className="text-data-mono font-mono">{f.reference}</p>
            <p className="text-body-md font-body">{donor.trim() ? `${donor.trim()}: ` : ''}{f.description}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- dns */
function Dns() {
  const s = disciplineSummary();
  return (
    <div className="space-y-6">
      <Card>
        <SectionLabel as="h2">Section 6: DNS Topology and Build Discipline Gate</SectionLabel>
        <p className="text-body-md font-body mt-1">
          The master stack pins <span className="font-mono">app.electioncos.co.za</span> to Grey Cloud (DNS-only) so Firebase can renew its certificate directly. The table
          below sets that specification beside what was observed on 8 November 2026. Two rows differ; the page does not change DNS.
        </p>
      </Card>
      <Card>
        <SectionLabel as="h3">Authoritative DNS Zone: As Specified</SectionLabel>
        <Table caption="DNS records as the master stack specifies them.">
          <thead><tr><Th>Type</Th><Th>Host</Th><Th>Target</Th><Th>Cloudflare posture</Th><Th>Rationale</Th></tr></thead>
          <tbody>{DNS_SPECIFIED.map((r) => (<tr key={r.type + r.host}><Td>{r.type}</Td><Td>{r.host}</Td><Td>{r.value}</Td><Td>{r.posture}</Td><Td>{r.why}</Td></tr>))}</tbody>
        </Table>
      </Card>
      <Card>
        <SectionLabel as="h3">As observed, {DNS_OBSERVED.asOf}</SectionLabel>
        <p className="text-caption font-body text-slate">{DNS_OBSERVED.method}. A snapshot: this page cannot query DNS itself.</p>
        <Table caption="DNS records as observed.">
          <thead><tr><Th>Type</Th><Th>Host</Th><Th>Observed</Th><Th>Matches</Th><Th>Note</Th></tr></thead>
          <tbody>{DNS_OBSERVED.rows.map((r) => (<tr key={r.type}><Td>{r.type}</Td><Td>{r.host}</Td><Td>{r.value}</Td><Td>{r.matches ? 'Yes' : 'No'}</Td><Td>{r.note}</Td></tr>))}</tbody>
        </Table>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel as="h3">Build Discipline Checklist (Rules 1 to 13)</SectionLabel>
          <Pill>{s.enforced} enforced by a test or check · {s.partial} partial · {s.process} process rules</Pill>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3" data-testid="discipline-grid">
          {DISCIPLINE.map((r) => (
            <div key={r.id} className="rounded border-l-4 border-green bg-paper p-3 space-y-1">
              <p className="text-body-md font-body font-semibold">{r.id}. {r.name}</p>
              <p className="text-caption font-body">{r.desc}</p>
              <p className="text-caption font-body text-slate"><strong>{r.kind === 'enforced' ? 'Enforced:' : r.kind === 'partial' ? 'Partly enforced:' : 'Process rule:'}</strong> {r.evidence}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------- page */
export function HubPage() {
  const [tab, setTab] = useState<Tab>('strategy');
  const wards = REGISTER_ENTRIES.reduce((s, m) => s + (m.wards ?? 0), 0);
  const agents = agentSummary();
  const q2026 = quotaFor(seatInput('NW405').totalValidVotes, 67, 0, 0);
  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/hub" title="Master Command & Media Hub" description="Election Campaign OS: strategy, assets, the agent stack, the Schedule 1 calculator, the legal vault and the DNS gate." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatTile label="Target Wards" value={n(wards)} sub={`${REGISTER_ENTRIES.length} municipalities`} />
        <StatTile label="Ward Entry Fee" value="R1,800" sub="BOFU ward tier" />
        <StatTile label="Volunteer Cost" value="not set" sub="no activity-based schedule adopted" />
        <StatTile label="NW405 Quota, 2026" value={q2026 === null ? 'ERR' : n(q2026)} sub="valid votes per seat" />
        <StatTile label="Named Agents" value={HUB_AGENTS.length} sub={`${agents.built} built`} />
        <StatTile label="Legal Instruments" value={LEGAL_DOCS.length} sub="none published" />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hub Sections">
        {TABS.map(([k, label]) => (
          <button key={k} id={`tab-${k}`} role="tab" aria-selected={tab === k} aria-controls={`panel-${k}`} type="button" onClick={() => setTab(k)} className={`min-h-11 rounded border px-3 text-body-md font-body font-semibold ${tab === k ? 'border-gold bg-ink text-paper' : 'border-ink/20 text-slate'}`}>{label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'strategy' && <Strategy />}
        {tab === 'assets' && <Assets />}
        {tab === 'tech' && <Tech />}
        {tab === 'quota' && <Quota />}
        {tab === 'legal' && <Legal />}
        {tab === 'dns' && <Dns />}
      </div>
      <details className="rounded border border-ink/10 bg-white p-4">
        <summary className="cursor-pointer text-body-md font-body font-semibold">What was changed from the master stack, and why ({CHANGES_FROM_MASTER.length})</summary>
        <Table caption="Each place the master stack's content was changed in carrying it over.">
          <thead><tr><Th>Where</Th><Th>Master stack</Th><Th>Here</Th><Th>Why</Th></tr></thead>
          <tbody>{CHANGES_FROM_MASTER.map((c) => (<tr key={c.where}><Td>{c.where}</Td><Td>{c.master}</Td><Td>{c.here}</Td><Td>{c.why}</Td></tr>))}</tbody>
        </Table>
      </details>
    </div>
  );
}
