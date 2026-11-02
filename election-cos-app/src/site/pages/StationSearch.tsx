/**
 * Election Campaign OS — JB Marks voting-station search, with map links
 *
 * Shared by the voter-details checklist and the election-day guide.
 * Map links are name searches, labelled as such: see `tools/mapLinks.ts`.
 */
import { useState } from 'react';
import { JB_MARKS_SOURCE, findStations } from '../tools/wardFinder';
import { stationMapLinks } from '../tools/mapLinks';

const nf = new Intl.NumberFormat('en-ZA');
const PLACE = 'JB Marks, North West';

export function StationSearch({ idPrefix = 'station' }: { idPrefix?: string }) {
  const [q, setQ] = useState('');
  const hits = findStations(q);

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={`${idPrefix}-q`} className="font-semibold">
        Ward number or station name
      </label>
      <input
        id={`${idPrefix}-q`}
        type="search"
        className="site-field"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        placeholder="12, or school, or church"
      />
      <div role="status" aria-live="polite">
        {q.trim() !== '' && hits.length === 0 && (
          <p className="m-0 text-site-sm">
            No match. Try fewer letters, or check the Electoral Commission’s list of voting
            stations.
          </p>
        )}
      </div>
      {hits.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {hits.slice(0, 25).map((h) => {
            const m = stationMapLinks(h.stationName, PLACE);
            return (
              <li
                key={`${h.wardNumber}-${h.vdCode}`}
                className="rounded-[10px] border border-line bg-white p-4"
              >
                <p className="m-0 font-semibold">
                  Ward {h.wardNumber} · {h.stationName}
                </p>
                <p className="m-0 mt-0.5 text-site-caption text-slate">
                  {nf.format(h.stationVoters)} registered voters at delimitation
                  {h.splitAcrossWards && ' · serves more than one ward'}
                </p>
                <p className="mb-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-site-sm font-semibold">
                  <a href={m.googleDirections} className="text-teal">
                    Directions in Google Maps
                  </a>
                  <a href={m.google} className="text-teal">
                    Google Maps
                  </a>
                  <a href={m.apple} className="text-teal">
                    Apple Maps
                  </a>
                  <a href={m.waze} className="text-teal">
                    Waze
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {hits.length > 25 && (
        <p className="m-0 text-site-caption text-slate">
          Showing the first 25. Narrow the search to see the rest.
        </p>
      )}
      <p className="m-0 text-site-caption text-slate">
        Map links search for the station by name. They are not pins supplied by the Electoral
        Commission, so confirm your station with the Commission before you travel. Source for names:{' '}
        {JB_MARKS_SOURCE}
      </p>
    </div>
  );
}
