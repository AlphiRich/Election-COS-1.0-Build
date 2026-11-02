/**
 * Which parties the scenario tools can model, per the 2026 candidate list.
 * Shown on Ward Comparison and the Scenario Runner so nobody reads a missing party as an oversight.
 */
import { NW405_2021_EXAMPLE } from './nw405Example';
import {
  NW405_PARTY_LIST_SOURCE,
  displayNameFor,
  entrantsWithout2021,
  notOnList,
} from './nw405Parties2026';

export function PartyListNotice() {
  const off = notOnList(NW405_2021_EXAMPLE.parties);
  const entrants = entrantsWithout2021();
  return (
    <details className="text-body-md font-body">
      <summary className="cursor-pointer font-semibold">Which parties can be modelled</summary>
      <div className="mt-2 space-y-2">
        <p>
          Swings can be set for the five parties that both contested 2021 and are on the 2026 list.
          Their 2021 result is the baseline.
        </p>
        <p>
          <strong>
            On the 2026 list with no 2021 result in this municipality ({entrants.length}):
          </strong>{' '}
          {entrants.map((p) => p.displayName).join('; ')}. A swing is a change from a 2021 result,
          so these cannot be given one. They are not in the projection, and the projection does not
          say how many votes they take from the others.
        </p>
        <p>
          <strong>Contested in 2021 and not on the 2026 list ({off.length}):</strong>{' '}
          {off.map((p) => displayNameFor(p.id, p.name)).join('; ')}. Their 2021 votes stay in the
          baseline because the model has no data on where those voters go.
        </p>
        <p className="text-caption text-slate">{NW405_PARTY_LIST_SOURCE}</p>
      </div>
    </details>
  );
}
