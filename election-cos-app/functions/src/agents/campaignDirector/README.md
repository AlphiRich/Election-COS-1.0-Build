# Campaign Director agent

A LangGraph agent for a campaign operator: it reads the certified baseline and
the war-room counters, drafts a briefing, and can propose an incident dispatch
that a human must approve. Built from the supplied handoff, wired to this repo's
real harness modules, and held to the build discipline (never fabricate; fail
closed; one `@deployable` marker per Cloud Function; region pinned).

## Status — Path B: runs on the Cloudflare worker (Stage 1 built, not yet deployed)

The owner chose **Path B**: the agent runs on the existing Cloudflare claims
worker (`ecos-claims-api`), not on Cloud Functions, so Firebase stays on Spark.

- **Entry:** `POST /api/agent/campaign-director` → `worker/src/agentRoute.ts` →
  `runAgent.ts` (this folder). `runAgent` is the ONE assembly path; the held
  Cloud Functions `callable.ts` (`@deployable no`, not exported) calls it too.
- **One LangGraph copy:** every LangGraph/Anthropic import lives under
  `functions/src`, and the worker imports only `runAgent` + `state`, so the bundle
  resolves a single copy from `functions/node_modules` (checked in the bundle's
  sourcemap). No firebase-admin, firebase-functions or MCP SDK in the bundle.
- **Gates (the worker reads Firestore as a service account, bypassing
  firestore.rules, so it re-applies them):** tenant from the verified token only;
  the rules' `mfaOK()`; the `warroom.view` capability. Body validated.
- **Lazy-loaded** so the agent never weighs on the sign-in routes' startup.
- **War-room tool** reads real counters on the edge via the worker's Firestore REST.
- **Verified:** full agent (graph → ToolNode → mirrored seat engine → 2026 data)
  executed under workerd; the real worker boots under `nodejs_compat`
  (health 200, agent route 401 without a token). Bundle ~836 KB gzipped.

**To go live (owner):** set the price of one model call,
`CAMPAIGN_DIRECTOR_CALL_COST_CENTS` (whole rand cents — a Worker variable, not a
secret), then `npx wrangler secret put ANTHROPIC_API_KEY`, then
`npx wrangler deploy`. Without the key or the price the route answers 503
(refuses, never fabricates, never runs unmetered).

**Review fixes (after stage 2):**
- **Threads belong to a user**, not just a tenant (`tenant:uid:threadId`), and
  deciding a held dispatch needs `incidents.escalate` (403 otherwise).
- **One run per thread:** a lease beside the checkpoints
  (`…/agentCheckpoints/{thread}/lease/current`, 120 s expiry) — a second request
  meanwhile is 409, so history cannot fork and an approval cannot dispatch twice.
- **A briefing exists only as a `submit_briefing` call** carrying its claims.
  The provenance gate runs on those claims, every percentage in the briefing must
  be declared as one, and free text (or array content) is never shipped.
- **Iteration cap** answers every pending tool call "not run" and returns an
  error, so a durable thread never carries an unanswered call.
- **Every model call is metered** against the R500 monthly ceiling, on the same
  `platform/spend_YYYY-MM` ledger as the paid OTP messages (optimistic
  concurrency over Firestore REST on the edge), plus a per-user rate limit
  (6 burst, then one per 30 s). Ceiling reached → 429.
- **Counters are labelled tenant-wide**; requested wards are no longer echoed as
  if the figures were for them.

**Stage 2 (built):** a durable checkpointer over Firestore REST, so a
conversation carries across requests on the same `threadId`, and a run paused
for human approval is resumed on a later request (`resumeDecision`). Each new
prompt resets the per-turn state (errors, claims, iteration budget). A new prompt
while an approval is pending → 409; a resume with nothing waiting → 409; a thread
too large to store → 413 (start a new `threadId`).

**Edge runtime fix (`asyncContext.ts`):** Cloudflare's bundler resolves
LangGraph's `browser` build, which never initialises LangChain's AsyncLocalStorage
— so on the worker `interrupt()` threw and the approval gate silently did not
pause. `graph.ts` now initialises it first. Verified under workerd both ways.

## What is real and tested now

- `scenarioPolicy.ts` — the provenance gate: a swing / turnout delta can never be
  `sourced`; a `sourced` claim must cite. The graph calls this instead of
  trusting the model.
- `state.ts` — state types, fail-closed `harnessContextFrom`, the 8-iteration
  cap, the HITL predicate.
- `firestoreCheckpointer.ts` — ONE tenant-scoped `BaseCheckpointSaver`
  (`DocStoreCheckpointSaver`) over a three-method store (`get`/`setMany`/`list`):
  firebase-admin (Functions), Firestore REST (worker, `restCheckpointStore`),
  memory (tests). A `heads` pointer per thread keeps loads to a few reads;
  pending writes replay in LangGraph's `writesSortKey` order.
- `graph.ts` — the governed nodes + routing with a full **ToolNode loop**
  (agent → tools → agent, capped at 8 iterations), tested with a scripted
  tool-calling model and an in-memory saver, including the human-in-the-loop
  interrupt/resume.
- `ecosMcpTools.ts` — the tool logic (one source), now serving real NW405 seat
  figures through the mirrored `engine/` (`allocateSeats` + the NW405 2021
  result); war-room counters read tenant-scoped from the run config; unheld data
  fails closed. `ecosLangchainTools.ts` wraps it as LangChain tools for the loop;
  `mcpServer.ts` is the MCP-transport wrapper of the same logic.
- `engine/` — GENERATED mirror of the app's Schedule 1 quota engine + register +
  annexure data + NW405 2021 result. `src/modules/analytics/agentEngineMirror.ts`
  defines the copy; `npm run gen:agent-engine` writes it; `agentEngineMirror.test.ts`
  guards it against drift.

## Firestore wiring (already in this repo)

- `firestore.rules` — `tenants/{tid}/agentCheckpoints/**` is server-only
  (`allow read, write: if false`): only the Admin SDK touches checkpoints.
- No composite index is needed: the saver reads documents by path and lists
  collections; it runs no `where`/`orderBy` queries.
