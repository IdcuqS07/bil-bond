export type GuardianAuthorization =
  | "guardian-connected"
  | "wallet-required"
  | "wrong-wallet"
  | "guardian-not-configured";

export function getGuardianAuthorization(
  walletAccountId: string | null | undefined,
  guardianId: string | null | undefined,
): GuardianAuthorization {
  if (!guardianId) return "guardian-not-configured";
  if (!walletAccountId) return "wallet-required";
  return walletAccountId.toLowerCase() === guardianId.toLowerCase()
    ? "guardian-connected"
    : "wrong-wallet";
}

export function canGuardianDecide(
  source: "testnet" | "demo-offline" | "database" | "database-demo",
  contractReady: boolean,
  walletAccountId: string | null | undefined,
  guardianId: string | null | undefined,
): boolean {
  if (source !== "testnet" || !contractReady) return false;
  return getGuardianAuthorization(walletAccountId, guardianId) === "guardian-connected";
}

export function guardianAuthorizationMessage(status: GuardianAuthorization): string {
  switch (status) {
    case "guardian-connected":
      return "Guardian wallet connected. Contract signature required.";
    case "wallet-required":
      return "Connect the configured Guardian wallet to decide.";
    case "wrong-wallet":
      return "Connected wallet is not the configured Guardian.";
    case "guardian-not-configured":
      return "No Guardian is configured on this contract.";
  }
}
