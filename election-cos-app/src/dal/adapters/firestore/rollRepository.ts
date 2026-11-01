/**
 * Election Campaign OS — Firestore adapter: voters' roll
 * Collections (all under /tenants/{tid}/): roll_meta, roll_addresses,
 * roll_entries, usageEvents. Read narrowing mirrors firestore.rules.
 * Entries and addresses are written only by tools/voters-roll.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { SessionContext } from "@/dal/ports/session";
import type {
  RollAddress,
  RollEntry,
  RollRepository,
  UsageEvent,
} from "@/dal/ports/roll";
import {
  db,
  geoScopeConstraints,
  stampOnWrite,
  tenantCollectionPath,
  toISO,
} from "./base";

const entry = (id: string, d: Record<string, unknown>): RollEntry => ({
  id,
  rollEdition: d.rollEdition as string,
  municipalityCode: d.municipalityCode as string,
  wardCode: d.wardCode as string,
  vdCode: d.vdCode as string,
  sequenceNo: d.sequenceNo as number,
  surname: d.surname as string,
  fullNames: d.fullNames as string,
  idNumberMasked: d.idNumberMasked as string,
  addressId: (d.addressId as string | null) ?? null,
  addressRaw: (d.addressRaw as string | null) ?? null,
});

const address = (id: string, d: Record<string, unknown>): RollAddress => ({
  id,
  rollEdition: d.rollEdition as string,
  wardCode: d.wardCode as string,
  vdCode: d.vdCode as string,
  addressRaw: d.addressRaw as string,
  voterCount: (d.voterCount as number) ?? 0,
});

const usage = (id: string, d: Record<string, unknown>): UsageEvent => ({
  id,
  tenantId: d.tenantId as string,
  kind: d.kind as UsageEvent["kind"],
  rollEntryId: d.rollEntryId as string,
  rollEdition: d.rollEdition as string,
  wardCode: d.wardCode as string,
  vdCode: d.vdCode as string,
  uid: d.uid as string,
  at: toISO(d.at as string) ?? "",
});

const path = (ctx: SessionContext, c: string) =>
  tenantCollectionPath(ctx.tenantId, c);

export const rollRepository: RollRepository = {
  async activeEdition(ctx) {
    const snap = await getDoc(doc(db(), path(ctx, "roll_meta"), "active"));
    return snap.exists()
      ? ((snap.data().edition as string | null) ?? null)
      : null;
  },

  async listAddresses(ctx, edition) {
    // The rules require the edition and the scope in the query itself.
    const snap = await getDocs(
      query(
        collection(db(), path(ctx, "roll_addresses")),
        where("rollEdition", "==", edition),
        ...geoScopeConstraints(ctx),
      ),
    );
    return snap.docs.map((d) => address(d.id, d.data()));
  },

  async listEntriesAtAddress(ctx, edition, addressId) {
    const snap = await getDocs(
      query(
        collection(db(), path(ctx, "roll_entries")),
        where("rollEdition", "==", edition),
        where("addressId", "==", addressId),
        ...geoScopeConstraints(ctx),
      ),
    );
    return snap.docs
      .map((d) => entry(d.id, d.data()))
      .sort((a, b) => a.sequenceNo - b.sequenceNo);
  },

  async listUsage(ctx) {
    const snap = await getDocs(
      query(
        collection(db(), path(ctx, "usageEvents")),
        ...geoScopeConstraints(ctx),
      ),
    );
    return snap.docs.map((d) => usage(d.id, d.data()));
  },

  async recordVerification(ctx, u) {
    const ref = doc(db(), path(ctx, "usageEvents"), u.id);
    // Create-only in the rules, so an existing event cannot be overwritten;
    // look first so "already counted" is an answer, not a permission error.
    if ((await getDoc(ref)).exists()) return "ALREADY_COUNTED";
    await setDoc(ref, { ...u, recordedAt: serverTimestamp() });
    return "COUNTED";
  },

  async captureWithConsent(ctx, w) {
    const batch = writeBatch(db());
    // Household: merge, so a second voter at the same door does not erase the first's.
    batch.set(
      doc(db(), path(ctx, "households"), w.household.id),
      { ...w.household, ...stampOnWrite(ctx, true) },
      { merge: true },
    );
    batch.set(doc(db(), path(ctx, "voters"), w.voter.id), {
      ...w.voter,
      ...stampOnWrite(ctx, true),
    });
    batch.set(doc(db(), path(ctx, "usageEvents"), w.usage.id), {
      ...w.usage,
      recordedAt: serverTimestamp(),
    });
    await batch.commit();
  },
};
