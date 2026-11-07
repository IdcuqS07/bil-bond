import { afterEach, describe, expect, it, vi } from "vitest";
import { readTestnetView } from "../client/src/lib/nearWallet";

describe("Testnet RPC timeout handling", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aborts a hanging contract read and returns a retryable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      })),
    );

    await expect(
      readTestnetView("newbilbondcotract.testnet", "get_order_count", {}, undefined, 10),
    ).rejects.toThrow("NEAR Testnet RPC request timed out");
  });
});
