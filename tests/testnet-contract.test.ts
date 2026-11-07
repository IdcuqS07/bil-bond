import { describe, expect, it } from "vitest";
import { deriveAppealStatuses } from "../client/src/lib/testnet-contract";

describe("deriveAppealStatuses", () => {
  it("keeps upheld after the later settlement event", () => {
    const statuses = deriveAppealStatuses([
      { sequence: "3", kind: "escrow_locked", actor: "buyer", order_id: 1, timestamp: "1", details: "" },
      { sequence: "5", kind: "appeal_submitted", actor: "provider", order_id: 1, timestamp: "2", details: "" },
      { sequence: "6", kind: "appeal_upheld", actor: "governance", order_id: 1, timestamp: "3", details: "" },
      { sequence: "7", kind: "escrow_refunded_and_bond_slashed", actor: "provider", order_id: 1, timestamp: "4", details: "" },
    ]);

    expect(statuses.get(1)).toBe("upheld");
  });

  it("keeps overturned distinct from upheld", () => {
    const statuses = deriveAppealStatuses([
      { sequence: "1", kind: "appeal_submitted", actor: "provider", order_id: 0, timestamp: "1", details: "" },
      { sequence: "2", kind: "appeal_overturned", actor: "governance", order_id: 0, timestamp: "2", details: "" },
      { sequence: "3", kind: "escrow_refunded", actor: "governance", order_id: 0, timestamp: "3", details: "" },
    ]);

    expect(statuses.get(0)).toBe("overturned");
  });
});
