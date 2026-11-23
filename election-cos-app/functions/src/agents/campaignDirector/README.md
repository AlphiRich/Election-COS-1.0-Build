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

**To go live (owner):** `npx wrangler secret put ANTHROPIC_API_KEY`, then
`npx wrangler deploy`. Without the key the route answers 503 (refuses, never
fabricates).

**Stage 2 (not built):** a Firestore-REST checkpointer so a paused human
approval can be resumed on a later request. Until then a resume is refused (501)
rather than silently starting a fresh thread; single-request briefings work.

## What is real and tested now

- `scenarioPolicy.ts` — the provenance gate: a swing / turnout delta can never be
  `sourced`; a `sourced` claim must cite. The graph calls this instead of
  trusting the model.
- `state.ts` — state types, fail-closed `harnessContextFrom`, the 8-iteration
  cap, the HITL predicate.
- `firestoreCheckpointer.ts` — tenant-scoped `BaseCheckpointSaver`
  (`<tenantId>:<threadId>` or it throws). `parseScopedThread` is tested on its
  own.
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
- `firestore.indexes.json` — composite index on the `checkpoints` collection
  (`checkpointNs` ASC, `deletedAt` ASC, `createdAt` DESC) for the saver's
  `getTuple`/`list` queries.
