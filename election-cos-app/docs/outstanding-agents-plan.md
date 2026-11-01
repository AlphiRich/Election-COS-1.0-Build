# Plan: the outstanding "agents" (1 Nov 2026)

Scope: every row of `docs/architecture-agent-map.md` whose status is not "built". An "agent" is a bounded
responsibility (a function, rule, or scheduled job), not a service. Polling day is 4 Nov 2026, so the plan is
ordered by what protects the campaign first, and by what can be finished and *proved* without a credential.

## Tier A: build now (no credential, no new data, provable by test)

| Order | Agent | Build | Proof |
|---|---|---|---|
| A1 | 1 OFFLINE_SYNC_SENTINEL (finish) | Wire `outboxStatus.ts` into the Dexie schema: `status`, `attempts`, `rejectReason`, `discardedBy/At`. Migration keeps existing rows as `pending`. | Dexie test: 5th failed retry surfaces as a rejection; discard without a named person is refused. |
| A2 | 13/19 POPIA consent trigger and purge (design as quarantine) | A scheduled-function module (not exported until Blaze) that moves records lacking consent into a `quarantine` state and lists them for a human release. **No automatic hard purge.** | Unit test with injected clock; a record with consent is never touched. |
| A3 | 15 RLS_AUDIT | A script that runs the rules emulator matrix (tenant × capability × ward/VD scope) and fails on any cross-tenant read. Extends the 15 roll cases to every collection. | Prove by injection: widen one rule, the audit must fail. |
| A4 | 21 AUDIT_LOG_WRITER hash chain | Each audit entry stores `prevHash` and `hash`; export verifies the chain. The page stops saying "no hash chain". | Tamper one row in a fixture, verification names it. |
| A5 | 2 MEDIA_COMPRESSION | Client-side image downscale and re-encode before queueing, size cap per photo. | Browser test: a 4 MB image queues under the cap; EXIF location stripped. |
| A6 | 24 COMPLIANCE_WAR_ROOM, 25 SCENARIO_POLICY (finish) | War room: counters read from real collections, empty states honest. Scenario: every input carries a source or is labelled "assumption you set"; gate that refuses an unsourced figure. | Test that an unsourced input cannot be saved as a source. |
| A7 | 7 POPIA_MASKING (finish) | One masking function used by every export and screen; test scans exports for unmasked ID/phone patterns. | Injection: unmask one export, scan fails. |

## Tier B: needs a credential or plan change (build the code, leave it off)

| Agent | Blocker | What I do now |
|---|---|---|
| 9 LWW_RECONCILIATION, 17 PGA_EVENT_AUDITOR | Firebase Blaze plan and a deploy credential | Already `@deployable fails-closed`; add emulator tests only. |
| 18 PPFA_AGGREGATOR | Attorney confirmation of the thresholds (under court challenge) | Stays unexported. Unblock = a written confirmation, then one export line. |
| 20 INCIDENT_DISPATCH | A WhatsApp Business credential | Build the dispatcher behind an interface with a recording fake; ship with it disabled. |
| 10 DOCUMENT_VAULT | KMS key | Envelope-encryption wrapper with the key supplied by environment; no key, no write (fails closed). |

## Tier C: do not build until the method and data exist (rule: never fabricate)

27–32 TURNOUT_ELASTICITY, PARTY_SUPPORT, WARD_SWING, MK_ENTRY, COALITION_POST, MONTE_CARLO, plus 11
SIMULATION_ORCHESTRATOR and 23 CAMPAIGN_DIRECTOR. No sourced data or published method sits behind them, and the 68.5 %
figure is unsourced. Entry condition for each: (1) a named, cited method, (2) the dataset in `seed-data/` with its
source, (3) a backtest against the 2021 result with the error stated. Until then `wardScenario.ts` stays a tool where
the user sets the inputs. The white paper also forbids predictions and results commentary on the public site.

## Tier D: decisions for the founder
1. The AWS/RDS/Python half: Firestore was decided on 13 Sep 2026. Reopen only as a new project.
2. Whether Tier A2 should ever hard-purge after a human release (the audit rates automatic purge critical).
3. Who is the named releaser for quarantined records.

## Sequence and exit
A1 → A4 → A3 → A2 → A7 → A5 → A6 (about one working session each, A1 to A3 before polling day).
Each item: code, a test that fails when the code is broken (shown by injection), control-sheet and change-log
entries, `npm run check:all` green, then push. Tier B items land disabled with a one-line unblock instruction.
