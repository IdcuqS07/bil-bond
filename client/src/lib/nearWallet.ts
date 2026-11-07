import {
  actionCreators,
  setupWalletSelector,
  type FinalExecutionOutcome,
  type WalletModuleFactory,
  type ModuleState,
  type WalletSelector,
} from "@near-wallet-selector/core";
import { setupNightly } from "@near-wallet-selector/nightly";
import { assertTestnetAccount, getConfiguredContractId, TESTNET_RPC_URL } from "../../../shared/network";

export type DetectedWallet = "meteor-wallet" | "nightly";

export type ContractMethod =
  | "set_auditor"
  | "set_guardian"
  | "add_governance_signer"
  | "set_policy"
  | "register_provider"
  | "deposit_bond"
  | "create_offer"
  | "deactivate_offer"
  | "lock_escrow"
  | "submit_work"
  | "record_verdict"
  | "guardian_decide"
  | "approve_escalated"
  | "appeal"
  | "resolve_appeal"
  | "finalize_success"
  | "finalize_failure"
  | "withdraw_auditor_rewards";

interface WalletRuntime {
  selector: WalletSelector;
  modules: Map<DetectedWallet, ModuleState>;
}

export interface WalletSnapshot {
  accountId: string | null;
  network: "testnet";
}

export interface ContractCallResult {
  txHash: string | null;
  awaitingWalletReturn: boolean;
  indexed: boolean;
  explorerUrl: string | null;
}

let runtimePromise: Promise<WalletRuntime> | null = null;

function timeoutSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("NEAR Testnet RPC request timed out.", "TimeoutError"));
  }, timeoutMs);
  const abortFromParent = () => controller.abort(parent?.reason);
  parent?.addEventListener("abort", abortFromParent, { once: true });
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

export async function detectWallets(waitMs = 1500): Promise<DetectedWallet[]> {
  const deadline = Date.now() + waitMs;
  do {
    const globals = globalThis as typeof globalThis & { meteorCom?: unknown; nightly?: { near?: unknown } };
    const wallets: DetectedWallet[] = [];
    if (globals.meteorCom) wallets.push("meteor-wallet");
    if (globals.nightly?.near) wallets.push("nightly");
    if (wallets.length > 0 || Date.now() >= deadline) return wallets;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  } while (true);
}

async function getWalletRuntime(): Promise<WalletRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const detected = await detectWallets();
      const walletFactories: WalletModuleFactory[] = [];
      if (detected.includes("meteor-wallet")) {
        const { setupMeteorWallet } = await import("@near-wallet-selector/meteor-wallet");
        walletFactories.push(setupMeteorWallet());
      }
      if (detected.includes("nightly")) walletFactories.push(setupNightly());
      if (walletFactories.length === 0) {
        throw new Error("No supported wallet extension detected. Please open this app in Chrome or Brave with Meteor or Nightly enabled.");
      }
      const selector = await setupWalletSelector({
        network: "testnet",
        optimizeWalletOrder: true,
        debug: true,
        modules: walletFactories,
        languageCode: "en",
      });
      const walletModules = new Map<DetectedWallet, ModuleState>();
      for (const module of selector.store.getState().modules) {
        if (module.id === "meteor-wallet" || module.id === "nightly") walletModules.set(module.id, module);
      }
      return { selector, modules: walletModules };
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise!;
}

function readAccount(selector: WalletSelector): string | null {
  const state = selector.store.getState();
  const account = state.accounts.find((item) => item.active) ?? state.accounts[0];
  if (!account) return null;
  try {
    assertTestnetAccount(account.accountId);
    return account.accountId;
  } catch {
    return null;
  }
}

export async function subscribeToTestnetWallet(
  onChange: (snapshot: WalletSnapshot) => void,
): Promise<() => void> {
  const { selector } = await getWalletRuntime();
  const subscription = selector.store.observable.subscribe(() => {
    onChange({ accountId: readAccount(selector), network: "testnet" });
  });
  onChange({ accountId: readAccount(selector), network: "testnet" });
  return () => subscription.unsubscribe();
}

export async function connectTestnetWallet(provider: DetectedWallet): Promise<void> {
  const { modules } = await getWalletRuntime();
  const module = modules.get(provider);
  if (!module) throw new Error("That wallet extension is no longer available. Click Check again and retry.");
  try {
    const wallet = await module.wallet();
    await wallet.signIn({ contractId: getConfiguredContractId() ?? undefined, methodNames: [] } as never);
    const accounts = await wallet.getAccounts();
    const accountId = accounts[0]?.accountId;
    if (!accountId) throw new Error("The wallet did not return a Testnet account.");
    try {
      assertTestnetAccount(accountId);
    } catch {
      await wallet.signOut().catch(() => undefined);
      throw new Error("Mainnet accounts are not supported here. Switch the wallet extension to a NEAR Testnet account and try again.");
    }
  } catch (error) {
    console.error("[wallet] raw connect error", {
      provider,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function disconnectTestnetWallet(): Promise<void> {
  const { selector } = await getWalletRuntime();
  if (!selector.isSignedIn()) return;
  const wallet = await selector.wallet();
  await wallet.signOut();
}

export async function getConnectedTestnetAccount(): Promise<string> {
  const { selector } = await getWalletRuntime();
  const accountId = readAccount(selector);
  if (!accountId) throw new Error("Connect a NEAR Testnet wallet before signing.");
  assertTestnetAccount(accountId);
  return accountId;
}

export async function callBilBondContract(
  methodName: ContractMethod,
  args: Record<string, unknown> = {},
  depositYocto = "0",
  orderId?: string,
): Promise<ContractCallResult> {
  const { selector } = await getWalletRuntime();
  const contractId = getConfiguredContractId();
  if (!contractId) {
    throw new Error("No Testnet contract is configured. Set VITE_BIL_BOND_CONTRACT_ID to a deployed .testnet account.");
  }
  assertTestnetAccount(contractId);
  const accountId = readAccount(selector);
  if (!accountId) throw new Error("Connect a NEAR Testnet wallet before signing.");
  assertTestnetAccount(accountId);
  if (!/^\d+$/.test(depositYocto)) throw new Error("Attached deposit must be a non-negative yoctoNEAR integer.");

  const wallet = await selector.wallet();
  const outcome = await wallet.signAndSendTransaction({
    signerId: accountId,
    receiverId: contractId,
    actions: [
      actionCreators.functionCall(
        methodName,
        args,
        BigInt("100000000000000"),
        BigInt(depositYocto),
      ),
    ],
  });

  const txHash = (outcome as FinalExecutionOutcome | void | undefined)?.transaction?.hash ?? null;
  if (!txHash) {
    return { txHash: null, awaitingWalletReturn: true, indexed: false, explorerUrl: null };
  }

  let indexed = false;
  try {
    const indexResponse = await fetch("/api/transactions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        txHash,
        signerAccountId: accountId,
        expectedContractId: contractId,
        orderId,
        action: methodName,
      }),
    });
    indexed = indexResponse.ok;
  } catch {
    // A successful on-chain transaction remains successful even if the audit index is offline.
  }

  return {
    txHash,
    awaitingWalletReturn: false,
    indexed,
    explorerUrl: `https://testnet.nearblocks.io/txns/${encodeURIComponent(txHash)}`,
  };
}

export async function readTestnetView<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
  signal?: AbortSignal,
  timeoutMs = 8_000,
): Promise<T> {
  assertTestnetAccount(contractId);
  const encoded = new TextEncoder().encode(JSON.stringify(args));
  let binary = "";
  for (const byte of encoded) binary += String.fromCharCode(byte);
  const argsBase64 = btoa(binary);
  const request = timeoutSignal(signal, timeoutMs);
  try {
    const response = await fetch(TESTNET_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `bil-bond-${methodName}`,
        method: "query",
        params: {
          request_type: "call_function",
          finality: "final",
          account_id: contractId,
          method_name: methodName,
          args_base64: argsBase64,
        },
      }),
    });
    if (!response.ok) throw new Error(`NEAR Testnet RPC returned HTTP ${response.status}.`);
    const payload = await response.json() as {
      result?: { result?: number[] };
      error?: { message?: string };
    };
    if (payload.error) throw new Error(payload.error.message ?? "NEAR Testnet RPC could not read the contract.");
    if (!Array.isArray(payload.result?.result)) throw new Error("The contract view returned no JSON result.");
    const bytes = new Uint8Array(payload.result.result);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch (error) {
    if (request.didTimeout()) {
      throw new Error("NEAR Testnet RPC request timed out. Check the network and retry.");
    }
    throw error;
  } finally {
    request.cleanup();
  }
}

export async function checkTestnetRpc(signal?: AbortSignal): Promise<boolean> {
  const request = timeoutSignal(signal, 8_000);
  try {
    const response = await fetch(TESTNET_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({ jsonrpc: "2.0", id: "bil-bond-testnet-health", method: "status", params: [] }),
    });
    if (!response.ok) return false;
    const payload = await response.json() as { result?: { chain_id?: string } };
    return payload.result?.chain_id === "testnet";
  } catch {
    return false;
  } finally {
    request.cleanup();
  }
}
