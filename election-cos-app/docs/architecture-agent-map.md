# The 32 "agents" and the 3 code listings, mapped to this build (1 Nov 2026)

Source: the supplied *Tech Architecture Master Code Stack*. Its topology (GCP landing page, Cloudflare Workers,
AWS ECS Fargate, RDS PostgreSQL, a Python simulator cluster) is **not what this build runs on**. Firestore on
Firebase is the database (decided 13 Sep 2026), and nothing can be deployed to AWS from here (no credentials, no
account). The rows below say what each named responsibility is in the system that exists. "Agent" here means a
bounded responsibility, not a service.

| # | Name in the document | In this build | Status |
|---|---|---|---|
| 1 | OFFLINE_SYNC_SENTINEL | `src/offline/` (Dexie outbox, sync status), `outboxStatus.ts` (state machine, 6 tests) | built; retry counting wired into the outbox (5th failure becomes a visible rejection with a reason); other states still derived, not stored |
| 2 | MEDIA_COMPRESSION | photo queue exists; no client-side compression | not built |
| 3 | FIELD_CONTEXT_GUARD | capability gates in the UI (`resolveAccess`), rules on the server | built |
| 4 | OFFLINE_CONSENT_VALIDATOR | the consent gate in `VoterForm`; roll capture needs spoken consent + typed name (`rollCapture.ts`) | built |
| 5 | TENANT_CONTEXT | tenant from the **verified token claim**; the path is checked by the rules. **Not** from a request header (the supplied worker trusted `X-Tenant-ID`) | built (rules, claims Worker) |
| 6 | SYNC_THROTTLE | `worker/src/edge.ts`: verified token, per-user token bucket, 5 MB cap, header scrub (6 tests) | built; best-effort per isolate, real limit is a Cloudflare rule |
| 7 | POPIA_MASKING | phone/ID masking, `householdSafety.ts`, IEC mask never copied | built (partial) |
| 8 | SOFT_DELETE | soft-delete in every repository; hard delete denied by rules | built |
| 9 | LWW_RECONCILIATION | `functions/src/syncMerge.ts` | built; needs Blaze to run |
| 10 | DOCUMENT_VAULT | Cloud Storage + `storage.rules`; no KMS envelope | partial |
| 11 | SIMULATION_ORCHESTRATOR | none | not built |
| 12 | RLS_SESSION_GUARDIAN | `firestore.rules` (tenant, capability, ward + station scope); 15 emulator cases for the roll | built |
| 13 | POPIA_CONSENT_TRIGGER | voters cannot be written without `popiaConsentGiven`. **No 48-hour hard purge**: the audit rates it critical; quarantine then human release is the design | gate built; quarantine and named-person release built as pure functions (`functions/src/consentQuarantine.ts`), not exported or scheduled; no purge by design |
| 14 | INDEX_HEALTH | not applicable to Firestore (indexes are declared) | n/a |
| 15 | RLS_AUDIT | `src/rulesAudit.test.ts`: static audit of `firestore.rules` (tenant tie on every allow, no `if true`, deny catch-all, server-only collections closed, delete denied except 3 named config collections). Emulator matrix remains `tools/voters-roll/appRules.emulator.ts` | built (static); emulator matrix for every collection not built (`@firebase/rules-unit-testing` will not install against this tree's peers) |
| 16 | QUOTA_FORMULA_GUARDIAN | `seatCalculator.ts` (authoritative, reproduces the IEC result) and `db/schedule1_quota.sql` (cross-check, tested on Postgres 16) | built |
| 17 | PGA_EVENT_AUDITOR | `functions/src/rgaNoticeScheduled.ts`, `rgaNotice.ts` | built; needs Blaze |
| 18 | PPFA_AGGREGATOR | `functions/src/ppfaAggregation.ts`, deliberately **not exported** pending legal confirmation. Bands are R200,000 / R30 million (Gazette 53182), not R80k/R15M | held back on purpose |
| 19 | POPIA_PURGE_DAEMON | replaced by quarantine (see 13); deletion goes through the data-subject route | by design |
| 20 | INCIDENT_DISPATCH | needs a WhatsApp credential this project does not have | not built |
| 21 | AUDIT_LOG_WRITER | server-written `auditLog`; CSV export. Hash chain (`functions/src/auditChain.ts`, verified in the export) on the OTP-challenge writer only; other writers unchained, no external anchor | partial |
| 22 | DATASET_INGESTION | `tools/source-acquisition`, `src/modules/ingest/`, `tools/voters-roll` | built |
| 23 | CAMPAIGN_DIRECTOR | none | not built |
| 24 | COMPLIANCE_WAR_ROOM | war-room counters (`warRoomCounters.ts`) | partial |
| 25 | SCENARIO_POLICY | the ward scenario tool states its inputs as assumptions; no source-of-truth register gate | partial |
| 26 | BASELINE_LOADER | 2021 NW405 ward results pinned to the superseded delimitation (`wardResults2021.ts`) | built for NW405 |
| 27–32 | TURNOUT_ELASTICITY, PARTY_SUPPORT, WARD_SWING, MK_ENTRY, COALITION_POST, MONTE_CARLO | `wardScenario.ts` is a deterministic swing tool the user sets. No Monte Carlo, no entrant model, no hung-council frequency: **no data or method behind them** (the 68.5 % figure is unsourced) | not built |

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
