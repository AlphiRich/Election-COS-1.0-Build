# Voters' Roll — loading and going live

Two separate steps, by design. Loading writes voter records; going live is a
pointer. Neither is a browser action that bulk-handles personal data.

## 1. Load an edition (server-side, on the campaign's own machine)

Bulk voter records are ingested by `tools/voters-roll`, run on the owner's
machine against the certified roll files the party is lawfully entitled to —
never uploaded through the app, never committed to this repository. The ingest
writes, under `/tenants/{tid}/`:

- `roll_entries/{edition}_{vd}_{seq}` — one per voter the roll lists.
- `roll_addresses/{id}` — distinct addresses with a voter count.
- `roll_meta/{edition}` — the edition's **metadata**: `{ edition, status, entries,
  addresses, loadedAt, note? }`, where `status` is `LOADING` while the run is in
  progress, `LOADED` once it has finished and reconciled, or `FAILED` if it
  refused. This is the document the in-app screen reads.

The ingest must write `roll_meta/{edition}` with `status: 'LOADED'` only after
every voting district reconciles; a half-written edition stays `LOADING` (or
`FAILED`) and the app will refuse to make it live.

## 2. Make an edition live (in-app, Party HQ Admin)

Settings → **Voters' Roll Editions** (`/settings/roll-editions`, capability
`roll.manage`). It lists every loaded edition and which one is live, and offers
**Make Live** for any `LOADED` edition that is not already active.

Activation calls the `setActiveRollEdition` Cloud Function, which re-checks —
server-side, from the verified token — that the caller holds `roll.manage`, has
passed the second sign-in step, and that the named edition exists and is
`LOADED`. Only then does it move `roll_meta/active = { edition }` with the admin
SDK. `roll_meta` is `write: if false` to clients, so the browser never writes
the pointer directly.

The field screen (`/roll`) and the segmentation (`/analytics/roll-segmentation`)
both read `roll_meta/active`, so going live switches the whole campaign at once.

## What this does not decide

Lawful basis and the retention date for loading the roll are a POPIA decision,
recorded in the design/change log (§11.1), not settled by this screen. No roll
data lives in this repository.
