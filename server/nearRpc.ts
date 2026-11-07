const TESTNET_RPC_URL = "https://rpc.testnet.near.org";

interface RpcError {
  message?: string;
  data?: unknown;
}

interface TransactionStatusResult {
  transaction?: {
    receiver_id?: string;
    signer_id?: string;
    hash?: string;
  };
  status?: Record<string, unknown>;
  transaction_outcome?: {
    outcome?: {
      status?: Record<string, unknown>;
    };
  };
}

interface RpcResponse {
  result?: TransactionStatusResult;
  error?: RpcError;
}

export interface TransactionVerification {
  success: boolean;
  error?: string;
}

export async function verifyTestnetTransaction(
  txHash: string,
  signerAccountId: string,
  expectedContractId: string,
): Promise<TransactionVerification> {
  if (!signerAccountId.toLowerCase().endsWith(".testnet") || !expectedContractId.toLowerCase().endsWith(".testnet")) {
    return { success: false, error: "Only NEAR Testnet accounts and contracts are accepted." };
  }

  const response = await fetch(TESTNET_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "bil-bond-transaction-check",
      method: "EXPERIMENTAL_tx_status",
      params: [txHash, signerAccountId, "FINAL"],
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    return { success: false, error: `NEAR Testnet RPC returned HTTP ${response.status}.` };
  }

  const payload = await response.json() as RpcResponse;
  if (payload.error) {
    return { success: false, error: payload.error.message ?? "The Testnet RPC could not find the transaction." };
  }

  const result = payload.result;
  if (!result?.transaction) {
    return { success: false, error: "The Testnet RPC response did not include a transaction record." };
  }
  if (result.transaction.receiver_id !== expectedContractId) {
    return { success: false, error: "The transaction receiver does not match the expected Testnet contract." };
  }
  if (result.transaction.signer_id !== signerAccountId) {
    return { success: false, error: "The transaction signer does not match the connected Testnet account." };
  }

  const status = result.status ?? result.transaction_outcome?.outcome?.status ?? {};
  if (!("SuccessValue" in status || "SuccessReceiptId" in status)) {
    return { success: false, error: "The Testnet transaction is not in a successful final state." };
  }

  return { success: true };
}
