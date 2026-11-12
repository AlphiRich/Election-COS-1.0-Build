---
name: voter-intelligence
description: Produce the Election-COS Voter Intelligence report (council seats, coalition arithmetic, ward map, competitive wards) for ANY of the 213 South African metro and local councils from the certified LGE 2026 results. Use when asked for an intelligence report, ward analysis, coalition arithmetic or "the JB Marks report for [another municipality]", or when refining the research section with municipal analysis. Computes from data in the repository; never types figures per municipality.
---

# Voter Intelligence, for any council

The instrument started as a one-municipality sheet for JB Marks whose figures were typed in and partly labelled "sample". It is now a computation over the Commission's certified results, so the same report exists for every council.

## Run it

```bash
cd election-cos-app
npx vite-node scripts/build-voter-intelligence.ts --list          # every council code, name, province
npx vite-node scripts/build-voter-intelligence.ts NW405           # JB Marks
npx vite-node scripts/build-voter-intelligence.ts BUF --out reports
```

Writes `reports/voter-intelligence-<code>.html` (self-contained: no scripts, fonts embedded) and `.json` (the same figures). An unknown code exits 1; it never produces a report for a council it does not have.

In the application it is `/analytics/voter-intelligence` (a council selector over the same module). The code is `src/modules/lge2026/voterIntelligence.ts`; read its header first.

## What the report contains (all computed)

1. **Council**: seats, wards, list seats, majority line, who holds what, registered voters, PR-ballot turnout, hung or not.
2. **Coalition arithmetic**: every *minimal* winning combination of parties (no member could leave and still leave a majority), fewest parties first. What-if arithmetic on seats; never a forecast or a statement of what a party will do. Independents are excluded (they are not a bloc).
3. **Ward map**: each ward's leader, its share and its margin over the runner-up, in the tiers Safe (>60%), Comfortable (50 to 60), Marginal (40 to 50), Contested (<40).
4. **Competitive wards**: margin under 10 points, and the share of registered voters in them.

## What it must NOT contain

- **No figure that is not computed from the repository's results.** The original sheet had demographic estimates, a 2016 trend, special-vote counts and a ward list labelled "sample". None of those has a source in this build, so none appears. If asked for one, say it is not in the build and what would be needed (a sourced Census table, the 2016 certified results, the Commission's special-vote counts), then stop. Do not estimate.
- **No "psychographic segments" or race-linked voter profiles.** They cannot be derived from results, and race-linked profiling of voters is a POPIA special-personal-information question. Decline and say why.
- **No prediction.** Say "what-if", "arithmetic", "not a forecast".

## Before you hand a report over

1. Read `iecStatus` in the JSON. If it is not `reconciled`, say so in the first paragraph: the Commission's own seat report for that council is `laterCount`, `incomplete` or `notPublished`, so the seats are not fully confirmed. (Five councils today: Mnquma, King Sabata Dalindyebo, Matjhabeng, Ray Nkonyeni, Msunduzi.)
2. Sanity-check against `src/modules/lge2026/nationalResults.ts` for that code: seats add up to the council's size; the tier counts add up to the ward count.
3. Look at the rendered HTML at phone width (390 px). The report must not scroll sideways.
4. If a council shares a name with another (two are called Emalahleni), use the code, not the name.

## Extending it

Add the new measure to `voterIntelligence.ts` with a test in `voterIntelligence.test.ts`; the sweep test there runs every one of the 213 councils, so a measure that breaks for one council fails the build. A measure needs a named source in `src/data`; if it has none, it does not go in.

## The related tools

`/analytics/lge-2026-results` (full tables, North West), `/analytics/lge-2026-party` (one party's candidates against its result, checked against the Commission's list; `tools/candidates/verify-party-list.py`), `/analytics/hub`.
