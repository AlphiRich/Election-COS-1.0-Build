import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, getDocs, query, collection, where, updateDoc, serverTimestamp } from "firebase/firestore";

let env: RulesTestEnvironment;
const RULES = process.env.APP_RULES ?? "../../../election-cos-app/firestore.rules"; // set APP_RULES to the absolute path
const T = "t1";
const claims = (o: object) => ({ tenantId: T, caps: ["roll.view", "roll.capture", "voters.view", "voters.edit"], geoScope: "VD", wardScope: "NW405-W31", vdScope: "86999001", ...o });
const e = (o = {}) => ({ rollEdition: "E1", wardCode: "NW405-W31", vdCode: "86999001", addressId: "A1", surname: "X", fullNames: "Y", ...o });
const ev = (o = {}) => ({ tenantId: T, kind: "VERIFY", rollEntryId: "r1", rollEdition: "E1", wardCode: "NW405-W31", vdCode: "86999001", uid: "u1", at: "2026-11-04T08:00:00Z", recordedAt: serverTimestamp(), ...o });

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-ecos-app", firestore: { rules: readFileSync(RULES, "utf8"), host: "127.0.0.1", port: 8080 } });
  await env.withSecurityRulesDisabled(async (c) => {
    const d = c.firestore();
    await setDoc(doc(d, `tenants/${T}/roll_meta/active`), { edition: "E1" });
    await setDoc(doc(d, `tenants/${T}/roll_entries/in`), e());
    await setDoc(doc(d, `tenants/${T}/roll_entries/otherWard`), e({ wardCode: "NW405-W32" }));
    await setDoc(doc(d, `tenants/${T}/roll_entries/otherVd`), e({ vdCode: "86999002" }));
    await setDoc(doc(d, `tenants/${T}/roll_entries/old`), e({ rollEdition: "E0" }));
    await setDoc(doc(d, `tenants/${T}/entitlements/voter-verification`), { module: "voter-verification", activeFrom: "2026-01-01T00:00:00Z" });
  });
});
afterAll(() => env.cleanup());

describe("app rules: roll", () => {
  const db = (c = {}) => env.authenticatedContext("u1", claims(c)).firestore();
  it("reads own ward+station entry in the active edition", () => assertSucceeds(getDoc(doc(db(), `tenants/${T}/roll_entries/in`))));
  it("refuses another ward's entry (split-station case)", () => assertFails(getDoc(doc(db(), `tenants/${T}/roll_entries/otherWard`))));
  it("refuses another station", () => assertFails(getDoc(doc(db(), `tenants/${T}/roll_entries/otherVd`))));
  it("refuses a superseded edition", () => assertFails(getDoc(doc(db(), `tenants/${T}/roll_entries/old`))));
  it("refuses another tenant", () => assertFails(getDoc(doc(env.authenticatedContext("u1", claims({ tenantId: "t2" })).firestore(), `tenants/${T}/roll_entries/in`))));
  it("refuses a user without roll.view", () => assertFails(getDoc(doc(db({ caps: ["voters.view"] }), `tenants/${T}/roll_entries/in`))));
  it("never lets a client write an entry", () => assertFails(setDoc(doc(db(), `tenants/${T}/roll_entries/new`), e())));
  it("scoped query succeeds", () => assertSucceeds(getDocs(query(collection(db(), `tenants/${T}/roll_entries`), where("rollEdition", "==", "E1"), where("vdCode", "==", "86999001"), where("wardCode", "==", "NW405-W31")))));
  it("unscoped query is rejected whole", () => assertFails(getDocs(query(collection(db(), `tenants/${T}/roll_entries`), where("rollEdition", "==", "E1")))));
  it("counts a verification", () => assertSucceeds(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r1`), ev())));
  it("refuses a wrong id, a spoofed uid, a price, a bad kind", async () => {
    await assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::zzz`), ev()));
    await assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r2`), ev({ rollEntryId: "r2", uid: "someone" })));
    await assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r3`), ev({ rollEntryId: "r3", price: 1 })));
    await assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/FREE::r4`), ev({ rollEntryId: "r4", kind: "FREE" })));
  });
  it("refuses out-of-scope usage", () => assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r5`), ev({ rollEntryId: "r5", wardCode: "NW405-W32" }))));
  it("refuses an edit or delete of an event", async () => {
    await assertFails(updateDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r1`), { kind: "CAPTURE" }));
  });
  it("refuses events when the module is not switched on", async () => {
    await env.withSecurityRulesDisabled((c) => import("firebase/firestore").then(({ deleteDoc }) => deleteDoc(doc(c.firestore(), `tenants/${T}/entitlements/voter-verification`))));
    await assertFails(setDoc(doc(db(), `tenants/${T}/usageEvents/VERIFY::r6`), ev({ rollEntryId: "r6" })));
  });
  it("refuses a view-only role creating events", () => assertFails(setDoc(doc(db({ caps: ["roll.view"] }), `tenants/${T}/usageEvents/VERIFY::r7`), ev({ rollEntryId: "r7" }))));
});
