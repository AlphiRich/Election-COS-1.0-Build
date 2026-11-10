/**
 * Election Campaign OS — charts for a party profile.
 *
 * Plain SVG from the design tokens. Used by the in-app page and by scripts/build-party-report.ts (server-rendered into
 * the standalone report), so the two can never show different numbers. Every figure is a prop; nothing is typed here.
 * One rule for colour: where a bar's colour carries meaning (finishing position) the legend says so, and the value is
 * also written on the bar or in the table beside it, so colour is never the only channel.
 */
import { tokens } from "@/design/tokens";
import { partyLabel } from "./lge2026Results";
import type { ListDepthRow, WardCandidate } from "./partyProfile";

const C = tokens.color;
const FONT = tokens.font;
const posColour = (pos: number) =>
  pos === 1 ? C.green : pos === 2 ? C.gold : pos === 3 ? C.teal : C.slate;
const posName = (pos: number) =>
  pos === 1
    ? "Led the ward"
    : pos === 2
      ? "Second"
      : pos === 3
        ? "Third"
        : "Fourth or lower";

export function WardShareChart({
  wards,
  title,
}: {
  wards: WardCandidate[];
  title: string;
}) {
  const W = 760;
  const H = 280;
  const L = 36;
  const T = 24;
  const B = 36;
  const max = Math.max(
    30,
    Math.ceil(Math.max(...wards.map((w) => w.share)) / 10) * 10,
  );
  const bw = (W - L - 8) / wards.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const top3 = new Set(
    [...wards]
      .sort((a, b) => b.share - a.share)
      .slice(0, 3)
      .map((w) => w.ward),
  );
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={title}
          style={{
            width: "100%",
            minWidth: 620,
            height: "auto",
            display: "block",
          }}
        >
          {Array.from({ length: max / 10 + 1 }, (_, i) => i * 10).map((g) => (
            <g key={g}>
              <line
                x1={L}
                x2={W - 8}
                y1={y(g)}
                y2={y(g)}
                stroke={C.line}
                strokeWidth={1}
              />
              <text
                x={L - 6}
                y={y(g) + 3}
                textAnchor="end"
                fontSize={10}
                fill={C.slate}
                fontFamily={FONT.mono}
              >
                {g}%
              </text>
            </g>
          ))}
          {wards.map((w, i) => {
            const x = L + i * bw + 1.5;
            return (
              <g key={w.ward}>
                <title>{`Ward ${w.ward}: ${w.share.toFixed(1)}% (${w.votes} votes), ${posName(w.position).toLowerCase()}`}</title>
                <rect
                  x={x}
                  y={y(w.share)}
                  width={bw - 3}
                  height={y(0) - y(w.share)}
                  rx={2}
                  fill={posColour(w.position)}
                />
                <text
                  x={x + (bw - 3) / 2}
                  y={H - B + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill={C.slate}
                  fontFamily={FONT.mono}
                >
                  {w.ward}
                </text>
                {top3.has(w.ward) && (
                  <text
                    x={x + (bw - 3) / 2}
                    y={y(w.share) - 5}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill={C.ink}
                    fontFamily={FONT.mono}
                  >
                    {w.share.toFixed(1)}
                  </text>
                )}
              </g>
            );
          })}
          <text
            x={L + (W - L) / 2}
            y={H - 4}
            textAnchor="middle"
            fontSize={10}
            fill={C.slate}
            fontFamily={FONT.body}
          >
            Ward number
          </text>
        </svg>
      </div>
      <Legend
        items={[1, 2, 3, 4]
          .filter((p) =>
            wards.some((w) => (p === 4 ? w.position >= 4 : w.position === p)),
          )
          .map((p) => ({ colour: posColour(p), label: posName(p) }))}
      />
    </figure>
  );
}

export function PositionChart({
  positions,
  total,
}: {
  positions: Record<number, number>;
  total: number;
}) {
  const rows = Object.entries(positions)
    .map(([k, v]) => ({ pos: Number(k), n: v }))
    .sort((a, b) => a.pos - b.pos);
  const W = 360;
  const rowH = 26;
  const H = rows.length * rowH + 8;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Number of wards by the party's finishing position"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {rows.map((r, i) => (
        <g key={r.pos}>
          <text
            x={0}
            y={i * rowH + 18}
            fontSize={11}
            fill={C.ink}
            fontFamily={FONT.body}
          >
            {r.pos}
            {
              ["th", "st", "nd", "rd"][
                r.pos % 10 > 3 || Math.floor(r.pos / 10) === 1 ? 0 : r.pos % 10
              ]
            }
          </text>
          <rect
            x={34}
            y={i * rowH + 6}
            width={Math.max(2, ((W - 110) * r.n) / max)}
            height={16}
            rx={2}
            fill={posColour(r.pos)}
          />
          <text
            x={34 + Math.max(2, ((W - 110) * r.n) / max) + 6}
            y={i * rowH + 18}
            fontSize={11}
            fontWeight={700}
            fill={C.ink}
            fontFamily={FONT.mono}
          >
            {r.n} of {total}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ListDepthChart({
  rows,
  highlight,
}: {
  rows: ListDepthRow[];
  highlight: string;
}) {
  const W = 760;
  const rowH = 34;
  const H = rows.length * rowH + 30;
  const L = 250;
  const max = Math.max(...rows.map((r) => Math.max(r.prSeats, r.eligible)));
  const sx = (v: number) => ((W - L - 200) * v) / max; // leaves room for the value label after the longest bar
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="List seats won against names on the published PR list, by party"
          style={{
            width: "100%",
            minWidth: 560,
            height: "auto",
            display: "block",
          }}
        >
          {rows.map((r, i) => {
            const y0 = i * rowH + 6;
            const mine = r.party === highlight;
            return (
              <g key={r.party}>
                <text
                  x={L - 10}
                  y={y0 + 17}
                  textAnchor="end"
                  fontSize={12}
                  fontWeight={mine ? 700 : 400}
                  fill={C.ink}
                  fontFamily={FONT.body}
                >
                  {partyLabel(r.party)
                    .replace(
                      "Vryheidsfront Plus | Freedom Front Plus",
                      "Freedom Front Plus",
                    )
                    .replace(
                      "Concerned Potchefstroom Residents",
                      "Concerned Potch. Residents",
                    )
                    .replace("African Christian Democratic Party", "ACDP")
                    .replace("South African Communist Party", "SACP")
                    .replace("Umkhonto Wesizwe Party", "MK")
                    .replace("Economic Freedom Fighters", "EFF")
                    .replace("Democratic Alliance", "DA")
                    .replace("Patriotic Alliance", "PA")}
                </text>
                <rect
                  x={L}
                  y={y0}
                  width={Math.max(2, sx(r.prSeats))}
                  height={11}
                  rx={2}
                  fill={C.ink}
                />
                <rect
                  x={L}
                  y={y0 + 13}
                  width={Math.max(2, sx(r.eligible))}
                  height={11}
                  rx={2}
                  fill={C.gold}
                />
                <text
                  x={L + Math.max(sx(r.prSeats), sx(r.eligible)) + 8}
                  y={y0 + 17}
                  fontSize={11}
                  fontWeight={700}
                  fill={r.unfilled > 0 ? C.maroon : C.slate}
                  fontFamily={FONT.mono}
                >
                  {r.prSeats} seat{r.prSeats === 1 ? "" : "s"} · {r.eligible}{" "}
                  name{r.eligible === 1 ? "" : "s"}
                  {r.unfilled > 0 ? ` · ${r.unfilled} unnamed` : ""}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <Legend
        items={[
          { colour: C.ink, label: "List seats won" },
          { colour: C.gold, label: "Eligible names on the published PR list" },
        ]}
      />
    </figure>
  );
}

function Legend({
  items,
}: {
  items: Array<{ colour: string; label: string }>;
}) {
  return (
    <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontFamily: FONT.body, fontSize: 14, color: C.slate }}>
      {items.map((i) => (
        <li key={i.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              background: i.colour,
              width: 12,
              height: 12,
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
