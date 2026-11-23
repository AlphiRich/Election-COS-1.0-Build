# Campaign Director agent

A LangGraph agent for a campaign operator: it reads the certified baseline and
the war-room counters, drafts a briefing, and can propose an incident dispatch
that a human must approve. Built from the supplied handoff, wired to this repo's
real harness modules, and held to the build discipline (never fabricate; fail
closed; one `@deployable` marker per Cloud Function; region pinned).

## Status — NOT deployed

`callable.ts` is `@deployable no` and is deliberately **not** exported from
`functions/src/index.ts`. Three things must land first:

1. **A model credential.** The provider is wired — `agentModel.resolveAgentModel()`
   builds a `ChatAnthropic` behind a key-presence check — but it returns `null`
   (so the agent/callable fail closed) until `ANTHROPIC_API_KEY` is set in the
   function environment. At deploy the owner sets it as a Firebase Functions
   secret (`firebase functions:secrets:set ANTHROPIC_API_KEY`) and the callable
   binds it (`defineSecret`). The model id defaults in `agentModel.ts` and is
   overridable per deploy with `CAMPAIGN_DIRECTOR_MODEL`. Still to do: bind the
   ECOS MCP tools to the model via a ToolNode loop (agent → tools → agent) so the
   model can actually call `get_war_room_counters` et al.
2. **The deterministic tools' engine.** `get_certified_baseline` and
   `run_schedule1_scenario` (`ecosMcpTools.ts`) fail closed: the certified-results
   seat calculator lives in the **application** package, outside `functions/`'s
   `rootDir`. Share that engine into functions before turning them on.
3. **A deploy target.** Decision B stands — Cloud Functions are not deployed
   (the Cloudflare Claims Worker is the live backend, no Blaze). The agent deps
   are ESM; a deploy would also need the functions runtime on Node 22
   (`require(ESM)`), or an ESM build.

## What is real and tested now

- `scenarioPolicy.ts` — the provenance gate: a swing / turnout delta can never be
  `sourced`; a `sourced` claim must cite. The graph calls this instead of
  trusting the model.
- `state.ts` — state types, fail-closed `harnessContextFrom`, the 8-iteration
  cap, the HITL predicate.
- `firestoreCheckpointer.ts` — tenant-scoped `BaseCheckpointSaver`
  (`<tenantId>:<threadId>` or it throws). `parseScopedThread` is tested on its
  own.
- `graph.ts` — the three governed nodes + routing, tested with a fake model and
  an in-memory saver, including the human-in-the-loop interrupt/resume.
- `ecosMcpTools.ts` / `mcpServer.ts` — the ECOS tools and their MCP wrapper.

## Firestore wiring (already in this repo)

- `firestore.rules` — `tenants/{tid}/agentCheckpoints/**` is server-only
  (`allow read, write: if false`): only the Admin SDK touches checkpoints.
- `firestore.indexes.json` — composite index on the `checkpoints` collection
  (`checkpointNs` ASC, `deletedAt` ASC, `createdAt` DESC) for the saver's
  `getTuple`/`list` queries.
