export const NEAR_NETWORK = "testnet" as const;
export const TESTNET_RPC_URL = "https://test.rpc.fastnear.com";
export const TESTNET_EXPLORER_URL = "https://testnet.nearblocks.io";
export const INTENTS_STATUS = "not_used" as const;

export function assertTestnetAccount(accountId: string): void {
  if (!/^[a-z0-9._-]+\.testnet$/i.test(accountId)) {
    throw new Error("Only NEAR Testnet accounts are allowed in this application.");
  }
}

export function getConfiguredContractId(): string | null {
  const value = import.meta.env.VITE_BIL_BOND_CONTRACT_ID?.trim();
  if (!value) return null;
  if (!/^[a-z0-9._-]+\.testnet$/i.test(value)) {
    throw new Error("VITE_BIL_BOND_CONTRACT_ID must be a .testnet account ID.");
  }
  return value;
}
