# Bil Bond Implementation Plan — NEAR Testnet

## Goals and boundaries

Build an **English-language** web MVP that uses a **real Bond Vault/Escrow contract on NEAR Testnet** to deposit bonds, lock escrow, verify approval transitions, and distribute test tokens according to the rules. All source code, identifiers, comments, tests, README, database/API naming, and application copy are written in English; the source PRD remains in Indonesian. The application displays the Testnet network, connected account/contract, and transaction hashes. The self-contained treasury contract is the fallback allowed by the PRD because the NEAR Business API/SDK integration has not been verified.

NEAR Intents has an important limitation: its official FAQ states that there is no Testnet deployment and no plan to provide one. The 1Click integration also requires assets on supported networks, so it is not used for a flow that must remain on Testnet. For this phase, cross-chain NEAR Intents is explicitly labelled **simulated/unavailable**, not treated as a real transaction. The project will not switch to Intents mainnet or send assets with real value without a separate decision and approval. References: [NEAR Intents FAQ](https://docs.near-intents.org/resources/faqs) and [NEAR contract deployment guide](https://docs.near.org/smart-contracts/quickstart).

Contract transactions on Testnet remain publicly visible in an explorer. Therefore, bond and escrow amounts on the Testnet contract are **not private on-chain**. The UI may limit details by demo role, but it must not claim encryption, zero-knowledge proofs, or production confidentiality. Cross-chain Confidential Intents is available through the 1Click API according to the official announcement, but not on NEAR Testnet. Reference: [Confidential Intents](https://www.near.org/blog/announcing-general-availability-of-confidential-intents).

## Product flow and behavior

1. The dashboard displays **NEAR Testnet**, the connected account/contract, wallet status, Testnet bond/escrow values, providers, review cases, and recent transactions.
2. The demo setup registers Agent A (honest) and Agent B (dishonest and cheaper) as real provider accounts on the Testnet contract. Marketplace displays offers, SLA, reputation, and purchase actions. The database seed stores only metadata and demo-labelled display reputation, not Testnet registration or balances. Testnet contract amounts are labelled public, not secret.
3. A provider connects a Testnet account and deposits test tokens into Bond Vault. A buyer selects an active on-chain offer and locks escrow through a Testnet wallet transaction. Every on-chain action requires a user-controlled wallet signature; the application never stores a private key.
4. The provider submits demo work. The auditor runs structured deterministic criteria and produces a verdict/recommendation, reasons/evidence, and confidence. Any on-chain record made on behalf of the auditor must still be signed by the user through the Testnet wallet; a verdict does not itself move funds.
5. The Guardian produces a recommendation from deterministic policy. Slashing cases above 10 test NEAR or with auditor confidence below 80% must include human governance approval; 2-of-3 approval uses the Guardian, auditor, and governance signers. Smaller cases require Guardian and auditor approval. Every on-chain action made on behalf of an auditor or Guardian is still signed by the user through the Testnet wallet.
6. If the work passes, the contract releases escrow to the provider and increases reputation. If it fails, slashing occurs only through the auditor verdict and applicable approvals. Escrow returns to the buyer; the bond result is distributed 70% to the buyer, 20% to the insurance pool, and 10% to the auditor. The auditor share is held until the appeal window ends; if the verdict is overturned, that share moves to the pool and auditor reputation decreases by 20.
7. Provider reputation starts at 0 and is bounded from 0 to 100. Success adds +10 in the demo profile or +2 in the production profile; slashing subtracts 30; an SLA that expires without a result subtracts 10 and opens a buyer refund without automatic slash. Minimum bond ratio (%) = 100 − 0.75 × reputation; a score of 0 requires 100%, while a score of 100 requires 25%.
8. NEAR Intents integration does not send transactions; the UI clearly states the Testnet limitation. A 1Click adapter can be considered later only if the project owner selects mainnet and approves the risk of real assets.

## Implementation design

- **Frontend:** React + TypeScript; responsive dashboard with Overview, Marketplace, Transactions/Detail, Guardian Queue, and Audit Log. The demo role switcher provides Buyer, Provider, Auditor, Guardian, and Governance contexts, but is not production authentication or authorization. A Testnet wallet still signs every role transaction.
- **Contract:** Rust + `near-sdk` for Bond Vault/Escrow. Functions are restricted by role and deterministic state machine: bond deposit, offer activation/deactivation, escrow lock/reservation (`order value × bond ratio`), work result, verdict, approval, release/refund/slash, SLA timeout, appeal, claim limit, reputation, and audit events. The ratio is `100 − 0.75 × reputation`; demo/production reputation changes are +10/+2 per success, −30 per slash, −10 on SLA timeout, and −20 for the auditor after an overturned verdict. Governance controls policy and profile; the AI model never moves funds.
- **Network:** explicit `testnet` configuration for every operation. UI/backend reject non-Testnet chains for the current on-chain features. The approved scope does not use NEAR mainnet, valuable tokens, or NEAR Intents mainnet.
- **Backend/database:** Node.js server for orchestration, validation, indexing/demo snapshots, and export; managed MySQL for providers, offers, criteria, verdicts, decisions, and audit metadata. Blockchain results are verified through Testnet RPC; the contract is the source of truth for on-chain balances and state.
- **Privacy:** data published to the Testnet contract is public. Demo-role UI filtering is not production access control. Do not put secrets or keys in the database or frontend.
- **NEAR Business integration:** not claimed as active. Use the self-contained treasury contract as the PRD fallback until a NEAR Business API/SDK integration is available and verified.
- **Testing:** unit-test all final contract parameters and rules, run sandbox integration tests for deposit/reservation/escrow/release/refund/slash/appeal/SLA/claim cap, then deploy to Testnet only after tests pass and a user-controlled Testnet account is available. Every on-chain action is signed by the user wallet. Never request or store a seed phrase/private key. Removing the full-access key is outside this approval.
- **Toolchain:** check Rust/Cargo, Node/pnpm, and related CLI tools before installation; do not install a machine-wide or global toolchain without specific permission. The contract can be tested in NEAR Sandbox before deployment.

## Proposed project structure

```text
/
├── client/                 # React UI, wallet, pages, components, and styles
├── server/                 # API, validation, RPC orchestration, and audit
├── contracts/bond-vault/   # Rust/near-sdk contract and sandbox tests
├── shared/                 # Types, workflow states, and economic rules
├── drizzle/                # MySQL schema and additive migrations
├── public/                 # Static assets and manus-routes.json
├── tests/                  # UI/API integration tests and audit export tests
├── plan.md                 # This updated implementation plan
├── TODO.md                 # Agreed product outcomes and criteria
└── PRD_Bil_Bond_v0.3.docx  # Current requirements source
```

The final structure follows the actual project directory without overwriting the PRD or Manus metadata.

## Design direction

Three style alternatives were considered: Swiss International editorial control room (probability 0.07), high-contrast neo-brutalist terminal (0.04), and a warm civic ledger with archival paper tones (0.08). The selected direction is **Swiss International editorial control room**, so blockchain status, decisions, and evidence are easy to scan.

- **Core principle:** operational readability; network status and evidence are more prominent than decoration; risky actions explain their impact; Testnet/simulation boundaries are always visible.
- **Color:** charcoal-blue canvas, warm white, teal for verified evidence, amber for review/escalation, and red for failure/slashing.
- **Layout:** a compact operations sidebar, account/network header, and asymmetric content with transaction summaries on the right; avoid uniform card grids.
- **Motifs:** audit-trail lines between stages, status chips labelled by actor/network, and monospace transaction IDs/hashes.
- **Interaction:** deposit, lock, release, refund, and slash actions show impact previews and request a wallet signature for Testnet transactions; audit details can be opened by demo persona.
- **Animation:** 160–220 ms status transitions and brief highlights for new events; no looping animation that obscures transaction status.
- **Typography:** modern sans-serif with tabular numbers; monospace only for hashes, accounts, and event IDs.
- **Brand core:** guarantees that make agent-to-agent work accountable; calm, precise, and auditable.
- **Brand voice:** all CTA and microcopy are in English, for example “Review evidence before deciding.” and “Approve Testnet slashing.”
- **Wordmark/logo:** two interlocking paths surrounding an evidence point, rather than a generic shield icon.
- **Signature color:** verified evidence uses a teal-green tone.

## Approved scope

**A real Bil Bond contract on NEAR Testnet + user-signed wallet transactions + NEAR Intents remains simulated/unavailable + no mainnet or real-value assets.** Target tracks are Agent Economy, AI Security & Defense, and Autonomous Business; Privacy & Private AI is not a target for this version. The economic decisions in Section 9 were approved by the project owner on October 22, 2026. The demo appeal window is 1 minute and the production window is 10 minutes; the target is final slash settlement within 60 seconds after the window closes. While the deployer full-access key exists, its holder can replace the code; removing it is irreversible and requires separate explicit approval. Official NEAR documentation states that Intents 1Click has no Testnet deployment. If real NEAR Intents becomes mandatory later, the target network and risk must be agreed again.

## Official technical references

- NEAR Intents FAQ — states that there is no Testnet deployment and recommends testing on mainnet with a separate account: https://docs.near-intents.org/resources/faqs
- NEAR smart-contract quickstart — creates a Testnet account and covers contract build, testing, and deployment: https://docs.near.org/smart-contracts/quickstart
- NEAR Web3 app quickstart — React, wallet, and contract-call integration: https://docs.near.org/web3-apps/quickstart
- NEAR Wallet Selector core/modal UI — wallet selector configuration with `network: "testnet"`: https://github.com/near/wallet-selector/blob/main/packages/core/README.md and https://raw.githubusercontent.com/near/wallet-selector/main/packages/modal-ui/README.md
- Wallet Selector v10 migration — use `actionCreators.functionCall` with `BigInt` gas/deposit values before `wallet.signAndSendTransaction`: https://github.com/near/wallet-selector/blob/main/MIGRATION-v10.md
- NEAR Confidential Intents announcement — 1Click confidential flow availability does not add a Testnet deployment: https://www.near.org/blog/announcing-general-availability-of-confidential-intents
