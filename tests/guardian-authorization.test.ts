import { describe, expect, it } from "vitest";
import {
  canGuardianDecide,
  getGuardianAuthorization,
  guardianAuthorizationMessage,
} from "../client/src/lib/guardian-authorization";

describe("Guardian on-chain authorization", () => {
  it("accepts the configured Guardian account case-insensitively", () => {
    expect(getGuardianAuthorization("MajorMeat1805.testnet", "majormeat1805.testnet")).toBe("guardian-connected");
    expect(canGuardianDecide("testnet", true, "majormeat1805.testnet", "majormeat1805.testnet")).toBe(true);
  });

  it("rejects a different connected wallet", () => {
    expect(getGuardianAuthorization("buyer-bilbond.testnet", "majormeat1805.testnet")).toBe("wrong-wallet");
    expect(canGuardianDecide("testnet", true, "buyer-bilbond.testnet", "majormeat1805.testnet")).toBe(false);
  });

  it("requires a wallet or configured Guardian", () => {
    expect(getGuardianAuthorization(null, "majormeat1805.testnet")).toBe("wallet-required");
    expect(getGuardianAuthorization("buyer-bilbond.testnet", null)).toBe("guardian-not-configured");
    expect(guardianAuthorizationMessage("wrong-wallet")).toBe("Connected wallet is not the configured Guardian.");
  });

  it("never grants production authorization from demo role/source", () => {
    expect(canGuardianDecide("demo-offline", true, "majormeat1805.testnet", "majormeat1805.testnet")).toBe(false);
    expect(canGuardianDecide("database", true, "majormeat1805.testnet", "majormeat1805.testnet")).toBe(false);
    expect(canGuardianDecide("testnet", false, "majormeat1805.testnet", "majormeat1805.testnet")).toBe(false);
  });
});
