# Bil Bond Vault

A deterministic provider-bond and buyer-escrow contract for **NEAR Testnet**. The contract does not call NEAR Intents, mainnet, external APIs, or AI services. All on-chain amounts and events are public by design; this is not a privacy or zero-knowledge implementation.

## Scope

- Provider registration and payable bond deposits.
- Offers with price, SLA, verification criteria, and maximum contract amount.
- Buyer escrow locks using the exact offer price.
- Provider work submission and one deterministic auditor verdict with confidence and evidence.
- Guardian approval or rejection.
- Ten-minute default appeal window, with provider appeal and human governance resolution.
- Large or low-confidence slashing escalation. The default low-confidence threshold is **80**. Escalated cases require **two of three distinct roles**: guardian, auditor, and one human governance signer.
- Success release to the provider.
- Failed-order refund plus bond split: **70% buyer, 20% insurance pool, 10% auditor**.
- Reputation from 0 to 100 and a deterministic required-bond ratio from 100% at reputation 0 to 25% at reputation 100.
- Public `audit_events` storage and `EVENT_JSON:` logs for every material action.

Money-changing methods only construct transfers after contract state, authorization, approval, and timing checks. An auditor verdict never transfers money by itself, and no AI method exists in this crate.

## Build and test

```bash
cargo test
cargo build --target wasm32-unknown-unknown --release
```

The contract is Testnet-neutral at the code level: NEAR contracts do not select a network in Rust. Deployment and RPC configuration must explicitly target `testnet` outside this crate. Do not put wallet secrets in source, tests, or configuration.

## Known limitations

- NEAR Testnet state and events are public; role-based UI presentation cannot hide explorer-visible balances.
- The insurance pool is tracked as a contract ledger. An administrator withdrawal policy is intentionally not implemented in this scope.
- The auditor's 10% share is accrued in a public ledger and must be withdrawn by the configured auditor; this avoids sending funds as a side effect of an AI/auditor verdict.
- This is deterministic escrow policy, not legal arbitration, production confidentiality, or a real-world service-quality oracle.
