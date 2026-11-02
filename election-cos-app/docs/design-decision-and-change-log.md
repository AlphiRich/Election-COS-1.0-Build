# Design Decision & Change Log — Audit Register

One place recording what was supplied, what was adopted, what was rejected,
and why. Open from session 31 onward; earlier sessions are recorded in
`BUILD-STATUS.md` and `docs/manual-and-legal-instruments.md`, which this
does not duplicate.

Each entry carries: **what arrived**, **the decision**, **the reason**, and
**where it landed in the code**. A rejection is an entry like any other —
the register exists so that a rejected asset does not arrive again looking
new.

---

## Session 31 — screen designs, edge/config guidance, security review

Sixteen files arrived in one batch. They are three different kinds of
thing and were triaged as three.

### Intake triage

| # | Asset | Kind | Decision |
|---|---|---|---|
| 1 | `ward_sentiment_comparison_dashboard.html` | Screen design | **Rejected as drawn**, one idea adopted |
| 2 | `3294d616-code.html` — Voter Profile (mobile) | Screen design | Adopted in part |
| 3 | `f40a509d-code.html` — Constituency Seat Allocation | Screen design | Adopted in part |
| 4 | `65f637e8-code.html` — Municipal Incident Report Export | Screen design | **Adopted** — built |
| 5 | Firebase Remote Config norms (17 Sep 2026) | Ops guidance | Deferred, recorded |
| 6 | Cloudflare Edge Worker script | Ops guidance | Deferred, recorded |
| 7–9 | Security Architecture Review (.md/.pdf) | Review of another build | One finding adopted |
| 10–12 | `README` (.md/.docx/.pdf) — security asset package | Another build's manifest | Not applicable |
| 13–15 | `1a09ae76-…` cursor rules (.md/.docx/.pdf) | Agent rules for another build | **Rejected** |
| 16 | `CLAUDE.docx` — security context | Agent rules for another build | **Rejected** |

### The brand on the screen designs is not this product

All four designs are branded **CIVIC ARCHITECT / "SA Elections 2024" /
"Municipal Command"**, with their own Material-3 token set
(`primary #040c30`, `secondary #795907`, `surface #f8f9ff`), Archivo
Narrow + Public Sans, and a `CIVIC_ARCH_v4.2.1` version string in a
footer.

This product is **Election Campaign OS** by Innovation Consult, with a
settled token set in `src/design/tokens.ts` (ink `#1A2246`, gold
`#B7913F`, paper `#F7F4EE`, maroon, teal, green, slate) enforced by
`scripts/check-no-hex.mjs` in CI.

Two of the designs' type tokens are already ours by name —
`display-lg`, `headline-md`, `body-md`, `label-caps`, `data-mono` are the
same scale this build uses. The colour palette is not. **Decision: take
the information architecture, leave the palette.** Nothing from these
files introduces a hex literal; every screen built from them uses the
existing tokens, which is also the only way they would pass `check:hex`.

### What the designs claim that this build will not

Recorded once, because these claims recur across the batch and each was
refused at the point it would have been implemented:

- **"IEC DATABASE CONNECTED"**, "IEC Portal Synchronization", "IEC
  VERIFIED CANDIDATES 218". There is no Commission integration and none
  is possible — SOP-11 says so and `prList.ts` has said so since it was
  written. Verification status in this build is *the party's own record
  that a person checked*.
- **"ENCRYPTION ACTIVE (AES-256)"** in a footer. Not provisioned. The
  build writes no ciphertext rather than a plausible-looking fake, and
  says so on every form that captures an identity number.
- **`840312 **** 082`** as an ID mask, in the candidate roll. Eight of
  thirteen digits, leading with a full date of birth. This is the exact
  mask `src/lib/saIdNumber.ts` was written to refuse, and the same one
  found in the North West candidate list last session
  (`docs/nw-candidate-list-2026-review.md` §5). Not adopted anywhere.
- **"WIN PROBABILITY INDEX 68.4%"**, "100% NOMINATION COVERAGE",
  "TARGET MET". Derived figures with no stated basis. The build's
  standing rule is that a number travels with the sentence that says what
  it is.
- **A click-to-sign signature box** on the incident report. Referrals are
  signed from the signed-in person's own staff record, never from a box
  anybody can click. Carried over to the report.

---

### Entry 31.1 — Ward Sentiment Comparison dashboard: rejected as drawn

**What arrived.** A full ward-comparison dashboard: a sentiment
leaderboard with an index from `+88` to `-91`, a 42-ward heat map, a
"volatility index", a "STRATEGIC ALERT" reading *"Shift identified in
Ward 18 from Neutral to Negative over last 48h — immediate field presence
recommended"*, and a "MUNICIPAL PULSE" feed citing *"increased social
media activity regarding infrastructure delays"*.

**Decision.** Rejected as drawn. Not built.

**Reason.** Three independent grounds, any one of which is sufficient:

1. **It is the thing SOP-08 exists to forbid.** The war-room SOP's
   closing warning is that sentiment here "is the sum of doorstep
   conversations, not a survey of the ward. It has no sampling frame, no
   weighting and no margin of error, and presenting it as a projection is
   the single easiest way to lose an argument about this platform." A
   signed ward index of `-91`, a "volatility" score and a 48-hour trend
   are precisely that presentation. `manual.test.ts` would fail on a
   screen that shipped them.
2. **The data source does not exist.** The design's inputs are social
   media activity and keyword trends. This build holds doorstep sentiment
   recorded by canvassers and nothing else. There is no ingestion, and
   inventing one is out of scope for a screen.
3. **It belongs to a module nobody has.** Ward Sentiment Intelligence is
   `ward-sentiment` in `src/auth/modules.ts` — ward-scoped, not bundled,
   `gatedCapabilities: []`, and documented there as "Not built here yet —
   the entitlement exists ahead of the surface." Building its flagship
   screen without the entitlement gate that landed last session would
   hand every tenant a paid module.

**Adopted from it.** One idea: *comparison across wards is a real need,
and the war room only shows one municipality-wide figure.* Recorded as a
candidate for the `ward-sentiment` module when it is built, gated on the
entitlement, sourced from door records, and labelled as SOP-08 requires.
Not built this session.

---

### Entry 31.2 — Municipal Incident Report Export: adopted and built

**What arrived.** A two-column screen: report configuration on the left
(date range, multi-select wards, four category checkboxes, an official
remarks box), a rendered "paper" document on the right with a letterhead
reading *Innovation Consult — ElectoralOS Civic Infrastructure Division*,
summary blocks (142 total / 28 high priority / 05 wards), an incident
ledger, a click-to-sign signature box, and "Page 1 of 8".

**Decision.** Adopted. Built as `/incidents/report`, reached from the
Incidents page (the primary nav is fixed at nine items by §3.2 and
`nav.test.ts` holds it there — same arrangement as the canvassing round
off Voters).

**Reason.** The information architecture is right and the gap was real.
The design's four categories are *exactly* this build's
`IncidentCategory` enum — Water & Sanitation, Electricity, Roads &
Transport, Public Safety — which is a strong signal the design was drawn
against this data model. The document pipeline
(`PrintDocument` → PDF/DOCX), the letterhead and the ward/severity
metadata all already existed. What did not exist was a way to ask the
question: `IncidentRepository` had `listByStatus` and nothing else, which
answers *what is waiting on us now* (the incidents board's question).
*What did this ward live with last month* had no read at all.

**What changed from the design, and why.**

| Design | Built | Reason |
|---|---|---|
| "+ 136 additional records truncated for preview", "Page 1 of 8" | Every incident in the range is printed | A total that stops describing the table beneath it is the one failure this report cannot survive. `incidentReport.test.ts` prints 40 incidents and asserts all 40 appear. |
| Click-to-tap signature box | "Prepared by", from the signed-in person's staff record | Referrals are signed from a real staff record and never from a box anybody can click. The report is prepared, not signed. |
| "FOR OFFICIAL REVIEW" stamp | `REPORT_BASIS` as the first block | It is a campaign record of faults its own people logged; nothing in it has been verified by the municipality. |
| Free-text "Official Remarks" appended to the footer | Not built | An "official remarks" box on a document a reader may take as official is an invitation to write something the campaign cannot stand behind. The description fields already carry what was recorded at the time. |
| Photographs implied in the ledger | Noted, never reproduced | §6.4 keeps images out of generated documents. The report says which incidents carry them so they can be retrieved. |

**Where it landed.**
- `src/dal/ports/incidents.ts` + adapter — `listByDateRange`, narrowed by
  geographic scope like every other read.
- `src/modules/incidents/report/incidentReport.ts` — the selection, the
  counts and the document.
- `src/modules/incidents/report/IncidentReportPage.tsx` — the screen.
- `src/modules/incidents/report/incidentReport.test.ts` — 14 guards.
- Link added to `IncidentsPage`.

**Guard proven by injection:** the row loop capped at six, exactly as the
design drew it. Fails.

---

### Entry 31.3 — Voter Profile (mobile): adopted in part, most fields refused

**What arrived.** A mobile voter profile: name, address, sentiment pill
("Lean Support"), registration status, quick actions, a demographics
block (`VOTER ID ZA-992-0481`, `54 / Male`, full phone `+27 82 555 0192`,
full email), tagged "primary concerns", an engagement-history timeline
(canvass / phone / SMS) and a map thumbnail.

**Decision.** Not built this session. Recorded with the specific reasons,
because most of what makes this screen look useful is data this build
deliberately does not hold.

**Reason, field by field.**

- **Sentiment pill, name, ward, household address** — real. This build
  holds all of it, and `VoterCard` already shows most.
- **Full contact number** — refused. Numbers are stored masked
  (`phoneMasked`), and unmasking is a server operation that writes an
  audit event. A profile screen printing `+27 82 555 0192` would undo
  that.
- **Email address** — not held. `Voter` has no email field and adding one
  to match a mockup would be collecting personal information for a
  screen's sake.
- **`54 / Male`** — not held, and not to be derived. Age and sex are not
  on the voter record. The only place a date of birth or sex marker could
  come from is an identity number, and `saIdNumber.ts` exists partly to
  refuse exactly that inference.
- **`VOTER ID ZA-992-0481`** — not a real identifier in this build, and
  not one the IEC issues in that form.
- **"Registered" status pill** — refused. This platform cannot check
  anybody against the voters roll. A green "Registered" tick would be the
  same false claim as the candidate screen's "IEC VERIFIED".
- **Engagement history timeline** — the genuinely valuable idea, and the
  one real gap. This build holds `contactStatus` and `lastContactedAt` on
  the household and diary entries on the shift, but no per-voter
  interaction log. Building one is a data-model change, not a screen, and
  is recorded here as a candidate rather than improvised.

**Adopted.** Nothing built. The engagement-history gap is the item worth
carrying forward.

---

### Entry 31.4 — Constituency Seat Allocation: the ward roll adopted, the rest refused

**What arrived.** A dashboard with a ward candidate roll table, four
summary tiles (242 wards contested / 218 IEC verified / 68.4% win
probability / campaign ACTIVE), a "Ward Coverage Index" dial reading
**100% — TARGET MET**, an incumbent-vs-new ratio, a filing compliance
audit trail with a "VIEW FULL AUDIT LOG" button, and a geospatial ward
map with "SECURE SEATS / BATTLEGROUND / AT RISK" counts.

**Decision.** One part adopted and built — the ward candidate roll, in
honest form. The rest refused.

**Reason.**

- **The ward roll is a real gap.** SOP-11 shipped last session with ward
  candidates as a flat list under the party list. That separation is
  correct, but a flat list cannot answer the question a party actually
  has before nominations close: *which wards do we not have a candidate
  for.* `wardRoll.ts` answers it.
- **"100% — TARGET MET" is the tile rebuilt.** Coverage is now counted
  against the wards actually loaded for the tenant, wards with nobody
  standing are **listed by code rather than summarised as a
  percentage**, and a ward with two candidates is reported as a finding
  rather than counted as covered. A candidate whose ward code is not one
  the tenant has loaded is shown as unplaceable rather than silently
  dropped.
- **"IEC VERIFIED CANDIDATES 218" / "IEC DATABASE CONNECTED"** — refused.
  There is no Commission integration. Verification here is the party's
  own record that a person checked.
- **"WIN PROBABILITY INDEX 68.4%"** — refused. No model, no basis, no
  inputs.
- **`840312 **** 082`** — refused. See the intake note above.
- **"Criminal record checks finalized for all 242 candidates"** in the
  audit trail — refused. This build performs no such check and holds no
  such record.
- **The geospatial map with secure/battleground/at-risk counts** — not
  built. It is the seat calculator's territory (`seatCalculator.ts`,
  property-tested) and would need a projection this build does not make.
- **"VIEW FULL AUDIT LOG"** — adopted, as entry 31.5.

**Where it landed.** `src/modules/candidates/wardRoll.ts`,
`wardRoll.test.ts` (10 guards), and a rebuilt ward section on
`CandidatesPage`.

**Guard proven by injection:** `covered` widened to `>= 1` so a doubled
ward counts as covered, and the orphan branch dropped. Five tests fail.

---

### Entry 31.5 — Audit log viewer: built, and it says what it is not

**What arrived.** Two things pointing at the same hole from opposite
directions: a "FILING COMPLIANCE AUDIT" panel with a "VIEW FULL AUDIT
LOG" button on the Constituency design, and a security review
recommending hash-chained, tamper-evident audit tables.

**Decision.** Built as `/settings/audit`.

**Reason.** `dal.auditLog.listRecent()` has existed since Phase 3, with a
Firestore adapter and a security rule allowing the read to
`settings.permissions` holders. **No screen ever called it.** Three
modules promise an audit event in their own headers — unmasking a
candidate's identity number, exporting the donor ledger, changing a PPFA
threshold — and an administrator asking *who unmasked that number* had no
way to find out and no way to learn that they could not find out. This is
the same shape as the entitlement gate found last session: a port, an
adapter, a rule, and nothing that reads it.

**What the screen says about itself, and why that is the point.** A page
headed "Audit log" makes a claim by its title; outside software the word
means the entries cannot have been altered. So:

- It states the property the rules actually give it — append-only from
  inside the application, because `firestore.rules` denies every client
  write — and `auditTrail.test.ts` checks that claim against the rules
  file itself.
- It states plainly that it is **not** tamper-evident: no hash chain,
  and somebody with server credentials could alter it without the record
  showing it. The security review's recommendation is right and is not
  built here.
- It states that ordinary reads are not logged, where the question gets
  asked.
- An empty log explains itself: the functions that write it need a live
  Firebase project, which this build does not have. An empty page that
  says why beats a page that merely looks quiet.
- An action with no plain-language description shows its raw identifier
  rather than a guessed sentence.

**Where it landed.** `src/modules/settings/auditTrail.ts`,
`AuditLogPage.tsx`, `auditTrail.test.ts` (9 guards), route and Settings
index entry.

**Guard proven by injection:** the integrity sentence rewritten to
"Entries are immutable and cannot be altered once written… a complete and
trustworthy record". Two tests fail.

**Open item.** A hash-chained audit log is a real improvement and is not
built. It belongs with the Cloud Functions work, not with a screen.

---

### Entry 31.6 — Firebase Remote Config norms: deferred, with the reasoning kept

**What arrived.** A well-argued optimisation note: "fetch for next
session" (activate from cache at 0 ms, fetch in the background on a
12–24 hour interval), no fetches bound to generic lifecycle events, and
realtime `addOnConfigUpdateListener` only inside flows that need instant
kill switches, with explicit teardown.

**Decision.** Deferred. Nothing built.

**Reason.** This build uses no Firebase Remote Config at all, and there is
no live Firebase project to configure. Adding the dependency and a
`remoteConfig.ts` now would be writing an optimisation for a system that
does not run — and the emergency-broadcast and kill-switch examples the
note is built around describe features this product does not have.

**What is worth keeping.** The advice is sound and the reasoning is the
kind this build already applies elsewhere (the war room reads one
pre-aggregated counter rather than scanning; SOP-08 explains why). If
Remote Config is ever introduced, the three rules — background fetch,
domain-triggered refresh only, bounded realtime listeners with teardown —
should be adopted as written. Recorded here so the note does not have to
be rediscovered.

**One thing that does not carry over.** The note's example config keys
include `threat_lockdown_level` and `emergency_broadcast_active` driving
UI. A remotely-flipped switch that changes what a campaign's field
workers see, with no record in the tenant, would sit badly beside this
build's discipline that every consequential act is attributable. If it is
built, it needs an audit event.

---

### Entry 31.7 — Cloudflare Edge Worker: deferred, one item flagged as wrong

**What arrived.** A reverse-proxy Worker in front of Firebase Hosting:
cache rules (30 days for static assets, bypass for `/api/*` and
`/auth/*`), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, and a CSP tuned for Firebase
Auth/Firestore. Plus a note to do rate limiting in Cloudflare's WAF
rather than in the Worker.

**Decision.** Deferred — it is deployment configuration, not a screen, and
this build has no deployment target configured. Recorded in full because
the header set is good and should be used when there is one.

**One correction for whoever implements it.** The script sets
`X-XSS-Protection: '1; mode=block'`. That header is deprecated, is
ignored by current Chrome and Firefox, and in its filtering mode has
itself been a source of vulnerabilities; the CSP in the same script is
what actually provides the protection. Do not carry it over.

**Also worth noting.** The CSP includes `script-src 'unsafe-inline'`.
That is a real weakening and is not required by this build — the Vite
output has no inline scripts. Tighten it before deploying rather than
copying it as given.

---

### Entry 31.8 — Security Architecture Review and asset package: not this codebase

**What arrived.** A layer-by-layer efficacy review of a 7-layer
defence-in-depth architecture, plus a README manifest for the asset
package it reviews, plus `CLAUDE.md` and cursor-rules files instructing a
coding agent how to work on it.

**Decision.** Not adopted. One finding taken (entry 31.5). The agent
rules files are **rejected and must not be added to this repository.**

**Reason.** The review is competent and it is about a different system.
Its subject has Prisma and Postgres, `src/middleware/validate.ts`,
ModSecurity WAF rules, a `cicd/security-gate.py`, gVisor sandboxing and
LLM agent tool registries. This build is a Firebase/Firestore
offline-first PWA with no server middleware, no ORM, no Postgres, no AI
agents and no WAF. None of the seven layers maps onto it.

**Why the agent rules are rejected rather than merely inapplicable.**
`CLAUDE.docx` instructs, as always-do rules: *"Update
`prisma/schema.prisma` + a migration for any new data model"*, *"Never
parse XML with @xmldom/xmldom"*, *"Merge if `cicd/security-gate.py` exit
code != 0"*. None of those files exist here. Dropping this in as
`CLAUDE.md` would give every future session a set of instructions whose
subject is absent — and the specific danger is the PII rule: *"Never
return voter/donor PII without field-level encryption path
(AES-256-GCM)."* This build has documented, deliberately and repeatedly,
that AES-256 is **not provisioned** and that it writes no ciphertext
rather than a plausible-looking fake. An agent told that rule, in this
repository, would either believe encryption exists or invent it. Both are
worse than the honest gap.

**The findings, assessed against this build.**

| Review finding | Applies here? |
|---|---|
| Hash-chained tamper-evident audit | **Yes.** Real gap, screen built, chaining not built — entry 31.5. |
| AES-256-GCM PII encryption | Already the documented position and the known gap. Not re-litigated. |
| FIDO2/WebAuthn over TOTP | Plausible, but this build has no MFA at all and no live Auth project. An infrastructure decision for provisioning, not a screen. |
| DDoS / Anycast / bot management | Infrastructure. See entry 31.7. |
| mTLS for east-west traffic | No microservices. There is no east-west traffic. |
| Least-privilege SQL roles, SQL budgets | No SQL. Firestore rules are the equivalent and are already capability-gated. |
| Zod strict schemas at handlers | No request handlers. Validation sits in the DAL and in pure modules, tested. |
| Prompt firewall, ToolRegistry, gVisor | No AI agents in the product. |

---

## Standing decisions confirmed this session

These were already settled and each was re-applied against a supplied
asset that would have broken it. Recorded once so the next batch does not
reopen them.

1. **Tokens, not palettes.** Supplied designs bring their own colours;
   this build has `src/design/tokens.ts` and a CI guard. Take the
   information architecture, leave the palette.
2. **The nine-item nav is fixed** (§3.2, `nav.test.ts`). New screens hang
   off a parent page or off Settings.
3. **No IEC integration, in any screen, ever, until one exists.**
4. **No fabricated ciphertext**, and no field named "encrypted" holding
   something that is not.
5. **No identity-number mask wider than four digits.**
6. **A figure travels with the sentence that says what it is.** No
   indices, coverage dials or probability scores without a stated basis.
7. **Nothing truncates silently.** Reports print everything or say what
   was excluded.

## Carried forward

- Per-voter engagement history (entry 31.3) — a data-model change.
- Hash-chained audit log (entry 31.5) — Cloud Functions work.
- Ward sentiment comparison (entry 31.1) — when `ward-sentiment` is built,
  gated on the entitlement, sourced from door records.
- Remote Config rules (entry 31.6) and edge headers (entry 31.7) — when
  there is a project and a deployment target.

---

## Session 32 — NW405 ward/VD GeoJSON export

### Entry 32.1 — The payload is our own seed; the geometry is generated

**What arrived.** A GeoJSON `FeatureCollection` for JB Marks (NW405):
34 wards claimed in the metadata, each feature carrying ward number,
code, registered voters, a voting-district list with per-VD voter counts
and `split` flags, and a `Point` geometry. Metadata cites *North West
Provincial Gazette No. 8929*. The paste truncated partway through ward 21,
so wards 1–20 were compared in full.

**Decision.** No re-seed. Geometry rejected. Nothing imported.

**Reason 1 — the data is already ours, exactly.** Every ward total, every
VD code, every per-VD voter count and every `split` flag in wards 1–20
matches `seed-data/jb-marks-nw405-wards-vds.json` byte for byte. The
per-ward totals are also internally consistent: each ward's
`registeredVoters` equals the sum of its VDs' counts, in all twenty. This
is a re-export of the seed this build already parsed from Gazette 8929,
with geometry added. The gazette citation is likewise already recorded, in
`docs/nw405-seed-data.md` and `docs/dha-idvs-and-provincial-scale-review.md`.

**Reason 2 — the geometry is a lattice, not a set of centroids.** Every
one of the twenty points satisfies, exactly:

```
lon = 27.097 + 0.05 × (wardNumber mod 6)
lat = −26.7145 + 0.05 × floor(wardNumber / 6)
```

Six distinct longitudes, four distinct latitudes, 0.05° spacing on both
axes, no exceptions. Real ward centroids do not fall on a grid derived
from the ward's own number. These are placeholder positions generated from
the index.

They are also geographically wrong, which is the part that matters if
anybody were tempted to use them as "close enough". The lattice spans
roughly 25 km × 17 km east and north of Potchefstroom. JB Marks is the
merged Tlokwe–Ventersdorp municipality; Ventersdorp sits roughly 60 km
north-west and falls outside the box entirely. Ikageng and Promosa wards
land in a neat row out in open country.

**Consequence for the map.** Three of last session's supplied designs had
map panels, and each was refused for want of real geometry (entries 31.3,
31.4). This file would have been that geometry. It is not, so the map
stays unbuilt and the reason is now specific rather than general: **this
build has no ward boundaries and no ward centroids.** `Household.geo`
holds real GPS captured at doors by canvassers, which is the only true
coordinate data in the product, and it is not a boundary set.

**What would actually close this.** The Municipal Demarcation Board
publishes ward boundary shapefiles. Nothing short of those, or a
comparable primary source, should populate a ward geometry field — and
when one arrives, the lattice test above is worth running on it first.

---

### Entry 32.2 — Split voting districts: an isolation hole closed

**What the file prompted.** Its `split` flags are the whole subject of the
export, and they pointed at a defect this register had carried as
noted-but-unfixed since the ward seed was built.

**The defect.** `inScope()` in `firestore.rules` narrowed a
voting-district-scoped user on `data.vdCode == token.vdScope` **alone**.
A voting district is a polling station's roll, and a station's roll can be
split across wards — **26 of NW405's 108 station codes are** (corrected
in session 33; this entry originally read 24 of 95 — see entry 33.2), and
code `86910239` (Lesego Primary School) across **three** wards: 8, 12
and 16.

So a canvasser assigned to ward 8's portion of Lesego Primary matched, and
could read, every voter at that station in wards 12 and 16 as well. For
close to a quarter of this municipality's stations the VD code was not a
narrowing at all. `VotingDistrict.id` has been `${wardCode}::${vdCode}` since the seed
was built for exactly this reason; the access rule had not followed.

**What made it unfixable until now.** `staffProvisioning.ts` actively
*refused* a ward code on a VD role — *"A voting-district role is narrowed
on the VD, not the ward. Clear it."* That rule was written before the
significance of split stations was understood, and it was enforced by a
test and repeated in SOP-02.

**The fix, at all three layers.**

| Layer | Change |
|---|---|
| `firestore.rules` | The VD branch of `inScope()` now requires `data.vdCode == token.vdScope` **and** `data.wardCode == token.wardScope`. A token with no `wardScope` fails against every real record — fail-closed, which is what a stale token should do. |
| `src/dal/adapters/firestore/base.ts` | `geoScopeConstraints` mirrors it, and keeps the district constraint alone when a token carries no ward rather than dropping its only narrowing. |
| `staffProvisioning.ts` | A VD role now requires both codes; the "clear the ward" rule is gone; `toStaffProfile` carries the ward through to the record, which is what the Cloud Function stamps onto the token. |
| `PermissionsPage` | Shows the ward field for VD roles and explains why. |
| SOP-02 and SOP-12 | Both carry `SPLIT_VD_BASIS` verbatim. A procedure still telling an administrator to leave the ward blank would produce accounts the rules deny. |

**The original concern is preserved.** The rule this replaced existed to
stop a VD role being *widened* to its whole ward, and `geoScope.test.ts`
still asserts the district test is present. Adding the ward is a further
narrowing, not a substitution.

**Guard proven by injection.** Reverting all three layers to
district-only fails four tests across the adapter, the rules scan, the
provisioning validator and the manual.

**Honest limit.** This narrows what a VD-scoped user may *read*. It does
not retroactively change what anyone has already read, and there is no
audit record of past reads to check against — ordinary reads are not
logged (see entry 31.5).


---

## Session 33 — Computational Source Item Control Sheet & Repository Index

### Entry 33.1 — A source-acquisition plan, and an ETL script that fetches nothing

**What arrived.** A planning document for a data-acquisition exercise: six
provinces (NW, GP, FS, LP, EC, KZN) × five LGE cycles (2000, 2006, 2011,
2016, 2021) of IEC ward- and VD-level results, plus Municipal Demarcation
Board delimitation gazettes and shapefiles for the 2024/2026 cycle. A
folder nomenclature (`07_Geospatial_&_Electoral_Historical_Data_Repository`,
`{PROV}_07_Electoral_Data/{MDB_Gazettes,IEC_Results}`), a target data
schema, and a Python ETL script.

**Decision.** Nothing built from the pipeline. One idea extracted and
built — entry 33.2. The plan itself is a data-acquisition programme for a
person to run, not a build task, and it is recorded here so it is not
mistaken for one.

**The script does not do what it prints.** `setup_directory_structure()`
creates folders and works. `scrape_iec_historical_data()` and
`scrape_mdb_gazettes()` each loop over the provinces and years, print a
`> Fetching …` line per item, and `pass`. Every network call is commented
out. Run as given, it prints thirty "Fetching" lines and
`ETL Pipeline complete. The local folder is ready for Drive
synchronization.` — and downloads nothing at all.

That shape matters more than the missing code. A pipeline that announces
per-item progress and then declares completion is one somebody runs, sees
green, and believes. Anyone picking this up should treat the two scrape
functions as unwritten, because they are.

**Unverified in it, and left unverified.**

- `https://api.elections.org.za/results/{year}/LGE/{prov}` — commented
  out, never called, and the script's own note says the IEC API needs
  credentials. This build did not confirm the endpoint exists or has that
  shape, and does not repeat it as fact.
- The MDB "Spatial Hub" as a programmatic source. Plausible; unconfirmed
  from here.
- **The "15% maximum deviation norm"** — extracted and used, but as a
  configured and cited default rather than an asserted rule. See 33.2.

**One objective refused outright.** The plan gives its purpose as a
historical baseline "for the Election Campaign OS sentiment and seat
projection mathematical algorithms."

- **Sentiment.** Past election results are not sentiment and must never be
  blended into it. SOP-08 is explicit that sentiment in this product is
  the sum of doorstep conversations, with no sampling frame and no
  weighting. Feeding results into it would produce a number that looked
  like a poll, was neither, and could not be defended. Refused.
- **Seat projection.** Genuinely useful — but as *inputs a person
  chooses*, not as an automatic baseline. `seatCalculator.ts` is a
  what-if tool that takes party vote figures and shows the allocation; it
  deliberately does not forecast. Historical results would be good
  starting values for that form. That is a data-entry convenience, and it
  needs the data first.

**Scope note.** Six provinces of historical results is a much larger
undertaking than this build's reference municipality, and none of it is
personal information (election results are public aggregates), so there is
no POPIA question here. There is a provenance question: whatever arrives
needs the same treatment the NW candidate list and the ward GeoJSON got.

**Not added to the repository.** The script targets a hardcoded Windows
desktop path on a named user's machine. It is a local utility, and the
repo is not where it belongs.

---

### Entry 33.2 — The deviation norm, built as a real check

**What was extracted.** The document's "Control Metric: Verification
against the 15% maximum deviation norm from the municipal average." It is
the one computational idea in the file, and it is arithmetic over data the
tenant already holds — which is exactly the standard
`seedReconciliation.ts` is built to.

**Why it was worth building.** `reconcileSeed()` checks the ward *count*
and the ward *codes*. It says nothing about ward *sizes*. A seed can have
all 34 wards, no duplicates and correct codes while one ward carries four
times another's voters — which is either a transcription error or a real
fact about the municipality, and a campaign needs to know which, because
it decides how many canvassers a ward needs.

**How the threshold is treated.** The 15% figure is taken from the
supplied note and has **not** been confirmed against the Municipal
Structures Act or the Demarcation Board's published delimitation
methodology; those sources were not reachable from this environment. So it
is a parameter with a stated default and a stated basis, every finding is
a warning, and nothing blocks. Same treatment `prList.ts` gives the party
list-length cap, for the same reason: a wrong hard threshold that flagged
a lawful demarcation would be worse than no check.

**What it found in our own seed, reported without a conclusion.** Run
against `seed-data/jb-marks-nw405-wards-vds.json`:

- 34 wards, 122,059 registered voters, mean **3,590.0** per ward.
- Range **3,052 to 4,127**. The ±15% band is [3,051.5, 4,128.5].
- **Every ward passes**, and the two extremes sit **0.5 and 1.5 voters
  inside the bounds**.
- Three wards share a total of 4,121 (W2, W3, W23) and two share 3,380
  (W15, W28).

That tightness is worth a second look by whoever holds the gazette. It is
what a demarcation drawn to a norm looks like; it is also what generated
figures look like. The module reports the arithmetic and draws no
conclusion about which — the same restraint applied to the ward geometry
in entry 32.1. The distribution across the band is lumpy rather than flat,
which argues against a naive uniform draw, so this is flagged as a
question and not as a finding.

**Where it landed.** `src/modules/wards/wardSizeDeviation.ts`,
`wardSizeDeviation.test.ts` (16 guards), and a panel on the Wards page
beside the seed check.

**Guard proven by injection:** the boundary comparison flipped from `>` to
`>=`, so a ward drawn exactly to the norm's limit reads as a breach.

---

### Entry 33.3 — Correction: the split-station figures shipped wrong

**What was wrong.** Session 32's `SPLIT_VD_BASIS`, the `inScope()` comment
in `firestore.rules`, and entry 32.2 above all said **"24 of 95 station
codes"**. The seed actually holds **108 distinct station codes, of which
26 are split** across wards.

**How it happened, because the mechanism is the useful part.** The figure
was read off a test failure message during the session-32 injection run —
at a moment when the seed had been deliberately truncated to 32 wards to
prove a different guard. The truncated seed really did contain 24 of 95.
SOP-03's own text was never wrong: it says 26 of 108, and
`manual.test.ts` computes both numbers from the seed rather than trusting
the prose, which is why it stayed right while the hand-written strings
drifted.

**Corrected**, in all three places, and the lesson applied:
`wardSizeDeviation.test.ts` now recomputes the counts from the seed and
asserts that `staffProvisioning.ts` and `firestore.rules` both quote them.
A figure quoted in prose is a figure that drifts; a figure a test derives
is not.

**Guard proven by injection:** the strings reverted to "24 of the 95".
Fails.

**No behaviour changed.** The rule fixed in 32.2 is unaffected — the
narrowing was always on both codes, and only the sentence describing how
common the problem is was wrong. It was understated, not overstated.

---

### Entry 33.4 — The pipeline corrected, and download enabled

**Asked for.** Correct the ETL pipeline from entry 33.1 and enable
download.

**Built.** `tools/source-acquisition/` — `acquire.py`, `sources.json`,
`README.md`, plus `src/lib/acquisitionTool.test.ts` holding the two
properties that stop it decaying back into what it replaced.

An operator utility, not part of the application build: nothing in `src/`
imports it, `npm run build` does not touch it, and it stays Python
because it runs on somebody's laptop beside their file sync.

**The correction is about reporting more than code.** The original's two
scrape functions ended in `pass` with every network call commented out —
but the reason that mattered is that it *announced success*: thirty
`> Fetching …` lines and `ETL Pipeline complete. The local folder is ready
for Drive synchronization.` A run that prints per-item progress and then
declares completion is one somebody runs, sees green, walks away from, and
believes.

So:

| Original | Corrected |
|---|---|
| Prints a fetch line per item, downloads nothing | Nothing reported as fetched unless bytes were written **and verified** |
| Always prints "ETL Pipeline complete" | No completion message exists on a failed run; exit `0` only if every selected source succeeded, `1` on any failure, `2` if nothing was attempted |
| No record of what arrived | Every run writes a manifest to `_runs/` — source, outcome, bytes, SHA-256 |
| Would write whatever came back | Streams to `.part`, verifies, renames only on pass; a rejected payload never takes the real filename |
| `C:\Users\<name>\Desktop\…` hardcoded | Defaults to the working directory, `--out` to override |
| "plug in your IEC credentials here" | `auth_env` names an environment variable; no token in the repo, none printed |
| `requests`, `pandas`, `beautifulsoup4` (pandas unused) | Standard library only |

**Verification is deliberately blunt**: minimum size, content type, leading
bytes (`%PDF-`, `PK\x03\x04`), and rejection of an HTML document where a
dataset was expected. That last one is the common silent failure — a
portal answering an unknown path with an error page, HTTP 200, plausible
filename, wrong thing entirely.

**What could and could not be proven here.** The build environment's
network policy denies `elections.org.za`, `demarcation.org.za` and the MDB
ArcGIS portal at CONNECT (403). So no URL in the registry has been fetched
from inside this project, and none is marked `CONFIRMED`.

What *was* proven is the machinery. `--self-test` starts a local HTTP
server, serves six payloads — a good PDF, an HTML error page wearing a
`.pdf` name, an empty response, a truncated one, a right-sized file with
wrong bytes, and a 500 — and asserts exactly one is accepted and **none of
the rejects land on disk**. It passes, with no network and no credentials,
so it gives the same answer on any machine.

The failure path was also demonstrated end to end: running `--fetch`
against the real registry from here produced four `FAILED_NETWORK` rows, a
manifest recording each, `This run did not complete.`, and exit code 1 —
where the original would have printed thirty progress lines and declared
success.

**The registry's two deliberate choices.**

- **`status` per source.** `CONFIRMED` means somebody fetched it and
  checked what came back; `UNCONFIRMED` means it came from a planning note
  and has never been tested. Both download; both are labelled in the
  output and the manifest; the summary always says how many unconfirmed
  sources were involved. Everything ships `UNCONFIRMED`, including the
  North West gazette whose *contents* this build does use — the filename
  is confirmed, the path it sits at is not.
- **Four rows, not thirty.** The supplied plan asked for six provinces ×
  five cycles. A registry of thirty rows nobody has fetched is a list of
  guesses wearing the shape of a plan. One row is kept for the MDB ward
  boundary shapefiles, pointing at the portal's human-facing page because
  nobody has found the download link — that row is the build's largest
  outstanding data gap (entry 32.1) and it gets a row so it stays visible.

`api.elections.org.za/results/{year}/LGE/{prov}` is **not** in the
registry. It was commented out in the script it came from and has never
been called; repeating it as a known URL would be the error this exercise
corrects. A guard asserts it stays out.

**Guards proven by injection:** the completion line hoisted above the
failure return; a source promoted to `CONFIRMED` that nobody fetched; and
the rename moved ahead of verification so an unverified payload takes the
real filename. All three fail.

---

## Session 34 — IEC dataset acquisition and ingestion

### Entry 34.1 — elections.org.za is unreachable from this build

**Asked for.** Rag all pertinent datasets from
`https://www.elections.org.za/pw/` and ingest the IEC's latest
publications.

**Could not be done, and this is the finding rather than an apology.**
The build environment's egress proxy denies the host at CONNECT. Tested
both ways available:

| Attempt | Result |
|---|---|
| `curl https://www.elections.org.za/pw/` | `CONNECT tunnel failed, response 403` |
| `WebFetch` on the same URL | `EGRESS_BLOCKED` |
| `elections.org.za`, `www.elections.org.za` | both refused at CONNECT |

Not one byte was fetched. **No dataset from that site has been ingested,
and none is in the repository.** Anything presented as IEC data in this
build would therefore be invented, and this register exists partly to make
that statement checkable later.

What *was* built is everything that runs the moment the site is reachable
— by an operator, on a machine that can reach it. That is the larger half
of the request and the half that survives this session.

---

### Entry 34.2 — Discovery: harvesting the dataset links

**Built.** `--discover URL` in `tools/source-acquisition/acquire.py`,
with `--suggest-to FILE`.

It scans one page for links ending in a dataset extension, de-duplicates
them, resolves relative URLs, decodes HTML entities, skips anchors,
`mailto:` and navigation, and writes proposed registry rows.

**A link scan, not a crawler.** A crawler turned loose on a government
portal during an election is a way to get a campaign's IP blocked, and the
operator only needs the download index. It reads the one page it is given
and stops.

**Every proposed row is `UNCONFIRMED` with `REPLACE_ME` where a person
must decide** province and category. Inferring `NW` from a filename is the
class of inference that put generated coordinates in a ward file (entry
32.1), so it is not done.

**Proven against a local fixture**, since the real portal is unreachable:
an eight-link page yields four datasets, with the duplicate sidebar link
collapsed and the three non-dataset links dropped. Downloads nothing.

---

### Entry 34.3 — Ingestion: schema, mapping registry, validator

**Built.** `src/modules/ingest/` — `electionResultSchema.ts`,
`ingestResult.ts`, `mappings.ts`, and 29 guards.

**The gap it closes.** This build holds exactly one municipal election
result: JB Marks 2021, transcribed **by hand** in session 8 from an IEC
"Seat Calculation Detail" report and hardcoded in `nw405Example.ts` as the
seat calculator's starter data. A second municipality, or the same one in
2016, meant somebody transcribing a PDF again. There was no schema, no
provenance and no validation — the figures were a TypeScript literal.

**Why the ingester is mapping-driven rather than format-aware.** The
obvious design is a parser that knows the IEC's column names. Nobody here
has seen an IEC results file (entry 34.1), so a parser hardcoding
`PARTY_NAME,VALID_VOTES,WARD_SEATS` would be a guess wearing the shape of
knowledge — and the first real file would either fail loudly (lucky) or
map the wrong column onto votes (not).

So columns are declared once per publication format in a `ColumnMapping`,
and a file with no mapping **reports every column heading it carries and
stops**. That is what makes writing a mapping a two-minute job instead of
a guess. Slower on the first file of a format, identical on every one
after, and the only version that survives the IEC renaming a heading.

**The registry ships one entry** — the report format this build has
actually seen — and says why it is nearly empty. Six plausible untested
mappings would be worse than one honest entry: one would match a file by
accident, map the wrong column onto votes, and produce a result that
validated.

**Proven against the real result, end to end.** The tests write
`NW405_2021_EXAMPLE` out as a delimited file, ingest it, and assert that
what comes back feeds `allocateSeats()` to **the same quota, the same
final council size and the same per-party seat totals** the IEC's own
report printed. An ingester proven against invented data proves nothing
about the data it will meet.

**What it refuses:** an unmapped file; a cell that is not a number
(`Number('')` is `0`, which is how a blank cell becomes a party with no
votes that validates and is false); party votes missing the published
total by more than 0.5%; more ward seats than the council has; a record
marked confirmed with nobody named; a stored result that does not say what
it is for.

**Nothing arrives confirmed.** Parsing is not checking. A person compares
the record against the published source and signs it, and
`CONFIRMED_WITHOUT_SIGNATORY` blocks a flag set without a name.

**`ResultUse` is a closed list of two** — seat-calculator inputs a person
chooses, and reference reconciliation. **Sentiment is not on it and cannot
be added quietly**: a guard asserts the list and fails on a third member.
This is the refusal from entry 33.1 made structural rather than
documentary.

---

### Entry 34.4 — The skill

**Built.** `.claude/skills/iec-data-ingestion/SKILL.md`.

Covers both stages, the refusals, how to add a mapping, and a
**judging-a-supplied-dataset** section listing the failure modes this
project has actually met: generated geometry on a lattice (32.1),
ordinals sold as ward identifiers (NW candidate list §1), a figure bounded
suspiciously tightly (33.2), an over-wide ID mask, and arithmetic that
does not close. Three of the four datasets supplied to this project failed
one of those checks.

A guard asserts the skill only documents flags `acquire.py` actually
implements, and only cites files that exist — a skill naming a flag the
tool does not have sends the next session down a path it cannot walk.

**Guards proven by injection:** fuzzy column matching (the guess the
design refuses); ingest marking its own output CONFIRMED; `SENTIMENT_BASELINE`
added to the permitted uses; and an untested mapping added to the
registry. All four fail.

### What an operator does next

```bash
python3 tools/source-acquisition/acquire.py --self-test
python3 tools/source-acquisition/acquire.py --discover https://www.elections.org.za/pw/ --suggest-to rows.json
# edit rows.json into sources.json — province, category, expectations
python3 tools/source-acquisition/acquire.py --probe
python3 tools/source-acquisition/acquire.py --fetch
# then ingest: no mapping yet, so it prints the file's columns; add one; ingest again; sign it off
```

---

## Session 35 — The proclaimed delimitation for 4 November 2026

Supplied: `Annexure-A-Number_of_Voters-Councillors-Wards_Circular_1_2025.pdf`.

This is the culmination of the delimitation cycle for the 4 November 2026
local government election: wards delimited by the Municipal Demarcation
Board, councillor numbers determined by the provincial MECs for local
government, consolidated by the Electoral Commission into the structure
against which ward and PR candidates are nominated and against which
seats will be allocated. It is final for this cycle.

### Entry 35.1 — Extraction, and what it verified

Seven pages, 273,729 bytes, SHA-256 `fe3361c7…5a78`. **258
municipalities** — 8 metros, 206 locals, 44 districts — with registered
voters, MEC-determined councillors, and for the **214 that have wards**,
the ward count and the delimitation band.

`tools/annexure/extract-annexure-a.py` verifies the SHA-256 before
reading, so a re-run against a different document fails rather than
silently producing a different dataset, and refuses to write unless five
relations hold on every row:

```
norm       == registeredVoters // wards
deviation  == floor(norm * 0.15)
minNorm    == norm - deviation
maxNorm    == norm + deviation
wards      == ceil(councillors / 2)
```

All 214 warded rows satisfy all five. A sixth check works across the whole
table: every local sits inside exactly one district and no metro does, so
the two columns describe the same voters — 16,546,428 each, with DC40's
352,259 exactly NW403 + NW404 + NW405. That identity is what would catch
a dropped or duplicated page, and it also caught a number this build would
otherwise have published: summing all 258 rows gives 44,270,103, which
counts every voter outside a metro twice. The dataset records 27,723,675
and 16,546,428 separately with a sentence saying they are never added.

Recorded in `sources.json` under a new `suppliedDocuments` key with hash,
size and arrival date. **No URL** — the location it was published at is
not known here, and a guessed URL in an acquisition registry is
indistinguishable from a confirmed one six months later (entry 33.1).

### Entry 35.2 — Hardwired as the source of truth, not as a cross-check

**The correction that matters this session.** The first pass treated the
annexure as a reference table to compare against, with every finding
non-blocking on the reasoning that the figures were a 2024 snapshot that
might be superseded. That conflated two different things:

- **The roll** (`RegVoters_2024`) genuinely moves. Every registration
  weekend adds to it.
- **The ward delimitation and the councillor determination** do not. They
  are the proclaimed structure for this election, fixed by statutory
  process across the MDB, the MECs and the Commission.

Treating the second as provisional was wrong, and the build now does not.
`src/modules/reference/municipalRegister.ts` carries
`DELIMITATION_VERSION` (`IEC-CIRCULAR-1-2025-ANNEXURE-A`, electoral event
`LGE-2026-11-04`) and `delimitationFor(code)`, and:

- A tenant ward count that is not the delimited count is **BLOCKING**.
  Every ward-level figure in the application is computed over the wards
  that are loaded, so all of them are wrong until it matches.
- A council size that is not the MEC's determination is **BLOCKING**. The
  quota divides by it.
- A roll difference is **INFO**, never blocking, and the text says the
  delimitation does not move with the roll.
- A guard fails if the old vintage wording — "may be superseded", "not the
  2026 register", "question about which is current" — reappears anywhere
  in the module's basis text.

### Entry 35.3 — PR seats are derived, never stored

**Defect class closed.** Municipality Config had three free number fields:
council seats, ward seats, PR seats. Three chances to disagree with the
delimitation and with each other, and a PR list drawn to the wrong length
is rejected at nomination.

The fields are gone. Entering a municipality code fills all three from the
baseline and shows them read-only; `prSeats` is always
`councillors - wardSeats`, computed, never stored as an independent
figure. A profile saved before this change that still disagrees is
flagged on the page with the proclaimed figures beside it.

A guard asserts `wardSeats + prSeats == councillors` for all 214 warded
municipalities, not just the worked one.

### Entry 35.4 — Category routes the formula family

**Structural refusal added.** A category C district council has no wards
and allocates seats under **Schedule 2** of the Municipal Structures Act,
not the Schedule 1 Item 12 quota `seatCalculator.ts` implements. Running
the Schedule 1 calculator on a district would produce a confident, wrong
answer — the same shape as the Item 16 overhang gap this project has
already met once.

`allocateSeats()` now takes an optional `municipalityCode` and calls
`assertSchedule1Applies()`, which **throws**. A returned flag would let a
caller ignore it and still walk away with a number. Omitting the code
leaves the calculator a what-if tool, which is a legitimate use.

Every allocation also carries `delimitationId`, defaulting to the
proclaimed baseline. The NW405 2021 worked example passes
`LGE-2021-SUPERSEDED` explicitly, so a historical result is never labelled
with today's boundaries.

### Entry 35.5 — The 15% band is the delimitation criterion

**Corrected twice.** Session 33 shipped it as a borrowed figure whose own
basis text admitted it was unsourced. The first pass this session promoted
it to "the IEC's published arithmetic" while still disclaiming the statute.
Both undersold it.

A ward's registered voters may not vary from the municipal norm by more
than 15%; the delimitation was drawn to that criterion; the NW405
provincial delimitation notice states it and Annexure A publishes the
resulting norm and bounds for all 214 warded municipalities. So a ward
outside the band indicates an error in what was captured, not a question
about the demarcation, and `DEVIATION_BASIS` says exactly that. A guard
fails on "not confirmed against", "unverified", "borrowed" or "may be
wrong" returning to that text.

Findings from `analyseWardSizes()` stay WARNING for a narrow technical
reason stated in the module: it works off a computed mean rather than the
published integers, and a roll that has grown since delimitation moves the
mean. `municipalRegister.ts` does the exact comparison and is the one to
believe where the two differ.

### Entry 35.6 — NW405: the two halves of one delimitation product

The seed was parsed from the North West provincial delimitation notice:
34 wards, 122,059 registered voters, range 3,052 to 4,127. The proclaimed
baseline gives NW405 **122,059 registered voters, 34 wards, 67
councillors** — and a band of 3,051 to 4,127, with every delimited ward
inside it and the largest sitting exactly on the maximum.

The annexure fixes how many wards a municipality has; the provincial
notice says where they are. `wardCountMatchesBaseline()` is the join, and
`municipalRegister.test.ts` asserts the agreement by reading both files.

This closes entry 33.2's open question. What was read in session 33 as
possibly-generated tightness is a delimitation drawn to the 15% criterion,
working to its ceiling.

### Entry 35.7 — What the annexure does not contain

Stated so the boundary is clear rather than discovered later. The document
is municipality-level: category, councillors, wards, roll, band. **Ward-by-
ward voter splits and voting-district schedules are not columns in it** —
those come from each province's MDB delimitation notice, which is where
this build's NW405 ward and VD records already come from. The VD data
model (split stations, `${wardCode}::${vdCode}`, entry 32.2) is unchanged
and remains keyed to that notice.

**Guards proven by injection:** a one-voter patch to a single `maxNorm`;
a dropped municipality row; removing the Schedule 2 refusal from
`allocateSeats`; an off-by-one in derived PR seats (fails four tests
including the all-214 invariant); and downgrading the ward-count
contradiction from BLOCKING to WARNING. All fail; reverted clean; 875
tests pass.

---

## Session 36 — NW_07_Repository_Manifest.xlsx

Supplied 30 September 2026, no covering instruction. SHA-256
`e9ac6cb6…efc8`, six sheets, compiled 23 September 2026 from the IEC's
2000–2021 North West results files and the MDB's final 2026 ward layer.
Full review: `docs/nw-repository-manifest-review.md`.

### Entry 36.1 — The first supplied dataset that needed no correction

**Accepted in full.** Four of the five datasets supplied to this project
before now failed a check: generated lattice geometry (32.1), a per-party
ordinal sold as a ward number (NW candidate list §1), an ETL script whose
network calls were commented out (33.1), a deviation norm with no source
(33.2). This one is computed rather than asserted, names every file it was
computed from with a retrieval date and row count, and audits an earlier
report rather than repeating it.

Everything checkable was checked against the proclaimed delimitation and
**every point agreed**: 402 wards for North West, 18 local municipalities,
4 districts, all eighteen per-municipality ward counts exactly, Moretele
at 25, JB Marks at 34, Merafong City sitting in Gauteng as GT484, and all
five retired codes genuinely absent from the 2026 baseline.

The 402 is the one worth restating. The MDB layer is a geometry file from
the Demarcation Board; the annexure is a table from the Commission. Two
artefacts, two production paths, the same 402 wards across the same
eighteen codes — the strongest corroboration the baseline has, and now a
permanent test rather than a note.

**Not imported:** the historical per-year ward counts (2000–2021). This
build holds none of those IEC files and cannot check them, so they are
recorded in the review document as supplied figures and are not
application data. Only the 2026 column is confirmed.

### Entry 36.2 — A municipal code is not an identifier across cycles

**Built.** `src/modules/reference/municipalCodeHistory.ts`.

`NW405` is JB Marks. In the IEC's 2006 North West results it is **Merafong
City** — 26 wards, subsequently moved to Gauteng, now `GT484`. A campaign
that charts "NW405 2006" beside NW405 2021 has put a Gauteng
municipality's history under JB Marks' name, and nothing about the result
looks wrong: the code matches, the province matches, the arithmetic
closes.

This is the one defect class in this area that verification cannot catch,
because **both records are correct and only the join is wrong**. So the
discontinuities are data and `validateResult()` consults them:

- A 2006 NW405 result labelled "JB Marks" is **BLOCKING**, and the message
  says it would otherwise appear in this municipality's own history.
- The same result labelled "Merafong City" is allowed with a **WARNING** —
  it is what the IEC published — telling the reader not to chart it beside
  later results on the same code.
- A result under a code retired by that year (`NW402` in 2021), or dated
  before its municipality existed (`NW405` in 2011, formed from NW401 +
  NW402), is **BLOCKING**.

Also registered: `NW391 + NW395 → NW397`, and `predecessorsOf()` so that
asking for JB Marks' pre-2016 history points at NW401 and NW402 rather
than returning nothing.

**Coverage is stated, not implied.** The manifest covers one province.
`COVERAGE_BASIS` says a code absent from the registry has *not* been shown
to be continuous — it has not been examined — and `codeHistoryCoverage()`
returns `['North West']` so a caller can tell "no discontinuity" from "no
information". A registry implying national coverage would be worse than no
registry, and a guard asserts that sentence stays.

### Entry 36.3 — The acquisition registry, rebuilt on real endpoints

**Corrected.** The biggest standing gap in `sources.json` was that its
URLs were reconstructions. The manifest's `Source_Log` supplies the real
ones: the MDB ArcGIS item `c59982d9f42a4b07929f3781883754e5` (updated
2026-09-01) with its data endpoint, and five IEC results files with row
counts.

- The two guessed IEC ward-results URLs are **removed** — they were
  inferred URL shapes and are now superseded by confirmed VD-level ones.
- `mdb-ward-boundaries-2026` pointed at a human-facing "explore" page; it
  now points at the download endpoint.
- Six rows read `CONFIRMED`. The registry's own promotion rule is
  "somebody fetched it and checked what came back", and the manifest's
  compiler did, on a recorded date, with a recorded row count.

**The honesty guard moved rather than being dropped.** It used to assert
that nothing could be `CONFIRMED` because nothing had been fetched from
here. It now asserts that every `CONFIRMED` row names its verifier and its
date **and states that this build has not fetched it** — which remains
true, since the environment still denies these hosts at CONNECT.

### Entry 36.4 — `expect.min_rows`: the check min_bytes cannot make

**Built.** `min_bytes` catches an empty or truncated download. It cannot
catch a portal that answers with the right content-type, the right
magic bytes, a plausible size, and a fraction of the data — a filter
applied server-side, a page limit, a province parameter ignored. That
failure lands on disk and reports success.

A published results file's row count is known in advance now, so it is
asserted. A floor rather than an equality, deliberately: the IEC may
republish with late adjustments, and a run failing because three more rows
arrived would teach an operator to ignore the check.

The self-test gained a case for it — an export silently truncated to 20 of
500 rows — which fails and leaves nothing on disk.

### Entry 36.5 — Two independent audits, one conclusion

Worth recording for its own sake. The manifest's `Allow_Audit` sheet
checks an earlier "Extraction Protocol Complete" report and finds it
*"FALSE at the time. No files existed. The ETL script it relied on has
`pass` stubs and a commented-out API call."*

That is the finding this project reached independently in session 33 from
reading the script (entry 33.1). Two reviews, no contact, same conclusion.

**Guards proven by injection:** removing the code-history check from
`validateResult` (4 tests fail); making the 2006 name check always pass
(2 fail); and skipping the row check after download (the acquisition
self-test fails and reports the short export as accepted). Reverted clean;
902 tests pass.

### Carried forward from the manifest's open items

- **VD → 2026 ward assignment** — the largest remaining data gap.
  Historical results cannot be restated on today's wards without a spatial
  join of 2026 voting districts to the 2026 ward layer. Nothing in the
  build attempts that restatement and nothing should until the join
  exists.
- **Registered voters per 2026 ward** — the band is no longer the missing
  half of the deviation check (Annexure A publishes it for every warded
  municipality); per-ward registration figures are. The MDB ward
  information tables would supply them. Held for NW405 only, from the
  provincial notice.
- **The other five provinces** — ward counts are already in the baseline;
  the results history and the delimitation notices are not.
- **Turnout denominators** — `RegisteredVoters` repeats on every party row
  in the IEC schema; de-duplicate by voting district × ballot before
  summing. For whoever writes the VD-level mapping.

---

## Session 37 — The other provinces

"Proceed with the other five provinces" — the repository manifest's open
item #4, which named GP, FS, LP, EC and KZN as outstanding against the NW
work already done.

**Done for all eight remaining provinces, not five.** The manifest's index
covered six; the delimitation baseline covers nine, the work is one loop,
and shipping a national product with three provinces missing for no reason
would be an arbitrary stopping point. Flagged here rather than done
quietly. Full figures: `docs/national-delimitation-baseline.md`.

### Entry 37.1 — What could be done without the files, and what could not

The manifest's pipeline was for **historical results**, 2000–2021. This
build holds none of those files and the environment still denies the hosts,
so no province's results history has been ingested and none is claimed.

What was available was better than expected: the delimitation baseline
already covers all nine provinces. Ward counts, council sizes, PR splits,
district structure and the roll for every municipality in the country were
already in hand and only needed deriving and checking. That is the
province-level work; the results history is the download that follows.

### Entry 37.2 — 44 district reconciliations

**Built.** `src/modules/reference/provinceDelimitation.ts`.

A district municipality's registered voters are the sum of the locals
inside it. The annexure carries no column linking the two — but the codes
do: the two digits after the province prefix are the district number, so
`NW371` sits in `DC37`, `EC441` in `DC44`, `WC011` in `DC1` (leading zero
dropped), `KZN212` in `DC21`.

That is an inference, so it is asserted nowhere. It is proved by
consequence: derive membership for all 206 locals, sum each district,
compare against the district row. **All 44 reconcile, every one to the
voter.** Two things follow — the mapping is right, and the annexure's
district rows and local rows agree across the whole country.

Session 35 could only make this check on the whole table at once (total
category C voters equals total category B voters). This is the same check
at a resolution 44 times finer, and it localises a fault instead of only
detecting one: adding a single voter to KZN235 breaks exactly one district
and names it, which is how it was verified.

**Metros are excluded, not assigned.** A category A municipality has
exclusive authority and sits in no district; its code carries no district
digits, so `districtCodeFor()` returns null. A guard fails if it ever
returns a district for any of the eight.

### Entry 37.3 — Per-province delimitation, derived and surfaced

`provinceSummary()` and `allProvinceSummaries()` give each province its
metros, locals, districts, wards, council seats, PR seats and roll — all
derived, none stored. Guards hold `councillors == wards + prSeats` for
every province and the nine provinces adding to the national figures.

Registered voters and council seats exclude district councils, because a
district row repeats its locals' voters. A guard checks the Gauteng summary
is below the double-counted figure, which is the shape of the mistake.

Surfaced on the Wards page beside the municipality's own figures: a
campaign in one municipality still negotiates provincially, and the numbers
were free.

### Entry 37.4 — Results endpoints for every province, honestly graded

`sources.json` goes from 7 rows to 31.

The URL shape is now known from confirmed North West rows:
`.../LGEPublicReports/{eventId}/Downloadable Party Results/{PROV}.csv`,
with event ids 1091 (2021), 402 (2016) and 197 (2011). So 24 rows were
added — eight provinces × three cycles — and the grading is split at
exactly the line where knowledge stops:

- The **event id** is `CONFIRMED`: it is the id North West was fetched from
  for that cycle.
- The **province token** is `INFERRED` from that one confirmed URL. Only
  `NW.csv` has ever been fetched.
- So every new row is `UNCONFIRMED`, its note says which half is which, and
  **no `min_rows` is set** — inventing a row count for a file nobody has
  fetched would make the check a guess that fails honest downloads.

Guards enforce all three: no non-NW results row may read `CONFIRMED`, each
must state what is inferred and what is confirmed, and no `UNCONFIRMED` row
may carry `min_rows`.

The MDB row also became what it actually is — **one national item**, not
nine provincial ones. The province subset is a local operation on one
download. Its note records that the layer should carry 4,488 ward features
nationally *and that this figure is ours, from the baseline, not counted
off the layer*.

### Entry 37.5 — Code-history coverage made visible per province

`provinceReviewStatus()` returns all nine provinces with a review flag;
`unreviewedProvinces()` returns the eight. The Wards page now tells an
operator in an unreviewed province what that means for them.

This matters because silence reads as absence. A campaign in Limpopo
seeing no code warnings would reasonably conclude Limpopo has no
discontinuities — which nobody has established. North West produced six
from twenty-four codes.

### Entry 37.6 — The published table cannot drift

`docs/national-delimitation-baseline.md` is a deliverable somebody will
quote in a meeting, so its table is parsed back in the test suite and
compared cell by cell against the computed summaries. A figure edited in
the doc, or a figure that changes in the data, fails the build.

**Guards proven by injection:** one voter added to KZN235 (the containment
check names DC23 and the national total fails); the leading-zero rule
dropped from district derivation (4 tests fail); metros assigned to a
district by guesswork; and a ward count altered in the published doc table.
All fail; reverted clean; 927 tests pass.

### Still open after this session

- **Results history for every province including North West.** The
  endpoints are in place and graded; nothing has been fetched, because the
  environment denies the hosts. This is a download, not a research task.
- **Code history for eight provinces.** Needs each province's 2000–2021
  results files: list the codes present per cycle, identify every code
  whose municipality changed.
- **Registered voters per 2026 ward**, nationally. The band is published
  for all 214 warded municipalities; per-ward registration is not in the
  annexure and not in the MDB layer. The MDB ward information tables would
  supply it. Held for NW405 only.
- **VD → 2026 ward assignment.** Still the largest gap. Historical results
  cannot be restated on today's wards without a spatial join, and nothing
  in the build attempts that restatement.

---

## Session 38 — The beta build

"Close all the gaps and unfinished code build tasks and functions…
complete the beta version build… deploy onto Firebase."

Three of those four are done. Deployment is wired, verified and blocked
on one credential only the account owner can supply — see 38.6.

### Entry 38.1 — The brand typefaces had never loaded

**Corrected.** The worst finding of the session, and the oldest.

`tailwind.config.js` and `src/design/tokens.ts` have declared Archivo
Narrow, Public Sans and IBM Plex Mono since session 1.
`tokens.test.ts` has asserted since then that the two files agree about
them. **Nothing ever loaded them** — no `<link>` in `index.html`, no
`@import` in `src/index.css`. Every `font-display`, `font-body` and
`font-mono` class in the product fell through to the browser's generic
sans-serif and monospace, for thirty-seven sessions.

The whole type scale — the 0.1em-tracked `label-caps`, the tight display
sizes, the monospaced data lines that make ward codes column up — was
being rendered in the wrong faces. A test suite that compared two config
files to each other could not see it, and nobody had ever looked at the
application, because until this session nobody could (38.4).

Now vendored: 18 woff2 faces in `public/fonts`, generated by
`tools/fonts/vendor-fonts.mjs`, imported through `index.css`.
**Self-hosted rather than CDN-linked** for two reasons that both matter
here: a `fonts.googleapis.com` stylesheet is a blocking request that
fails exactly when a field app is most needed, and a font CDN would see
an IP and a referer on every page load of an application holding voter
records. `latin-ext` is kept because Afrikaans names carry ë, ê, ô and î.

### Entry 38.2 — The sync endpoint, after thirty-one sessions

**Built.** `functions/src/sync.ts` and `syncMerge.ts`.

It was a declared skeleton from session 7, deliberately — a half-right
sync silently destroys a canvasser's day of work, and it could not be
tested without a live Firestore this build has never had.

Resolved by splitting it. Every decision now lives in `syncMerge.ts` as
pure functions over plain objects, proven by 33 tests; `sync.ts` is the
shell that reads the token, reads the documents and writes what the merge
decided.

- **Last-write-wins per field, not per document** (§7.5). Per-document
  means a canvasser correcting a phone number also reverts the sentiment
  a ward lead recorded ten minutes ago. The server keeps a
  `_fieldUpdatedAt` map; a field it has no timestamp for loses to any
  incoming value, because treating unknown as newest would make the first
  sync after this ships discard everything already in Firestore. Ties go
  to the server, so a retry is deterministic.
- **The tenant comes from the verified token, never the body** (§5.2
  non-negotiable #2). `CLIENT_IMMUTABLE_FIELDS` strips it.
- **Idempotency stores the whole response**, not a seen flag. A batch
  whose reply was lost in a tunnel gets the reply, not a second
  application.
- **One transaction per operation.** Partial success is the contract
  (§7.3); a batch-wide transaction would roll back thirty-seven good
  writes over three conflicts.
- **The POPIA consent gate is a typed rejection**, checked against the
  *resulting* document, so editing a consented voter's phone number does
  not require re-sending consent. `retryable: false`, or the client
  queues it forever (§7.6).

### Entry 38.3 — The PWA shell

**Built.** The product's headline claim is offline-first. There was no
`public/` directory, no manifest, no service worker, and no registration.

The rule the worker is built around: **it caches the application and
never the data.** Caching API responses would show a canvasser a voter
record that has since been corrected, and would put personal information
into a store this product cannot enumerate, expire on sign-out, or wipe
when a phone changes hands. Offline data belongs in Dexie, which is all
three. Guarded by test, and both halves of the guard were proved by
injection.

Updates are offered, never forced: a canvasser mid-capture with unsent
work does not get reloaded out of a form.

### Entry 38.4 — The application had never been run

**Corrected, and this is the entry that unlocked the rest.**

`signInWithPopup` needs a live Google OAuth round trip. There was no
emulator wiring. No Firebase project has ever been reachable from this
environment. The three together meant **no signed-in screen of this
product had ever been seen by anybody** in thirty-seven sessions.
Everything was proven by unit test and review.

`client.ts` now connects Auth, Firestore, Storage and Functions to the
local emulator suite behind `VITE_FIREBASE_USE_EMULATORS`, which
`usingEmulators()` refuses in any production build by checking
`import.meta.env.PROD` first. The sign-in screen offers email sign-in
behind the same gate, using `signInWithEmail`/`signUpWithEmail` — which
have been in `firebaseAuth.ts`, tested, and exposed nowhere since session
3. The emulator host is hardcoded to loopback and is not a parameter: a
configurable one is a way to send a tenant's voter records elsewhere.

Two dev tools make it usable: `tools/dev/grant-claims.mjs` stamps the
capability claims `resolveCapabilities` would mint in production, and
`tools/dev/seed-emulator.mjs` loads the real NW405 delimitation.
`docs/running-locally.md` is the path.

**What that immediately found.** Running it surfaced three defects no
test had: the fonts (38.1); ward lists sorted lexicographically, so a
34-ward municipality read 1, 10, 11, 2, 20 — a ward lead looking for
Ward 3 finds it two thirds down a list that appears sorted, beside
figures for a ward they did not mean to read; and fixed multi-column
grids that cramped at 390px.

### Entry 38.5 — A shared interface layer, and a nav that fits a phone

**Built.** `src/components/ui`.

There was no component layer — two files of values and 46 pages
assembling the same Tailwind strings by hand: the card 27 times, the
section label 205 times, the input 68 times, the page header 45 times.
Not a tidiness complaint: each copy had drifted, and no single edit could
correct any of it.

Nothing in it is new visual language. Every class was already in the
codebase; this is the majority spelling of each pattern, named. What the
primitives add beyond consistency is a 44px minimum touch target, which
several hand-rolled buttons were not, and a `Field` that genuinely
associates its label with its control, which several hand-rolled forms
did not.

The shell was `md:w-64`, which on a phone meant nine nav links stacked
above every screen's content. It is now a drawer on small screens and the
sidebar on large. A drawer rather than a bottom bar because §3.2 fixes
the nav at nine items and `nav.test.ts` guards the count.

**`ConnectionStatus` is the addition that matters most.** The product's
central promise is that work captured with no signal is sent later, and
nothing in the interface had ever reported whether that had happened. A
canvasser finishing a round in a dead spot and closing the app believing
the day is filed, with the queue still full, is the worst failure this
application could have. It reports only what it can establish — whether
the browser has a connection, and how many operations are queued — and
never claims anything is synced.

### Entry 38.6 — Deployment: wired, verified, and blocked on one thing

**Not done, and not fudged.**

The project `election2026-campaignms7-0` is real and reachable — the
BigQuery connector authenticates against it. But BigQuery cannot deploy
Hosting, Firestore rules or Functions, `gcloud` has no credential
(`CLOUDSDK_AUTH_ACCESS_TOKEN` is the proxy's placeholder and returns
`CREDENTIALS_MISSING`), and `firebase login` needs an interactive browser.

What was built instead so that deployment is one verified command the
moment a credential exists:

- `firebase-tools` as a devDependency.
- `scripts/deploy-preflight.mjs`, which checks the project id, the deploy
  credential, the six web-config variables, whether `dist` is older than
  `src`, that every function is pinned to `africa-south1`, and that no
  rules file carries an allow-all. It never deploys and never reports a
  deploy.
- `npm run deploy` = `check:all && build && preflight && firebase deploy`.
- A `@deployable yes|fails-closed|no` marker on every function, read by
  the preflight. The distinction is whether a function can do the wrong
  thing: `unmaskCandidateIdNumber` throws `unimplemented` as its entire
  body pending a KMS key, which is safe to ship, where a half-written
  write path is not. An unmarked function fails the check, because the
  default for "nobody has said" must not be "ship it".

Preflight currently fails on two items, both of which only the account
owner can supply: a deploy credential, and the Firebase web app config.
A request for them was sent to the owner's mobile.

**Guards proven by injection:** per-document LWW; a consent gate reading
only the payload; a service worker caching cross-origin; a dropped
`/api/` exclusion; the font import commented out; the leading-zero rule;
and a ward count altered in a published doc. The font one initially
passed — the guard matched the import inside the comment — so the guard
was fixed and re-proved.

**Verified by running it:** nine routes, two viewports, signed in against
the emulator with the real NW405 seed loaded. No console errors. 965
tests pass.

### Still open

- **Deployment**, on the credential and web config above.
- **The PPFA aggregation function**, held since session 10 pending the
  §6.8.1 legal confirmation. Unchanged and deliberately not exported.
- **`unmaskCandidateIdNumber`**, pending a Cloud KMS key. Fails closed.
- **War Room's fuller dashboard** — volunteer presence, campaign
  velocity, a live diary feed. Still no traceable data source; building
  placeholders for them would be the mistake this project keeps avoiding.
- **The remaining 46 pages** still use the raw Tailwind strings the new
  primitives encode. They render identically; migrating them is
  mechanical and was not worth risking in the same pass that built the
  primitives.

---

## Session 39 — The screen-rebuild reference

Two artifact links, which turn out to be one document and a copy of it
(918,784 and 918,791 bytes — the seven are " (Copy)" in the title).
"Election-COS1.0 — Screen Rebuilds": six screens rebuilt against this
build's own tokens, with the three typefaces inlined as data URIs because
the artifact sandbox blocks font CDNs.

### Entry 39.1 — The reference is honest, and that is what makes it usable

**Accepted as a design reference.** It does the thing this project has
asked of every supplied asset and rarely got: it labels what is real.

| Screen | What it says of itself | Verdict |
|---|---|---|
| War Room | Real page, illustrative numbers | Patterns adopted |
| Vote Calculator | Real page, real Schedule 1 formula, real 2021 IEC result | Already built |
| Role Permissions | Real page, real capabilities from `types.ts` | Already built |
| Field Performance | *"concept reference — no route. Not a built feature."* | **Not built** |
| Ward Sentiment Summary | *"concept reference — no route."* | **Not built** |
| Ward Sentiment Drilldown | *"Ward code and voter counts are real; the sentiment figures are not."* | **Not built** |

The three concept screens stay unbuilt, for the reason the reference
itself gives: volunteer identity, hours and conversion have no data model
here, and per-ward sentiment segmentation needs the counters document
restructured and the Cloud Function triggers rewritten. Building them
would mean shipping invented numbers in a product whose entire discipline
is not doing that. The reference agreeing with that position is worth
recording — it is the first supplied asset that drew the line itself.

It also uses the real palette and the real type scale, with no drift. No
correction needed anywhere in it, which has not happened before.

### Entry 39.2 — The table the build never had

**Adopted.** `Table`, `Th`, `Td` and `BarMeter` in `src/components/ui`.

The reference's `table.data` pattern exposed a real gap: this build had no
table component at all. The Wards page rendered 34 wards as 34 stacked
cards — most of a metre of scrolling to compare two figures, with the
numbers not even in a column to compare.

Three details carry it, all from the reference: `tabular-nums` on numeric
cells so digits line up (proportional figures in a column defeat the only
reason to put them in one), headers in the tracked display face matching
`SectionLabel`, and a horizontal scroll container rather than a reflow —
a table that rewraps on a phone has stopped being a table.

The ward table also carries a `BarMeter` per row, read against the largest
ward rather than the municipal total: 34 bars at 3% each would all look
identical.

### Entry 39.3 — The empty slot in the chrome, filled

**Corrected.** `Shell.tsx` carried a comment since session 9 explaining
that §2.3 specifies the wordmark "with tenant name below", and that the
slot stays empty because no tenant *name* exists — `SessionContext` has
only an opaque `tenantId`, and the `Tenant.displayName` that would supply
one lives in the unbuilt Postgres store.

That reasoning was right about the tenant and wrong about the slot. The
municipality profile carries `municipalityName` and `municipalityCode`,
and the reference's top bar shows exactly that — "JB Marks Local
Municipality · NW405". It is the one piece of context that tells somebody
which campaign they are looking at before they read a figure.

Rendered only when a real name exists. A tenant id there would still be
worse than nothing: opaque, and it reads as a defect.

### What was not taken

The reference's own nav rail, wordmark lockup and "design reference — not
live data" badge are scaffolding for a standalone page, not product
chrome. Its single-theme choice matches this build, which has no dark mode
for a stated reason — a field tool that must stay legible on a cracked
Android screen in direct sun does not get one for free.

**Verified:** `npm run check:all` — 965 tests green; `npm run build`
green; the nine routes re-driven signed-in against the emulator with the
real NW405 seed, both viewports, no console errors.

---

## Session 40 — The credential request, reissued

*Logged late. This turn came before session 39's screen-rebuild work in
wall-clock order and was never written up; it is recorded here rather than
inserted above, because the entry numbers are referenced from code
comments and renumbering them would break those references.*

The request was "haven't received the requests, please reissue."

### Entry 40.1 — There is no channel from here to a mobile phone

**Stated plainly rather than worked around.** The original instruction was
"for further permissions, send request to my mobile." That cannot be done:
this session has no SMS gateway, no push channel to the account holder's
handset, and no way to raise a notification outside the conversation. The
first request was therefore written into the conversation and into
`docs/deploy-credentials-request.md`, which is the only durable channel
that exists — and the reason it appeared not to arrive is that nothing
ever left this container.

Saying so is the correction. Reissuing the same text into the same channel
and hoping would have wasted another turn, and a CTO who cannot say "that
channel does not exist" is worse than no CTO.

What replaced it: the request became a committed document with three
routes — self-deploy, GitHub Actions, or supply a credential to this
environment — so the account holder reads it where the work is, not where
a notification would have been.

### Entry 40.2 — Present config is not correct config

**Defect found by reissuing.** Rewriting the request meant re-running
`npm run preflight` to quote its real output, and the web-config check
**passed**. It should not have. The `.env` in this container is the
emulator config: project `demo-ecos`, six well-formed values, every one of
them wrong for a deploy.

The check tested presence. Six present values for the wrong project would
have deployed a site that loads perfectly, reaches nothing, and gives no
clue why — the config is compiled into the bundle, so the failure surfaces
as a silent inability to sign in.

`scripts/deploy-preflight.mjs` now also fails if:

- `VITE_FIREBASE_PROJECT_ID` names a project other than the one
  `.firebaserc` is deploying to, and
- `VITE_FIREBASE_USE_EMULATORS` is still set, which would publish a build
  pointed at `127.0.0.1`.

Both branches were proved by injection: the project-id mismatch by
pointing `.env` at another project, the emulator flag by the `.env` that
is actually there — which is why the preflight output in the request
document now shows that second failure instead of a pass. Reverted clean
in the first case; the second is the honest state of a development
container and is left as it is.

---

## Session 41 — The launch card on the corporate landing page

The request was to integrate a live UI/UX link to the application from the
company's corporate landing page.

### Entry 41.1 — A link that proves the thing it links to

**Built.** `index.html` at the repository root carries an Election
Campaign OS launch card.

The obvious implementation — an `<a href>` to the Hosting URL — would have
put a dead link on Innovation Consult's public page for as long as the
deploy stays blocked. On a maiden SaaS offering that is a worse outcome
than no link at all: a prospective client who clicks it and gets a 404
has learned something about the company, and it is not true.

So the card probes before it links. A script at the bottom of the page
requests `/icon-192.png` from the application origin via `new Image()`,
and only on load does it replace the inert "Launching soon" element with a
real anchor. No fetch, no CORS preflight, no dependency on the
application's CSP — an image load either succeeds or it does not.

The consequence worth recording: **a dead link is not a state this page
can reach.** When the deploy succeeds the link appears by itself, with
nobody coming back to edit the landing page and no second deploy.

### Entry 41.2 — `APP_URL` appears exactly once

**By construction.** The application origin is a single `const` in that
script, and the card's text, the anchor it builds and the probe URL are
all derived from it. A custom domain later is a one-line change in one
place, which is the only version of this that survives somebody else
making it.

---

## Session 42 — Routing around the block

The request was "retry."

### Entry 42.1 — The block is a property of this container, not the project

**Verified three independent ways, then routed around.** Deployment has
been blocked for several sessions on credentials. The three checks:

| Check | Result |
|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_TOKEN` | neither set |
| `gcloud projects describe election2026-campaignms7-0` | `CREDENTIALS_MISSING` |
| `gcloud auth print-access-token` | returns the literal string `proxy-injected` |

The third is the decisive one. It is not an expired token or a missing
scope: no Google credential can exist in this container, because the
egress proxy substitutes a placeholder. Retrying from here cannot succeed,
and had not been going to succeed on any previous attempt either.

The BigQuery MCP connector does authenticate and does reach
`election2026-campaignms7-0`, which confirms the project is real and the
account holder's connectors work. It cannot deploy Hosting, rules or
functions.

**So: `.github/workflows/deploy-ecos.yml`.** GitHub Actions has no such
limitation, and a repository secret is a path the account holder already
knows. One secret (`FIREBASE_SERVICE_ACCOUNT`), six Actions variables for
the web config, and **Run workflow**. It is `workflow_dispatch` only —
automatic deploys on every push, to a project holding a campaign's voter
roll, is a decision for a person to make deliberately rather than inherit,
so the `push` trigger is present and commented out.

The workflow runs `check:all`, the build, and then the same preflight
before anything is sent. It writes the service-account JSON to
`$RUNNER_TEMP`, validates that it parses before the CLI can report
something unrelated, and removes it under `if: always()`.

### Entry 42.2 — The functions predeploy hook that was never there

**Defect found by writing the workflow.** Spelling out the deploy steps
for CI meant reading `firebase.json` closely, and the functions codebase
had **no `predeploy` hook**.

`functions/package.json` points `main` at `lib/index.js`, which exists
only after `tsc` has run. `lib/` is gitignored. A deploy from a clean
checkout — which is every CI run — would have uploaded a package whose
entry point is absent: the deploy **succeeds**, and every function is dead
on arrival. Nothing in 41 sessions would have caught it, because `lib/`
existed in this container from local development.

```json
"predeploy": ["npm --prefix \"$RESOURCE_DIR\" ci", "npm --prefix \"$RESOURCE_DIR\" run build"]
```

And a preflight check, so it cannot silently go missing again: for each
declared functions codebase, if `main` names a file that is absent and
there is no predeploy hook to build it, that is a `FAIL`. Proved by
deleting the hook — `functions build  FAIL` — and restoring it.

This is the window's clearest instance of the pattern this project keeps
hitting: **the defect is found by implementing the next thing, not by
thinking harder about the last one.** Running the app for the first time
found the fonts that had never loaded. Reissuing the credential request
found the preflight's false pass. Writing the CI workflow found the
functions that would have deployed dead.

### Entry 42.3 — What is still blocked, and on whom

Everything is in place except two values only the account holder can
supply: a deploy credential, and the Firebase web app config. Both are
documented in `docs/deploy-credentials-request.md` with the exact IAM
roles, and neither should be pasted into the conversation — a
service-account key is a standing credential on the project, and chat
history is not a secret store. A web config is public by design and may
be.

One thing the preflight cannot check and nobody should skip: **Firestore
and Storage must have been created in `africa-south1`.** The region is
fixed at creation, is not expressible in `firebase.json`, cannot be
changed once data exists, and reading it requires authenticating. If
either was created elsewhere the remedy is a new project — far cheaper now
than after a campaign has loaded a roll.

---

## Session 43 — The brand reconciliation

The request was to commit the night's progress durably, and to settle the
navy question against the latest cover-pages and letterheads artifact.

### Entry 43.1 — Three navies, and only one of them was wrong

**Resolved.** The current HTML version of the design artifact
("Letterhead & Covers", updated 7 Oct 2026) declares
`--ink: #13244A`, `--gold: #C9A227`, `--maroon: #7B1E30`,
`--bg: #F4EFE2` — value for value what `docs/innovation-consult-brand.md`
already recorded from the 9 August canvas. Two sources, two months apart,
in exact agreement. The brand document needed no correction, which is
worth stating because it is the first time a supplied asset and this
repository's record of it have matched without one.

What that agreement exposed is where the drift actually was:

| Where | Navy | Status |
|---|---|---|
| Letterheads & covers | `#13244A` | **Canonical corporate** |
| EC OS product tokens | `#1A2246` | **Correct — separate namespace** |
| Corporate landing page | `#1C355E` | **Drift — corrected** |

The landing page's four colours matched neither system. They were never a
third design decision; they were approximations nothing had checked.
`index.html` now carries the canonical four, with a comment naming the
artifact and the brand document as its source so nobody has to re-derive
this.

**`src/design/tokens.ts` is deliberately unchanged.** The product's ink,
gold, maroon and paper stay as they are, for the reason the brand document
has carried since it was written: a company that publishes documents and
one product that company builds are two identity systems, and merging them
would make the product's `check-no-hex.mjs` guard enforce the wrong
palette.

### Entry 43.2 — The build discipline, written down where it loads

**Added** `.claude/skills/ecos-build-discipline/SKILL.md`.

Eleven working rules that this build arrived at the hard way — the
guard-test-as-tripwire protocol, "present is not correct", `@deployable`
markers, never fabricating statutory or roll figures, never drafting
binding instruments, probe-before-link, and the standing instruction that
the proclaimed delimitation is not to be second-guessed. They were
scattered across forty-odd changelog entries and several file headers,
which is to say they were not available at the moment of a decision.

Also `docs/session-handoff.md`: the current state in one page — what is
built, what is blocked and on whom, what is deliberately unbuilt and why.

### Entry 43.3 — The README was a stale copy of the landing page

**Corrected.** `README.md` at the repository root carried the entire
corporate landing page pasted below its first paragraph — 235 lines,
`<!DOCTYPE html>` and all. It had been there since the first scaffold
commit, which means the original README *was* that HTML file and the
scaffold only prepended a paragraph to it.

GitHub renders a README, so the repository's front page was a
half-rendered duplicate of a page that already exists as `index.html` —
and the duplicate had drifted away from the original: superseded palette,
no launch card. Diffed against `index.html` to confirm nothing in it was
unique before removing it.

Replaced with an actual README: what is in the repository, where the
landing page's single `APP_URL` lives, the canonical palette and why the
launch card inside it deliberately uses different colours, and pointers to
the handoff document, the discipline skill, the local-run instructions and
the deploy routes.

Found the way everything in this window was found: by reading the file in
order to add two links to it.

**Verified:** `npm run check:all` — 965 tests, 60 files green;
`cd functions && npm test` — 52 tests green; `npm run build` green,
27 assets precached.

---

## Session 44 — The migration, and the guard it exposed

Worked unattended while the account holder was away, on the one task in
`docs/session-handoff.md` that needed nothing from them: moving the pages
onto the shared primitives built in session 38. Thirteen of twenty-seven
page components done, in three verified commits.

The migration was supposed to be mechanical. It was not, and the reason it
was worth doing by hand rather than by `sed` is everything below.

### Entry 44.1 — `SectionLabel` would have stripped the document outline

**Caught before it shipped.** Three War Room panels title themselves with
a real `<h2>`. `SectionLabel` renders a `<p>`. Substituting it would have
looked pixel-identical and silently removed three headings from the
document outline a screen-reader user navigates by.

`SectionLabel` now takes `as`, defaulting to `'p'`. A label that titles a
section is a heading; one that labels a field or a figure is not; the
caller is the only one who knows which. This is the first change the
primitives themselves have needed since they were built, and it came from
using them rather than from reviewing them.

### Entry 44.2 — The labelling claim was wrong, and here is what was true

**Corrected mid-session.** Entry 44.2 originally said Voters and Field
Diary "wrapped their voting-district input in a bare `<label>` with no
association" and that "a screen reader announced an unlabelled text
field". That is **not correct**, and six commit messages in this session
repeat it. A control nested inside its `<label>` is implicitly associated
— HTML spec, honoured by screen readers. Those fields were labelled.

The claim did not start here: `src/components/ui/index.tsx` has carried it
since session 38, in the header justifying `Field`. It was taken at face
value instead of checked, and then amplified into a tally. The code
changes stand on their own merits; the reasoning attached to them did not.

**What was actually wrong**, having gone back and read the originals:

| Real defect | Where | Count |
|---|---|---|
| Hint text inside the `<label>`, so it became part of the control's accessible name | Voters, Field Diary | 2 |
| No label at all | Bulk Import's file input | 1 |
| A placeholder standing in for a label — not a label, and gone on the first keystroke | Data Subject Requests' rejection reason | 1 |
| Checkbox groups with no `fieldset`/`legend`, so twelve related checkboxes read as twelve unrelated ones | Incident report | 3 groups |

On Voters, the polluted name was literally *"Voting district No VD in your
session scope — enter one manually. A ward/VD picker (§6.1) isn't built
yet."*

The other ~23 controls were correctly labelled already. What `Field` gave
them is real but smaller, and should have been described as such from the
start: the 44px minimum target several `py-1.5` controls missed, hint and
error text wired through `aria-describedby` rather than nested in the
label, and one spelling instead of sixteen.

**The lesson is the project's own rule, broken by me.** An existing comment
asserting a defect is not evidence of the defect. The discipline skill
already says to prove a guard fails before trusting it; the same applies
to a claim in a file header. Read the original, then describe it.

### Entry 44.3 — Three selection states that existed only in colour

**Fixed.** The Incidents status filter, the Voters list/map switch and the
Finance donor list all signalled the current choice with an inverted ink
background and nothing in the markup. All three now carry `aria-pressed`.

They stay hand-rolled rather than becoming `Button`s: `Button` has no
selected state, and inventing one on the way past three call sites is the
wrong place to decide what a selected button looks like across the
product.

### Entry 44.4 — Links that were dressed as buttons stay links

**Deliberately not migrated.** The War Room quick links, Voters'
round/import actions, the Incidents report link and "Back to the round"
are navigations wearing button styling. `Button` renders a real
`<button>`, so substituting it would have broken middle-click, cmd-click
and "copy link address" on eight controls. They keep `<Link>` and match
the variant's treatment by hand, including the 44px target.

Also not forced: the counter chip rows (`Contacted: 1 204`) are bordered
counters, not `Pill`'s tinted status words, and the gold left-rule notice
is its own pattern. Substituting a primitive that merely looks close is
how a design system starts lying about itself.

### Entry 44.5 — One real defect in Logistics

**Fixed.** Every REQUESTED row's Approve button read `isPending` off the
one shared mutation, so approving a single item made every row say
"Approving…" at once — on the page whose entire job is telling a
coordinator what has been approved and what has not. The label now keys
off `approveMutation.variables`. Disabling all of them stays: two
approvals racing one mutation is not something to allow; claiming they are
all in flight is.

### Entry 44.6 — Nothing was guarding the type scale

**The session's real find.** `check-no-hex.mjs` has guarded colour since
session 2. Nothing guarded type, and `tailwind.config.js` *extends*
`fontSize` rather than replacing it, so Tailwind's defaults kept working
and five files were quietly setting their own sizes.

Two of them matter:

| Page | What it rendered at | What everything else uses |
|---|---|---|
| Gatherings advisory — quotes an Act and a ConCourt judgment | `text-sm`, 14px | 16px |
| Election timetable — statutory deadlines, with a "verify before relying on this for a filing deadline" warning | `text-sm`, 14px | 16px |

Small print on the two pages where small print is the worst possible
signal, for two months, with every test passing throughout.

`scripts/check-type-scale.mjs` catches `text-xs` through `text-9xl` and
arbitrary sizes like `text-[13px]`, through any variant prefix, and is
wired into `check:all`. It does not touch `text-ink` and the other colour
utilities sharing the prefix, and a token's own name cannot be mistaken
for a default — `text-display-lg` does not match `text-lg`.

Proved by injection, all four branches: `text-sm` in a page FAILS,
`md:text-[13px]` FAILS, `text-body-lg sm:text-display-lg` PASSES, clean
tree PASSES. Reverted clean.

**And it caught itself first.** The guard's opening run flagged its own
header and the comments the migration had just added naming the classes
it had removed. That is the same defect as the font guard in session 38,
where the regex matched the import *inside* a comment. Two occurrences of
one class, so it is now written into the discipline skill: **a guard that
fails on the sentence explaining it gets switched off, and then it guards
nothing.** It blanks comments before scanning, preserving line numbers.

### Entry 44.7 — The primitives needed props, not `className`

**Three added, all for one reason.** Migrating turned up call sites that
wanted a variation the primitive did not offer, and the obvious move —
pass it through `className` — is quietly broken:

| Wanted | Appending this | Why it loses |
|---|---|---|
| Ink heading instead of slate | `className="text-ink"` | both are colour utilities in the same Tailwind group |
| Monospace input for a ward code | `className="text-data-mono font-mono"` | races the control's `text-body-md font-body` |
| A table with no card padding | `className="p-0"` | races `Card`'s own `p-4` |

In every case the winner is decided by the order Tailwind emits the two
rules into the stylesheet, **not** by their order in the class attribute.
It can look right in one build and change when an unrelated class is
added elsewhere.

So `SectionLabel` gained `tone`, `Field` gained `mono`, and the Threshold
Analyzer's table is rendered bare rather than inside a `Card` — matching
how `WardsPage` already renders the build's other table. A prop that
*selects* a class cannot lose a specificity race; appending a second one
can. **No primitive here accepts a padding override, deliberately.**

Where a variation is genuinely one-off, the markup stays hand-rolled with
the reason in the file: the Vote Calculator's pending-tied-seats tile
(maroon alarm, which `StatTile` has no state for), its "Tied — needs
manual resolution" heading (maroon, which `tone` does not offer), and the
Round's Coverage panel (a wide explanatory block that leads with a figure,
not a stat tile). Adding an alarm emphasis or a third tone on the way past
a single call site is the wrong place to decide what either looks like
across the product.

### Entry 44.8 — What the migration has found, counted

Twenty of twenty-seven page components done, in six verified commits. The
tally is the argument against doing the remaining seven by `sed`:

| Found | Count | Where |
|---|---|---|
| Buttons with no distinguishing accessible name | **~125** | Ward Detail's per-row Edit, Round's 25 doors × 4 outcomes, DSR, Candidates |
| Off-token type scale | **5 files** | now guarded by `check-type-scale.mjs` |
| Selection states that existed only in colour | **3** | Incidents filter, Voters view switch, Finance donor list |
| Checkbox groups with no `fieldset`/`legend` | **3** | Incident report's filter panel |
| Headings that a naive substitution would have demoted to paragraphs | **3** | War Room panels |
| Hand-rolled tables with proportional figures in numeric columns | **2** | Threshold Analyzer, Vote Calculator |
| Duplicate copies of `StatTile` | **2** | Round, Bulk Import |
| Genuinely unlabelled or placeholder-labelled controls | **2** | Bulk Import's file input, DSR's rejection reason |
| Accessible names polluted by hint text inside the label | **2** | Voters, Field Diary |
| Real behavioural defects | **1** | Logistics' shared-mutation Approve label |
| Controls below the 44px target | **many** | every `py-1.5` and `py-2` control |

This table replaces an earlier version of itself that claimed nine
unlabelled form controls. See entry 44.2 — that count was wrong, and the
correction is the more useful finding of the two.

Not one of the items above was visible in a test run, and every test
passed throughout.

### Still open after this session

- **The page migration is complete**: 27 of 27, in nine verified
  commits. `PermissionsPage` was the last and the worst — its sign-in-ID
  error message sat inside the label (so the control's accessible name
  changed as you typed), its two capability columns were 52 checkboxes
  with the same 26 names in both and no `fieldset` to tell them apart,
  and "Deactivate" repeated down the staff list with nothing to say
  whose account it ended.
- Everything in `docs/session-handoff.md` under "blocked" and
  "deliberately unbuilt" is unchanged. **Deployment still waits on the
  account holder's two values.**

---

## Session 45 — Running it, after the migration

The page migration left one follow-up: drive the routes. Done — 25 routes
at phone (390px) and desktop (1440px) width, signed in against the
emulator with the real NW405 seed.

**It found four defects, and corrected two of my own measurements.** Every
test was green before and after; none of this was visible to them.

### Entry 45.1 — The audit was wrong twice before it was right

Worth leading with, because the first run reported 186 undersized targets
and 4 pages overflowing, and **both numbers were inflated by the audit
rather than by the product**.

| First reading | What it actually was |
|---|---|
| 4 pages with horizontal overflow | **3.** `/wards` was fine: `documentElement.scrollWidth` counts descendants of an inner scroll container, so a table that correctly scrolls sideways inside its own box reads as page overflow. `body.scrollWidth` plus an explicit "is any ancestor a scroller" test is the honest measure, and under it `/wards` is 390 of 390. |
| 186 targets under 40px | **~14 real.** The rest were the `sr-only` skip link (1px until focused, not a tap target) and inline links inside running prose. |
| 8 pages missing expected text | **0.** My expectations were wrong — the page titles are "PPFA Threshold Config", "What your subscription includes", "Import a register" and "Advisory: Public gatherings…". All four rendered correctly; confirmed by reading their `<h1>` and body length directly. |

Second time this window that a check has had to be corrected before its
output could be trusted. The pattern is the same as the type-scale guard
flagging its own comments: **a measurement is not evidence until the
measurement itself has been checked.**

### Entry 45.2 — The migration covered pages; the forms underneath were never in scope

**This is the session's real finding.** Session 44 migrated every
`*Page.tsx`. The editors and forms those pages render are *components*,
and nothing had reached them. All four genuine defects live there:

| Component | Defect |
|---|---|
| `PartyRowsEditor` | `grid-cols-[1fr_140px_120px_40px]` — 300px of fixed columns plus gaps plus an input's intrinsic minimum. The **Vote Calculator's content was 567px wide in a 390px viewport**, so the page scrolled sideways. §3.3 forbids that, on a field application. |
| `PartyRowsEditor` | Its column headings were plain `<span>`s. **A span is not a label.** Every input in it was genuinely unnamed. |
| `PartyRowsEditor` | The remove button was **16px tall** — the smallest thing on the screen was the control that deletes a party. |
| `IncidentForm` | Two selects at 39px, two buttons at 38px. The form a canvasser fills in at a gate, one-handed. |

`PartyRowsEditor` now stacks on a phone and keeps the grid from `sm:` up,
every control has a real `<label htmlFor>` that is visible on a phone and
`sm:sr-only` above it, and the remove button is a full-width 44px row on
a phone and a 44px square on desktop.

Note what the second row means for session 44's correction (entry 44.2).
The claim "these inputs are unlabelled" was **wrong about the pages** —
their inputs were nested inside their `<label>` and were correctly named.
It is **right about this component**, which no one had looked at. The
lesson stands and sharpens: read the markup, then describe it.

### Entry 45.3 — `PageHeader` pinned its own action too wide

**Fixed in the primitive.** The action slot was `shrink-0`, which pins it
to max-content width — so an action that is a *group* never gets narrow
enough for its own `flex-wrap` to fire. Voters has three controls there
and was 428px wide in a 390px viewport as a direct result. Now `min-w-0`:
a group wraps internally, the outer `flex-wrap` still drops the whole
action to its own line when that is not enough, and a single button is
unaffected because its min-content is the button.

### Entry 45.4 — "Migrated" was measured by the import, not by the markup

`WardsPage` counted as migrated in session 44 because it imports
`Table` — which is a weaker test than using the primitives, and the drive
caught it: its `+ New ward` button was 32px. Its header and stat tiles
were still hand-rolled from session 39, when only the table was adopted.
Now on `PageHeader`, `Button`, `StatTile` and `Card`.

### Entry 45.5 — One control stays under 44px, deliberately

Bulk Import's file input is 30px and is staying that way. A file input's
height is set by the user agent and **its hit area is the browser's own
button, not the element**, so `min-h-11` would pad the box, leave the
button exactly as small, and make the audit pass while nothing improved.
The real fix — hiding the native input behind a styled label — costs
keyboard and assistive-technology behaviour that works today. Recorded in
the file so the next person does not "fix" it.

### Entry 45.6 — `npm run emulators` no longer works here

**Found while setting up.** The script starts the functions emulator,
whose startup reaches out and gets a plaintext `request blocked` from the
egress proxy where it expects JSON — then takes the **whole suite** down
with `Unable to parse JSON: SyntaxError: Unexpected token 'r', "request
bl"`. `--only auth,firestore,storage` works and is enough for everything
in `docs/running-locally.md`.

That document also carried a now-false bullet saying functions are *not*
started by `npm run emulators`. True when written; the `firebase.json`
change that added the functions predeploy hook put them in the default
set. Corrected, with the history, rather than quietly swapped.

Also recorded there: **`pkill -f "firebase emulators"` kills the shell
that runs it**, because the pattern matches that shell's own command
line. Exit 144, and everything chained after it silently never runs. It
has now cost three shells on this project.

### Final state

25 routes × 2 viewports: **no console errors, no page errors, no failed
requests, no blank pages, no horizontal overflow, no missing content.**
One known 30px target, documented above.

`npm run check:all` green — 965 tests, 60 files. `npm run build` green.

---

## Session 46 — The domain

`electioscos.co.za` registered, 16 October 2026. The application is
served from the **apex**, not an `app.` subdomain.

### Entry 46.1 — Two things flagged before building it in

**The spelling.** `electioscos` has no "n" — it reads as "electios-cos",
not "election-cos". Raised in one line before wiring it in, and built so
that changing it is two constants and a guard test. Proceeding as
instructed; the flag is recorded here so that if it ever turns out to
have been a slip, nobody has to reconstruct whether it was noticed.

**The repository already assumed a different domain.** Session 2's
`docs/phase-0-infra-plan.md` planned `app.electioncampaignos.co.za` with
`www.` and `api.` siblings, and `BUILD-STATUS.md` referenced it in two
places — including in the console checklist, as the domain to add to
Firebase's authorised list. None of those names were ever registered.

That table is now marked **superseded** with a live table beside it,
rather than silently rewritten. The `api.` subdomain is explicitly not
taken up: the sync endpoint is served same-origin at `/api/**` behind a
Hosting rewrite, which is what lets the service worker treat it as
same-origin and never cache it. A separate `api.` host would have made
every sync request cross-origin for nothing.

### Entry 46.2 — One declaration, and a guard that proves it

`src/config/publicDomain.ts` holds `APP_DOMAIN`, `APP_ORIGIN`,
`HOSTING_ORIGIN`, `CORPORATE_DOMAIN` and `SUPERSEDED_DOMAINS`.

A domain is the one value in this build that is simultaneously public,
printed on material, and expensive to change — and it had already drifted
once before it was registered. So `publicDomain.test.ts` (6 tests) holds
the line, including across a package boundary: the corporate landing page
is plain HTML at the repository root and cannot import the constant, so
the test reads `index.html` and asserts they agree.

**Proved by injection, all four branches** — change the constant alone
and the drift test fails; put `app.electioncampaignos.co.za` back in
`index.html` and the supersession tripwire fails; add a second `APP_URL`
assignment and the single-source test fails; delete `FALLBACK_URL` and
the fallback test fails. Reverted clean.

Comments are blanked before matching, up front this time. Third
occurrence of that defect class in this repository and the first where it
was handled before it bit.

### Entry 46.3 — The launch card now probes two origins, in order

**Changed, and the reason matters.** The card used to probe one origin.
Pointed at a freshly registered `.co.za`, that would have meant a
*successful* deploy still reading "Launching soon" on the company's
public page for however long DNS and certificate issuance took — a worse
outcome than the dead link the probe was built to prevent.

It now tries `electioscos.co.za`, then
`election2026-campaignms7-0.web.app`, and links to whichever answers
first. Still fails closed: if neither loads the probe image, no anchor is
rendered at all.

**Verified by driving it**, with the two origins stubbed:

| | Probed | Result |
|---|---|---|
| Custom domain answers | custom only | links to `electioscos.co.za`, "Live" |
| Custom dead, Hosting answers | custom → fallback | links to the `.web.app`, "Live" |
| Neither answers | custom → fallback | **no anchor**, "Launching soon" |

The first row matters as much as the third: once the real domain works,
the fallback is never probed, so the page cannot quietly settle on the
`.web.app` address.

### Entry 46.4 — The ordering that takes sign-in down

**The expensive mistake available here**, now guarded.

`VITE_FIREBASE_AUTH_DOMAIN` is where the Google OAuth handshake happens.
Pointing it at `electioscos.co.za` is a legitimate and better end state —
a party official signing in sees the campaign's own domain rather than
`election2026-campaignms7-0.firebaseapp.com`, which to that reader looks
like a phishing page. Firebase Hosting serves the `/__/auth/*` helpers on
a custom domain, so it genuinely works.

**But only after the domain is connected and its certificate issued.**
Set it before that and every sign-in fails — the one failure that locks
out the people who would otherwise fix it.

So the preflight gained a check, and with it a third status. `WARN` is
not `FAIL`, because the custom value is the correct destination; and it
is not silence, because the order is what bites. The reporter previously
printed anything that was not `PASS` as `FAIL`, which would have
displayed this warning as a failure while not counting it as one —
corrected in the same pass.

Both branches proved: the Firebase default reads `ok`, a custom value
reads `warn` with the preconditions and does not change the exit code.

`.env.example` carries the same ordering at the line somebody would
actually edit, and §4.1 of `docs/deploy-credentials-request.md` has the
five console steps with the dependency spelled out.

### Entry 46.5 — Rule 11, after the fourth shell

`pkill -f "firebase emulators"` and `pkill -f http-server` kill the shell
that runs them, because the shell's own command line contains the
pattern. Exit 144, and everything chained after it silently never runs.

Four shells now, two of them in this session — and each time the real
cost was not the shell but the chained work that looked done and wasn't.
It was a caveat in `docs/running-locally.md`; it is now **rule 11** of
the discipline skill, with the pid-lookup that works and the port check
that confirms a listener is actually gone. A dead parent does not mean a
dead listener: `http-server`'s child kept serving after its parent was
killed.

### What did not need changing

The PWA manifest (`start_url`, `scope`, `id` all `/`) and the service
worker (`url.origin !== self.location.origin`) are origin-relative and
work unchanged on any host. The app's own `index.html` keeps
`noindex, nofollow` and gains no canonical or Open Graph tags: it is an
authenticated application holding voter records under POPIA, and the
right amount of search-engine presence for it is none.

**Verified:** `npm run check:all` green — 971 tests, 61 files (6 new);
`npm run build` green; the landing card driven through all three probe
branches; the preflight driven through both auth-domain branches.

---

## Session 47 — Cloudflare: DNS yes, Workers no; and the headers that were missing

Prompted by the Wrangler documentation. The question it raises is real,
because the phase-0 plan has assumed Cloudflare since session 2 and the
domain was registered yesterday.

### Entry 47.1 — Wrangler is not for this, and Workers would cost residency

**Decided against, and the reason is not "we don't need it".**

Nothing in this build is a Worker. The application is Firebase Hosting
plus Cloud Functions, and the sync endpoint is already same-origin at
`/api/**` behind a Hosting rewrite — which is exactly what lets
`connect-src` stay `'self'` for it and the service worker treat it as
same-origin and never cache it.

A Worker would add a second compute platform, a second deploy path and a
second credential that can drift out of step with the app it fronts.
But the argument that settles it is **rule 1: `africa-south1`, for voter
data.** Edge compute terminates and processes requests at whichever point
of presence is nearest the user. That is the opposite of a data-residency
commitment, and residency is a question a South African municipality will
ask about a voter roll.

Cloudflare as **DNS** is unaffected and still fine. One caveat now in
§4.1 of the deploy document: the A records must be **DNS-only (grey
cloud)** while Firebase issues the certificate, or validation is
intercepted and the domain sits in "pending" while everything looks
correct.

### Entry 47.2 — Session 31's deferral, revisited on its own terms

Session 31 reviewed a reverse-proxy Worker carrying a good header set and
deferred it: *"it is deployment configuration, not a screen, and this
build has no deployment target configured. Recorded in full because the
header set is good and should be used when there is one."*

There is one now. So the headers were implemented — **in Firebase
Hosting, not in a Worker**, where they cost nothing extra to run, deploy
with the app, and can be tested.

Both of session 31's corrections were carried out, and both were checked
against the real build rather than taken on trust:

- **`X-XSS-Protection` is not set.** Deprecated, ignored by current
  Chrome and Firefox, and its filtering mode has itself been a source of
  vulnerabilities.
- **`script-src` has no `'unsafe-inline'`.** Session 31 said it was not
  required; verified — `dist/index.html` emits one
  `<script type="module" src=…>` and nothing else.

### Entry 47.3 — What was actually missing: all of it

**The application had no security headers at all.** `firebase.json` had
`public`, `ignore` and `rewrites`, and nothing else. A product holding a
municipality's voter roll was shipping with no CSP, no HSTS, no
frame-ancestors and no referrer policy.

Now declared in `src/config/securityHeaders.ts` and generated into
`firebase.json` by `scripts/sync-hosting-headers.mjs`, because a JSON
file cannot import a module and hand-copying is how the two drift.
`npm run check:headers` fails if they disagree and is wired into
`check:all`.

**The one concession, stated rather than buried.** `style-src` carries
`'unsafe-inline'`. Three components set style attributes with values only
known at runtime — `BarMeter`'s width percentage, `SchematicMap`'s
per-ward alpha, the household map's height. An inline style *attribute*
cannot be hashed, and a nonce cannot apply to an attribute, so the
alternatives are this or losing those renders. It permits style
injection, not code execution, and it is the only `'unsafe-*'` in the
policy — which a test asserts.

HSTS is one year **without `preload`**. Preload is baked into browsers
and is slow and painful to reverse; it should be its own decision once
the domain has been stable.

### Entry 47.4 — The verification was vacuous twice before it was real

The honest part of this session.

**First attempt: "0 CSP violations across 25 routes."** False comfort.
The production build has no emulator sign-in block — `usingEmulators()`
checks `import.meta.env.PROD` first, deliberately, so a production bundle
can never point at localhost. The drive script guarded the sign-in with
`if (await emailField.count())`, found none, **skipped the click
silently**, and walked 25 routes that all redirected to the sign-in page.
It reported a clean pass having tested one screen.

**Second attempt** rebuilt with `vite build --mode development`. Still no
emulator block: `vite build` forces `NODE_ENV=production` regardless of
`--mode`, so `PROD` stayed true. `NODE_ENV=development vite build` is
what makes that branch exist.

**Third attempt** reached the routes and stopped at "Awaiting access" —
the emulator had been restarted, and emulator auth state does not
persist, so the account had no claims.

Each failure was caught only because the script was hardened after the
first one to **exit non-zero when it cannot test anything**: it now fails
if the sign-in block is absent, fails if it is still on the sign-in
screen afterwards, and counts how many routes actually rendered rather
than assuming.

**The real result:** 25 of 25 routes rendered signed-in, against the
exact production header set served from a local server reading
`firebase.json`, with the emulator origins appended to `connect-src` for
the test only. **Zero CSP violations.**

This is the third time in three sessions that a measurement had to be
corrected before its output meant anything — the type-scale guard
flagging its own comments, `documentElement.scrollWidth` counting a
scroll container's contents, and now a guard that skipped its own
subject. The rule is earning its place: **a measurement is not evidence
until the measurement has itself been checked**, and the cheapest way to
check it is to make it fail loudly when it tests nothing.

### Entry 47.5 — Guards, proved

13 tests in `securityHeaders.test.ts`, each asserting a property somebody
could plausibly weaken while fixing something else. Proved by injection:

| Injected | Result |
|---|---|
| `'unsafe-inline'` into `script-src` | 3 tests fail |
| `X-XSS-Protection` restored | 2 tests fail |
| `sw.js` made cacheable | 2 tests fail |
| `X-Frame-Options` removed from `firebase.json` by hand | `check:headers` fails |

Reverted clean. A cached service worker is a device frozen on an old
build, in an offline-first application whose users are in the field —
which is why that one is a test and not a comment.

**Verified:** `npm run check:all` green — 984 tests, 62 files (13 new);
`npm run build` green; 25 routes driven signed-in under the production
CSP with zero violations.

---

## Session 48 — Three historic assets, reviewed

Full review: `docs/historic-assets-review-2026-10-17.md`. The three
verdicts in one line each, and the one change made.

### Entry 48.1 — A dataset that is right in total and wrong in seven places

`DOCTYPE_1.txt` (the "Mobile Control Tower" prototype) carries North West
ward counts totalling **402** — which is exactly what the proclaimed
delimitation totals for North West. Per municipality it disagrees in
**7 of 18**, and in 3 of the 4 district rollups.

| Code | Asset | Proclaimed |
|---|---|---|
| NW371 Moretele | 28 | **25** |
| NW374 Kgetlengrivier | 6 | **7** |
| NW375 Moses Kotane | 34 | **35** |
| NW382 Tswaing | 15 | **14** |
| NW384 Ditsobotla | 21 | **20** |
| NW393 Mamusa | 9 | **8** |
| NW397 Kagisano-Molopo | 11 | **15** |

**This is the worst shape a bad dataset can take**: every aggregate
reconciles, so the check somebody would actually run passes. Ward count
feeds the seat quota, so seven municipalities would have been campaigned
and projected on the wrong number.

Nothing was ingested. It was checkable in minutes because
`provinceDelimitation.test.ts` already reconciles all 44 districts
against their locals — the guard earned its keep against a real dataset
rather than a hypothetical one.

### Entry 48.2 — The one thing carried forward: a name variant

**Added** `NAME_VARIANTS` and `codeForName()` to
`municipalCodeHistory.ts`, with 5 tests.

The asset spells NW383 **Mahikeng**; the Annexure spells it
**Mafikeng**. Both are the same municipality — the town was officially
renamed in 2010 and the Commission's register still carries the older
form. The Annexure's spelling stays as the name of record, because that
is what appears on a nomination form. But an ingest matching on name
alone would have **rejected every NW383 row as unrecognised**, which is
a silent data loss rather than an error.

`codeForName()` returns `null` rather than guessing: a near-miss on a
municipality name is not something to resolve by similarity, because a
wrong code attaches a result to the wrong place. `'Mafik'` and
`'Greater Mafikeng'` both return null, and a variant will not match a
code that is out of scope.

### Entry 48.3 — V1 of the build spec: two rules now reversed

`01-claude-code-build-spec_1.md` is **IC-ECOS-BUILD-2026-V1**. It cannot
be merged with V2, only mined, because two of its five overriding rules
are reversed:

- §0.4 "There is **no** PPFA module… delete it and note it" — V2 §6.8
  mandates it. This is also why the nav is nine items where V1's table
  shows eight: the ninth is Funding & Disclosure. And why Finance Officer
  is a seed role again.
- §0.5 "No gatherings permit workflow" — **still in force**, and the
  Gantt violates it.

**A formula in V1 is wrong and was already disproved.** §8.2 presents,
under the heading "Fix:", `Q = floor(totalValidVotes / (totalSeats + 1)) + 1`
— a Droop quota. The build implements Schedule 1 Item 12,
`Q = (A/(B−C−D))+1`, and session 8 disproved the Droop-adjacent form
against a real IEC result. `SeatCalculatorPage.tsx` records this in its
header precisely so it is not re-adopted from a document that states it
authoritatively.

**Four V1 disciplines checked. Two held, two do not exist:**

| | |
|---|---|
| §4.3 Auth minimal footprint, CI-asserted | ✅ `firebaseAuth.test.ts` pins the permitted fields and asserts `updateProfile` clears the displayName Google populates |
| §3.5 no "Blockchain Verified Hash" | ✅ guarded by two tests |
| §6.2 informal-settlement addressing | ✅ `dwellingType` + `informalDescriptor` + GPS |
| §5.2 one port suite run against both adapters | ❌ **issue #17** |
| §7.4 dev read-counter failing over 50 reads/page | ❌ **issue #18** |

The first gap is the serious one. **The entire justification for the DAL
is that Phase 8 becomes a swap rather than a rewrite, and the thing that
would prove it is a storage-agnostic suite passing against both
adapters.** The ESLint boundary is enforced, but enforcing the boundary
is not evidence of substitutability. "The DAL held" is currently an
assertion.

### Entry 48.4 — The Gantt: right schedule, wrong build, superseded figures

`municipal-gantt-planner-v2_1.xlsx` describes AWS `af-south-1` (Cape
Town) Postgres + Redis, Express + Prisma, a database-per-tenant, 4-level
RBAC and Base64 photo uploads. V1 §3.5 already required af-south-1 →
africa-south1 and V1 §6.4 already forbade Base64 in documents, so it
predates both corrections.

**Its PPFA figures are the superseded ones** — R80k warning, R100k
critical, R15M cap. The build uses **R200,000 / R30,000,000** from
`Government Gazette No. 53182, 18 August 2025`, warning at 80% =
R160,000, and `ppfaDefaults.ts` already carries the comment *"never
R80,000 (superseded)"*. Carrying the Gantt's numbers would set a
disclosure trigger at half the statutory threshold.

**WBS 2.3 is forbidden and also wrong about the law.** It schedules a
permit-status scanner with T-7 and T-3 escalations. The Regulation of
Gatherings Act is a **notice** regime — the convener notifies; the
responsible officer may impose conditions or prohibit. There is no
permit status to scan. A product doing this would tell a campaign it was
compliant against a test the Act does not contain.

**What it is genuinely worth is its schedule.** Two Sprint 4 tasks
describe tests we do not have — a load runner at 120 devices / 1,200 sync
payloads, and LWW reconciliation under 20% socket dropouts. We have 33
pure-function tests over `syncMerge` and have never run the endpoint
under concurrency or packet loss. **Issue #19.**

Recorded not built: a 48-hour verbal-consent remediation dispatcher —
whose *remediation* half is a good idea and whose *"cron purge"* half
conflicts with the standing rule that field work is never silently
discarded; an independent pen test at ZAR 120,000; ISO 27001; and a
post-election councillor casework pivot at R2,500/month per ward, which
reuses the incident capture and geolocation already built and is the most
commercially interesting item in the set.

**Two cost models that disagree**: the Gantt projects R250/ward/month,
the prototype R93.37 against R843.06. Neither is sourced and both price
the Phase-8 Postgres architecture rather than the Firestore build.
Neither is usable as a price.

### Entry 48.5 — T−18 days

The most useful thing to come out of the review is a date. Election day
is **4 November**; this was written on the 17th. The Gantt puts a
production code freeze at **28–31 October**.

The build is verified, runnable, and **has never been deployed**. Added
to the top of `docs/session-handoff.md`, because nothing else in that
document is more urgent than the two values the deploy waits on.

**Verified:** `npm run check:all` green — 989 tests, 62 files (5 new);
nothing ingested from any of the three assets.

---

## Session 49 — The CI that never ran

A security-audit HTML document was supplied for review. It audits a
different codebase; chasing one of its generic recommendations into our
repository found something real and considerably worse.

### Entry 49.1 — The supplied report is an audit of someone else's project

`validate.ts`, `runtime-guards.ts`, `security-gate.py`, `security.ts`,
`package_security.json`, `modsecurity-crs-custom.conf`,
`0001_security_baseline.sql`, `pipeline.yml`, `architecture-and-tools.md`
— **none of these files exist in this repository.** `AGENTS.md` appears
only inside `node_modules/re2`, as a dependency's own file. There is no
`CLAUDE.md`.

Its stated central premise is to "prioritise the canonical PostgreSQL 16
+ PostGIS with RLS architecture, disregarding contradictory MySQL
references". This build has **zero** occurrences of PostGIS, MySQL or
ModSecurity. PostgreSQL is Phase 8, conditional on a signed paying
customer, and `src/dal/index.ts` throws if the adapter is set to
`postgres`. The canonical store is Firestore.

It also recommends a ModSecurity CRS deployment. Session 47 decided
against edge compute in front of Hosting eight days earlier, on
data-residency grounds, and implemented the equivalent headers in
Firebase Hosting instead.

Three further observations, recorded because they bear on how much weight
to give a document like this:

- Every one of its ~50 inline citations resolves to **the same Notion
  URL**, with index `|1`. It is one link, repeated, styled as a citation
  apparatus.
- Its footer reads **© 2024**, which V1 §3.5 of our own spec lists as a
  copy correction to apply wherever found.
- Its "Critical Gaps" are four generic statements — length-only
  identifier validation, case-sensitive WAF rules, missing historic
  secret scanning, incomplete dependency floors — none of which name
  anything in this codebase. One is also mislabelled: "WAF rules are
  case-sensitive by default" is a Cloudflare interface note, presented
  under a red Critical banner as the conclusion of a discussion about a
  CRS request-body bypass.

**Nothing was adopted from it.** What follows was found by checking
whether its one applicable theme — CI security gates — applied here.

### Entry 49.2 — CI has never run. Not once.

**The finding.** `ci.yml` lived at
`election-cos-app/.github/workflows/ci.yml`. **GitHub reads workflows
only from `.github/workflows/` at the root of a repository.** A nested
`.github` is an ordinary directory with a suggestive name.

Confirmed from the outside rather than inferred: the Actions API reports
`total_count: 0` workflows for this repository. On `origin/main` the only
workflow file present is the nested one.

So since session 1, every check in that file has run exactly nowhere.
`npm run check:all` has only ever been executed by hand, in a
development container, by me. The guards are real and the 992 tests are
real — but **"verified" has meant "verified locally", throughout**, and
the documentation said "run in CI" in two places where that was not
true. Both corrected.

**It is still not running.** A workflow must be on the **default branch**
to execute or to be dispatchable. Both `ci.yml` and `deploy-ecos.yml`
exist only on `claude/election-campaign-os-jlzsw3`. Merging is the
account holder's decision and no pull request has been opened.

**This also means deploy Route B does not work yet** — the one I have
twice described as ready and needing only a repository secret and six
variables. `workflow_dispatch` offers no "Run workflow" button for a
workflow that is not on `main`. The secret and the variables are still
necessary; they are no longer sufficient.

**Fixed, and guarded.** Moved to the root. `workflowLocation.test.ts`
fails if a `.github/workflows` directory appears anywhere else, if the
root one is missing, or if `ci.yml` stops calling `check:all`. Proved by
injection: recreating the nested directory fails the first test;
replacing `check:all` with `lint` fails the third. Reverted clean.

### Entry 49.3 — The dead workflow was also three guards out of date

Worth separating from the path bug, because it is a different failure.

The workflow listed `lint`, `typecheck`, `check:hex` and `test`
individually. Sessions 44, 46 and 47 added `check:type-scale`,
`check:headers` and `check:fonts` to `check:all` — and nothing added
them here, because nobody was watching a file that never produced
output.

It now calls **`npm run check:all`**, one command, so CI and a
developer's machine cannot drift apart again. It also runs the functions
tests, the build, and the deploy preflight in report-only mode.

### Entry 49.4 — 5 high advisories, and why the fix would be the mistake

The report's "integrate SCA as a mandatory gate" is sound advice that,
applied literally here, would have done damage.

`npm audit --omit=dev` on production dependencies: **0 critical, 5 high,
8 moderate.** All five high are transitive inside the Firebase SDK —
`@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js`,
`undici`.

**npm's proposed remedy is `firebase@9.14.0`.** The installed version is
`10.14.1`. That is a downgrade of two major versions, to a release from
2022. `npm audit fix --force` would turn the job green by making the
product materially worse — on a product holding a voter roll.

The real remedy is `firebase@13.1.0`: two majors up, with breaking-change
risk across auth, Firestore and storage. **Ten days before an election,
on a build that has never been deployed, that is the wrong trade.**
Recorded as post-election work in `docs/session-handoff.md`.

So the gate blocks on **critical** and reports high and moderate without
failing. A gate that is red on arrival and whose only green path is
destructive is a gate that gets ignored, or "fixed" destructively. This
one is green and honest rather than red and theatrical.

`dependency-review-action` is added on pull requests only, which is the
only context where GitHub exposes the base/head dependency diff.

### Entry 49.5 — What was deliberately not added

**A third-party secret-scanning action.** The report is right that secret
scanning matters and that history scanning matters more. But adding an
unpinned third-party action to a workflow is precisely the supply-chain
exposure the same document warns about two sections earlier, and pinning
one by commit SHA requires a SHA I cannot verify from here — inventing
one would be worse than the gap.

The honest version: **GitHub's own secret scanning and push protection
are repository settings**, not workflow steps, and switching them on is
the account holder's to do. Recorded as a recommendation rather than
implemented badly.

**Verified:** `npm run check:all` green — 992 tests, 63 files (3 new).
Nothing adopted from the supplied report.

---

## Session 50 — Five NotebookLM exports, 1 November 2026

Five files arrived together, all exported from one NotebookLM notebook on 20 October 2026. They are four different kinds of thing.

### Intake triage

| # | Asset | Kind | Decision |
|---|---|---|---|
| 1 | `lge2026_candidate_database.csv` (51 rows) | Candidate data | **Ingested into quarantine**, not published |
| 2 | `Candidate-database-schema-2026-10-20.md` and `.html` | Description of #1 | Read; one claim contradicted by #1; no data in it |
| 3 | `Candidate_Screening_Analysis_Dual-Nomination_Check.md` | Analysis of #1 | **Rejected** |
| 4 | `notebooklm-chat-…-complete-walkthrough…md` | Marketing walkthrough | **Not ingested**; three claims contradict the build |

### 1. The candidate CSV

**What it is.** A 7,966-byte extract (SHA-256 `b3ca94cc…2ad3`). Its own notes name `LGE2026 Certified Candidate List - NW.pdf` and `- EC.pdf` as the source. **Neither PDF was supplied and nothing was fetched**, so this build has not seen a primary document for it. It is not the Electoral Commission's file.

**Decision.** Ingested by `scripts/ingest-candidates.ts` through `src/modules/ingest/candidateList.ts` into `src/data/iec/candidates-lge2026-notebooklm-2026-10-20.json`, recorded `UNCONFIRMED` and `PARTIAL`, with the checks below. `publishableCandidates()` returns nothing until a named person records `confirmedBy` and `confirmedOn`, and a test fails if any public-site file imports the data, so the names cannot ship in the bundle. The public "Know your ward candidates" page therefore still shows its empty state.

**Why quarantined, from the file itself:**
- **Short.** 51 rows; the Commission's NW workbook the project reviewed earlier had 9,731. JB Marks (34 wards) has candidates in 23 wards; **wards 6–10 and 29–34 have none**. ANC has PR ranks 1, 2, 16, 17, 18 only; DA has 3–6 and neither 1, 2 nor anything after 6; ActionSA has 18 consecutive wards (11–28) and no PR list; EFF, ACDP, BOSA and SACP, which the schema note says are covered, have no rows. A voter shown this would see most wards as uncontested.
- **The ID column was refused.** All 51 values open with a full date of birth (`YYMMDD****08*`), the mask shape `src/lib/saIdNumber.ts` exists to refuse and `docs/nw-candidate-list-2026-review.md` §5 already rejected. It was read only to be counted. A test proves it reaches no record, and the guard was proved by injection.
- **Three rows not placed.** Moses Kotane, Ditsobotla and Matlosana give a ward id but no ward number. The id layout is confirmed for NW405 only (2021 seed), so the suffix was not used to guess a ward.
- **What held up.** Every NW405 ward row's number agrees with its own ward id; every PR rank agrees with its list position; every municipality, name and province matches Annexure A; no repeats. These are checks the earlier workbook failed, so this file's structure is better than that one's, though its coverage is far worse.

**To unlock it:** supply the Commission's candidate-list PDFs for NW and EC (or the Commission's own workbook). Compare, fix, then set `provenance.confirmedBy` and `confirmedOn`. Do not set them on the strength of this file.

### 2. The schema note and HTML
Plain description of #1 plus a 1.4 MB HTML rendering that carries 3,119 characters of text and no data. It says JB Marks has "full coverage across all 34 wards". The CSV it describes does not.

### 3. The dual-nomination and Mayoral Committee analysis — rejected
- **Not reproducible.** It lists eight people as both ward and PR candidates with PR ranks (DA 7, ANC 5 and 8, PA 2, ActionSA 1, FF+ 3 and 4, MK 1). The CSV it says it used contains **no dual nominations** (the ingester reports none) and none of those ranks. It cites a "flagged" CSV that was not supplied.
- **The legal basis is unchecked.** It rests the dual-nomination rule on "Schedule 1 of the Municipal Structures Act". The text of the Municipal Electoral Act read this session (2000 text) neither requires nor forbids it, and the Structures Act was not read, so the rule is neither adopted nor disputed.
- **Named people are given invented ratings and accusations.** A 100-point "Mayoral Committee screening" scores real, named candidates and "vetoes" two of them for "an active SIU SCM procurement inquiry" and "financial disclosure". No source is given, the scores are not computed from anything in this build, and publishing or storing them as findings about identifiable people would be an unsupported allegation. Not ingested, not repeated. Build rule 2 (no fabricated candidate records) applies.
- The offer to generate "Mayoral Committee Appointment Certificates" for six named people is declined for the same reason.

### 4. The platform walkthrough — not ingested
It is a script for a product tour, not data. Three things in it contradict this build and must not be copied: the PPFA limits "R100k disclosure / R15M cap" (superseded: **R200,000 / R30,000,000**, Gazette 53182, 18 August 2025); "Droop and Hare quota thresholds" (the quota here is the Commission's `Q = A ÷ (B − C − D) + 1`, and the Droop reading was disproved against its own 2021 report); and performance and integration claims (OCR in under 1.8 seconds, "Google Maps Platform vector integration", "Dexie IndexedDB", "CampaignToken wallet metering") that this build has not been shown to deliver. Nothing from it went on the public site.

**Verified:** `check:all`; ingester guards proved by injection (confirmation gate removed, ward/ward-id check removed, ID value added to a record), each failing exactly the intended test and reverted clean.

### Session 50, later the same day — fetched from the Commission, and what it showed

The session's network settings were changed, and `elections.org.za` became reachable. The root address answers with a 302 to the Commission's own registration-status site (`registertovote.elections.org.za`, via its data-free mirror); the portal at `/pw/` is the real site. Read directly, not from a supplier:

- **The Commission's candidate-lists page** (`/pw/Parties-And-Candidates/Candidate-Lists-LGE-2026`) lists ten PDFs, one per province plus national, all headed *"Supplementary Certified Candidate Lists"* and dated 23 October 2026. The document itself is headed *"Publication of the certified list of candidates as supplemented pursuant to the Constitutional Court order in African National Congress v Electoral Commission of South Africa and Another (CCT 282/26)"*.
- **Link trap:** the page's links are relative (`../Documents/...`) and resolve under `/pw/`. The same path from the site root returns 404. The page labels the NW file 2.3 MB; the file served is 3,217,349 bytes.
- **Fetched:** NW (3,217,349 bytes, SHA-256 `b121e268…b8f0`, 257 pages, `Last-Modified` 23 Oct 2026 13:41 GMT) and EC (4,669,755 bytes, `a64f66d6…`). `%PDF` magic and `application/pdf` checked. Both added to `tools/source-acquisition/sources.json` as `CONFIRMED` because this build fetched them.
- **Extracted** by `tools/candidates/extract-iec-candidate-list.py` (new; self-tested on seven defect classes) with checks run on the document's own structure: every line that opens with a municipality code parses (10,018 for NW, 15,360 for EC, zero failures); every municipality and name matches Annexure A; district councils have no ward rows; every ward id has the right province and municipality prefix (NW = 6…, e.g. `64005001`; EC = 2…) and a ward number inside the delimitation; every party's PR list runs 1 to n with no gaps or repeats; no party has two candidates in a ward (several INDEPENDENTs may); no exact repeats. The ID column is read for structure and dropped.
- **The format questions in `docs/nw-candidate-list-2026-review.md` do not apply to this file.** There, "Ward \ List Order" held per-party ordinals and a destroyed list order. Here, ward candidates carry real ward ids and PR candidates carry real list positions. That earlier workbook was not the Commission's own file.
- **Shipped:** `src/data/iec/candidates-lge2026-iec-nw-23102026.json`, 10,018 NW candidates, no ID of any kind, `UNCONFIRMED`, `confirmedBy: null`. EC was verified and not stored.

**What the verification showed about the five supplied files**
1. **The 51-row CSV is accurate and tiny.** All 48 North West rows and all 3 Nelson Mandela Bay rows match the Commission's list exactly, name for name. It is 51 of 10,018. For JB Marks it carries 45 of 611 candidates; the Commission's list has candidates in all 34 wards (9 to 17 each) from 20 parties. The schema note's "full coverage across all 34 wards" is false of the CSV.
2. **The dual-nomination note is wrong about most of the people it names.** Dual nomination (the same person on a party's ward ballot and its PR list) is common: 102 in JB Marks, 1,110 in North West, 1,774 in the Eastern Cape, matching on name and partial ID together. But of the eight people the note lists, only Werner Thomas Hitge (DA, Ward 2, PR **27**, not 7) and Everhardus Johannes Jacobus Laing (VF+, Ward 2, PR **7**, not 4) are on both ballots. Moyo, Makousa, Beukes, Moeketsi and Mashiane have no PR row at all. Gideon Du Plessis (VF+) is a ward candidate in five wards, with a PR rank of 19; name alone cannot tell whether those are five people, which is why the extractor compares the partial ID in memory and stores neither.
3. **The Mayoral Committee screening remains rejected.** Nothing in the Commission's list supports a score, a veto or an "SIU inquiry" for anybody.

**Gate:** `publishableCandidates()` still returns nothing, and `scripts/publish-candidates.ts` (`@deployable fails-closed`) writes no files, until a named person records `confirmedBy` and `confirmedOn`. When it does, it writes one small `candidates/<code>.json` per municipality for `/tools/know-your-candidates` to fetch, so no name is in the site's JavaScript. Run end to end with a throwaway "TRIAL ONLY" confirmation, the page showed JB Marks Ward 11's candidates with their source line; the trial files were deleted.

**The owner's list of Commission pages** ("Key processes and roleplayers" and the rest) was probed one by one before use: all answered 200 or a redirect to a working page on the Commission's own hosts, except `/pw/StatsData/Political-Parties-Statistics`, which answers 302 to the Commission's own error page (ER-500) and is not linked. They are in `src/site/officialSources.ts` and `/official-sources`. Read and used: **Party agents** (restated and attributed on the agent log page, including "no communication with people outside the venue until the results are finalised"), **Report election disinformation** (reports go to Real411, complaints cannot be anonymous), **the Code of Conduct page** (agrees with the Act summary: offence, fines up to R200,000, Electoral Court), **Objections** (it describes the 2024 national and provincial process and deadlines, so the site says to rely on section 65 of the Municipal Electoral Act and current rules), **Counting** (a diagram, no text), **Documents-Forms** (folders open by script, so no form numbers can be listed).

### Session 50, later still — the North West list confirmed and switched on

**Decision.** On the owner's instruction on 1 November 2026, the Commission's North West certified list (as supplemented, 23 October 2026) is recorded `CONFIRMED`, `confirmedBy` "the site owner (Innovation Consult)", `confirmedOn` 2026-11-01, with the basis written into the dataset (`provenance.confirmationBasis`). The owner states the list is the Commission's own and declared by it, and points to the Commission's website, its video and news reports. This build checked the website part itself (downloaded, hashed, structure-checked) and, separately by web search, news reports of the 15 October 2026 Constitutional Court order and the Commission's extension of the same relief to similarly affected parties in 107 municipalities. **Not found:** the case number "CCT 282/26" in any news report; it appears only in the Commission's own document heading. The YouTube video was not watched. **No named individual** is recorded; the code accepts the entry, and a person's name should replace the role when there is one.

**What it switched on.** `npm run build:site` now ends with `scripts/publish-candidates-cli.ts`, which writes `dist-site/candidates/<code>.json` for each of the 18 North West local municipalities (548 KB in all; ward candidates only). The page fetches one municipality when a voter picks it. Run in a browser: JB Marks Ward 11 shows 15 candidates, Ward 1 shows 14, Moses Kotane Ward 4 shows 16, with the source line, at 320 and 1280 px, no overflow. If the dataset ever loses its confirmation, `build:site` fails loudly rather than shipping without candidates.

**Scope.** Ward candidates only; PR lists are on the Commission's page, which the site links. North West only; the Eastern Cape list was verified and not stored. Other provinces were not fetched.

---

## Session 50 — the voters'-roll ingestion toolkit (A-087's code), reviewed, not merged

**What arrived (1 Nov 2026).** `IC-ECOS-DATA-2026-02-README.md` (SHA-256 `8b9c675a…`) and `ElectionCOS-ingestion-voters-roll.zip` (`3794165c…`, 34 files, 151 KB): the toolkit that A-087 described in the 28 October batch. **It contains no roll data**: no CSV, PDF or personal record, only code, tests and a nested `CLAUDE.md`. So nothing was ingested and nothing could be: the 31 (or 347) roll PDFs are not in this session and were not asked for.

**What was done.** Unzipped outside the repository. `tsc --noEmit` clean. `vitest`: 29 passed, 2 skipped (they need the real roll). The 10 Firestore-rules tests need the emulator (`firebase-tools`, not installed here) and were **not run**. The parser (`parse_iec_voters_roll.py`, pdfplumber, reads local files only) was read, not run: no PDFs.

**Decision: reviewed and recorded; not merged into the repository.** The toolkit's hard rules match this register's (never commit roll data; never write roll records into `voter`/`household`; never relax a gate; editions immutable; field roles see only their own scope, active edition only). Its gates are good practice and are the pattern §11.3 asks for. It is not mergeable as supplied, for reasons that are the build's own:

1. **Its Firestore rules bypass tenant isolation.** They put `roll_entries`, `roll_addresses` and the rest at the top level and key access on claims `role`, `wardCode`, `vdCode`, then say to "merge into the app's rules". This build's rules put every collection under `/tenants/{tid}/…` with claims `tenantId`, `caps`, `geoScope`, `wardScope` (spec §4.1, "no exceptions"). Merging as written would create the one set of collections in the project that sit outside the tenant path.
2. **It scopes a VD canvasser by `vdCode` alone.** Our rules narrow on VD **and** ward because 25 to 26 of the 108 gazetted stations are split across wards (one across three), so `vdCode` alone shows a canvasser another ward's portion. The roll itself places all 106 VDs it carries in exactly one ward (§13.4), so its data cannot populate the composite `wardCode::vdCode` key for the split stations. The toolkit's one-ward-per-VD gate is correct for the roll and wrong for the delimitation, and the register already records that as a user decision.
3. **Role names differ** (`HQ_ADMIN`, `LOCAL_HEAD`, `VD_CAPTAIN`… against this app's seven roles and capabilities).
4. **Dependency versions differ** (it pins `firebase` ^11 and `firebase-admin` ^13; the app has ^10.13 and ^12.5).
5. **PostgreSQL and Prisma half** targets a database this build does not use and, by the toolkit's own open item 2, conflicts with its stated schema. Not adopted.
6. **106 VDs against 108 gazetted:** two stations are missing from the roll the toolkit reconciles. Unexplained.

**One open item it lists can now be partly closed.** "Ward-number mapping is derived (`64005031` → `NW405-W31`, last three digits)": the Commission's own candidate list, downloaded today, uses the same id for NW405 (`64005001`…`64005034`, all in 1 to 34). That is the Commission confirming the format from a second document. MDB confirmation of the *mapping to ward names* is a separate thing and stays open; `wardMappingBasis` should not be set to `MDB_CONFIRMED` on this evidence.

**What is not decided, and is not mine to decide:**
- **Whether the roll is loaded into Election Campaign OS at all.** The toolkit's own open item 3 says the same: lawful basis, retention date and attorney review come first (build rule 3: no legal conclusions drafted here). §11.1 already says "a POPIA decision, not a technical one".
- **Whether to adapt the toolkit** to the tenant path, claims, composite key and role set. That is a bounded piece of work. It should not be started three days before an election on data this session has not seen.

**If the answer to the first is yes:** the adaptation list above is the work order, the toolkit's gates carry over unchanged, and the first act is to run its parser on the PDFs on the owner's own machine, outside this repository, and check that every VD reads PASS.

### Session 50 (cont.) — voters' roll: tenant adaptation, field screen, per-use metering

- **Toolkit adapted to the tenant structure** (`tools/voters-roll/tenant-adaptation.patch`, README alongside). Found two real conflicts, not stylistic ones: the toolkit's ward code `NW405-W1` never matches the app's `NW405-W01` (a ward-scoped token would have seen nothing), and its VD documents were keyed by station code alone although split stations are real. Both fixed; roll collections now live under `/tenants/{tid}/`. Toolkit unit tests (29) pass patched.
- **Module `voter-verification`** (PER_USE, tenant-scope, not bundled) with capabilities `roll.view` / `roll.capture`; granted to canvasser, VD captain, ward lead (view+capture), HQ and municipal lead (view only). Roles mirror regenerated.
- **Field screen `/roll`** (reached from Voters, nav stays at the spec's nine): reads the people listed at an address in the caller's own ward + station, VERIFY (one counted instance), CAPTURE only with spoken consent and the canvasser typing the person's name back (audit CM1). A refusal stores nothing. The IEC mask is never copied to the voter record. Voter + household + capture event are one atomic batch.
- **Rules** (`firestore.rules`): `roll_*` read-only to clients, scoped by `inScope` and the active edition; `usageEvents` create-only, id `KIND::entryId` (retry cannot double count), caller's own uid, module entitlement present and unlapsed, no price/amount field. **Run in the Firestore emulator: 15/15** (`tools/voters-roll/appRules.emulator.ts`); the same rules text is guarded in `rollCapture.test.ts` and proved by injection (3 guards fail when broken, pass when restored).
- **Not done / open:** no roll data exists in this build; POPIA basis + retention + attorney review undecided (register §11.1); offline path (Dexie sync) not wired; no payment flow, prices or invoice job (deliberately — published identical terms, no drafting of commercial terms); server-side invoicing reconciliation not built; 106 vs 108 VDs unexplained.
- New attachments this turn (Stitch re-export order: 178 screens missing code, 121 unrecoverable; human-centred AI audit v1/v2; white paper): read. The audit's consent-gate, saved-vs-received, and F1/F2/F3/F7 findings informed this screen; the rest are not acted on here.

### Session 50 (cont.) — "master build dashboard" incorporated as a checked Build Review

The supplied static dashboard (`election_campaign_os_master_build_dashboard.html`, plus an "_updated" variant with commercial/legal panels) is a presentation page with hard-coded figures. Its *functionality* (one-screen operator view of roll, quota, seats, ward sizes, field usage) is built as `/analytics/build-review` (`BuildReviewPage`, `buildReview.ts`, 7 tests) from live sources. Its *numbers* are not copied; each was tested:
- **Matches:** quota 1,515 (but it is the 2021 quota, mislabelled "certified 2026"); 34 + 33 = 67.
- **Contradicted:** seat split ANC 33/DA 23/EFF 7 (sourced 2021 result differs, e.g. ANC won 24 ward seats, not 18); top ward sizes 4,210–5,140 exceed the proclaimed upper norm 4,127; "50,400 deceased" vs the toolkit's 52,176 rejected (rejected ≠ deceased).
- **Unreconciled:** 131,963 verified vs Annexure A 122,059 (no roll loaded to arbitrate); address categories sum 1,175 short of 82,607 and the chart adds voters to points; 106 vs 108 VDs.
- **Unsourced, not shown:** turnout series and scenarios S1–S5; 68.5 % hung-council probability; swing ranking.
- **Not carried:** token/tier prices (no prices against a tenant; published identical terms); 32-agent Cloudflare/AWS topology (Firestore decision); 02:00 48-hour hard purge presented as active (audit F3); six legal documents shown "Active" (build rule 3; attorney review undecided).
Guard proved by injection (ward sizes lowered under the norm → test fails; restored → passes). Not rendered in a browser this turn.

Five more HTML files arrived for the same request. Three are byte-identical to files already read (`master_build_dashboard`, `dashboard`, `2026_infographic`). `dashboard222` is an earlier master-dashboard variant (same 33/23/7/2/2 split, 1,515 quota). The sixth, `Election_Campaign_OS_1.0.html`, is the **design board for the public site** (Home, Casework Tracker, Compliance, Packages, Contact, phone layout, product tokens), each page itself a packed bundle, unpacked and read. Its figures (34 wards, 108 stations, 122,059 voters, R2,500 per ward a month, R200,000 / R30 million, Gazette 53182) already match what the public site carries, so it supports the site as built and contradicts the dashboards' 131,963 / 106 / 112,480. Build Review now also rejects 112,480 registered voters, the fractional 1,684.2 quota, and the superseded PPFA R80k/R100k/R15m bands (Gazette 53182), and marks the infographic's pilot financial model out of scope. Layout, typography (Public Sans) and the board's placeholders were not diffed pixel-for-pixel against the live site.

### Session 50 (cont.) — tech architecture master code stack checked

`tech_architecture_master_code_stack` (an HTML rendering of a `.md`; the 1.4 MB is mostly non-text) specifies a GCP landing page + Firebase static hosting + Cloudflare Workers + AWS ECS Fargate/RDS PostgreSQL, 32 agents, and three code listings. Per the 13 Sep 2026 decision ("Firestore is my final decision") the topology is **not adopted** and not re-opened; this is the fifth upload to propose it. The three listings were tested instead, and added to Build Review:
- **`fn_calculate_schedule1_quotas` is wrong.** Run on the 2021 NW405 result it gives quota 1,514.01 (no floor, no "+1"), allocates 65 of 67 seats, never allocates remainders, ignores ward seats won. The IEC published 1,515 and 67/67, which the app's calculator reproduces. Not adopted.
- **Edge worker trusts a client-set `X-Tenant-ID` header** and forwards it unverified: a cross-tenant hole by design. The build takes the tenant from the verified token claim and the rules compare it to the path. Also its CSP allows `script-src 'unsafe-inline'`, weaker than `firebase.json`'s.
- **"Firebase is static-only"** contradicts the build (Auth, Firestore, Functions). **PPFA R80k/R200k/R15M** mixes superseded and current bands (Gazette 53182: R200,000 / R30 million). Outbox vocabulary differs from the tested one in `syncTypes.ts`.
The Dexie outbox listing duplicates what `src/offline/` already has.

### Session 50 (cont.) — hosting estate, Book a demo, Research, enquiry service

Instruction: company site on GCP or Cloudflare, app on Firebase, both behind Cloudflare on `innovationconsult.co.za`, subdomains per service and AI product line, site as acquisition/conversion instrument (book a demo; research on customer pain points).
- **Estate registry** `src/config/estate.ts` (+test): three known hostnames, platform and proxy status; `proposeSubdomain()`; no product subdomain invented; ad/campaign-data origin isolation guarded. Runbook `docs/hosting-and-domain-estate.md`.
- **Flag, not a toggle:** proxying the app through Cloudflare routes voter data through an edge outside the `africa-south1` commitment (a recorded reason `securityHeaders.ts` preferred DNS-only). Needs the attorney review already outstanding; registry follows the instruction (`cloudflareProxied: true`).
- **Enquiry service** `functions/src/enquiry.ts` (11 tests) + `enquiryHttp.ts` (`submitEnquiry`, fails-closed without `TURNSTILE_SECRET`); client `src/site/enquiryClient.ts` (4 tests); `enquiries` collection closed to clients in rules. Site: `/book-a-demo`, `/research` (published explainers + commissioning; no invented reports), header "Book a demo", report links preselect the interest. Preview mode kept honest when the endpoint is not configured. ID-number refusal proved by injection.
- **Five attachments read, not adopted:** (1) "IEC integration" doc: a Node/Express/Prisma/Postgres service calling `api.elections.org.za/v1/voter-roll`. No such public API was found when the Commission's own site was fetched (it publishes PDFs); the roll is supplied as PDFs. It hashes full ID numbers with SHA-256 (a 13-digit structured space is trivially enumerable, so that is not masking), and re-proposes the closed Postgres/Express/Redis stack. (2) "Voice client / publicDomain" doc: would replace `publicDomain.ts` with a `PRIMARY_DOMAIN` + `api.` WebSocket scheme that conflicts with the registry and the superseded-name guard; `modules/voice` does not exist. (3) Gemini FastAPI "live advisory" WebSocket (Redis, Gemini Live): a possible AI product line for its own subdomain, not part of this build; it takes `tenant_id` from the URL path with no authentication, the same flaw as the `X-Tenant-ID` header finding. (4) Gemini `seat_calculator` tests: expected NW405 2021 totals (ANC 33, DA 17, VF+ 9, EFF 6, PA 2) agree with the build's IEC-reproduced result; nothing to add. (5) a one-line placeholder script.

### Session 50 (cont.) — attorney review stated as approved; Spark-plan claims Worker

- **Owner's statement, 1 Nov 2026: "ATTORNEY REVIEW APPROVED PROCEED."** Recorded as the owner's statement. No reviewer name, firm, date, document reference or scope was supplied, and this build has not seen the opinion. What it is taken to settle, pending the document: the open item in register §11.1 (lawful basis / attorney review for loading the voters' roll and the Cloudflare edge question). What it does **not** change: no roll data is in the repository or the build; the consent gate, the "never write the roll into voter/household" rule and the gates in the toolkit stay as they are; this build still drafts no binding legal instrument (rule 3). **Please file the opinion's reference here** so the next reader can see what it covered (roll load and retention date, processing through Cloudflare, cross-border transfer, and the lawful basis wording).
- **Claims Worker** (`worker/`, `wrangler.jsonc`, `src/auth/claimsApi.ts`, AuthProvider hook, 13 + 4 tests): free-tier replacement for the Blaze-only `resolveCapabilities` trigger, adapted from the supplied Cloudflare zip. Cut: 501 stubs for sync/unmask; hard-coded owner e-mail and tenant id; the demo-accounts bypass. Off by default; runbook in `docs/hosting-and-domain-estate.md`. The zip's other contents (an older snapshot of this app plus patch scripts) were not merged.

### Session 50 (cont.) — "build these": the tech-architecture listings, and three exports

Instruction: build the Tech Architecture Master Code Stack. Built as far as the system that exists allows; `docs/architecture-agent-map.md` maps all 32 named responsibilities to this build and lists what is not built.
- **Schedule 1 quota in SQL** `db/schedule1_quota.sql` + `db/test_schedule1_quota.sh`, run against a real Postgres 16: quota 1,515, 67 of 67, every party equal to the IEC result. Two injected defects fail it (no "+1" → 1,514; no remainder pass → 65 seats, the supplied function's exact fault). A cross-check engine; the TS calculator stays authoritative.
- **Outbox status machine** `src/offline/outboxStatus.ts` (6 tests): no silent discard, retries stop at five. Not wired into the stored Dexie schema (risk days before polling).
- **Edge gate** `worker/src/edge.ts` (6 tests), mounted on `/api/sync`: verified token, per-user throttle, 5 MB cap, identity-header scrub, no CSP of its own. Replaces the supplied `X-Tenant-ID` design.
- **Three exports from the other uploads, as files not screens ("no dashboard showing")**: audit-log CSV (`auditExport.ts`, formula-safe, metadata excluded); a priceless, nameless monthly usage statement for the invoicing side (`usageStatement.ts`, CSV/JSON, marks a ward-scoped file as not to be invoiced from); Daily Ground Intelligence HTML (`groundIntelligence.ts`, cells under five suppressed, no ward totals, no script or external request). Shared `src/lib/csv.ts` neutralises spreadsheet formulas.
- **The accounting-agent spec (IC Books)** is a separate product whose own spec says not to touch this repo; only its interface to the apps is honoured here (the usage statement). Not built: the books, D1 hosting, VAT, intercompany.
- **Not built:** AWS ECS/RDS topology, GCP landing-page host, Python simulators, Monte Carlo and hung-council probabilities (no data or method), the 48-hour hard purge, WhatsApp dispatch (no credential).

### Session 50 (cont.) — five more files: four repeats and one new (VD captain telemetry)

- The four HTML dashboards (`master_build_dashboard`, `_updated`, `dashboard`, `dashboard222`) are byte-identical to the copies already reconciled (matching SHA-256 prefixes). Nothing new; the Build Review rows stand (seat split, ward sizes, 112,480 / 1,684.2, superseded PPFA bands, prices, topology).
- **New: "Captain Telemetry Dashboard" note** (NotebookLM, 20 Oct 2026), a spreadsheet design for a VD captain's day. Built as a **file, not a screen** (`src/modules/voters/dailySignoff.ts`, 8 tests; "Daily sign-off" button on the Round page, voting-district logins): printable HTML sign-off sheet and `ecos.vd-signoff/1` counts, from records the app already holds (doors by state, consented captures, supportive responses, incidents, device outbox depth). Deliberately **not** taken from the note: "pledges" and the 35 % / 45 % conversion thresholds (no pledge concept here, thresholds unsourced, the note itself asks to adjust them; the alert is a parameter that is off until a campaign sets it); a per-canvasser grading table (audit §7.2); the "POPIA §4.3" checklist reference (not verifiable). Unsynced work always outranks any other flag. The Excel workbook and Python export script the note offers were not built.

### Session 50 (cont.) — build-discipline pass and security review of this session's changes

- **`npm run check:all` had been failing since the ground-intelligence and sign-off commits.** I ran lint, typecheck and tests after each change but not the whole gate, and both generated HTML reports carried raw hex colours (rule 12; `check:hex`). Fixed: their stylesheets now interpolate `tokens.color.*`. `check:all` is green again (lint, typecheck, hex, type-scale, headers, fonts, 1,310 app + 133 function tests).
- **Security review findings, both in my roll capture write, both fixed:**
  1. A deterministic voter id (`roll-<entry>`) meant a second capture overwrote the first and, if the first had been soft-deleted at the person's own request, set `deletedAt` back to null: an erased person revived by a different canvasser's "yes". `assertCapturable` now refuses any person already on file (different wording for one removed at their request: "tell your Ward Lead"); tested.
  2. The household write used the create stamp with `merge`, so a second voter at a door reset `createdAt` and could clear `deletedAt`. Only a new household now gets the create stamp.
  Reviewed and found sound: tenant claims come from the verified token (not a header); the claims Worker reads the staff record, validates the tenant id before building a Firestore path, and never takes capabilities from the request; the enquiry function rejects a missing or unknown `Origin`, sets CORS only for the two allowed origins, fails closed without its secret, stores no IP; `enquiries` is closed to clients; the `?interest=` parameter is only honoured if it matches the report pattern or a known interest and is rendered through React; CSV cells are formula-neutralised; generated HTML is escaped and has no script. **Residual risks, stated:** the enquiry endpoint relies on Turnstile plus a Cloudflare rate-limit rule to stop a flood of distinct fake emails (not yet configured); client-written usage events are a convenience tally and must be reconciled against `voters` by the invoicing side; the typed-name consent check is a UI control the rules cannot enforce (the rule only requires `popiaConsentGiven == true`).
- **Run in a real browser (rule 8):** the built public site, served on a throwaway port and driven with Playwright at 390 px and 1280 px: `/book-a-demo`, `/research` and `/contact?interest=report:…` render with the right headings, no horizontal overflow, the interest preselects, the preview submit shows the honest "nothing has been sent" message, zero console errors. Not run: the application itself (needs the emulator and seed data) and the authenticated pages (`/roll`, Build Review, Round sign-off), so those remain **unrendered**.
- **Skipped from the queued commands:** the algorithmic-art skill (nothing in this build for it); the built-in browser skill (its browser cannot open a server started in this container, so Playwright was used); the demarcation and quota skills (the quota SQL and the Build Review already tie the calculator to the IEC 2021 result, and the delimitation baseline was not touched).

### Session 50 (cont.) — ECOS design system zip; /design-sync

`/design-sync` could not run (DesignSync needs `/design-login`, impossible headless), so nothing was pushed or pulled. The supplied files are kept as reference in `docs/design-system/` with `RECONCILIATION.md`. Done: added the missing `roadmap` colour (#8A6A2A) to `tokens.ts` and `tailwind.config.js`; `designSystemSync.test.ts` ties all eight shared values to the supplied `tokens.css` (proved by injection: altering one hex fails it). Not done, by decision: removing `maroon` (the system forbids red; 61 files use it; owner to decide after polling day), the six-role list (seven settled 13 Sep), the hash-chained audit column (no chain exists), the capability-token and delegation screens.

### Session 50 (cont.) — "develop a landing page tutorial": the 60-second tour at `/tutorial`

Inputs: a NotebookLM 60-second video outline, two PDFs of an earlier fork's landing and tutorial screens, and a 29 Oct snapshot zip of that fork. `/team-onboarding` is not a command this session has; nothing ran for it.
- **Built:** `src/site/tutorial.ts` + `pages/SiteTutorial.tsx` (7 guard tests): six chapters on a 0:00–1:00 progress bar (roles, command view, capture with consent, offline, seats, funding and privacy rules), tabbed, keyboard-operable, no autoplay, links to the seat tool, the funding checker and "Book a demo"; link on the home page and "Tour" in the header. Roles come from the role table, not retyped. **No video exists**: the page says so and doubles as the script.
- **Not taken from the outline or the screenshots, and why:** "AI OCR under 1.8 s" (no scanner); "predictive seat forecasting" and "Droop/Hare quotas" (the calculator applies Schedule 1 to entered numbers and forecasts nothing; the statutory quota is not Droop); "R100,000 disclosure limit" (superseded; R200,000 / R30 million, Gazette 53182, under challenge); CampaignToken wallet (not in this build); "POPIA §4.3" (unverifiable); the sandbox log-ins with named personas, the invented ward map ("18 strongholds"), "412 active canvassers", "3,842 votes per seat", "token wallet 24.5k". A guard test fails if any of these claims returns (proved by injection). The screenshots' red headline is the maroon the design system forbids (see `docs/design-system/RECONCILIATION.md`).
- **Browser-verified** (Playwright, 390 and 1280 px): six chapters switch, no horizontal overflow, 0 console errors, home link present.
- **The 29 Oct zip** is another snapshot of the same fork as the earlier Cloudflare zip; not merged (older source, demo-account bypass, Postgres/AWS material). Differences against the earlier zip: see `diff -rq` count recorded in the session.

### Session 50 (cont.) — queued commands finished

- **Quota skill → a real Item 16 defect, fixed.** On a synthetic fixture (B=34; party P with 12 ward seats against an entitlement of 9, ranking for a remainder seat) the calculator gave P a list seat on top of its wards; Item 16 gives a party at or over its entitlement **no** list seat. Now: the remainder seat is consumed (not reassigned; the Act has no mechanism), the party keeps every ward seat, and the council ends larger than B by the overhang (hand-worked 38 = 12 + 14 + 12; 3 new tests; proved by injection). Mirrored in `db/schedule1_quota.sql` (fixture added to its Postgres test). The published NW405 2021 result and all prior tests are unchanged. All consumers (Seat calculator page, public seat model, coalition tool, ward scenario) use the one function.
- **Open, not changed:** the skill states Item 13(2)(b) breaks remainder ties by the party with the higher total votes and says never to leave a tie unresolved; this calculator flags the tie and leaves the seat pending ("the Electoral Commission resolves ties, not this model"). The skill's verbatim statute file (`references/`) is not present in the synced copy, so the wording could not be checked against a primary source (rule 2). Left as the conservative behaviour; the attorney whose review the owner reports as approved should confirm 13(2)(b), after which a highest-votes rule is a small change. The skill also calls the Item 12 quota a "Droop-type variant"; the calculator's own header (read against the IEC's printed formula) says it is not the Droop quota. The site copy names neither.
- **Demarcation skill:** its category rule is already enforced (`assertSchedule1Applies` refuses a category C district council when a municipality code is given; tested) and PR seats come from the register, not hand entry. Nothing to change.
- **Security-review skill could not run** (its first step runs `git diff origin/HEAD...`, and this clone has no `origin/HEAD`). The manual review stands; a pattern scan over all 81 files changed since the roll work found no key, token, credential or personal address; the only 13-digit number is an invented fixture in the enquiry ID-refusal test.
- **Algorithmic-art skill: not run.** No art request came with it, and its required viewer template carries third-party branding that does not belong on a party-neutral product. Say what the piece is for and I will make it in the product's own palette.
- **/design-sync** and **/team-onboarding**: see earlier entries (no design authorisation headless; no such command).

### Session 50 (cont.) — CORRECTION: Item 16 was the 2021 text, not the pre-2021 one; ties break by votes

The entry above ("queued commands finished") fixed Item 16 by making the council grow and consuming the seat. **That implemented the pre-2021 text.** A primary-source research pass (Gazette PDF of Act 3 of 2021 read, the formula checked on the printed page) found the law in force for 4 November 2026 is different, and the quota skill's "proposed amendment, not current law" is out of date:
- **Item 16(1)–(2):** a party whose ward seats are equal to or greater than its Item 13 entitlement takes no list seats; its ward seats are untouched.
- **Item 16(3)–(9), added by Act 3 of 2021 s33, in force 1 Nov 2021:** a **new quota** `floor((A − B) / (C − (D + E))) + 1` (B = that party's votes, D = the seats it holds, E = independents) is set; every OTHER party is divided by it; surpluses by highest surplus; ward seats deducted. The council stays at C.
- **Item 13(2)(b) and 16(4)(c):** equal surpluses go to the party with the highest valid votes. The Act has **no lot-draw** and no rule for equal surplus AND equal votes.
- **Item 12:** the Act's denominator is B − C. The Commission's printed reports use B − C − D (D = 0 in every report seen); the calculator's four-term form reduces to the Act's at D = 0.
`seatCalculator.ts` now implements this (new `newQuota`, `excessiveParties`, `notes`, `excessive` per party); tests rewritten with hand-worked fixtures, proved by injection; `db/schedule1_quota.sql` and its Postgres test ported to the same rules and fixtures (quota 1,515 and 67 of 67 unchanged; fixtures: one excessive party → P12/Q13/R9, new quota 1,114; two → 12/10/12, 1,401; tie on surplus won by votes). The public seat tool, coalition tool and in-app calculator copy no longer say the council "grows" and now describe item 16.
**Interpretations the Act leaves open, stated in the output `notes` when relied on:** D is taken as the ward seats the excessive party holds; two excessive parties are treated together; if another party is still over entitlement after the recalculation its ward seats are kept and the council is shown larger; "valid votes" in the tie rule is read as the party's votes on the Item 13(1)(a) basis. **Not modelled:** Item 16(9) (forfeiture and repeat when a party's list is too short) and Item 17 (list shortfall), which need candidate-list lengths; **no current consolidated text was retrieved** (wording is from the 2009 consolidation plus the 2021 Gazette amendment): confirm word for word against a current consolidation.
**A NotebookLM note ("Electoral Engine Updates", 20 Oct)** says Item 17 is "tied remainder and lot-drawing" and Item 18 is "PR overhang recalculation". Against the Gazette text: Item 17 deals with a party list that has too few candidates (17A: a candidate assigned to more than one seat), Item 18 with vacancies; ties go to the party with more votes with no lot; the overhang is Item 16(3)–(9), and its quota formula in the note (seats minus ward wins over votes) is not the Act's. Not adopted. A `lot_drawing` flag has no basis in the Act.


### Session 51 — public website reconciled with the white paper; outstanding-agents plan

- **Decision:** keep the existing Vite/React public site rather than rebuild in Astro before the 5 Nov launch; cost stated (entry JS 126 KB gzip vs the paper's 50 KB target). Full page map and divergences: `docs/website-reconciliation.md`.
- **Built:** `/platform` (seven roles, held to `seedRoles.ts`), `/about` with the neutrality pledge, `/legal/privacy|terms|cookies` (facts only; binding text pending attorney, rule 3), `/sign-in` (hands to the app origin), a noindex 404 (was: unknown paths showed the home page). Footer legal links pointed all at the pledge; now at their pages.
- **Controls:** claims gate (C.7) hides placeholder rows and labels unchecked ones "Draft: check pending"; forbidden-claim and party-name lint on the marketing files; site `_headers` with CSP (no unsafe script) and `wrangler.site.jsonc` (not deployed); route-level lazy loading (entry JS 198 → 126 KB gzip) and `check:site-budget`.
- **Not built:** signed 24-hour downloads, Pagefind, cookieless analytics, Turnstile rate rule. Founder decisions open: hosting A vs B, advertising A/B/C (framework inert), Information Officer, nameservers.
- **Plan written:** `docs/outstanding-agents-plan.md` (tiers: build now / needs credential / do not build without method and data / founder decisions).

### Session 52 — outstanding agents A1 and A4

- **A1 sync sentinel:** `outbox.ts` now counts retryable failures (`OutboxEntry.retryCount`, not indexed so no Dexie version bump) and `transition` turns the 5th into a rejection: the record shows REJECTED with `_rejectedReason`, the entry leaves the queue. Before, a retryable failure was retried for ever. Test + injection (counter pinned at 0 → test fails).
- **A4 audit hash chain:** `functions/src/auditChain.ts` (transactional append with a head doc, `sha256(prev \n [seq, time, actor, action, type, id])`), adopted by the membership-OTP audit writer only; `src/modules/settings/auditChain.ts` verifies; the CSV export gains a `chain` column (verified / BROKEN / not chained); the integrity wording is updated and still says unchained entries are not tamper-evident and that there is no external anchor. The canonical form is pinned by an independently computed SHA-256 in both projects. Injection: removing the linkage check lets a deleted entry pass → test fails. **Other audit writers (unmask, PPFA export, config) are not yet moved to the chain.**

### Session 52 (cont.) — agents A2 and A3

- **A3 RLS audit (static):** `src/rulesAudit.test.ts` parses `firestore.rules` and fails if a tenant collection has an `allow` without `tenantOK(tid)`, any `if true`, a missing deny catch-all, a writable server-only collection (`auditLog`, `counters`, `counterEvents`, `membershipOtpChallenges`, `entitlements`), or a hard delete. Proved by injection (dropping `tenantOK` from the diary read fails it). **Finding, not changed:** `profile`, `wards` and `votingDistricts` use `allow write`, so their editors can delete; recorded as a named allowlist in the test, owner to decide. The emulator matrix for every collection is not built: `@firebase/rules-unit-testing` fails to resolve against this tree's peer dependencies (not forced).
- **A2 consent quarantine:** `functions/src/consentQuarantine.ts` — pure selection (no consent, no time, no method; skips held and soft-deleted) and a release that needs a named person, a reason and valid consent. No purge. Not exported or scheduled (needs Blaze, a release screen and the owner to name the releaser). Injection: removing the missing-time check fails the test.

### Session 52 (cont.) — agent A7, masking sweep

`src/lib/piiScan.ts` (13-digit run, SA phone formats) and `src/exportSweep.test.ts`: the four text exports are built from hostile input and scanned; a second test lists every file that triggers a download and fails if one is neither swept nor classified. The four PDF downloads (PR list, referral, incident report, subject access) are classified as personal-data-by-design and are **not** text-scanned: the PDFs are compressed, so a scan of the bytes would prove nothing. Injection: appending event metadata to the audit CSV fails the sweep.

### Session 52 (cont.) — cost guard (white paper: paid usage above R500 a month needs the founder's approval)

- **Built:** `functions/src/costGuard.ts`. Every paid action reserves its cost against a month ledger (`platform/spend_YYYY-MM`, SAST month, whole cents) in one transaction before it is incurred. Ceiling R500 (50,000 cents) unless `platform/costApproval` carries a higher ceiling, a named approver and the same month. Wired into `requestMembershipOtp` (the only paid action: a WhatsApp message) ahead of code generation and delivery; refusals return `resource-exhausted` with a plain message.
- **Fails closed:** the per-message price is `WHATSAPP_COST_CENTS_PER_MESSAGE` with **no default**. Unset means no paid sends. Read it off the Meta bill; it is not assumed here. Failed deliveries are not refunded.
- **Tests (10):** exactly-at-ceiling allowed and next cent refused (refusal records nothing); approval valid only for its month, with an approver, above the default; invalid prices refused; SAST month boundary; structural test that the reservation precedes generation and delivery, and that no other file calls the delivery. Injection: replacing the reservation call fails the structural test.
- **Not covered, stated:** only this one paid action exists in the code. Firebase, Cloudflare and Google Cloud platform bills are not metered here; they need a budget alert in the Google Cloud and Cloudflare consoles. To approve more: write `platform/costApproval` {ceilingCents, approvedBy, period} with the Admin console; no screen for it yet.

### Session 52 (cont.) — agents A5, A6 and Tier B finished

- **A5 photo compression:** `src/offline/photoCompress.ts` (7 tests) plus a real-Chromium run: 12.2 MB, 4000x3000 noise photo with a spliced GPS/EXIF segment became 406 KB at 1600x1200 with the GPS text gone (noise is the worst case, so it landed 6 KB over the 400 KB target at the lowest quality step). Not wired to a screen: the app has no photo capture UI.
- **A6 scenario policy:** `scenarioPolicy.ts` (6 tests) labels every scenario input sourced (with a citation) or assumption; shown on Ward Comparison. Injection: dropping the citation check fails the gate test. War-room counters unchanged: already read real counters with an honest empty state, and need the Firebase paid plan to populate.
- **Document vault:** `functions/src/documentVault.ts` (5 tests). **Incident dispatch:** `functions/src/incidentDispatch.ts` (5 tests), off by default. Injection: removing authenticated context lets a moved blob open; putting the description in the message leaks it; both fail their tests.
- **Not built, on purpose:** agents 11, 23, 27 to 32 (no sourced method or data).

### Session 52 (cont.) — scenario runner (Monte Carlo over stated assumptions)

- **Built:** `src/modules/analytics/scenarioRunner.ts` (14 tests) and `ScenarioRunnerPage.tsx` (3 jsdom tests), route `/analytics/scenario-runner`, linked from Ward Comparison. Methods: seeded mulberry32 generator, Box-Muller normals, optional zero-sum balancing of swings, nearest-rank percentiles, Monte Carlo standard errors on every frequency, one-at-a-time sensitivity. Every draw calls `projectCouncil`/`allocateSeats`; the statute is not re-implemented. 20,000 draws is about 0.7 s.
- **Proven:** zero uncertainty reproduces the deterministic projection exactly and zero swing reproduces the certified 2021 council (67 of 67); same seed same output; normal generator mean/sd checked; percentile and standard error hand-worked. Injection: removing the zero-sum subtraction fails the invariant test. (An earlier version of that test was vacuous and passed against the injection; found and replaced.)
- **What it is not, and the screen says so above every table:** the spreads are the user's beliefs, not estimated from data (one certified election cannot estimate a swing distribution) and nothing is back-tested, so every frequency is "in X% of draws from your assumptions", never a probability of an outcome. Independence of ward results beyond the common swing, and normality of swings, are modelling assumptions of the runner.
- **Not adopted:** the Gemini simulator API note (unsourced shares, a 132,140-voter pool, a Python/FastAPI service off the Firestore decision) and the NotebookLM engine-updates note (Item 17/18 claims contradicted by the Gazette text, already recorded above). The attachments sent with the instruction contained no attorney confirmation and no method; the owner's word is recorded as the instruction.
- **Desktop folders:** the only folder the owner's computer offers (ECOS1_FINAL BUILD - V3 BETA_19 Oct 2026 on DESKTOP-4RGFL7O) is not available to cloud sessions, so the desktop could not be read.

### Session 52 (cont.) — voter sentiment polls (website, app, social, WhatsApp link) and dashboard

**Asked for:** an online poll measuring voters' party support, on all social platforms, the website and the app, sendable via WhatsApp, reporting automatically to a sentiment dashboard in the app.

**Built**
- `src/modules/polls/pollModel.ts` (13 tests): definition validation, tally keys, the dashboard builder, share links for WhatsApp, Facebook, X, Telegram, LinkedIn, email and SMS (plain links, no SDKs or pixels) and paste-only links for Instagram, TikTok and YouTube (no web share URL exists; no pretend button).
- `functions/src/pollSubmit.ts` + `pollHttp.ts` (13 tests): GET definition, POST one answer. Closed choice only, so no identifier can be typed in. Stores COUNTS (`tenants/{t}/pollTallies/{poll}`), never a per-response row; single-use link tokens kept only as a hash in a separate document. Turnstile; fails closed (503) without `TURNSTILE_SECRET`. Added to `index.ts`.
- `src/site/pollClient.ts` (7 tests) and `pages/SitePoll.tsx` at `/poll/:pollId`: browser-verified at 390 and 1280 px against a stubbed API (validation, payload contains only answer fields, no overflow, no console errors).
- `src/modules/polls/PollsPage.tsx` at `/analytics/polls` (create, open, close, share panel, results), `dal.polls`, rules for `polls` (staff with `settings.tenant`) and `pollTallies` (read-only, server-written), a collection-group index override for `publicId`.
- Injection proofs: dropping the option-membership check, the small-group suppression, and the consent check each fail a test.

**Where this departs from the request, and why**
1. **Anonymous counts, not voter-level records.** Political opinion is special personal information under POPIA. The design holds no name, number, ID, IP or device, so an answer cannot be traced to a person. The cost: no linking a poll answer to the roll or to a canvassed voter, and no per-person follow-up. That is deliberate. A voter-level version would need the attorney's sign-off on a lawful basis and purpose first.
2. **Self-selected, so no margin of error and no forecast.** Results are people who chose to answer a link. The dashboard says so, shows no confidence interval (it would imply representativeness), hides any group under 5 responses, and never presents shares as a prediction.
3. **The website stays neutral.** No party name is in the site source: the question and options are fetched from the organiser's poll at run time, and the page names the organiser and says the platform takes no side. The neutrality lint still passes with the poll page included.
4. **WhatsApp = a link you choose to send** (wa.me share, or a unique link per invitee in single-use mode). **Not built:** sending WhatsApp messages to voters through the API. That needs a WhatsApp Business credential, a recorded opt-in for being contacted about polls (the roll's consent covers canvassing and one-time codes, not this), and the cost guard; unsolicited bulk messages risk POPIA direct-marketing rules. A recipient filter and sender should be built only once that consent field exists.
5. **"Automatically reports to the dashboard"** is true once the `poll` function is deployed (Firebase paid plan, `TURNSTILE_SECRET`, `VITE_POLL_URL`). Until then the page says polling is not switched on and sends nothing.
6. **Open links can be stuffed** by someone who solves many Turnstile challenges; the per-IP rate limit is a Cloudflare rule not yet set. Single-use links cannot be answered twice. Both the dashboard and this note say so.
7. **Notice wording** (`POLL-NOTICE-V1`) is a placeholder pending attorney sign-off (build rule 3); the privacy page gained one factual line about polls, also pending.

### Session 52 (cont.) — sign-in with Meta, Microsoft and Apple (alongside Google)

- **Built:** `src/auth/authProviders.ts` (provider registry, `VITE_AUTH_PROVIDERS`, minimum scopes, plain error messages), `signInWithProvider` in `firebaseAuth.ts` (Google is now one case of it), and the sign-in page renders one button per listed provider. 12 new tests; injections (adding a broader Facebook scope; dropping the scope loop) each fail a test.
- **A button appears only if listed.** Default is Google only. Each other provider has to be switched on in the Firebase console first, with its own app credentials; this code cannot do that, and a button for a provider that is off would only fail.
- **Access is unchanged:** an administrator still assigns a role to a Firebase user id; the claims function keys on that id, not on email, so a new provider cannot inherit anyone's access. The owner bootstrap in the claims Worker still requires `email_verified`.
- **No automatic account linking, deliberately.** Linking by email lets someone who controls an unverified email at one provider take over the account at another (Meta can return unverified or no email). Firebase refuses the sign-in, and the page tells the person to use their previous method. Consequence: the same person on a second provider is a different user id and needs their own role assignment (or an administrator-led link, not built).
- **Minimal-footprint rule kept:** email scope only; the name and photo a provider volunteers are scrubbed from the Auth record straight after sign-in, as for Google.
- **Owner steps (not done, cannot be done from here):** (1) Firebase console, Authentication, Sign-in method: enable Facebook with the Meta app id and secret; Microsoft and Apple likewise. (2) In the Meta developer app add `https://electioncos1-0.firebaseapp.com/__/auth/handler` as a valid OAuth redirect URI, set the app Live, and supply the privacy-policy URL and data-deletion instructions Meta requires. (3) Add each production origin to Firebase authorized domains. (4) Set `VITE_AUTH_PROVIDERS=google,facebook` for the build. (5) Attorney: signing in through Meta, Microsoft or Apple tells that company the person uses this platform (a political-campaign tool); Auth records are held in the US regardless. Decide whether that is acceptable for staff, and whether to disclose it on the sign-in page.

### Session 52 (cont.) — landing page design, short video explainers (YouTube), animation

**Asked for:** a landing page / website for the application, with video and animation tutorials and explainers short enough that voters and parties will use them, hosted on YouTube so the static page stays static.

- **Design:** a Claude Design canvas with three artboards, built from the product tokens only (paper, ink, gold; Archivo, Public Sans, IBM Plex Mono), no party names, invented numbers labelled "Example · invented data": the landing page, the short-explainer hub, and the signed-in application home. Link: https://claude.ai/artifact/CL73bwZMvuXgHcTxz7htGY (private to the owner until shared).
- **Built in the repo:** `src/site/explainerVideos.ts` (10 explainers, 4 for voters/parties each as 10 to 30 seconds, every one with its words as text), `pages/SiteWatch.tsx` at `/watch` (nav item "Videos"), an animated case journey in CSS (keyframes in `tailwind.config.js`, stops under `prefers-reduced-motion`), a "Start here: short videos" card on the War Room page, CSP `frame-src` for `youtube-nocookie.com` only. 24 new tests; three injections (accepting a malformed id, rendering the player before a click, allowing the ordinary YouTube host) each fail a test.
- **No video is faked.** `youtubeId` is null for all ten because **no video has been recorded**: this build cannot film, voice or edit one, and cannot upload to YouTube. Each card shows its words and says "Video not recorded yet". Setting an 11-character id in the registry turns that card into a player; nothing else changes.
- **YouTube without breaking the static page's privacy rules:** the player is built only after a click, from `youtube-nocookie.com`, with captions on and related videos limited. Browser-verified at 390 and 1280 px: loading `/watch` contacts only Google Fonts (as the rest of the site already does), never YouTube; no overflow; no console errors; animation off under reduced motion. The page uses no YouTube thumbnail (fetching one would contact YouTube); the poster is our own panel.
- **To finish (owner):** (1) record the ten scripts (the `readIt` text is the voiceover: about 25 words for 10 seconds), with captions, using invented wards and data; (2) upload to a YouTube channel as public or unlisted with captions; (3) put each 11-character id in `explainerVideos.ts`; (4) before using YouTube, decide whether disclosing to Google that a visitor pressed play is acceptable for the privacy page (it is only after a click, but it is still a transfer), and add one line to the cookie/privacy notice (attorney). The neutrality rule applies to the videos too: no party branding, no predictions.

### Session 53 — party names reflect the parties contesting, per the candidate list

- **Source and its limit:** `nw-province-candidate-list-2026.xlsx`, the 610 rows for NW405. It says it is derived from the Electoral Commission's final candidate list of 16 September 2026; no named person has confirmed it against the Commission (see `docs/nw-candidate-list-2026-review.md`). Used only to decide which party names the scenario tools offer; not published to voters.
- **Built:** `src/modules/analytics/nw405Parties2026.ts` (7 tests) holds the 20 parties contesting NW405 with names exactly as the list prints them (a test fails if a display name differs by anything but case), `PartyListNotice.tsx`, and the Ward Comparison and Scenario Runner screens now offer swings only for parties that are on the 2026 list AND have a 2021 result (ANC, DA, EFF, PA, VFP; Vryheidsfront Plus now shows as the list names it, "Vryheidsfront Plus | Freedom Front Plus"). Injections: offering a non-contesting party fails the runner page test; altering a display name fails the list test.
- **What the list changed:** four 2021 parties are not on the 2026 list (Abantu Batho Congress, African Transformation Movement, Black First Land First, Forum 4 Service Delivery). Fifteen parties on the 2026 list have no 2021 NW405 result (including ActionSA and Umkhonto Wesizwe Party). The screens say so plainly.
- **Not done, and why:** the 15 new parties are NOT modelled. A swing is a change from a 2021 result; with no 2021 votes there is nothing to swing from, and inventing a starting share would be fabricating data. The four absent 2021 parties' votes stay in the baseline (no data on where they go). The certified 2021 data (`nw405Example.ts`) is unchanged: it is history, and its names are the 2021 names. The candidate-list files in `/seed-data` and the published candidate pages already carry the list's own party names.
- **Candidate-list discrepancy to resolve:** the smaller `lge2026_candidate_database.csv` (51 rows, 6 parties for NW405) is a partial extract and disagrees with the workbook's 20; the workbook was used. A person should confirm the party list against the Commission's list.

### Session 53 (cont.) — explainer videos rendered, dependency audit, Real411, and what the five documents did and did not change

- **The zip is not video files.** `ECOS_design_system_development.zip` holds the ten explainers as Claude Design animation sources (HTML plus React, one per explainer). They are checked in as `video-src/explainers/` (excluded from lint) with a SOURCE.md, and **rendered to real MP4s here**: `scripts/render-explainers.mjs` (`npm run render:explainers`) steps each animation through its own seek hook frame by frame in Chromium and pipes the frames to ffmpeg: H.264, 1280x720, 24 fps, 10 to 30 seconds, 0.3 to 0.9 MB each. Silent (no voiceover), captions on screen. SRT caption files generated from the scene timings are in `video-src/explainers/captions/`. All ten were delivered to the owner; I looked at all ten frames: on-brand, examples labelled "Example data is invented". Not committed as binaries.
- **Sync guard:** `src/site/explainerVideos.sync.test.ts` (4 tests) fails if a video's captions, title, audience or length differ from the registry's text. The registry's `seconds` for four explainers were corrected to the rendered lengths (roles 12, capture-consent 11, offline 15, funding-30-day 14), as the zip's README asked.
- **Still not on YouTube:** `youtubeId` stays null for all ten until someone uploads them (needs the owner's channel) and pastes the ids. Voiceover is not produced. One visual note for the owner: the seat-calculation video shows Q = floor(A / (B - C)) + 1 without saying on screen what A, B and C are.
- **Dependency audit** (from the Vulnerability Dataset Extraction Plan, run for real rather than taken from its prose): `npm audit fix` (no `--force`) on both packages. **functions: all 5 critical/high advisories cleared** (proxy-addr IP spoofing, body-parser DoS, node-forge, grpc-js, busboy); 11 moderate remain. **app: 13 production advisories remain, 5 high**, all in the Firebase client's Node-side dependencies (undici, grpc-js) plus react-router (open redirect). Their fixes need breaking moves (Firebase 10 to 13; react-router 6 to 7), which I did not make three days before polling. Checked instead: the shipped app and site bundles contain neither undici nor grpc-js, and no user-controlled value reaches a link, redirect or navigate call (the query parameters are validated against allow-lists), so none is reachable in the shipped product. **Schedule both upgrades after 4 November.** Full gate green after the fixes.
- **Real411** (owner: "useful for verification"): its complaint form was already listed; added its elections page (verified live: the Commission's Framework of Co-operation, the disinformation code, a guide for political parties) to the official sources and a "check it or report it" line on /watch.
- **Not adopted from the documents, and why:** the Master Development Roadmap and its WBS describe AWS af-south-1, Prisma and a Postgres RLS rebuild (contradicts the recorded Firestore decision), a 48-hour hard purge (the audit rates that critical; the build quarantines instead) and WhatsApp API dispatch (needs a credential and a poll-contact opt-in); the "90% gross margin" figure is unsourced. The Computational Source Item Control Sheet is a Python skeleton whose download functions are `pass` stubs and whose API endpoint is a commented-out guess, pointing at a Windows desktop path; it cannot run here, and the repo already has `tools/source-acquisition`. The JB Marks Electoral Forecast Analysis is a forecast; the build keeps scenario tools that forecast nothing, and its figures were not imported. The Vulnerability plan's CVE and SNYK identifiers were not individually verified; the audit above uses the registry's own advisory data instead.

### Session 53 (cont.) — "complete the build": Firebase web config, and what stands between this build and live

- **Config received** (second web app registration for project electioncos1-0, appId `...:web:77cb23f7...`; the earlier paste was `...:web:d726f045...`; the later one is used). Held in `.env.production.local` (gitignored), not committed: a web config is public by design but the repo convention is never to commit keys. **Restrict the API key by HTTP referrer** (app.electioncos.co.za, electioncos1-0.web.app, localhost) in Google Cloud Console; I cannot see or set that.
- **Firebase Analytics deliberately not wired**, though the pasted snippet calls `getAnalytics`. It sets an identifier and reports to Google from the first load, which breaks the rule that no analytics or advertising identifier is set before consent (and the white paper's cookieless-analytics decision). `measurementId` is left out. The production bundle contains no analytics code or tag manager (checked).
- **Verified:** a production build with this config bakes in the new appId and has no emulator block; the sign-in page renders in a real browser at 390 and 1280 px, shows the Google button only (`VITE_AUTH_PROVIDERS=google`), no overflow, no console errors. `npm run check:all` green.
- **`npm run preflight` still says "Not ready to deploy" and the real blocker is one thing: no deploy credential.** (The other two failures are this machine's `.env` pointing at the emulator, which the GitHub workflow does not use, and a stale `dist/` rebuilt above.) Deployment needs the owner to: (1) add repository secret `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON, whole; never paste it into a chat), (2) add the six `VITE_FIREBASE_*` values as Actions variables, (3) run the workflow "Deploy Election Campaign OS", (4) upgrade the project to the Blaze plan for the functions, (5) enable the Google sign-in provider and add the app domains under Authentication, Authorised domains, (6) set `TURNSTILE_SECRET`, `VITE_ENQUIRY_URL`, `VITE_POLL_URL`, `VITE_TURNSTILE_SITE_KEY` for the enquiry and poll forms.

### Session 53 (cont.) — reference data in the app: candidates, voting-district locator, voter statistics (ingest record)

Owner instruction (2 Nov 2026): the candidate list, voting-district locator and voter demographic statistics are public information and are to be in the application; the owner will verify the data and its legality. Built per the `iec-data-ingestion` and `dataviz` rules.

- **What arrived and the decision, one line each.**
  - Candidate workbook (610 rows NW405) and the Commission's 23 Oct candidate dataset (611 NW405 entries: 447 ward, 164 PR, 20 parties, 34 wards, 102 dual-nominated): **accepted**; the Commission dataset is the source because it carries real ward numbers. Output `src/data/reference/nw405-candidates.json` with sha256, confirmedBy "the site owner (Innovation Consult)", confirmedOn 2026-11-01. No ID fields.
  - Workbook ward column: **not used as a ward identifier.** It is a per-party ordinal (every party runs 1..N), the "ordinals sold as identifiers" failure.
  - `lge2026_candidate_database.csv` (51 rows, 6 parties): **rejected as a source**; a partial subset of the Commission dataset. Not cross-checked row by row.
  - Workbook count 610 vs dataset 611: **not reconciled**; one entry difference, flagged for the owner.
  - Voters roll CSVs (NW405): **accepted as aggregate input only.** 131,963 verified, 52,176 rejected, 106 ward by voting-district rows. Age is derived from the date-of-birth prefix of the masked ID, bands 18–29 … 70+ at polling day 4 Nov 2026. **No ID number, no name, no row-level data is stored or committed**; the roll was extracted outside the repo. Cells under 10 are hidden, and when exactly one cell in a row is hidden the next smallest is hidden too so it cannot be recovered by subtraction.
  - Roll vs seed: all 106 voting-district totals equal the Commission's per-VD totals (0 differ). But the roll's verified total (131,963) disagrees with the seed's registered total (122,059), e.g. VD 86821094 ward 1: seed 1,352 vs roll 2,540. **Surfaced on the voter-statistics page as "two numbers for registered voters"; not reconciled, because the cause (seed from an earlier date, or a different definition of verified) is not known.** 104 of 106 rows matched the seed.
  - "Data analyzer app zip", the extra SOP files, and any separate VD-locator or demographic CSVs: **not present in the session uploads.** Nothing was built from them. The newest uploaded file predates this work. Re-send them if they exist.
- **Built.** `scripts/build-reference-data.mjs`, `scripts/extract-reference-candidates.mjs`, `scripts/lib/ageBands.mjs`; `src/modules/reference/` (`vdReference.ts`, `candidateReference.ts`, `BarChart.tsx`, three pages); routes `/analytics/candidate-list`, `/analytics/vd-locator`, `/analytics/voter-statistics`; War Room "Reference data" card; SOP-13 to SOP-16 (candidate list, voting districts and voter statistics, voter sentiment polls, scenario runner).
- **Charts** follow the dataviz skill: one hue, bars up to 24px with rounded data end, value at the tip, tooltip on hover and focus, "View as table", hidden cells shown as hidden and never drawn as zero.
- **Proved by injection:** removing complementary suppression, removing the century rule for birth years, and adding an `idNumber` field to the JSON each made a test fail; reverted.
- **Gate:** `npm run check:all` green, 1,473 app + 171 functions tests.
- **Not done:** browser check of the three pages at 390 and 1280 px (app is behind sign-in; component render tests only); other municipalities' candidates remain on the public site, the app bundles NW405 only; the war-room-analyst design import is blocked until `/design-login` or the files are provided.

### Session 53 (cont.) — owner decision: registered voters are 122,059; the 131,963 figure is dropped

- **Instruction (2 Nov 2026):** "Apply the 122059 registered voters and drop the 131963 figure." Recorded as the owner's decision. The roll-vs-seed disagreement logged above is superseded: the application now shows one voter count, the gazetted baseline (IEC Circular 1 of 2025, Annexure A), split by ward and voting district in the seed. Seed totals proven: 135 voting-district rows and 34 wards each sum to 122,059.
- **What changed.** Voter statistics and the VD locator show registered voters only. The "Two numbers", "Verified voters", "Rejected entries" and "Seed minus roll" displays are gone. The locator now lists all 135 seed rows (was 106 roll rows).
- **Age is now a percentage, not a count.** The roll cannot be shown as head counts without re-introducing a total that disagrees with 122,059. The generator reduces the roll to the share of each row's age-placed entries per band, with the same suppression (under 10 hidden, second cell hidden when exactly one would be). 104 of 135 rows have an age mix; 31 show "not available" rather than an estimate. No roll count (verified, rejected, banded, unplaced) is written to the shipped JSON. SOP-14 rewritten to say so, and not to apply a percentage to another total.
- **Proved by injection:** adding a `verified: 131963` field to the JSON fails "carries no roll count"; reverted. Gate green: 1,472 app + 171 functions tests.
- **Left as it was:** older log and asset-sheet entries still mention 131,963 as history of the roll; they are a record, not displayed.
- **Data analyzer (`ai-data-analyst.zip`):** received and read; **not integrated.** It is an AI Studio app that sends uploaded CSVs to a Gemini managed agent (needs a Gemini key and Cloud Storage), so putting roll or campaign data through it would send it to a third-party model. Its profile, analyse, chart, report method was followed in deterministic scripts instead.
- **war-room-analyst design import:** the files named (`Canvas.dc.html`, `github.md`, `readme.md`, `SKILL.md`, `styles.css`, `support.js`) are not in the uploads or the workspace, and DesignSync still refuses without `/design-login`. Not imported.
