// Shared palette, motion helpers and the ten explainer visuals. Each visual draws in an 800×740 box
// and keys every beat to its sentence cues S[i] (authored seconds) — never to wall-clock time.
const C = { ink: '#1A2246', paper: '#F7F4EE', amber: '#B7913F', slate: '#6A6E7E', blue: '#33427E', green: '#2F7E4A', roadmap: '#8A6A2A', line: '#DCD6C8', lineStrong: '#B9B3A6', raised: '#FCFBF8', sunk: '#EFEBE3', inkTint: '#EAE7E4', blueTint: '#E3E3E8', greenTint: '#E3E8DE', roadTint: '#EDE4D2' };
const FT = { display: 'Archivo, "Public Sans", sans-serif', body: '"Public Sans", system-ui, sans-serif', mono: '"IBM Plex Mono", ui-monospace, monospace' };
const MOTION = {
  enter: (T, s, d = 0.6) => Easing.easeOutCubic(clamp((T - s) / d, 0, 1)),
  draw: (T, s, d = 1) => Easing.easeInOutCubic(clamp((T - s) / d, 0, 1)),
  pop: (T, s, d = 0.5) => Easing.easeOutBack(clamp((T - s) / d, 0, 1)),
};
const rise = (p, d = 24) => ({ opacity: clamp(p, 0, 1), transform: `translateY(${(1 - p) * d}px)` });
const popIn = p => ({ opacity: clamp(p * 1.6, 0, 1), transform: `scale(${0.6 + 0.4 * p})` });
const A = (x, y, w, h, s = {}) => ({ position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box', ...s });
const commas = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const LBL = { font: `600 15px/1 ${FT.body}`, letterSpacing: '.1em', textTransform: 'uppercase', color: C.slate };

function Phone({ title, badge, children }) {
  return (
    <div style={A(210, 0, 380, 740, { border: `12px solid ${C.ink}`, borderRadius: 48, background: C.paper, overflow: 'hidden' })}>
      <div style={A(0, 0, 356, 76, { background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px' })}>
        <span style={{ font: `700 22px/1 ${FT.display}`, color: C.paper }}>{title}</span>{badge}
      </div>
      {children}
    </div>
  );
}
function Badge({ text, tone = 'ink', style }) {
  const t = { ink: [C.ink, C.paper, C.amber], green: [C.greenTint, C.green, C.green], road: [C.roadTint, C.roadmap, C.roadmap], blue: [C.blueTint, C.blue, C.blue] }[tone];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 3, background: t[0], color: t[1], font: `600 15px/1 ${FT.body}`, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', ...style }}><span style={{ width: 8, height: 8, borderRadius: 4, background: t[2] }} />{text}</span>;
}
function Btn({ label, on, amber, dim, style }) {
  const bg = amber ? C.amber : on ? C.ink : 'transparent';
  return <div style={{ height: 56, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', font: `600 20px/1 ${FT.body}`, background: bg, color: amber ? C.ink : on ? C.paper : C.ink, border: `1.5px solid ${amber || on ? bg : C.lineStrong}`, opacity: dim ? 0.4 : 1, ...style }}>{label}</div>;
}
const Card = ({ children, style }) => <div style={{ background: C.raised, border: `1px solid ${C.line}`, borderRadius: 4, ...style }}>{children}</div>;

// 01 — When a canvasser knocks
function VKnock({ T, S }) {
  const card = MOTION.enter(T, S[0] - 0.3), ask = MOTION.draw(T, S[0] + 0.5, 1.2), no = MOTION.pop(T, S[1] + 0.25, 0.45);
  const gone = MOTION.draw(T, S[2] + 0.2, 0.8), nothing = MOTION.pop(T, S[2] + 0.8), list = MOTION.enter(T, S[2] + 1.8), strike = MOTION.draw(T, S[2] + 2.6, 0.7);
  return (
    <Phone title="Before you record">
      <Card style={{ ...A(22, 100, 312, 250, { padding: 22 }), ...rise(card) }}>
        <div style={LBL}>Ask permission first</div>
        <div style={{ font: `600 23px/31px ${FT.body}`, color: C.ink, marginTop: 14 }}>May I record your answers about the ward?</div>
        <div style={{ height: 3, width: `${ask * 100}%`, background: C.amber, marginTop: 14 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}><Btn label="Yes" /><Btn label="No" on={no > 0.02} style={{ transform: `scale(${0.94 + 0.06 * no})` }} /></div>
      </Card>
      <div style={{ ...A(22, 380, 312, 160), opacity: 1 - gone * 0.8 }}>
        {['Name', 'Address', 'Answers'].map((f, i) => (
          <div key={f} style={{ position: 'relative', height: 44, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', font: `400 18px/1 ${FT.body}`, color: C.slate }}>{f}
            <span style={{ position: 'absolute', left: 0, top: 22, height: 2, width: `${gone * 100}%`, background: C.ink }} /></div>
        ))}
      </div>
      <div style={{ ...A(22, 430, 312, 50, { display: 'flex', justifyContent: 'center' }), ...popIn(nothing) }}><Badge text="Nothing stored" /></div>
      <div style={{ ...A(22, 560, 312, 120, { border: `2px dashed ${C.lineStrong}`, borderRadius: 4, padding: 18 }), ...rise(list) }}>
        <div style={LBL}>List of people who said no</div>
        <div style={{ position: 'relative', marginTop: 18, font: `500 20px/1 ${FT.mono}`, color: C.ink }}>Not kept<span style={{ position: 'absolute', left: -4, top: 10, height: 2, width: `${strike * 110}px`, background: C.amber }} /></div>
      </div>
    </Phone>
  );
}
// 02 — Your answer to a poll
function VPoll({ T, S }) {
  const card = MOTION.enter(T, S[0] - 0.3), pick = MOTION.pop(T, S[1] + 0.2, 0.45), tally = MOTION.draw(T, S[1] + 0.8, 1.4), unl = MOTION.enter(T, S[1] + 2.0), pns = MOTION.pop(T, S[2] + 0.3);
  const opts = ['Water and sanitation', 'Roads', 'Safety', 'Prefer not to say'];
  const counts = [168, 121, 94, 30];
  return (
    <div style={A(0, 0, 800, 740)}>
      <Card style={{ ...A(40, 0, 720, 430, { padding: 30 }), ...rise(card) }}>
        <div style={LBL}>Ward poll · invented example</div>
        <div style={{ font: `700 30px/38px ${FT.display}`, color: C.ink, margin: '14px 0 20px' }}>Which issue matters most in your ward?</div>
        {opts.map((o, i) => {
          const sel = i === 1 && pick > 0.02, hl = i === 3 ? pns : 0;
          return <div key={o} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 56, padding: '0 16px', marginTop: 6, borderRadius: 3, border: `2px solid ${hl > 0.02 ? C.ink : 'transparent'}`, background: sel ? C.inkTint : 'transparent', font: `400 22px/1 ${FT.body}`, color: C.ink }}>
            <span style={{ width: 24, height: 24, borderRadius: 12, border: `${sel ? 8 : 2}px solid ${sel ? C.ink : C.slate}`, boxSizing: 'border-box', transform: `scale(${sel ? 0.9 + 0.1 * pick : 1})` }} />{o}</div>;
        })}
      </Card>
      <div style={{ ...A(40, 456, 720, 50, { display: 'flex', gap: 14, alignItems: 'center' }), opacity: card }}>
        <span style={{ ...LBL, marginRight: 4 }}>Not asked</span>
        {['Name', 'Phone number', 'ID number'].map((f, i) => { const s = MOTION.draw(T, S[0] + 0.8 + i * 0.35, 0.5); return <span key={f} style={{ position: 'relative', font: `500 19px/1 ${FT.mono}`, color: C.slate, padding: '10px 14px', border: `1px solid ${C.line}`, borderRadius: 3 }}>{f}<span style={{ position: 'absolute', left: 8, right: 8, top: '50%', height: 2, background: C.ink, transform: `scaleX(${s})`, transformOrigin: 'left' }} /></span>; })}
      </div>
      <div style={{ ...A(40, 540, 720, 200), opacity: tally > 0 ? 1 : 0 }}>
        {counts.map((n, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 60px', gap: 14, alignItems: 'center', height: 34, font: `400 17px/1 ${FT.body}`, color: C.ink }}>
          <span>{opts[i]}</span><div style={{ height: 16, background: C.inkTint }}><div style={{ height: '100%', width: `${n / 168 * 100 * tally}%`, background: i === 3 ? C.slate : C.blue }} /></div><span style={{ font: `500 16px/1 ${FT.mono}`, textAlign: 'right' }}>{Math.round(n * tally)}</span></div>)}
        <div style={{ ...rise(unl, 10), marginTop: 12 }}><Badge text="Not linked to you" tone="blue" /></div>
      </div>
    </div>
  );
}
// 03 — How seats are won
function VSeats({ T, S }) {
  const wardFill = i => MOTION.pop(T, S[0] + 0.4 + i * 0.07, 0.35), prFill = i => MOTION.pop(T, S[0] + 2.2 + i * 0.07, 0.35);
  const law = MOTION.enter(T, S[1] + 0.2), q = MOTION.draw(T, S[1] + 1.4, 1), tbl = i => MOTION.enter(T, S[2] + 0.3 + i * 0.4);
  const rows = [['Party A', '36,000', '17.99', 18], ['Party B', '26,000', '12.99', 13], ['Party C', '18,000', '8.995', 9]];
  return (
    <div style={A(0, 0, 800, 740)}>
      <div style={A(40, 0, 720, 300, { display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 14 })}>
        {Array.from({ length: 40 }, (_, i) => { const ward = i < 20, p = ward ? wardFill(i) : prFill(i - 20); return <div key={i} style={{ aspectRatio: '1', borderRadius: '50%', border: `2px solid ${C.lineStrong}`, position: 'relative' }}><div style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: ward ? C.blue : C.ink, transform: `scale(${p})` }} /></div>; })}
      </div>
      <div style={{ ...A(40, 300, 720, 40, { display: 'flex', gap: 28, font: `600 18px/1 ${FT.body}`, color: C.ink }) }}>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: wardFill(0) }}><i style={{ width: 16, height: 16, borderRadius: 8, background: C.blue }} />20 ward seats</span>
        <span style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: prFill(0) }}><i style={{ width: 16, height: 16, borderRadius: 8, background: C.ink }} />20 from the party vote</span>
      </div>
      <div style={{ ...A(40, 370, 720, 120, { background: C.sunk, borderLeft: `4px solid ${C.ink}`, padding: '18px 22px' }), ...rise(law) }}>
        <div style={{ font: `500 28px/1.2 ${FT.mono}`, color: C.ink }}>Q = ⌊ A ÷ (B − C) ⌋ + 1<span style={{ opacity: q }}>{'  = 2,001'}</span></div>
        <div style={{ font: `400 17px/1.4 ${FT.body}`, color: C.slate, marginTop: 10 }}>Schedule 1, Municipal Structures Act 117 of 1998 · Item 12</div>
      </div>
      <div style={A(40, 515, 720, 225)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr .8fr', font: `600 14px/1 ${FT.body}`, letterSpacing: '.08em', textTransform: 'uppercase', color: C.slate, paddingBottom: 10, borderBottom: `2px solid ${C.ink}`, opacity: tbl(0) }}><span>Invented</span><span style={{ textAlign: 'right' }}>Votes</span><span style={{ textAlign: 'right' }}>÷ Q</span><span style={{ textAlign: 'right' }}>Seats</span></div>
        {rows.map((r, i) => <div key={r[0]} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr .8fr', height: 48, alignItems: 'center', borderBottom: `1px solid ${C.line}`, font: `400 20px/1 ${FT.body}`, color: C.ink, ...rise(tbl(i + 1), 10) }}><span>{r[0]}</span>{r.slice(1).map((c, j) => <span key={j} style={{ textAlign: 'right', fontFamily: FT.mono }}>{c}</span>)}</div>)}
      </div>
    </div>
  );
}
// 04 — Roles
function VRoles({ T, S }) {
  const muni = MOTION.enter(T, S[0] - 0.4), ward = MOTION.draw(T, S[0] + 0.1, 0.6), vd = MOTION.draw(T, S[1] + 0.1, 0.6), arrow = MOTION.draw(T, S[2] + 0.2, 0.8), stamp = MOTION.pop(T, S[2] + 1.0, 0.5);
  return (
    <div style={{ ...A(0, 0, 800, 740), opacity: muni }}>
      <div style={A(0, 20, 800, 700, { border: `2px solid ${C.ink}`, borderRadius: 4, padding: 22 })}><span style={LBL}>Municipality</span></div>
      <div style={A(40, 90, 440, 560, { border: `2px solid ${ward > 0.02 ? C.blue : C.lineStrong}`, background: `rgba(51,66,126,${0.1 * ward * (1 - 0.6 * vd)})`, borderRadius: 4, padding: 20 })}>
        <span style={{ ...LBL, color: C.ink }}>Ward 07</span>
        <div style={{ position: 'absolute', right: 18, top: 14, ...popIn(ward) }}><Badge text="Ward lead" tone="blue" /></div>
      </div>
      <div style={A(80, 330, 280, 270, { border: `2px solid ${vd > 0.02 ? C.ink : C.lineStrong}`, background: `rgba(26,34,70,${0.1 * vd})`, borderRadius: 4, padding: 18 })}>
        <span style={{ ...LBL, color: C.ink }}>Voting district 0012</span>
        <div style={{ position: 'absolute', left: 18, bottom: 18, ...popIn(vd) }}><Badge text="Canvasser" /></div>
      </div>
      <div style={A(520, 90, 240, 560, { border: `2px dashed ${C.lineStrong}`, borderRadius: 4, padding: 20 })}><span style={LBL}>Ward 08</span></div>
      <div style={A(360, 462, 200 * arrow, 4, { background: C.ink })} />
      <div style={{ ...A(500, 448, 30, 30, { borderTop: `4px solid ${C.ink}`, borderRight: `4px solid ${C.ink}`, transform: 'rotate(45deg)' }), opacity: arrow > 0.95 ? 1 : 0 }} />
      <div style={{ ...A(470, 520, 320, 120, { background: C.ink, borderRadius: 4, padding: '20px 22px', borderTop: `4px solid ${C.amber}` }), ...popIn(stamp) }}>
        <div style={{ font: `700 26px/1.1 ${FT.display}`, color: C.paper }}>Refused</div>
        <div style={{ font: `400 18px/1.4 ${FT.body}`, color: C.paper, marginTop: 8 }}>by the database rules, not only the screen</div>
      </div>
    </div>
  );
}
// 05 — Command view
function VCommand({ T, S }) {
  const card = MOTION.enter(T, S[0] - 0.4), counts = [[1284, 'People recorded with consent'], [3912, 'Doors worked'], [7, 'Incidents open']];
  const only = MOTION.pop(T, S[1] + 0.15), noname = MOTION.enter(T, S[2] + 0.1), strike = MOTION.draw(T, S[2] + 0.6, 0.6);
  return (
    <Card style={{ ...A(0, 40, 800, 660), ...rise(card), overflow: 'hidden' }}>
      <div style={{ height: 74, background: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px' }}><span style={{ font: `700 24px/1 ${FT.display}`, color: C.paper }}>Command view</span><span style={{ font: `500 15px/1 ${FT.mono}`, color: C.amber }}>INVENTED EXAMPLE</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 28px' }}>
        {counts.map(([n, l], i) => { const p = MOTION.draw(T, S[0] + 0.2 + i * 0.5, 1.4); return <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '22px 0', borderBottom: `1px solid ${C.line}`, ...rise(MOTION.enter(T, S[0] + i * 0.5), 12) }}><span style={{ font: `400 24px/1.2 ${FT.body}`, color: C.ink }}>{l}</span><span style={{ font: `500 54px/1 ${FT.mono}`, color: C.ink }}>{commas(n * p)}</span></div>; })}
      </div>
      <div style={{ position: 'absolute', left: 28, top: 440, ...popIn(only) }}><Badge text="Counts only" /></div>
      <div style={{ position: 'absolute', left: 28, right: 28, top: 510, ...rise(noname, 12) }}>
        <div style={{ position: 'relative', display: 'flex', gap: 18, alignItems: 'center', height: 60, padding: '0 18px', border: `2px dashed ${C.lineStrong}`, borderRadius: 4, font: `400 22px/1 ${FT.body}`, color: C.slate }}>Voter name<span style={{ position: 'absolute', left: 14, top: 29, height: 2, width: `${strike * 140}px`, background: C.ink }} /><span style={{ marginLeft: 'auto', font: `600 18px/1 ${FT.body}`, color: C.ink }}>Not on this view</span></div>
      </div>
    </Card>
  );
}
// 06 — Capture with consent
function VCapture({ T, S }) {
  const name = 'Lerato Mokoena', typed = name.slice(0, Math.floor(name.length * clamp((T - (S[0] + 0.6)) / 2.2, 0, 1)));
  const ready = typed.length === name.length, press = MOTION.pop(T, S[0] + 3.2, 0.4), swap = MOTION.draw(T, S[1] - 0.1, 0.5), nothing = MOTION.pop(T, S[1] + 0.6);
  return (
    <Phone title="Record consent">
      <div style={{ ...A(22, 100, 312, 380), opacity: 1 - swap, transform: `translateX(${-40 * swap}px)` }}>
        <div style={LBL}>Type their name back</div>
        <div style={{ marginTop: 14, height: 60, border: `2px solid ${ready ? C.ink : C.blue}`, borderRadius: 3, display: 'flex', alignItems: 'center', padding: '0 14px', font: `400 22px/1 ${FT.body}`, color: C.ink, background: C.raised }}>{typed}<span style={{ width: 2, height: 28, background: C.ink, marginLeft: 2, opacity: ready ? 0 : 1 }} /></div>
        <div style={{ font: `400 16px/1.5 ${FT.body}`, color: C.slate, marginTop: 12 }}>A mis-tap cannot create consent.</div>
        <Btn label={press > 0.5 ? 'Recorded' : 'Record'} amber={ready} dim={!ready} style={{ marginTop: 24, transform: `scale(${ready ? 0.95 + 0.05 * press : 1})` }} />
      </div>
      <div style={{ ...A(22, 100, 312, 400), opacity: swap, transform: `translateX(${40 * (1 - swap)}px)` }}>
        <div style={LBL}>They said no</div>
        <Btn label="No" on style={{ marginTop: 14 }} />
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start', ...popIn(nothing) }}><span style={LBL}>Stored</span><Badge text="Nothing" /></div>
      </div>
    </Phone>
  );
}
// 07 — Offline in a dead zone
function VOffline({ T, S }) {
  const online = T >= S[0] + 2.0, sent = i => i < 2 && T >= S[0] + 2.4 + i * 0.5, waitHl = MOTION.pop(T, S[1] + 0.2), warn = MOTION.pop(T, S[2] + 0.4);
  const items = ['Household 0041 · 10:12', 'Household 0042 · 10:19', 'Household 0044 · 10:31'];
  return (
    <Phone title="Today" badge={online ? <Badge text="Online" tone="green" style={{ height: 30 }} /> : <Badge text="Offline" style={{ height: 30, background: C.paper, color: C.ink }} />}>
      <div style={A(22, 100, 312, 300)}>
        <div style={LBL}>Kept on this phone</div>
        {items.map((it, i) => { const p = MOTION.enter(T, S[0] + i * 0.35); return <div key={it} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, borderBottom: `1px solid ${C.line}`, font: `400 18px/1 ${FT.body}`, color: C.ink, ...rise(p, 12) }}><span>{it}</span><span style={{ font: `600 14px/1 ${FT.body}`, letterSpacing: '.06em', textTransform: 'uppercase', color: sent(i) ? C.green : C.roadmap }}>{sent(i) ? 'Sent' : 'Waiting'}</span></div>; })}
      </div>
      <div style={{ ...A(22, 340, 312, 80, { borderRadius: 4, padding: '16px 18px', background: C.roadTint, boxShadow: `inset 4px 0 0 ${C.amber}` }), ...popIn(waitHl) }}>
        <div style={{ font: `500 32px/1 ${FT.mono}`, color: C.ink }}>1 <span style={{ font: `400 18px/1 ${FT.body}` }}>still waiting to send</span></div>
      </div>
      <div style={{ ...A(22, 450, 312, 200, { background: C.ink, borderRadius: 4, padding: 20, borderTop: `4px solid ${C.amber}` }), ...popIn(warn) }}>
        <div style={{ font: `700 21px/1.2 ${FT.display}`, color: C.paper }}>Clearing this browser's data</div>
        <div style={{ font: `400 18px/1.45 ${FT.body}`, color: C.paper, marginTop: 10 }}>removes 1 capture that has not been sent yet.</div>
      </div>
    </Phone>
  );
}
// 08 — Funding line and the 30-day clock
function VFunding({ T, S }) {
  const pays = [60000, 45000, 80000, 30000], line = 200000, max = 250000;
  let tot = 0; const segs = pays.map((v, i) => { const p = MOTION.draw(T, S[0] + 0.5 + i * 0.7, 0.6); const s = { from: tot, v: v * p }; tot += v * p; return s; });
  const over = tot > line, flag = MOTION.pop(T, S[0] + 3.4), clock = MOTION.enter(T, S[1] - 0.2), day = Math.max(1, Math.round(12 * MOTION.draw(T, S[1] + 0.3, 2)));
  const X = v => v / max * 720;
  return (
    <div style={A(0, 0, 800, 740)}>
      <div style={{ ...A(40, 10, 720, 40), ...LBL }}>One donor · payments this year · invented</div>
      <div style={A(40, 70, 720, 60, { background: C.inkTint })}>
        {segs.map((s, i) => <div key={i} style={A(X(s.from), 0, X(s.v), 60, { background: i % 2 ? C.blue : C.ink, borderRight: `2px solid ${C.paper}` })} />)}
      </div>
      <div style={A(40 + X(line) - 2, 50, 4, 100, { background: C.amber })} />
      <div style={{ ...A(40, 160, 720, 30, { display: 'flex', justifyContent: 'space-between', font: `500 18px/1 ${FT.mono}`, color: C.ink }) }}><span>{'R' + commas(tot)}</span><span style={{ position: 'absolute', left: X(line) - 90 }}>R200,000 line</span></div>
      <div style={{ ...A(40, 210, 720, 60, { display: 'flex', gap: 14, alignItems: 'center' }), ...popIn(over ? flag : 0) }}><Badge text="Over the line · disclose" tone="road" /></div>
      <div style={{ ...A(40, 280, 720, 30, { font: `400 17px/1.4 ${FT.body}`, color: C.slate }), opacity: MOTION.enter(T, S[0] + 0.3) }}>Government Gazette 53182 · under court challenge</div>
      <div style={{ ...A(40, 360, 720, 360, { display: 'flex', gap: 40, alignItems: 'center' }), ...rise(clock) }}>
        <svg width="280" height="280" viewBox="0 0 280 280"><circle cx="140" cy="140" r="118" fill="none" stroke={C.inkTint} strokeWidth="22" /><circle cx="140" cy="140" r="118" fill="none" stroke={C.ink} strokeWidth="22" strokeDasharray={`${2 * Math.PI * 118 * day / 30} 999`} transform="rotate(-90 140 140)" /><text x="140" y="150" textAnchor="middle" fontFamily={FT.mono} fontSize="56" fontWeight="500" fill={C.ink}>{day}</text><text x="140" y="190" textAnchor="middle" fontFamily={FT.body} fontSize="20" fill={C.slate}>of 30 days</text></svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><span style={LBL}>Data request</span><span style={{ font: `700 30px/1.15 ${FT.display}`, color: C.ink }}>A person asks about their own data</span><span style={{ font: `400 19px/1.45 ${FT.body}`, color: C.slate }}>Tracked against a 30-day target</span></div>
      </div>
    </div>
  );
}
// 09 — Sentiment polls
function VSentiment({ T, S }) {
  const groups = [['Ward 03', 142, .62], ['Ward 07', 88, .48], ['Ward 11', 3, .7], ['Ward 14', 57, .41], ['Ward 19', 120, .55]];
  const link = MOTION.pop(T, S[0] + 0.2), bars = MOTION.draw(T, S[0] + 0.8, 1.6), b1 = MOTION.pop(T, S[1] + 1.2), b2 = MOTION.pop(T, S[1] + 2.4), hide = MOTION.draw(T, S[2] + 0.3, 0.7);
  return (
    <div style={A(0, 0, 800, 740)}>
      <div style={{ ...A(40, 0, 720, 50), ...popIn(link), transformOrigin: 'left' }}><Badge text="Replied to a link" tone="blue" /></div>
      <div style={{ ...A(40, 70, 720, 30), ...LBL }}>Agree with the new market plan · invented</div>
      {groups.map(([g, n, v], i) => { const hidden = n < 5; return (
        <div key={g} style={A(40, 120 + i * 78, 720, 64, { display: 'grid', gridTemplateColumns: '130px 1fr 110px', gap: 16, alignItems: 'center', font: `400 20px/1 ${FT.body}`, color: C.ink })}>
          <span>{g}</span>
          <div style={{ position: 'relative', height: 30, background: C.inkTint }}>
            <div style={{ height: '100%', width: `${v * 100 * bars}%`, background: C.blue, opacity: hidden ? 1 - hide : 1 }} />
            {hidden && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 12, opacity: hide, background: `repeating-linear-gradient(45deg, ${C.inkTint} 0 8px, ${C.line} 8px 16px)`, font: `600 15px/1 ${FT.body}`, letterSpacing: '.06em', textTransform: 'uppercase', color: C.ink }}>Hidden · under 5 answers</div>}
          </div>
          <span style={{ font: `500 17px/1 ${FT.mono}`, textAlign: 'right', color: C.slate }}>{hidden && hide > 0.5 ? '—' : 'n = ' + n}</span>
        </div>); })}
      <div style={A(40, 540, 720, 180, { display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' })}>
        <div style={popIn(b1)}><Badge text="Not a random sample · no margin of error" /></div>
        <div style={popIn(b2)}><Badge text="No forecast" /></div>
      </div>
    </div>
  );
}
// 10 — Scenario runner
function VScenario({ T, S }) {
  const sw = MOTION.draw(T, S[0] + 0.3, 1.4), un = MOTION.draw(T, S[0] + 1.4, 1.2), runs = MOTION.draw(T, S[1] + 0.2, 3.2), sens = MOTION.enter(T, S[1] + 3.6), stamp = MOTION.pop(T, S[2] + 0.2);
  const hist = [2, 6, 14, 26, 38, 31, 18, 8, 3];
  const Slide = ({ label, val, p, y }) => <div style={A(40, y, 720, 70)}><div style={{ display: 'flex', justifyContent: 'space-between', font: `400 20px/1 ${FT.body}`, color: C.ink }}><span>{label}</span><span style={{ fontFamily: FT.mono }}>{val}</span></div><div style={{ position: 'relative', height: 6, background: C.line, marginTop: 20, borderRadius: 3 }}><div style={{ height: '100%', width: `${50 + 30 * p}%`, background: C.ink, borderRadius: 3 }} /><div style={{ position: 'absolute', left: `calc(${50 + 30 * p}% - 13px)`, top: -10, width: 26, height: 26, borderRadius: 13, background: C.paper, border: `3px solid ${C.ink}`, boxSizing: 'border-box' }} /></div></div>;
  return (
    <div style={A(0, 0, 800, 740)}>
      <Slide label="Swing, Party A" val={'+' + (2 * sw).toFixed(1) + ' pp'} p={sw} y={0} />
      <Slide label="How unsure you are" val={'± ' + (1.5 * un).toFixed(1) + ' pp'} p={un} y={96} />
      <div style={{ ...A(40, 200, 720, 30, { display: 'flex', justifyContent: 'space-between' }), opacity: runs > 0 ? 1 : 0 }}><span style={LBL}>Seats won · invented</span><span style={{ font: `500 18px/1 ${FT.mono}`, color: C.ink }}>{commas(1000 * runs)} runs</span></div>
      <div style={A(40, 240, 720, 220, { display: 'flex', alignItems: 'flex-end', gap: 10, borderBottom: `2px solid ${C.ink}` })}>
        {hist.map((h, i) => <div key={i} style={{ flex: 1, height: `${h / 38 * 100 * clamp(runs * 1.4 - i * 0.05, 0, 1)}%`, background: i === 4 ? C.ink : C.blue }} />)}
      </div>
      <div style={{ ...A(40, 470, 720, 30, { display: 'flex', justifyContent: 'space-between', font: `500 16px/1 ${FT.mono}`, color: C.slate }), opacity: runs > 0 ? 1 : 0 }}>{hist.map((_, i) => <span key={i}>{14 + i}</span>)}</div>
      <div style={{ ...A(40, 520, 720, 110), ...rise(sens, 14) }}>
        <div style={LBL}>Which assumption matters most</div>
        {[['Swing', .78], ['Turnout', .24]].map(([l, v]) => <div key={l} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 16, alignItems: 'center', marginTop: 14, font: `400 19px/1 ${FT.body}`, color: C.ink }}><span>{l}</span><div style={{ height: 18, background: C.inkTint }}><div style={{ height: '100%', width: `${v * 100}%`, background: C.blue }} /></div></div>)}
      </div>
      <div style={{ ...A(430, 640, 330, 70, { display: 'flex', justifyContent: 'flex-end' }), ...popIn(stamp) }}><div style={{ background: C.ink, color: C.paper, font: `700 28px/1 ${FT.display}`, padding: '20px 26px', borderRadius: 4, borderTop: `4px solid ${C.amber}` }}>Not a prediction</div></div>
    </div>
  );
}
window.EX_VISUALS = { 'canvasser-knocks': VKnock, 'poll-answer': VPoll, 'seats-won': VSeats, roles: VRoles, 'command-view': VCommand, 'capture-consent': VCapture, offline: VOffline, 'funding-30-day': VFunding, 'sentiment-polls': VSentiment, 'scenario-runner': VScenario };
Object.assign(window, { C, FT, MOTION, rise, popIn, A, Badge });
