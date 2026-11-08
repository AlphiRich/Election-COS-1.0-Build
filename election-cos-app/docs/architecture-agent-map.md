# The 32 "agents" and the 3 code listings, mapped to this build (1 Nov 2026)

Source: the supplied *Tech Architecture Master Code Stack*. Its topology (GCP landing page, Cloudflare Workers,
AWS ECS Fargate, RDS PostgreSQL, a Python simulator cluster) is **not what this build runs on**. Firestore on
Firebase is the database (decided 13 Sep 2026), and nothing can be deployed to AWS from here (no credentials, no
account). The rows below say what each named responsibility is in the system that exists. "Agent" here means a
bounded responsibility, not a service.

| # | Name in the document | In this build | Status |
|---|---|---|---|
| 1 | OFFLINE_SYNC_SENTINEL | `src/offline/` (Dexie outbox, sync status), `outboxStatus.ts` (state machine, 6 tests) | built; retry counting wired into the outbox (5th failure becomes a visible rejection with a reason); other states still derived, not stored |
| 2 | MEDIA_COMPRESSION | `src/offline/photoCompress.ts`: long edge 1600 px, JPEG quality stepped down to a 400 KB target, EXIF/GPS dropped by re-encode. Real Chromium: 12.2 MB noise photo to 406 KB, GPS gone. **No capture screen calls it yet** (the app has no photo UI) | built (module); not wired to a screen |
| 3 | FIELD_CONTEXT_GUARD | capability gates in the UI (`resolveAccess`), rules on the server | built |
| 4 | OFFLINE_CONSENT_VALIDATOR | the consent gate in `VoterForm`; roll capture needs spoken consent + typed name (`rollCapture.ts`) | built |
| 5 | TENANT_CONTEXT | tenant from the **verified token claim**; the path is checked by the rules. **Not** from a request header (the supplied worker trusted `X-Tenant-ID`) | built (rules, claims Worker) |
| 6 | SYNC_THROTTLE | `worker/src/edge.ts`: verified token, per-user token bucket, 5 MB cap, header scrub (6 tests) | built; best-effort per isolate, real limit is a Cloudflare rule |
| 7 | POPIA_MASKING | phone/ID masking, `householdSafety.ts`, IEC mask never copied; `src/exportSweep.test.ts` scans every text export (audit CSV, usage statement, ground intelligence, sign-off) fed hostile input, and fails if a new download is added without being classified. The four PDF exports are not text-scanned (compressed; personal data by design, own document tests) | built |
| 8 | SOFT_DELETE | soft-delete in every repository; hard delete denied by rules | built |
| 9 | LWW_RECONCILIATION | `functions/src/syncMerge.ts` | built; needs Blaze to run |
| 10 | DOCUMENT_VAULT | Cloud Storage + `storage.rules`; `functions/src/documentVault.ts` envelope encryption (AES-256-GCM, per-document key, wrapped under a supplied KEK, context bound); refuses with no key | built (primitive); not wired to uploads; KEK decision open |
| 11 | SIMULATION_ORCHESTRATOR | `scenarioRunner.ts` + `/analytics/scenario-runner`: seeded Monte Carlo over the user's stated swing and turnout distributions, through the one Schedule 1 calculation, from the certified 2026 result of any of the 18 North West local municipalities (or JB Marks 2021). Runs in the browser, not on worker threads | built (browser, seeded, reproducible) |
| 12 | RLS_SESSION_GUARDIAN | `firestore.rules` (tenant, capability, ward + station scope); 15 emulator cases for the roll | built |
| 13 | POPIA_CONSENT_TRIGGER | voters cannot be written without `popiaConsentGiven`. **No 48-hour hard purge**: the audit rates it critical; quarantine then human release is the design | gate built; quarantine and named-person release built as pure functions (`functions/src/consentQuarantine.ts`), not exported or scheduled; no purge by design |
| 14 | INDEX_HEALTH | not applicable to Firestore (indexes are declared) | n/a |
| 15 | RLS_AUDIT | `src/rulesAudit.test.ts`: static audit of `firestore.rules` (tenant tie on every allow, no `if true`, deny catch-all, server-only collections closed, delete denied except 3 named config collections). Emulator matrix remains `tools/voters-roll/appRules.emulator.ts` | built (static); emulator matrix for every collection not built (`@firebase/rules-unit-testing` will not install against this tree's peers) |
| 16 | QUOTA_FORMULA_GUARDIAN | `seatCalculator.ts` (authoritative, reproduces the IEC result) and `db/schedule1_quota.sql` (cross-check, tested on Postgres 16) | built |
| 17 | PGA_EVENT_AUDITOR | `functions/src/rgaNoticeScheduled.ts`, `rgaNotice.ts` | built; needs Blaze |
| 18 | PPFA_AGGREGATOR | `functions/src/ppfaAggregation.ts`, deliberately **not exported** pending legal confirmation. Bands are R200,000 / R30 million (Gazette 53182), not R80k/R15M | held back on purpose |
| 19 | POPIA_PURGE_DAEMON | replaced by quarantine (see 13); deletion goes through the data-subject route | by design |
| 20 | INCIDENT_DISPATCH | `functions/src/incidentDispatch.ts`: channel interface, off by default, minimal message, cost-guarded, once per incident and responder. No real channel until a WhatsApp credential exists | built (disabled) |
| 21 | AUDIT_LOG_WRITER | server-written `auditLog`; CSV export. Hash chain (`functions/src/auditChain.ts`, verified in the export) on the OTP-challenge writer only; other writers unchained, no external anchor | partial |
| 22 | DATASET_INGESTION | `tools/source-acquisition`, `src/modules/ingest/`, `tools/voters-roll` | built |
| 23 | CAMPAIGN_DIRECTOR | none | not built |
| 24 | COMPLIANCE_WAR_ROOM | war-room counters (`warRoomCounters.ts`) read from the counters document with an honest empty state; the triggers need the Firebase paid plan to run | built; needs Blaze |
| 25 | SCENARIO_POLICY | `scenarioPolicy.ts`: every input labelled sourced (with a citation) or assumption; a swing can never be sourced; shown on the Ward Comparison screen | built |
| 26 | BASELINE_LOADER | `baselines.ts`: the certified 2026 result of all 18 North West local municipalities (`modules/lge2026`, reconciled with the Commission's own seat calculations, 18 of 18) and JB Marks 2021 on its superseded delimitation (`wardResults2021.ts`) | built for the North West (2026); 2021 for NW405 only |
| 27 | TURNOUT_ELASTICITY | turnout mean and spread are inputs the person sets; the observed 2021 to 2026 change for JB Marks is shown beside them. No elasticity is estimated | partial |
| 28 | PARTY_SUPPORT | per-party swing and spread set by the person; the observed 2021 to 2026 swing by party is shown (`swing2021to2026.ts`) | partial |
| 29 | WARD_SWING | `wardScenario.ts` deterministic swing on certified ward results, with the observed ward-level 2021 to 2026 mean and spread | built |
| 30 | MK_ENTRY | MK has a certified 2026 result (1.2% in JB Marks) so can be given a swing; no entrant model | partial |
| 31 | COALITION_POST | `/tools/how-coalitions-work` on the certified 2026 councils; arithmetic only | built (arithmetic) |
| 32 | MONTE_CARLO | see 11 | built |

## The three listings
- **4.1 `fn_calculate_schedule1_quotas`** — the supplied version allocated 65 of 67 seats on the 2021 result (no floor, no
  "+1", no remainder allocation, ward seats ignored). Rebuilt in `db/schedule1_quota.sql`; `db/test_schedule1_quota.sh`
  runs it in a throwaway Postgres 16 and requires quota 1,515, 67 of 67 and every party equal to the IEC. Proved by
  injection (drop the "+1": quota 1,514; drop the remainder pass: 65 seats).
- **4.2 outbox states** — `src/offline/outboxStatus.ts`. A discard needs a named person and a time; a rejection needs a
  reason; retries stop at five and surface as a rejection.
- **4.3 edge worker** — rebuilt as `worker/src/edge.ts` (above). The tenant is never read from a header.

## What was not built, and why
AWS ECS/RDS, the GCP landing page host, and the Python simulators: no account or credentials here, and the AWS/Postgres
half contradicts the recorded Firestore decision. If that decision has changed, it is a new project with its own plan,
not an edit to this one. Say so and I will scope it.

MONTE_CARLO (32) is now `scenarioRunner.ts`, run over assumptions the user states. TURNOUT_ELASTICITY, PARTY_SUPPORT, WARD_SWING (as an estimated model), MK_ENTRY and COALITION_POST remain unbuilt: each needs a cited method and a sourced dataset that the build does not hold. The Gemini 'simulator API' note (unsourced shares, a 132,140-voter pool) and the NotebookLM engine-updates note (Item 17/18 claims contradicted by the Gazette text) were read and not adopted.
