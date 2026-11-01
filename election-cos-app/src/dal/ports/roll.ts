/**
 * Election Campaign OS — voters'-roll port (module `voter-verification`)
 * IC-ECOS-DATA-2026-02, adapted to the tenant structure.
 *
 * The roll is the TARGET LIST, not the voter register. A roll entry is
 * personal information the party was supplied for electoral purposes; it
 * is never copied into `voters` or `households` until the person
 * themselves consents at the door (see `modules/roll/rollCapture.ts`).
 *
 * Everything lives under /tenants/{tid}/ like every other collection, so
 * the same three isolation layers apply. The ingest (tools/voters-roll)
 * is the only writer of entries and addresses; a client can only read
 * them, in its own scope, and write usage events.
 */
import type { SessionContext } from "./session";

export interface RollEntry {
  id: string;
  rollEdition: string;
  municipalityCode: string;
  wardCode: string;
  vdCode: string;
  sequenceNo: number;
  surname: string;
  fullNames: string;
  /** IEC mask, last digits only. Shown to a canvasser to tell two people apart; never copied elsewhere. */
  idNumberMasked: string;
  addressId: string | null;
  addressRaw: string | null;
}

export interface RollAddress {
  id: string;
  rollEdition: string;
  wardCode: string;
  vdCode: string;
  addressRaw: string;
  voterCount: number;
}

/** What is counted. Each is one chargeable instance. */
export type UsageKind = "VERIFY" | "CAPTURE";

export interface UsageEvent {
  /** `${kind}::${rollEntryId}` — a retry cannot count the same person twice. */
  id: string;
  tenantId: string;
  kind: UsageKind;
  rollEntryId: string;
  rollEdition: string;
  wardCode: string;
  vdCode: string;
  uid: string;
  /** ISO 8601, device clock. The authoritative time is the server's `recordedAt`. */
  at: string;
}

export interface RollRepository {
  /** The edition devices may use, or null before any roll has been loaded. */
  activeEdition(ctx: SessionContext): Promise<string | null>;
  /** Distinct addresses in the caller's own district (ward + VD), edition-filtered. */
  listAddresses(ctx: SessionContext, edition: string): Promise<RollAddress[]>;
  /** The people the roll lists at one address. */
  listEntriesAtAddress(
    ctx: SessionContext,
    edition: string,
    addressId: string,
  ): Promise<RollEntry[]>;
  /** Usage events visible to the caller — own scope — for the day's statistics. */
  listUsage(ctx: SessionContext): Promise<UsageEvent[]>;
  /** Count one verification. Idempotent: counting the same person twice is a no-op. */
  recordVerification(
    ctx: SessionContext,
    usage: UsageEvent,
  ): Promise<"COUNTED" | "ALREADY_COUNTED">;
  /**
   * Create the voter (and the household, if new) and count the capture, as
   * ONE atomic write. A voter without its capture event, or the reverse,
   * would be either unbilled personal data or a charge for nothing.
   */
  captureWithConsent(
    ctx: SessionContext,
    write: {
      household: Record<string, unknown> & { id: string };
      voter: Record<string, unknown> & { id: string };
      usage: UsageEvent;
    },
  ): Promise<void>;
}
