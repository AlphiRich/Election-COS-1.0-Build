/**
 * Election Campaign OS — public site, how coalitions work
 * (`/tools/how-coalitions-work`)
 *
 * Arithmetic only: which groups of parties pass half the seats. It does
 * not know any real agreement, does not say which coalition is likely or
 * lawful, and carries no party's current seat count. It starts from the
 * 2021 JB Marks result, labelled as history, so that the page has real
 * numbers on it and none invented.
 */
import { useMemo, useState } from 'react';
import { Eyebrow, SiteCard, SiteSection } from '../SiteChrome';
import { allocateSeats } from '@/modules/analytics/seatCalculator';
import { NW405_2021_EXAMPLE } from '@/modules/analytics/nw405Example';
import {
  majorityThreshold,
  minimalMajorities,
  seatsHeld,
  type SeatHolder,
} from '../tools/coalition';

function exampleHolders(): SeatHolder[] {
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
  const [holders, setHolders] = useState<SeatHolder[]>(exampleHolders);
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const total = holders.reduce((n, h) => n + h.seats, 0);
  const need = majorityThreshold(total);
  const held = seatsHeld(holders, chosen);
  const reached = total > 0 && held >= need;
  const sets = useMemo(() => minimalMajorities(holders), [holders]);
  const name = (id: string) => holders.find((h) => h.id === id)?.name ?? id;
  const isExample = JSON.stringify(holders) === JSON.stringify(exampleHolders());

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
              {isExample ? 'Worked example: JB Marks council, 2021' : 'Your seat numbers'}
            </h2>
            <p className="m-0 text-site-caption text-slate">
              {isExample
                ? 'Seats as allocated from the real 2021 result, on 2021 boundaries. History, not a forecast.'
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
                  <label htmlFor={`co-${i}`} className="min-w-0 flex-1 truncate">
                    {h.name}
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
                setHolders(exampleHolders());
                setChosen(new Set());
              }}
            >
              Reset to the 2021 example
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
            {sets === null ? (
              <p className="m-0 text-site-sm">Too many parties to list the combinations here.</p>
            ) : sets.length === 0 ? (
              <p className="m-0 text-site-sm">No group of these parties passes half.</p>
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
              A group is listed only if every member is needed: take any one away and it drops to
              half or below.
            </p>
          </SiteCard>
        </div>
      </SiteSection>

      <SiteSection className="pb-[88px]">
        <p className="m-0 max-w-[48em] text-site-caption text-slate">
          Counting seats is not the whole story. Which decisions need a simple majority, what counts
          as a quorum, and how a mayor is elected are set by law and by the council’s own rules, and
          this tool does not model them. Source for the example: the Electoral Commission’s seat
          calculation report for JB Marks, 2021.
        </p>
      </SiteSection>
    </>
  );
}
