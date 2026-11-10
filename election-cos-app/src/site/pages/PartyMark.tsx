/**
 * Election Campaign OS — public site, a party shown by its emblem and name.
 *
 * The emblem is the one the Electoral Commission publishes with its results (tools/lge2026/fetch-party-emblems.mjs), so a
 * reader finds their party by the picture they know from the ballot instead of reading every name. Every party gets the
 * same size, frame and position. Where the Commission serves no emblem the party gets a plain badge with its initials,
 * never a substitute image.
 *
 *   stack:  emblem above, name beneath (legends, chips, cards)
 *   inline: emblem beside the name (table rows, lists)
 */
import emblemIds from '@/data/lge2026/party-emblem-ids.json';

const HAS = new Set(emblemIds as string[]);

/** IND (independents, merged) has the Commission's independents emblem; TIED (a seat undecided by a tie) has none. */
function emblemSrc(id: string): string | null {
  return id !== 'TIED' && HAS.has(id) ? `/party-emblems/${id.toLowerCase()}.png` : null;
}

function initials(name: string): string {
  const words = name.replace(/[|()]/g, ' ').split(/\s+/).filter((w) => w && !/^(of|the|and|for|a)$/i.test(w));
  return (words.length > 1 ? words.slice(0, 3).map((w) => w[0]) : [name.slice(0, 2)]).join('').toUpperCase();
}

export function Emblem({ id, name, size = 32 }: { id: string; name: string; size?: number }) {
  const src = emblemSrc(id);
  const box = { width: size, height: size };
  return src ? (
    <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="flex-none rounded-[4px] border border-line bg-white object-contain" style={box} />
  ) : (
    <span aria-hidden="true" className="flex flex-none items-center justify-center rounded-[4px] border border-line bg-paper font-mono text-site-micro font-semibold text-slate" style={box}>
      {id === 'TIED' ? '?' : initials(name)}
    </span>
  );
}

export function PartyMark({ id, name, size = 32, layout = 'inline', detail }: { id: string; name: string; size?: number; layout?: 'inline' | 'stack'; detail?: string }) {
  if (layout === 'stack') {
    return (
      <span className="inline-flex w-[88px] flex-col items-center gap-1 text-center">
        <Emblem id={id} name={name} size={size} />
        <span className="line-clamp-2 text-site-micro leading-tight">{name}</span>
        {detail && <span className="font-mono text-site-micro font-semibold">{detail}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Emblem id={id} name={name} size={size} />
      <span className="min-w-0">{name}</span>
    </span>
  );
}

/** A row of emblems with name and seats beneath: the key that tells a reader which party is where. */
export function PartyLegend({ holders, max = 12 }: { holders: Array<{ id: string; name: string; seats: number }>; max?: number }) {
  const shown = holders.slice(0, max);
  const rest = holders.slice(max);
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-3 p-0">
      {shown.map((h) => (
        <li key={h.id}>
          <PartyMark id={h.id} name={h.name} layout="stack" detail={`${h.seats}`} />
        </li>
      ))}
      {rest.length > 0 && (
        <li className="flex w-[88px] items-center justify-center text-center text-site-micro text-slate">
          +{rest.length} more, {rest.reduce((s, h) => s + h.seats, 0)} seats
        </li>
      )}
    </ul>
  );
}
