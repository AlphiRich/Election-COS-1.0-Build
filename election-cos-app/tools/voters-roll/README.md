# Voters' roll — adapted to the tenant structure

Source: the IC-ECOS-DATA-2026-02 toolkit (`ElectionCOS-ingestion-voters-roll.zip`, kept outside this repo).
**Never commit roll data.** The PDFs, CSVs and zip are personal information; nothing here contains any,
and every test uses invented people.

## What the toolkit assumed, and what the app is

| Toolkit | App | Adaptation |
|---|---|---|
| top-level `roll_*`, `geo_*` collections | everything under `/tenants/{tid}/` | `AdminSink(db, "tenants/<tid>")`; CLI needs `--tenant` |
| claims `role`, `wardCode`, `vdCode` | claims `tenantId`, `caps`, `geoScope`, `wardScope`, `vdScope` | app rules use `inScope()` and `cap('roll.view')` |
| ward code `NW405-W1` | `NW405-W01` (zero-padded, as the ward reference data) | `wardFromIecId` pads to 2 digits. **Unpatched, a ward-scoped token would match nothing** |
| VD doc keyed by `vdCode` | `(wardCode, vdCode)` — split stations are real | VD docs keyed `wardCode::vdCode` |
| fixed roles `VD_CAPTAIN` etc. | capability model | `roll.view`, `roll.capture`; module `voter-verification` |
| Postgres + PostGIS half | Firestore is the database (BUILD-STATUS 13 Sep 2026) | not used |
| Firestore rules as a separate file | one `firestore.rules` | merged: `roll_*`, `usageEvents` blocks |

`tenant-adaptation.patch` is the change to the toolkit (5 files). Apply to a copy of the toolkit:
`cd ingestion/voters-roll && patch -p1 < tenant-adaptation.patch`. With it, the toolkit's own unit tests
(ingest + client, 29) pass.

`appRules.emulator.ts` (not picked up by the app's vitest; copy it to the toolkit's `test/appRules.test.ts`) runs the app's real `firestore.rules` in the Firestore emulator (15 cases: scope, split
station, superseded edition, other tenant, unscoped query, create-only events, module off, price field).
Run inside the toolkit folder (it has `@firebase/rules-unit-testing`):
`APP_RULES=/abs/path/firestore.rules npx firebase emulators:exec --only firestore --project demo-ecos-app "npx vitest run test/appRules.test.ts"`.

## Not done, and why
- **No roll has been loaded.** None was supplied to this build. The field screen shows "No roll loaded".
- **Ward-number mapping is still derived** (last 3 digits of the IEC ward id) until confirmed against the MDB delimitation.
- **106 vs 108 VDs** (roll vs the app's NW405 reference) is unexplained. A split-station difference is a
  hypothesis, not a finding.
- **POPIA lawful basis, retention date and attorney review are undecided** (register §11.1). Loading the roll
  into a volunteer tool is processing. This is a go-live blocker for loading data, not for the code.
- **Offline.** Writes go through the Firestore SDK. The toolkit's Dexie scoped sync (`client/src`) is not wired
  in; a canvasser without signal cannot yet verify or capture. Audit F1/F2 ("saved on phone" vs "received by
  the campaign") applies to this screen.
- **Per-use billing is metering only.** Events are counted; there is no payment flow, price list or invoice, and
  no pricing terms are drafted here (the platform sells on published, identical terms; an event or entitlement
  carrying a price is refused by test and by rule). Client-written events are a convenience tally. Invoicing
  must reconcile against `voters` created from the roll (`rollEntryId`) with a server-side job. Not built.
- The server-side step that turns the entitlement on (paying) is also not built; entitlements are written
  server-side only.
