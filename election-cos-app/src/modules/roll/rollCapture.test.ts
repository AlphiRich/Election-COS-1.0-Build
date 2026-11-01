import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { RollAddress, RollEntry } from "@/dal/ports/roll";
import type { SessionContext } from "@/dal/ports/session";
import { MODULES, gatingModule } from "@/auth/modules";
import { SEED_ROLES } from "@/auth/seedRoles";
import {
  CaptureRefused,
  buildCapture,
  buildVerification,
  findAddresses,
  inCallerScope,
  spokenName,
  summariseUsage,
  usageId,
} from "./rollCapture";

// Invented people and places. No roll data is, or may be, in this repository.
const entry = (over: Partial<RollEntry> = {}): RollEntry => ({
  id: "E1_86999001_00001",
  rollEdition: "E1",
  municipalityCode: "NW405",
  wardCode: "NW405-W31",
  vdCode: "86999001",
  sequenceNo: 1,
  surname: "TESTERMAN",
  fullNames: "ALEX JORDAN",
  idNumberMasked: "9109** ****08*",
  addressId: "A1",
  addressRaw: "12 TEST STREET",
  ...over,
});
const addr: RollAddress = {
  id: "A1",
  rollEdition: "E1",
  wardCode: "NW405-W31",
  vdCode: "86999001",
  addressRaw: "12 TEST STREET",
  voterCount: 2,
};
const ctx = (over: Partial<SessionContext> = {}): SessionContext => ({
  tenantId: "t1",
  uid: "u1",
  caps: ["roll.view", "roll.capture"],
  geoScope: "VD",
  wardScope: "NW405-W31",
  vdScope: "86999001",
  ...over,
});
const NOW = new Date("2026-11-04T08:00:00Z");
const ok = { consentGiven: true, confirmedName: "alex  testerman" };

describe("capturing a voter from the roll", () => {
  it("creates the household, the voter and ONE capture event, linked to the roll entry", () => {
    const r = buildCapture(ctx(), entry(), addr, ok, NOW);
    expect(r.voter).toMatchObject({
      popiaConsentGiven: true,
      popiaConsentMethod: "VERBAL_DOORSTEP",
      firstName: "ALEX",
      lastName: "TESTERMAN",
      householdId: "roll-A1",
      rollEntryId: "E1_86999001_00001",
    });
    expect(r.voter.popiaConsentReference).toContain("by:u1");
    expect(r.usage).toMatchObject({
      kind: "CAPTURE",
      id: usageId("CAPTURE", entry().id),
      uid: "u1",
      tenantId: "t1",
    });
    expect(r.household).toMatchObject({
      id: "roll-A1",
      addressLine: "12 TEST STREET",
      vdCode: "86999001",
    });
  });

  it("refuses without consent, and writes nothing (there is no refusal record)", () => {
    expect(() =>
      buildCapture(ctx(), entry(), addr, { ...ok, consentGiven: false }, NOW),
    ).toThrowError(CaptureRefused);
    try {
      buildCapture(ctx(), entry(), addr, { ...ok, consentGiven: false }, NOW);
    } catch (e) {
      expect((e as CaptureRefused).reason).toBe("NO_CONSENT");
    }
  });

  it("refuses unless the canvasser names the person who agreed", () => {
    for (const confirmedName of [
      "",
      "ALEX",
      "JORDAN TESTERMAN",
      "someone else",
    ]) {
      expect(() =>
        buildCapture(ctx(), entry(), addr, { ...ok, confirmedName }, NOW),
      ).toThrowError(CaptureRefused);
    }
    expect(spokenName(entry())).toBe("ALEX TESTERMAN");
  });

  it("never carries the IEC mask, or any ID-shaped field, into the voter record", () => {
    const r = buildCapture(ctx(), entry(), addr, ok, NOW);
    const text = JSON.stringify(r);
    expect(text).not.toContain("9109");
    expect(text).not.toContain("idNumber");
    expect(Object.keys(r.voter).some((k) => /id.?number|idmask/i.test(k))).toBe(
      false,
    );
  });

  it("refuses a person outside the canvasser’s own ward and station, including the other ward of a split station", () => {
    expect(() =>
      buildCapture(ctx(), entry({ wardCode: "NW405-W32" }), addr, ok, NOW),
    ).toThrowError(CaptureRefused);
    expect(() =>
      buildCapture(ctx(), entry({ vdCode: "86999002" }), addr, ok, NOW),
    ).toThrowError(CaptureRefused);
    expect(inCallerScope(ctx({ wardScope: undefined }), entry())).toBe(false);
    expect(
      inCallerScope(ctx({ geoScope: "WARD", vdScope: undefined }), entry()),
    ).toBe(true);
    expect(
      inCallerScope(
        ctx({ geoScope: "WARD", vdScope: undefined }),
        entry({ wardCode: "NW405-W32" }),
      ),
    ).toBe(false);
  });

  it("refuses someone with no address on the roll", () => {
    expect(() =>
      buildCapture(ctx(), entry({ addressId: null }), undefined, ok, NOW),
    ).toThrowError(CaptureRefused);
  });
});

describe("the per-use meter", () => {
  it("counts a verification as one instance with an id that makes a retry a no-op", () => {
    const a = buildVerification(ctx(), entry(), NOW);
    const b = buildVerification(
      ctx(),
      entry(),
      new Date(NOW.getTime() + 60_000),
    );
    expect(a.id).toBe(b.id);
    expect(a.id).toBe("VERIFY::E1_86999001_00001");
  });

  it("never carries a price, rate or amount on an event", () => {
    const e = buildVerification(ctx(), entry(), NOW);
    expect(
      Object.keys(e).some((k) =>
        /price|rate|amount|cost|fee|rand|zar/i.test(k),
      ),
    ).toBe(false);
  });

  it("summarises the day by kind, district, hour (SAST) and canvasser", () => {
    const mk = (
      kind: "VERIFY" | "CAPTURE",
      id: string,
      uid: string,
      at: string,
    ) => ({
      ...buildVerification(ctx({ uid }), entry({ id }), new Date(at)),
      id: usageId(kind, id),
      kind,
    });
    const s = summariseUsage([
      mk("VERIFY", "a", "u1", "2026-11-04T06:10:00Z"),
      mk("CAPTURE", "a", "u1", "2026-11-04T06:12:00Z"),
      mk("VERIFY", "b", "u2", "2026-11-04T07:05:00Z"),
    ]);
    expect(s).toMatchObject({ verify: 2, capture: 1 });
    expect(s.captureRate).toBe(0.5);
    expect(s.byUser.u1).toEqual({ verify: 1, capture: 1 });
    expect(s.byHour["2026-11-04 08:00"]).toEqual({ verify: 1, capture: 1 });
    expect(s.byHour["2026-11-04 09:00"]).toEqual({ verify: 1, capture: 0 });
    expect(summariseUsage([]).captureRate).toBeNull();
  });
});

describe("finding an address", () => {
  it("matches a fragment case-insensitively and sorts", () => {
    const list = [addr, { ...addr, id: "A2", addressRaw: "3 OTHER ROAD" }];
    expect(findAddresses(list, "test st").map((a) => a.id)).toEqual(["A1"]);
    expect(findAddresses(list, "").map((a) => a.id)).toEqual(["A1", "A2"]);
  });
});

describe("how the module is wired into the tenant structure", () => {
  it("is a metered, non-bundled tenant module gating exactly the two roll capabilities", () => {
    const m = MODULES.find((x) => x.key === "voter-verification")!;
    expect(m).toMatchObject({
      metering: "PER_USE",
      bundled: false,
      scope: "TENANT",
    });
    expect(gatingModule("roll.view")?.key).toBe("voter-verification");
    expect(gatingModule("roll.capture")?.key).toBe("voter-verification");
    expect(MODULES.filter((x) => x.metering).map((x) => x.key)).toEqual([
      "voter-verification",
    ]);
  });

  it("gives field roles the roll, and gives nobody in finance or compliance the doorstep", () => {
    const caps = (id: string) =>
      SEED_ROLES.find((r) => r.id === id)!.defaultCaps;
    for (const id of ["canvasser", "vd-captain", "ward-lead"]) {
      expect(caps(id), id).toEqual(
        expect.arrayContaining(["roll.view", "roll.capture"]),
      );
    }
    for (const id of ["party-hq-admin", "municipal-team-lead"]) {
      expect(caps(id), id).toContain("roll.view");
      expect(caps(id), id).not.toContain("roll.capture");
    }
    for (const id of ["finance-officer", "compliance-officer"]) {
      expect(caps(id), id).not.toContain("roll.view");
    }
  });
});

describe("firestore.rules for the roll", () => {
  const rules = readFileSync(
    path.resolve(__dirname, "..", "..", "..", "firestore.rules"),
    "utf-8",
  );
  const block = (name: string) => {
    const i = rules.indexOf(`match /tenants/{tid}/${name}/`);
    expect(i, name).toBeGreaterThan(-1);
    return rules.slice(i, rules.indexOf("\n    }\n", i));
  };
  it("lives under /tenants/{tid}/ — there is no top-level roll collection", () => {
    expect(rules).not.toMatch(/match \/roll_[a-z]+\//);
    expect(rules).not.toMatch(/match \/geo_[a-z_]+\//);
  });
  it("lets no client write the roll, and none read rejected entries", () => {
    for (const n of [
      "roll_entries",
      "roll_addresses",
      "roll_meta",
      "roll_editions",
    ]) {
      expect(block(n)).toMatch(/allow write: if false;/);
    }
    expect(block("roll_rejected")).toMatch(/allow read, write: if false;/);
  });
  it("scopes entry and address reads by inScope and the active edition", () => {
    for (const n of ["roll_entries", "roll_addresses"]) {
      expect(block(n)).toMatch(/inScope\(tid, resource\.data\)/);
      expect(block(n)).toMatch(/activeRollEdition\(tid, resource\.data\)/);
      expect(block(n)).toMatch(/cap\('roll\.view'\)/);
    }
  });
  it("makes usage events create-only, tied to the caller, the module being on, and priceless", () => {
    const b = block("usageEvents");
    expect(b).toMatch(/allow update, delete: if false;/);
    expect(b).toMatch(/cap\('roll\.capture'\)/);
    expect(b).toMatch(/uid == request\.auth\.uid/);
    expect(b).toMatch(/rollModuleOn\(tid/);
    expect(b).toMatch(/!\('price' in request\.resource\.data\)/);
  });
});
