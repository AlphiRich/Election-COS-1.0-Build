// One explainer = Title → Line1..LineN (one caption per section, trim each to fit the voiceover) → Close.
function ExplainerPiece({ e, portrait, captions }) {
  const { T, CUES } = useComposition();
  const W = portrait ? 1080 : 1920, H = portrait ? 1920 : 1080;
  const S = e.sentences.map((_, i) => CUES['Line' + (i + 1)]);
  const end = CUES.Close;
  const Visual = EX_VISUALS[e.id];
  const kick = MOTION.enter(T, 0.1, 0.5), titleIn = MOTION.enter(T, 0.25, 0.7), rule = MOTION.draw(T, 0.5, 0.7), settle = MOTION.draw(T, S[0] - 0.55, 0.75);
  const lerp = (a, b) => a + (b - a) * settle;
  const L = portrait
    ? { x: 90, tTop: lerp(720, 110), tSize: lerp(92, 44), tW: 900, vis: { x: 140, y: 350, s: 1.15 }, cap: { x: 90, y: 1250, w: 900, size: 56 } }
    : { x: 120, tTop: lerp(380, 96), tSize: lerp(104, 42), tW: lerp(1400, 1500), vis: { x: 1000, y: 210, s: 1 }, cap: { x: 120, y: 380, w: 760, size: 54 } };
  const visIn = MOTION.enter(T, S[0] - 0.1, 0.8), drift = MOTION.draw(T, S[0], end - S[0]);
  let ci = -1; S.forEach((s, i) => { if (T >= s - 0.15) ci = i; });
  const capP = ci >= 0 ? MOTION.enter(T, S[ci] - 0.15, 0.45) : 0, capOut = 1 - MOTION.draw(T, end - 0.1, 0.4);
  const wipe = MOTION.draw(T, end, 0.65), sign = MOTION.enter(T, end + 0.4, 0.6), url = MOTION.enter(T, end + 0.7, 0.6);
  return (
    <div data-screen-label={'t=' + Math.floor(T) + 's'} style={{ position: 'relative', width: W, height: H, overflow: 'hidden', background: C.paper, fontFamily: FT.body }}>
      <div style={{ position: 'absolute', left: L.x, top: L.tTop - (portrait ? 60 : 56), font: `600 ${portrait ? 24 : 22}px/1 ${FT.mono}`, letterSpacing: '.12em', color: C.roadmap, ...rise(kick, 12) }}>{e.audience === 'voters' ? 'FOR VOTERS' : 'FOR PARTIES & CAMPAIGNS'}</div>
      <div style={{ position: 'absolute', left: L.x, top: L.tTop, width: L.tW, font: `700 ${L.tSize}px/1.05 ${FT.display}`, letterSpacing: '-0.015em', color: C.ink, textWrap: 'balance', ...rise(titleIn, 30) }}>{e.title}</div>
      <div style={{ position: 'absolute', left: L.x, top: L.tTop + L.tSize * 1.05 * Math.max(1, Math.ceil(e.title.length * L.tSize * 0.5 / L.tW)) + 18, width: 140 * rule, height: 6, background: C.amber }} />
      <div style={{ position: 'absolute', left: L.vis.x, top: L.vis.y, width: 800, height: 740, opacity: visIn, transform: `translateY(${(1 - visIn) * 40}px) scale(${L.vis.s * (1 + 0.025 * drift)})`, transformOrigin: 'center' }}>
        {Visual && <Visual T={T} S={S} end={end} />}
      </div>
      {captions && ci >= 0 && <div key={ci} style={{ position: 'absolute', left: L.cap.x, top: L.cap.y, width: L.cap.w, font: `600 ${L.cap.size}px/1.28 ${FT.body}`, color: C.ink, textWrap: 'pretty', opacity: capP * capOut, transform: `translateY(${(1 - capP) * 22}px)` }}>{e.sentences[ci]}</div>}
      <div style={{ position: 'absolute', left: L.x, right: L.x, bottom: portrait ? 70 : 52, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', opacity: kick }}>
        <span style={{ font: `700 ${portrait ? 30 : 26}px/1 ${FT.display}`, color: C.ink }}>Election-COS<sup style={{ font: `500 0.55em/1 ${FT.mono}`, color: C.slate }}>1.0</sup></span>
        <span style={{ font: `500 ${portrait ? 20 : 18}px/1 ${FT.mono}`, color: C.slate }}>{e.invented ? 'Example data is invented · ' : ''}electioncos.co.za</span>
      </div>
      <div style={{ position: 'absolute', left: 0, top: H * (1 - wipe), width: W, height: H, background: C.ink, borderTop: `8px solid ${C.amber}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: portrait ? '0 90px' : '0 160px', boxSizing: 'border-box', gap: 28 }}>
        <div style={{ font: `700 ${portrait ? 96 : 120}px/1 ${FT.display}`, color: C.paper, ...rise(sign, 30) }}>Election-COS<sup style={{ font: `500 0.4em/1 ${FT.mono}`, color: C.amber }}>1.0</sup></div>
        <div style={{ font: `600 ${portrait ? 30 : 34}px/1.3 ${FT.body}`, color: C.amber, ...rise(sign, 20) }}>Democracy Through Computational Intelligence</div>
        <div style={{ font: `500 ${portrait ? 30 : 32}px/1 ${FT.mono}`, color: C.paper, marginTop: 24, ...rise(url, 16) }}>Read it at electioncos.co.za/watch</div>
      </div>
    </div>
  );
}
function ExplainerApp({ id }) {
  const e = window.ECOS_EXPLAINERS.find(x => x.id === id);
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);
  const portrait = t.ratio === '9:16';
  return (
    <React.Fragment>
      <CompositionStage key={t.ratio} width={portrait ? 1080 : 1920} height={portrait ? 1920 : 1080} scenes={window.OM_SCENES} playback={window.OM_PLAYBACK} bg={C.paper} autoplay="false">
        <ExplainerPiece e={e} portrait={portrait} captions={t.captions} />
      </CompositionStage>
      <TweaksPanel>
        <TweakSection label="Video" />
        <TweakRadio label="Format" value={t.ratio} options={['16:9', '9:16']} onChange={v => setTweak('ratio', v)} />
        <TweakToggle label="Burned-in captions" value={t.captions} onChange={v => setTweak('captions', v)} />
        <TweakToggle label="Motion editor" value={t.motionEditor} onChange={v => setTweak('motionEditor', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}
window.ExplainerApp = ExplainerApp;
