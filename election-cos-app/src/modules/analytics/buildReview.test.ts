import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CLAIMS,
  nw405Register,
  nw405Seats2021,
  reconcile,
} from "./buildReview";

const row = (id: string) => reconcile().find((r) => r.id === id)!;

describe("the master-build dashboard, checked against this build", () => {
  it("reproduces the 1,515 quota, but only as the 2021 figure", () => {
    expect(nw405Seats2021().quota).toBe(1515);
    expect(row("quota").status).toBe("MATCHES");
    expect(row("quota").note).toMatch(/2021/);
  });

  it("finds the dashboard’s seat split does not match the sourced 2021 result", () => {
    expect(row("seat-split").status).toBe("CONTRADICTED");
    // The 2021 result gave ANC 24 ward seats; the dashboard claimed 18.
    expect(
      nw405Seats2021().parties.find((p) => p.id === "ANC")!.wardSeatsWon,
    ).toBe(24);
    expect(DASHBOARD_CLAIMS.split.ANC[0]).toBe(18);
  });

  it("finds ward sizes above the proclaimed upper norm", () => {
    expect(nw405Register().maxNorm).toBe(4127);
    expect(row("ward-sizes").status).toBe("CONTRADICTED");
  });

  it("finds the address categories do not sum to the stated total", () => {
    expect(row("address-points").status).toBe("UNRECONCILED");
    expect(row("address-points").note).toMatch(/1,175 short/);
  });

  it("accepts the 34 + 33 = 67 arithmetic because the register agrees", () => {
    expect(row("seat-totals").status).toBe("MATCHES");
  });

  it("never carries a price, a probability or an unsourced figure as a fact", () => {
    for (const id of [
      "turnout",
      "hung-council",
      "tokens",
      "agents",
      "purge",
      "legal-docs",
    ]) {
      expect(["UNSOURCED", "OUT_OF_SCOPE"], id).toContain(row(id).status);
    }
  });

  it("gives every row a claim and a reason", () => {
    for (const r of reconcile()) {
      expect(r.claim.length, r.id).toBeGreaterThan(5);
      expect(r.note.length, r.id).toBeGreaterThan(20);
    }
  });
});
