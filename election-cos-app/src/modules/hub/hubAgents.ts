/**
 * Election Campaign OS — the 32 named responsibilities ("agents") of the master code stack, mapped to this build.
 *
 * Names, tiers and descriptions of 01 to 18 are the master stack's own. `build` and `status` say what exists in THIS build:
 * the application runs on Firebase, not on AWS ECS and PostgreSQL, so several tiers in the master stack's description are
 * not how the work is done here (docs/architecture-agent-map.md, 1 Nov 2026, updated 8 Nov 2026). Generated from that
 * document and then hand-corrected for 11, 26 and 27 to 32; `hub.test.ts` fails if a row loses its status.
 */
export interface HubAgent {
  id: string;
  name: string;
  /** The master stack's tier for 01 to 18; "Beyond the 18 listed" after that. */
  tier: string;
  desc: string;
  /** What implements it in this build. */
  build: string;
  /** The build's own words for its state. */
  status: string;
}

export const HUB_AGENTS: HubAgent[] = [
  {
    id: "01",
    name: "OFFLINE_SYNC_SENTINEL",
    tier: "Client PWA",
    desc: "Controls IndexedDB outbox execution lock and state transitions.",
    build:
      "`src/offline/` (Dexie outbox, sync status), `outboxStatus.ts` (state machine, 6 tests)",
    status:
      "built; retry counting wired into the outbox (5th failure becomes a visible rejection with a reason); other states still derived, not stored",
  },
  {
    id: "02",
    name: "MEDIA_COMPRESSION_AGENT",
    tier: "Client PWA",
    desc: "Compresses voter registration/field imagery via WebAssembly Canvas.",
    build:
      "`src/offline/photoCompress.ts`: long edge 1600 px, JPEG quality stepped down to a 400 KB target, EXIF/GPS dropped by re-encode. Real Chromium: 12.2 MB noise photo to 406 KB, GPS gone. **No capture screen calls it yet** (the app has no photo UI)",
    status: "built (module); not wired to a screen",
  },
  {
    id: "03",
    name: "FIELD_CONTEXT_GUARD",
    tier: "Client PWA",
    desc: "Inspects JWT capability claims before offline record creation.",
    build: "capability gates in the UI (`resolveAccess`), rules on the server",
    status: "built",
  },
  {
    id: "04",
    name: "OFFLINE_CONSENT_VALIDATOR",
    tier: "Client PWA",
    desc: "Validates POPIA data subject explicit consent during canvassing.",
    build:
      "the consent gate in `VoterForm`; roll capture needs spoken consent + typed name (`rollCapture.ts`)",
    status: "built",
  },
  {
    id: "05",
    name: "TENANT_CONTEXT_AGENT",
    tier: "Edge Worker",
    desc: "Inspects Cloudflare headers and injects tenant session context.",
    build:
      "tenant from the **verified token claim**; the path is checked by the rules. **Not** from a request header (the supplied worker trusted `X-Tenant-ID`)",
    status: "built (rules, claims Worker)",
  },
  {
    id: "06",
    name: "SYNC_THROTTLE_AGENT",
    tier: "Edge Worker",
    desc: "Rate-limits client sync bursts (60 req/min) during field events.",
    build:
      "`worker/src/edge.ts`: verified token, per-user token bucket, 5 MB cap, header scrub (6 tests)",
    status: "built; best-effort per isolate, real limit is a Cloudflare rule",
  },
  {
    id: "07",
    name: "POPIA_MASKING_AGENT",
    tier: "AWS ECS Backend",
    desc: "Redacts sensitive PII (+27 82 *** 4129) based on role clearance.",
    build:
      "phone/ID masking, `householdSafety.ts`, IEC mask never copied; `src/exportSweep.test.ts` scans every text export (audit CSV, usage statement, ground intelligence, sign-off) fed hostile input, and fails if a new download is added without being classified. The four PDF exports are not text-scanned (compressed; personal data by design, own document tests)",
    status: "built",
  },
  {
    id: "08",
    name: "SOFT_DELETE_AGENT",
    tier: "AWS ECS Backend",
    desc: "Applies soft-delete flags and appends immutable deletion audit logs.",
    build: "soft-delete in every repository; hard delete denied by rules",
    status: "built",
  },
  {
    id: "09",
    name: "LWW_RECONCILIATION_AGENT",
    tier: "AWS ECS Backend",
    desc: "Resolves doorstep updates using Last-Write-Wins and vector clocks.",
    build: "`functions/src/syncMerge.ts`",
    status: "built; needs Blaze to run",
  },
  {
    id: "10",
    name: "DOCUMENT_VAULT_AGENT",
    tier: "AWS ECS Backend",
    desc: "Encrypts political documents into S3 using KMS envelope encryption.",
    build:
      "Cloud Storage + `storage.rules`; `functions/src/documentVault.ts` envelope encryption (AES-256-GCM, per-document key, wrapped under a supplied KEK, context bound); refuses with no key",
    status: "built (primitive); not wired to uploads; KEK decision open",
  },
  {
    id: "11",
    name: "SIMULATION_ORCHESTRATOR",
    tier: "AWS ECS Backend",
    desc: "Dispatches Monte Carlo simulation jobs to worker threads.",
    build:
      "`scenarioRunner.ts` + `/analytics/scenario-runner`: seeded Monte Carlo over the user's stated swing and turnout distributions, through the one Schedule 1 calculation, from the certified 2026 result of any of the 18 North West local municipalities (or JB Marks 2021). Runs in the browser, not on worker threads",
    status: "built (browser, seeded, reproducible)",
  },
  {
    id: "12",
    name: "RLS_SESSION_GUARDIAN",
    tier: "PostgreSQL RLS",
    desc: "Enforces multi-tenant isolation via Row-Level Security policies.",
    build:
      "`firestore.rules` (tenant, capability, ward + station scope); 15 emulator cases for the roll",
    status: "built",
  },
  {
    id: "13",
    name: "POPIA_CONSENT_TRIGGER",
    tier: "PostgreSQL RLS",
    desc: "Triggers 48-hour unconsented data purges inside PL/pgSQL.",
    build:
      "voters cannot be written without `popiaConsentGiven`. **No 48-hour hard purge**: the audit rates it critical; quarantine then human release is the design",
    status:
      "gate built; quarantine and named-person release built as pure functions (`functions/src/consentQuarantine.ts`), not exported or scheduled; no purge by design",
  },
  {
    id: "14",
    name: "INDEX_HEALTH_AGENT",
    tier: "PostgreSQL RLS",
    desc: "Automated index maintenance and pg_cron vacuum scheduling.",
    build: "not applicable to Firestore (indexes are declared)",
    status: "n/a",
  },
  {
    id: "15",
    name: "RLS_AUDIT_AGENT",
    tier: "PostgreSQL RLS",
    desc: "Logs unauthorized cross-tenant query attempts directly.",
    build:
      "`src/rulesAudit.test.ts`: static audit of `firestore.rules` (tenant tie on every allow, no `if true`, deny catch-all, server-only collections closed, delete denied except 3 named config collections). Emulator matrix remains `tools/voters-roll/appRules.emulator.ts`",
    status:
      "built (static); emulator matrix for every collection not built (`@firebase/rules-unit-testing` will not install against this tree's peers)",
  },
  {
    id: "16",
    name: "QUOTA_FORMULA_GUARDIAN",
    tier: "PostgreSQL RLS",
    desc: "Implements Schedule 1 seat formulas in PL/pgSQL functions.",
    build:
      "`seatCalculator.ts` (authoritative, reproduces the IEC result) and `db/schedule1_quota.sql` (cross-check, tested on Postgres 16)",
    status: "built",
  },
  {
    id: "17",
    name: "PGA_EVENT_AUDITOR",
    tier: "Queue / Cron",
    desc: "Manages Public Gatherings Act T-7 notification schedules.",
    build: "`functions/src/rgaNoticeScheduled.ts`, `rgaNotice.ts`",
    status: "built; needs Blaze",
  },
  {
    id: "18",
    name: "PPFA_AGGREGATOR",
    tier: "Queue / Cron",
    desc: "Aggregates donations against PPFA statutory disclosure thresholds.",
    build:
      "`functions/src/ppfaAggregation.ts`, deliberately **not exported** pending legal confirmation. Bands are R200,000 / R30 million (Gazette 53182), not R80k/R15M",
    status: "held back on purpose",
  },
  {
    id: "19",
    name: "POPIA_PURGE_DAEMON",
    tier: "Beyond the 18 listed",
    desc: "Popia Purge Daemon",
    build:
      "replaced by quarantine (see 13); deletion goes through the data-subject route",
    status: "by design",
  },
  {
    id: "20",
    name: "INCIDENT_DISPATCH",
    tier: "Beyond the 18 listed",
    desc: "Incident Dispatch",
    build:
      "`functions/src/incidentDispatch.ts`: channel interface, off by default, minimal message, cost-guarded, once per incident and responder. No real channel until a WhatsApp credential exists",
    status: "built (disabled)",
  },
  {
    id: "21",
    name: "AUDIT_LOG_WRITER",
    tier: "Beyond the 18 listed",
    desc: "Audit Log Writer",
    build:
      "server-written `auditLog`; CSV export. Hash chain (`functions/src/auditChain.ts`, verified in the export) on the OTP-challenge writer only; other writers unchained, no external anchor",
    status: "partial",
  },
  {
    id: "22",
    name: "DATASET_INGESTION",
    tier: "Beyond the 18 listed",
    desc: "Dataset Ingestion",
    build:
      "`tools/source-acquisition`, `src/modules/ingest/`, `tools/voters-roll`",
    status: "built",
  },
  {
    id: "23",
    name: "CAMPAIGN_DIRECTOR",
    tier: "Beyond the 18 listed",
    desc: "Campaign Director",
    build: "No implementation: nothing in this build orchestrates a campaign on its own",
    status: "not built",
  },
  {
    id: "24",
    name: "COMPLIANCE_WAR_ROOM",
    tier: "Beyond the 18 listed",
    desc: "Compliance War Room",
    build:
      "war-room counters (`warRoomCounters.ts`) read from the counters document with an honest empty state; the triggers need the Firebase paid plan to run",
    status: "built; needs Blaze",
  },
  {
    id: "25",
    name: "SCENARIO_POLICY",
    tier: "Beyond the 18 listed",
    desc: "Scenario Policy",
    build:
      "`scenarioPolicy.ts`: every input labelled sourced (with a citation) or assumption; a swing can never be sourced; shown on the Ward Comparison screen",
    status: "built",
  },
  {
    id: "26",
    name: "BASELINE_LOADER",
    tier: "Beyond the 18 listed",
    desc: "Baseline Loader",
    build:
      "`baselines.ts`: the certified 2026 result of all 18 North West local municipalities (`modules/lge2026`, reconciled with the Commission's own seat calculations, 18 of 18) and JB Marks 2021 on its superseded delimitation (`wardResults2021.ts`)",
    status: "built for the North West (2026); 2021 for NW405 only",
  },
  {
    id: "27",
    name: "TURNOUT_ELASTICITY",
    tier: "Beyond the 18 listed",
    desc: "Turnout elasticity.",
    build:
      "Turnout mean and spread are inputs the person sets in the scenario runner; the observed 2021 to 2026 change for JB Marks (valid PR votes 50,733 to 69,048; registered 113,218 to 131,963) is shown beside them. No elasticity is estimated: one election pair cannot do it",
    status: "partial (inputs and an observation, no model)",
  },
  {
    id: "28",
    name: "PARTY_SUPPORT",
    tier: "Beyond the 18 listed",
    desc: "Party support.",
    build:
      "Per-party swing and spread are set by the person; the observed 2021 to 2026 swing by party is shown (`swing2021to2026.ts`). Descriptive, not a support model",
    status: "partial (inputs and an observation, no model)",
  },
  {
    id: "29",
    name: "WARD_SWING",
    tier: "Beyond the 18 listed",
    desc: "Ward swing.",
    build:
      "`wardScenario.ts`: a deterministic uniform-swing tool on the certified ward results, with the observed ward-level 2021 to 2026 mean and spread for ANC, DA, EFF and VF+ beside it",
    status: "built (deterministic, user-set)",
  },
  {
    id: "30",
    name: "MK_ENTRY",
    tier: "Beyond the 18 listed",
    desc: "Entry of a new party (uMkhonto weSizwe).",
    build:
      "MK now has a certified 2026 result (1.2% of the JB Marks party votes), so it can be given a swing like any other party. No entrant model: there is no data for how a new party's vote forms",
    status: "partial (a 2026 baseline, no entrant model)",
  },
  {
    id: "31",
    name: "COALITION_POST",
    tier: "Beyond the 18 listed",
    desc: "Post-election coalition arithmetic.",
    build:
      "`/tools/how-coalitions-work`: seat counts against more-than-half, from the certified 2026 council of any North West local municipality. Arithmetic only; says nothing about which coalition is likely or lawful",
    status: "built (arithmetic)",
  },
  {
    id: "32",
    name: "MONTE_CARLO",
    tier: "Beyond the 18 listed",
    desc: "Monte Carlo.",
    build: "See 11",
    status: "built (see 11)",
  },
];
