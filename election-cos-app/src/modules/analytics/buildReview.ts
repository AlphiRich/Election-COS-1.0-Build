/**
 * Election Campaign OS — reconciling the "master build dashboard" with the build
 *
 * A supplied static page (`election_campaign_os_master_build_dashboard.html`)
 * presented roll, quota, seat, turnout, swing and commercial figures as
 * facts about NW405. Its useful functionality — a one-screen operator view
 * of the roll, the Schedule 1 quota, ward sizes and field usage — is built
 * as `BuildReviewPage` from LIVE sources. Its numbers are not copied.
 * This module is the cross-check: every claim the page made that can be
 * tested against something in this repository is tested, and each is
 * returned with a status rather than quietly adopted or dropped.
 *
 * STATUSES
 *   MATCHES       reproduced from a verified source here
 *   CONTRADICTED  disagrees with a verified source here
 *   UNRECONCILED  internally inconsistent, or two sources that cannot both
 *                 be right and nothing here arbitrates
 *   UNSOURCED     no source in this build; not shown as a fact
 *   OUT_OF_SCOPE  deliberately not carried (see `note`)
 */
import { REGISTER_ENTRIES } from "@/modules/reference/municipalRegister";
import { allocateSeats } from "./seatCalculator";
import { NW405_2021_EXAMPLE } from "./nw405Example";

export type ReviewStatus =
  | "MATCHES"
  | "CONTRADICTED"
  | "UNRECONCILED"
  | "UNSOURCED"
  | "OUT_OF_SCOPE";

export interface ReviewRow {
  id: string;
  claim: string;
  status: ReviewStatus;
  note: string;
}

/** The dashboard's own numbers, kept here only so they can be tested. */
export const DASHBOARD_CLAIMS = {
  quota: 1515,
  councilSeats: 67,
  wardSeats: 34,
  prSeats: 33,
  // "Council baseline seat split" (ward / PR)
  split: {
    ANC: [18, 15],
    DA: [12, 11],
    EFF: [4, 3],
    VFP: [0, 2],
    PA: [0, 2],
  } as Record<string, [number, number]>,
  topWardVoters: [4820, 5140, 4210, 4690, 4950],
  verifiedVoters: 131_963,
  vds: 106,
  addressPoints: 82_607,
  addressTypePoints: [42_975, 26_386, 12_071],
  rejected: 50_400,
} as const;

export function nw405Register() {
  const m = REGISTER_ENTRIES.find((e) => e.code === "NW405");
  if (!m) throw new Error("NW405 missing from the municipal register");
  return m;
}

/** The 2021 result recomputed — the only seat split in this build that has a source. */
export function nw405Seats2021() {
  const e = NW405_2021_EXAMPLE;
  return allocateSeats({
    totalValidVotes: e.totalValidVotes,
    totalSeats: e.totalSeats,
    independentWardSeats: e.independentWardSeats,
    noPRListWardSeats: e.noPRListWardSeats,
    parties: e.parties,
    municipalityCode: "NW405",
    delimitationId: e.delimitationId,
  });
}

export function reconcile(): ReviewRow[] {
  const c = DASHBOARD_CLAIMS;
  const reg = nw405Register();
  const seats = nw405Seats2021();
  const rows: ReviewRow[] = [];

  rows.push({
    id: "quota",
    claim: `Council seat quota ${c.quota} = ⌊101,439 / 67⌋ + 1, shown as the "certified 2026" quota`,
    status: seats.quota === c.quota ? "MATCHES" : "CONTRADICTED",
    note:
      seats.quota === c.quota
        ? "The arithmetic reproduces, but 101,439 is the 2021 valid-vote total. A 2026 quota cannot exist before 4 November 2026; this is the 2021 quota, and is labelled so on the page."
        : `Recomputed quota is ${seats.quota}.`,
  });

  const total = (id: string) =>
    seats.parties.find((p) => p.id === id)?.totalSeats ?? 0;
  const ward = (id: string) =>
    seats.parties.find((p) => p.id === id)?.wardSeatsWon ?? 0;
  const splitDiffs = Object.entries(c.split)
    .map(
      ([id, [w, p]]) =>
        `${id}: dashboard ${w + p} (${w}/${p}) vs 2021 ${total(id)} (${ward(id)}/${total(id) - ward(id)})`,
    )
    .filter((_, i) => {
      const [id, [w, p]] = Object.entries(c.split)[i]!;
      return w + p !== total(id) || w !== ward(id);
    });
  rows.push({
    id: "seat-split",
    claim:
      "Council baseline seat split ANC 33 · DA 23 · EFF 7 · VF+ 2 · PA 2 (ward/PR)",
    status: splitDiffs.length ? "CONTRADICTED" : "MATCHES",
    note: splitDiffs.length
      ? `The only sourced split is the 2021 IEC result, and it differs: ${splitDiffs.join("; ")}. The dashboard split has no source in this build and is not shown.`
      : "Matches the 2021 result.",
  });

  rows.push({
    id: "seat-totals",
    claim: "34 ward + 33 PR = 67 seats",
    status:
      c.wardSeats === reg.wards && c.wardSeats + c.prSeats === reg.councillors
        ? "MATCHES"
        : "CONTRADICTED",
    note: `Annexure A: ${reg.councillors} councillors, ${reg.wards} wards, so ${reg.councillors - (reg.wards ?? 0)} PR.`,
  });

  const maxNorm = reg.maxNorm ?? 0;
  const over = c.topWardVoters.filter((v) => v > maxNorm);
  rows.push({
    id: "ward-sizes",
    claim: `Top wards hold ${Math.min(...c.topWardVoters).toLocaleString()}–${Math.max(...c.topWardVoters).toLocaleString()} registered voters`,
    status: over.length ? "CONTRADICTED" : "MATCHES",
    note: over.length
      ? `${over.length} of ${c.topWardVoters.length} exceed the proclaimed upper norm of ${maxNorm.toLocaleString()} voters per ward (Annexure A: norm ${reg.norm?.toLocaleString()}, band ${reg.minNorm?.toLocaleString()}–${maxNorm.toLocaleString()}). Real ward sizes come from the loaded roll, not from this page.`
      : "Within the delimitation band.",
  });

  rows.push({
    id: "registered",
    claim: `${c.verifiedVoters.toLocaleString()} verified voters on the certified roll`,
    status: "UNRECONCILED",
    note: `Annexure A gives ${reg.registeredVoters.toLocaleString()} registered voters for NW405. A certified roll later than the circular can legitimately differ, but no roll is loaded in this build to confirm either figure. Shown only from the roll once ingested.`,
  });

  const sumPoints = c.addressTypePoints.reduce((a, b) => a + b, 0);
  rows.push({
    id: "address-points",
    claim: `${c.addressPoints.toLocaleString()} address points = street + stand + rural`,
    status: sumPoints === c.addressPoints ? "MATCHES" : "UNRECONCILED",
    note: `The three categories sum to ${sumPoints.toLocaleString()}, ${Math.abs(c.addressPoints - sumPoints).toLocaleString()} short of ${c.addressPoints.toLocaleString()}. The doughnut also adds 10,832 unaddressed VOTERS to a chart of points.`,
  });

  rows.push({
    id: "vds",
    claim: `${c.vds} voting districts`,
    status: "UNRECONCILED",
    note: "The app’s NW405 reference carries 108 station codes (25 split across wards). 106 vs 108 is unexplained.",
  });

  rows.push({
    id: "rejected",
    claim: `${c.rejected.toLocaleString()} "deceased audit quarantine"`,
    status: "CONTRADICTED",
    note: "The roll toolkit reports 52,176 REJECTED entries (not all deceased) for NW405. Rejected is not the same as deceased, and the two figures differ.",
  });

  for (const [id, claim, note] of [
    [
      "turnout",
      "Turnout history and scenarios S1–S5 (47.8 / 54.2 / 39.1 / 49.5 %)",
      "No turnout series or scenario basis exists in this build. The ward scenario tool lets a user set turnout and states it as an assumption.",
    ],
    [
      "hung-council",
      "68.5 % probability of a hung council; ward swing-risk ranking",
      "No model or data behind these. A probability needs a method; none was supplied. Not shown.",
    ],
    [
      "tokens",
      "CampaignToken rates (R0.0005 / write, R0.02 / sync, R0.15 / upload), ~R16.40 per volunteer, R1,800–R45,000 tiers",
      "Prices are not stored or shown in the build: the platform sells on published, identical terms and no price sits against a tenant. Per-use events are counted without prices (module voter-verification).",
    ],
    [
      "agents",
      "32-agent topology on Cloudflare Workers, AWS Fargate and Cloud SQL",
      "Firestore is the database and Firebase the platform (BUILD-STATUS, 13 Sep 2026). Not carried.",
    ],
    [
      "purge",
      "02:00 SAST 48-hour unconsented hard-purge daemon",
      "The human-centred audit rates an irreversible automatic purge as a critical defect (F3: quarantine, then human release). Not built; not presented as active.",
    ],
    [
      "legal-docs",
      'Six statutory documents "Active" (POPIA, PAIA, ECTA…)',
      "Binding legal instruments are not drafted by this build (build rule 3), and attorney review is undecided. Presenting them as active would be a claim.",
    ],
  ] as const) {
    rows.push({
      id,
      claim,
      status:
        id === "turnout" || id === "hung-council"
          ? "UNSOURCED"
          : "OUT_OF_SCOPE",
      note,
    });
  }
  return rows;
}
