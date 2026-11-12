# Screen disposition — 19 HTML screens received 31 Oct 2026

Every file classified. Verdicts:

- **DELETE** — carries a claim, a name, or an architecture the programme has
  rejected. Do not rebuild. Do not re-receive.
- **QUARANTINE** — dangerous if published, but the underlying question is
  real. Recorded under `docs/quarantine/` for the record only.
- **LAYOUT-REF** — the *structure* is useful; the content is not. Recorded as
  a visual reference, not built.
- **REBUILD** — correct enough in shape that, with false claims and drifted
  tokens removed, it could not lie about the product.
- **SUPERSEDED** — the thing it depicts is already built; a reference would
  only compete with the real screen.

## Provenance — read this before relying on the table

**None of the 19 files is in this repository or in the uploads folder.** The
verdicts below, and every statement about what a file contains (names,
percentages, claims), are **the reviewer's, as reported**. They have not been
independently re-read, because the files were not retained. Nothing was
deleted or moved by this exercise, because there was nothing on disk to
delete or move.

If any of the 19 arrive again, re-read the file rather than citing this table
for its contents; cite it only for the verdict.

## Verdicts

| # | File | Verdict | Reason (as reported) |
|---|---|---|---|
| 1 | `turnout_impact_report_65_scenario.html` | **QUARANTINE** | Named-party forecast of a 2026 result. Violates the Neutrality Pledge, `MUST_NOT_CLAIM` #1, and the SPIKE·G5 guard. Never published; see `docs/quarantine/README.md`. |
| 2 | `ward_sentiment_report_refined_pdf_export.html` | **DELETE** | Named, fabricated signatory and organisation; fabricated reliability coefficient (97.9%); drifted tokens `#1a2b4b/#c5a059/#800000`. |
| 3 | `30_day_ward_sentiment_summary_refined_report.html` | **DELETE** | Named, fabricated signatory. Retired "SA ELECTIONS 2024" shell and `#040c30/#795907` palette. |
| 4 | `campaign_os_mobile_landing_page.html` | **DELETE** | Fabricated testimonial attributed to a non-existent role at Innovation Consult. |
| 5 | `allocation_confirmation_receipt.html` | **DELETE** | "Scan to verify … on the central blockchain ledger." No blockchain exists. |
| 6 | `campaign_os_contact_sales_provincial_metro.html` | **DELETE** | "Air-gapped server options and end-to-end encryption." Neither is true. |
| 7 | `campaign_os_contact_sales_with_enhanced_validation.html` | **DELETE** | Same air-gap/E2E claim, plus invented form-validation states. |
| 8 | `volunteer_rewards_configuration.html` | **DELETE** | Rejected twice already in `docs/screen-findings.md`. No capability, DAL port or spec section. |
| 9 | `volunteer_performance_metrics_dashboard.html` | **DELETE** | Retired "Civic Authority" shell. Fabricated per-volunteer conversion percentages attributed to named individuals. |
| 10 | `configure_automated_reporting_johannesburg_team.html` | **DELETE** | Retired shells. Fabricated staff with `.gov.za` emails on a private product's config screen. |
| 11 | `ward_sentiment_comparison_innovation_consult_edition.html` | **DELETE** | Correct tokens, but contains results commentary and operational direction ("Strategic Alert … Field presence mandated"), both barred by the Pledge. |
| 12 | `ward_field_app_innovation_consult_edition.html` | **LAYOUT-REF** | "Opponent Postering Noted" is a partisan frame; taxonomy does not match `IncidentCategory`. Structure of the "today's doors" view is reusable. |
| 13 | `voter_profiling_intake_innovation_consult_edition.html` | **LAYOUT-REF** | Age band, employment, language, psychological alignment, probability-of-support slider and a referral field are out of scope per `screen-findings.md`. Form layout reusable. |
| 14 | `voter_detail_profile.html` | **LAYOUT-REF** | A formatted fabricated voter ID that `screen-findings.md` says to skip. Timeline and concern-chip layout reusable. |
| 15 | `ward_12_resource_audit_log.html` | **SUPERSEDED** | The audit-log screen **already exists** (`src/modules/settings/AuditLogPage.tsx`, `auditTrail.ts`). See *Corrections on receipt*. |
| 16 | `volunteer_tasks_innovation_consult_edition.html` | **LAYOUT-REF** | Volunteer-task concept out of scope; progress-bar and task-card layout reusable for a doors-queue view. |
| 17 | `sync_reconciliation_terminal.html` | **REBUILD** | Per-field last-write-wins visual describes the real merge. False encryption claim removed. Rebuilt at `docs/screen-references/sync-reconciliation.html`. |
| 18 | `campaign_os_refined_mobile_pricing.html` | **DELETE** | Prices invented. The published price list is in `src/site/siteContent.ts`, held to the application by tests. |
| 19 | `campaign_os_submission_success.html` | **LAYOUT-REF** | No public form submits anywhere yet. Layout only. |

**Tally: 11 DELETE · 1 QUARANTINE · 5 LAYOUT-REF · 1 REBUILD · 1 SUPERSEDED = 19.**

## Corrections on receipt

The disposition as first written had defects, found by checking it against the
code before committing. They are recorded so the same mistakes are not made by
the next reader.

1. **The summary counts did not match the table.** The prose said "two
   rebuilt, two layout references, fifteen deleted". The table has 11 deleted,
   5 layout references, 1 quarantined and 2 proposed rebuilds. The table is
   what was committed; the tally above is computed from it.

2. **#15 was proposed as a rebuild, and the audit log is already built.**
   `AuditLogPage.tsx` exists, over a different model (`actorUid`, `action`,
   `targetType`, `targetId`, `occurredAt`, `metadata`). The drafted reference
   invented columns (`event_kind`, request id), invented event kinds that
   nothing writes (`auth.login`, `metering.debit`, `ppfa.donation.record`,
   `capabilities.refused`, `referral.issue`, `incident.status.refused`; only
   `candidate.idNumber.unmask` appears in the code), cited a Prisma model that
   does not exist (the database is Firestore), and described the log as
   "immutable by construction". The real screen states the opposite and a
   test enforces it: the log is append-only **from the client** but **not
   tamper-evident**, because there is no hash chain and anyone holding Admin
   SDK credentials could alter it undetected. A reference that overstates
   that property is worse than no reference. Not committed.

3. **The sync reference carried four false "proven" claims.** It said the sync
   endpoint "is a skeleton that returns 501" (it is implemented — 286 lines,
   33 merge tests — but has never run against Firestore, and nothing in the
   client calls it); that documents use "Firestore's persistent cache" (none
   is configured); that a "Drain outbox now" button exists (it does not); and
   it described a rules-based conflict protocol (the real one is per-field
   last-write-wins in `functions/src/syncMerge.ts`). Rewritten against the
   code.

4. **Placement.** The drafted location `src/screens/references/` does not
   exist, and `src/` is product source under the hex and type-scale guards.
   References live in `docs/screen-references/` and use inline CSS from the
   product tokens, with no CDN script, so opening one makes no third-party
   request.

5. **BUILD-STATUS and the Pledge.** `BUILD-STATUS.md` records that gatherings
   notice alerts were deliberately not built (spec §6.7). The RGA notice
   countdown was built on 30–31 Oct at the founder's instruction and supersedes
   that line; see the `BUILD-STATUS.md` entry of 31 Oct.

## What this does not resolve

- **Casework Tracker timing.** The public site already states casework season
  opens 5 November 2026, and the sales plan sets gate G0b at 50 paid ward
  commitments by 31 January 2027 (control sheet §42.4). Whether the *product*
  module will be ready by then is a build question, not a screen question.
- **Profile-screen scope** — whether `Voter` gains demographic or
  psychographic fields. A product decision (POPIA s 26 applies to political
  opinion), not a screen decision.
- **The turnout model as a commercial service.** If it is to exist at all it
  belongs in a separate firm under a separate contract, not in
  `election-cos-app`.
