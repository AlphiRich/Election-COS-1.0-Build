/**
 * Election Campaign OS — public site, party agent station log
 * (`/for-campaigns/agent-tool`)
 *
 * A notebook for an agent at a voting station, built around what the Act
 * lets an agent do: observe voting, counting and the declaration of
 * results, not interfere, and lodge objections (section 40(3)). It keeps
 * counts and notes, has no field for a voter’s name, ID number or choice,
 * and stores nothing off the device (the log is kept in this browser so a
 * reload does not lose a day’s notes). It is the agent’s own record, not
 * the official result.
 */
import { useEffect, useMemo, useState } from 'react';
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { HOURS, checkCount, emptyLog, toCsv, type StationLog } from '../tools/agentLog';

const KEY = 'ecos-agent-log-v1';

function load(): StationLog {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...emptyLog(), ...(JSON.parse(raw) as StationLog) };
  } catch {
    /* storage blocked: start empty */
  }
  return emptyLog();
}

const nowHm = () =>
  new Date().toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  });

export function SiteAgentTool() {
  const [log, setLog] = useState<StationLog>(load);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(log));
    } catch {
      /* storage blocked: the log still works for this visit */
    }
  }, [log]);

  const set = (patch: Partial<StationLog>) => setLog((l) => ({ ...l, ...patch }));
  const bump = (h: string, d: number) =>
    setLog((l) => ({ ...l, hourly: { ...l.hourly, [h]: Math.max(0, (l.hourly[h] ?? 0) + d) } }));
  const total = HOURS.reduce((n, h) => n + (log.hourly[h] ?? 0), 0);
  const check = useMemo(
    () =>
      checkCount(
        Number(log.count.counted),
        Number(log.count.rejected),
        log.count.lines.map((l) => ({ party: l.party, votes: Number(l.votes) })),
      ),
    [log.count],
  );
  const setCount = (patch: Partial<StationLog['count']>) =>
    set({ count: { ...log.count, ...patch } });

  async function copy() {
    try {
      await navigator.clipboard.writeText(toCsv(log));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <PageIntro
        eyebrow="For party agents"
        title="Station log for party agents"
        lead="Keep a clean record at your voting station: voters seen each hour, incidents, objections, and the count. It stays in this browser and has no place for a voter’s name or ID number."
      />

      <SiteSection labelledBy="rules-h" className="pb-8">
        <SiteCard className="flex max-w-[900px] flex-col gap-3 p-6">
          <h2 id="rules-h" className="m-0 font-site-display text-site-h5">
            What the Act lets you do
          </h2>
          <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-site-sm">
            <li>
              Observe voting, counting and the declaration of results, but not interfere.{' '}
              <span className="font-mono text-site-micro text-slate">s 40(3)</span>
            </li>
            <li>
              Object, before a voter is handed a ballot, to that voter being allowed to vote. The
              objection is in writing, on the prescribed form, to the presiding officer.{' '}
              <span className="font-mono text-site-micro text-slate">s 51(1), (4)</span>
            </li>
            <li>
              Object to the conduct of an officer, agent or other person at the station, in the same
              way. <span className="font-mono text-site-micro text-slate">s 51(3)–(4)</span>
            </li>
            <li>
              Object in writing to the counting officer about the sorting or counting of ballot
              papers, at any stage before the counting officer completes the result form.{' '}
              <span className="font-mono text-site-micro text-slate">s 62(1)–(2)</span>
            </li>
            <li>
              Dispute whether a ballot paper is accepted or rejected, and it is marked “disputed”.{' '}
              <span className="font-mono text-site-micro text-slate">s 61(3)</span>
            </li>
            <li>
              Do not campaign, hand out material or wear party clothing inside the station boundary.
              Wear your prescribed tag.{' '}
              <span className="font-mono text-site-micro text-slate">s 40(1)–(2)</span>
            </li>
          </ul>
          <p className="m-0 text-site-caption text-slate">
            Summary of the Local Government: Municipal Electoral Act 27 of 2000 as published in
            2000, not legal advice. Your party’s election agent and the Electoral Commission’s
            current instructions come first.
          </p>
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="log-h" className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
            <h2 id="log-h" className="m-0 font-site-display text-site-h5">
              Station
            </h2>
            <label htmlFor="ag-station" className="font-semibold">
              Station name or code
            </label>
            <input
              id="ag-station"
              className="site-field"
              value={log.station}
              onChange={(e) => set({ station: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="ag-open" className="font-semibold">
                  Opened at
                </label>
                <div className="flex gap-2">
                  <input
                    id="ag-open"
                    className="site-field"
                    value={log.opened}
                    onChange={(e) => set({ opened: e.target.value })}
                    placeholder="07:00"
                  />
                  <button
                    type="button"
                    className="site-btn-outline-ink px-3"
                    onClick={() => set({ opened: nowHm() })}
                    aria-label="Set opening time to now"
                  >
                    Now
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="ag-close" className="font-semibold">
                  Closed at
                </label>
                <div className="flex gap-2">
                  <input
                    id="ag-close"
                    className="site-field"
                    value={log.closed}
                    onChange={(e) => set({ closed: e.target.value })}
                    placeholder="21:00"
                  />
                  <button
                    type="button"
                    className="site-btn-outline-ink px-3"
                    onClick={() => set({ closed: nowHm() })}
                    aria-label="Set closing time to now"
                  >
                    Now
                  </button>
                </div>
              </div>
            </div>
            <label htmlFor="ag-obj" className="font-semibold">
              Objections you lodged in writing
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="site-btn-outline-ink px-4"
                onClick={() => set({ objections: Math.max(0, log.objections - 1) })}
                aria-label="One fewer objection"
              >
                −
              </button>
              <output id="ag-obj" className="min-w-8 text-center font-mono text-site-h5">
                {log.objections}
              </output>
              <button
                type="button"
                className="site-btn-outline-ink px-4"
                onClick={() => set({ objections: log.objections + 1 })}
                aria-label="One more objection"
              >
                +
              </button>
            </div>
          </SiteCard>

          <SiteCard className="flex min-w-0 flex-col gap-3 p-6">
            <h2 className="m-0 font-site-display text-site-h5">Voters seen each hour: {total}</h2>
            <p className="m-0 text-site-caption text-slate">
              Tap + for each voter you see go in. Counts only. Never names.
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2 p-0">
              {HOURS.map((h) => (
                <li
                  key={h}
                  className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-2 py-1"
                >
                  <span className="font-mono text-site-sm">{h}</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-h-[44px] min-w-[44px] rounded-md border border-line"
                      onClick={() => bump(h, -1)}
                      aria-label={`One fewer at ${h}`}
                    >
                      −
                    </button>
                    <span
                      className="min-w-6 text-center font-mono"
                      aria-label={`${log.hourly[h] ?? 0} at ${h}`}
                    >
                      {log.hourly[h] ?? 0}
                    </span>
                    <button
                      type="button"
                      className="min-h-[44px] min-w-[44px] rounded-md border border-line bg-gold"
                      onClick={() => bump(h, 1)}
                      aria-label={`One more at ${h}`}
                    >
                      +
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection labelledBy="inc-h" className="pb-8">
        <SiteCard className="flex max-w-[900px] flex-col gap-3 p-6">
          <h2 id="inc-h" className="m-0 font-site-display text-site-h5">
            Incidents and irregularities
          </h2>
          <label htmlFor="ag-note" className="font-semibold">
            What happened (no names or ID numbers)
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="ag-note"
              className="site-field min-w-0 flex-1"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className="site-btn-primary"
              onClick={() => {
                if (note.trim()) {
                  set({ incidents: [...log.incidents, { time: nowHm(), note: note.trim() }] });
                  setNote('');
                }
              }}
            >
              Add to log
            </button>
          </div>
          {log.incidents.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-site-sm">
              {log.incidents.map((i, n) => (
                <li key={n} className="border-l-[3px] border-ink pl-3">
                  <span className="font-mono">{i.time}</span> {i.note}
                </li>
              ))}
            </ul>
          )}
          <p className="m-0 text-site-caption text-slate">
            An irregularity is raised with the presiding officer on the spot. This log is your
            memory aid, not a complaint.
          </p>
        </SiteCard>
      </SiteSection>

      <SiteSection labelledBy="cnt-h" className="pb-8">
        <SiteCard className="flex max-w-[900px] flex-col gap-3 p-6">
          <h2 id="cnt-h" className="m-0 font-site-display text-site-h5">
            The count
          </h2>
          <p className="m-0 text-site-sm text-slate">
            Copy the figures from the result as it is announced, one ballot at a time. Rejected
            papers are those the counting officer rejects under section 61.
          </p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="ag-ballot" className="font-semibold">
                Ballot
              </label>
              <select
                id="ag-ballot"
                className="site-field"
                value={log.count.ballot}
                onChange={(e) => setCount({ ballot: e.target.value })}
              >
                <option>Ward</option>
                <option>Proportional</option>
                <option>District</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ag-counted" className="font-semibold">
                Ballot papers counted
              </label>
              <input
                id="ag-counted"
                inputMode="numeric"
                className="site-field font-mono"
                value={log.count.counted}
                onChange={(e) => setCount({ counted: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ag-rej" className="font-semibold">
                Rejected
              </label>
              <input
                id="ag-rej"
                inputMode="numeric"
                className="site-field font-mono"
                value={log.count.rejected}
                onChange={(e) => setCount({ rejected: e.target.value })}
              />
            </div>
          </div>
          {log.count.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem] gap-2">
              <label className="sr-only" htmlFor={`ag-p-${i}`}>
                Party {i + 1}
              </label>
              <input
                id={`ag-p-${i}`}
                className="site-field min-w-0"
                value={l.party}
                placeholder="Party or candidate"
                onChange={(e) =>
                  setCount({
                    lines: log.count.lines.map((x, j) =>
                      j === i ? { ...x, party: e.target.value } : x,
                    ),
                  })
                }
              />
              <label className="sr-only" htmlFor={`ag-v-${i}`}>
                Votes for party {i + 1}
              </label>
              <input
                id={`ag-v-${i}`}
                inputMode="numeric"
                className="site-field min-w-0 text-right font-mono"
                value={l.votes}
                placeholder="Votes"
                onChange={(e) =>
                  setCount({
                    lines: log.count.lines.map((x, j) =>
                      j === i ? { ...x, votes: e.target.value } : x,
                    ),
                  })
                }
              />
            </div>
          ))}
          <button
            type="button"
            className="site-btn-outline-ink self-start"
            onClick={() => setCount({ lines: [...log.count.lines, { party: '', votes: '' }] })}
          >
            Add a party line
          </button>
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-line bg-white p-4 text-site-sm"
          >
            {log.count.counted === '' ? (
              'Enter the ballot papers counted to check the figures.'
            ) : check.balanced ? (
              <>
                Party votes {check.partyVotes} + rejected {check.rejected} = {check.accountedFor},
                which matches the {check.ballotsCounted} counted.
              </>
            ) : (
              <>
                Party votes {check.partyVotes} + rejected {check.rejected} = {check.accountedFor},
                but {check.ballotsCounted} were counted (
                {check.difference > 0
                  ? `${check.difference} not accounted for`
                  : `${-check.difference} too many`}
                ). Check you copied every figure. If they still differ, raise it with the counting
                officer before they complete the result form.
              </>
            )}
          </div>
        </SiteCard>
      </SiteSection>

      <SiteSection className="pb-10">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="site-btn-primary" onClick={copy}>
            Copy log as CSV
          </button>
          <button
            type="button"
            className="site-btn-outline-ink"
            onClick={() => {
              setLog(emptyLog());
              setCopied(false);
            }}
          >
            Clear the log
          </button>
          <span role="status" aria-live="polite" className="text-site-sm">
            {copied ? 'Copied. Paste into a spreadsheet.' : ''}
          </span>
        </div>
      </SiteSection>

      <SourceNote>
        The log is stored only in this browser and is never sent anywhere. Sections cited are from
        the Local Government: Municipal Electoral Act 27 of 2000, as published in 2000. Running
        agents across every ward, with reporting back to a campaign office, is part of the full
        Election Campaign OS.
      </SourceNote>
    </>
  );
}
