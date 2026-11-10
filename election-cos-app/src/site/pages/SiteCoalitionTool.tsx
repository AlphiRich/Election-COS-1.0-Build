/**
 * Election Campaign OS — public site, how coalitions work
 * (`/tools/how-coalitions-work`)
 *
 * Arithmetic only: which groups of parties pass half the seats. It does
 * not know any real agreement, does not say which coalition is likely or
 * lawful, and carries no party's current seat count. It starts from the
 * certified 2026 result of any metro or local council in the country (JB Marks first),
 * with the 2021 JB Marks result kept as history, so the page has real numbers on it
 * and none invented.
 */
import { useMemo, useState } from 'react';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { allocateSeats } from '@/modules/analytics/seatCalculator';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import { NATIONAL_SEATS } from '@/modules/lge2026/nationalResults';
import { provinceName } from '../tools/resultsFormat';
import { PartyMark } from './PartyMark';
import { smallMajorities } from '../tools/tracker';
import { majorityThreshold, seatsHeld, type SeatHolder } from '../tools/coalition';

const COUNCILS = NATIONAL_SEATS.councils;
const CODES = Object.keys(COUNCILS).sort((a, b) => COUNCILS[a].province.localeCompare(COUNCILS[b].province) || COUNCILS[a].name.localeCompare(COUNCILS[b].name));
const HISTORY = 'NW405-2021';

function exampleHolders(code: string = 'NW405'): SeatHolder[] {
  if (code !== HISTORY) {
    return COUNCILS[code].holders.map((h) => ({ id: h.id, name: h.name, seats: h.seats }));
  }
  const r = allocateSeats({
    totalSeats: NW405_2021_EXAMPLE.totalSeats,
    totalValidVotes: NW405_2021_EXAMPLE.totalValidVotes,
    parties: NW405_2021_EXAMPLE.parties,
  });
  return r.parties
    .filter((p) => p.totalSeats > 0)
    .map((p) => ({ id: p.id, name: p.name, seats: p.totalSeats }));
}

export function SiteCoalitionTool() {
  const [code, setCode] = useState('NW405');
  const [holders, setHolders] = useState<SeatHolder[]>(() => exampleHolders('NW405'));
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const total = holders.reduce((n, h) => n + h.seats, 0);
  const need = majorityThreshold(total);
  const held = seatsHeld(holders, chosen);
  const reached = total > 0 && held >= need;
  const sets = useMemo(() => smallMajorities(holders, total), [holders, total]);
  const name = (id: string) => holders.find((h) => h.id === id)?.name ?? id;
  const isExample = JSON.stringify(holders) === JSON.stringify(exampleHolders(code));
  const label = code === HISTORY ? 'JB Marks council, 2021' : `${COUNCILS[code].name} council, 2026`;

  const toggle = (id: string) =>
    setChosen((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <SiteSection className="pb-8 pt-[88px]">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Eyebrow>Voter tool</Eyebrow>
          <h1 className="m-0 font-site-display text-site-h3 md:text-site-h2">
            How coalitions work
          </h1>
          <p className="m-0 text-site-lead">
            When no party holds more than half of a council’s seats, parties can agree to work
            together. Pick parties below and see whether, between them, they pass half.
          </p>
          <p className="m-0 text-site-base text-slate">
            A coalition is an agreement between parties. Some are written and detailed, some are
            decided vote by vote. This tool counts seats and cannot tell you what any real agreement
            says.
          </p>
        </div>
      </SiteSection>

      <SiteSection className="pb-8">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 className="m-0 font-site-display text-site-h5">
              {isExample ? `Worked example: ${label}` : 'Your seat numbers'}
            </h2>
            <label className="flex flex-col gap-1 text-site-caption text-slate" htmlFor="co-council">
              Council
              <select
                id="co-council"
                className="site-field min-h-[44px]"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setHolders(exampleHolders(e.target.value));
                  setChosen(new Set());
                }}
              >
                {CODES.map((c) => (
                  <option key={c} value={c}>
                    {COUNCILS[c].name} ({provinceName(COUNCILS[c].province)}), 2026
                  </option>
                ))}
                <option value={HISTORY}>NW405 JB Marks, 2021 (history)</option>
              </select>
            </label>
            <p className="m-0 text-site-caption text-slate">
              {isExample
                ? code === HISTORY
                  ? 'Seats as allocated from the real 2021 result, on 2021 boundaries. History, not a forecast.'
                  : 'Seats as allocated by the Commission from the 4 November 2026 result. Independents are shown as one group; in a real council each decides separately.'
                : 'Your own figures. Nothing here is a real result.'}
            </p>
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 font-semibold">Choose the parties to combine</legend>
              {holders.map((h, i) => (
                <div key={h.id} className="flex min-h-[48px] items-center gap-3">
                  <input
                    type="checkbox"
                    id={`co-${i}`}
                    className="h-5 w-5 flex-none accent-teal"
                    checked={chosen.has(h.id)}
                    onChange={() => toggle(h.id)}
                  />
                  <label htmlFor={`co-${i}`} className="min-w-0 flex-1">
                    <PartyMark id={h.id} name={h.name} size={28} />
                  </label>
                  <label htmlFor={`seats-${i}`} className="sr-only">
                    {h.name} seats
                  </label>
                  <input
                    id={`seats-${i}`}
                    inputMode="numeric"
                    className="site-field min-h-[44px] !w-20 text-right font-mono"
                    value={h.seats}
                    onChange={(e) => {
                      const n = Math.max(
                        0,
                        Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0),
                      );
                      setHolders((hs) => hs.map((x) => (x.id === h.id ? { ...x, seats: n } : x)));
                    }}
                  />
                </div>
              ))}
            </fieldset>
            <button
              type="button"
              className="site-btn-outline-ink self-start"
              onClick={() => {
                setHolders(exampleHolders(code));
                setChosen(new Set());
              }}
            >
              Reset to the {code === HISTORY ? '2021' : '2026'} result
            </button>
          </SiteCard>

          <SiteCard className="flex min-w-0 flex-col gap-4 p-6">
            <h2 className="m-0 font-site-display text-site-h5">Do they pass half?</h2>
            <div role="status" aria-live="polite" className="flex flex-col gap-3">
              <p className="m-0 font-mono text-site-h3 font-medium">
                {held} of {total}
              </p>
              <p className="m-0 text-site-sm">
                More than half of {total} seats is <strong>{need}</strong>.{' '}
                {chosen.size === 0
                  ? 'Choose at least one party.'
                  : reached
                    ? `The parties you chose hold ${held}, which is ${held - need} more than the minimum.`
                    : `The parties you chose hold ${held}, which is ${need - held} short.`}
              </p>
              <div
                className="h-3 w-full overflow-hidden rounded-full border border-line bg-paper"
                role="img"
                aria-label={`${held} of ${need} seats needed`}
              >
                <div
                  className={reached ? 'h-full bg-green' : 'h-full bg-gold'}
                  style={{
                    width: `${Math.min(100, total === 0 ? 0 : (held / need) * 100)}%`,
                  }}
                />
              </div>
              <p className="m-0 text-site-sm font-semibold">
                {reached ? 'Passes half the seats.' : 'Does not pass half the seats.'}
              </p>
            </div>

            <h3 className="m-0 mt-2 font-semibold">Smallest groups that pass half</h3>
            {sets.length === 0 ? (
              <p className="m-0 text-site-sm">No group of four or fewer of these parties passes half.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-site-sm">
                {sets.slice(0, 12).map((s) => (
                  <li
                    key={s.ids.join('+')}
                    className="rounded-md border border-line bg-white px-3 py-2"
                  >
                    {s.ids.map(name).join(' + ')}{' '}
                    <span className="font-mono text-slate">· {s.seats} seats</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="m-0 text-site-caption text-slate">
              Groups of up to four parties. A group is listed only if every member is needed: take
              any one away and it drops to half or below.
            </p>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection className="pb-[88px]">
        <p className="m-0 max-w-[48em] text-site-caption text-slate">
          Counting seats is not the whole story. Which decisions need a simple majority, what counts
          as a quorum, and how a mayor is elected are set by law and by the council’s own rules, and
          this tool does not model them. Source for the examples: the Electoral Commission’s Seat Calculation
          Detail reports for the 2026 local government elections, and for JB Marks, 2021.
        </p>
      </SiteSection>
    </>
  );
}
