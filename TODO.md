# Bil Bond — Product TODO

**Source of truth:** `PRD_Bil_Bond_v0.3.docx`. The PRD remains in Indonesian. Product UI, source code, identifiers, comments, API/database names, tests, and README are in English. NEAR Testnet only; no mainnet or real-value assets. Target tracks: Agent Economy, AI Security & Defense, and Autonomous Business. Privacy & Private AI is not a target track for this version.

**Decision record:** Section 9 policy decisions were approved by the project owner on 22 October 2026, with the demo appeal window changed to 1 minute and production to 10 minutes. Full-access key removal is not approved and remains a separate, irreversible action requiring explicit approval after the exact account/key is known. Do not deploy, delete keys, or initiate on-chain setup transactions without the required user-controlled wallet signature and applicable approval.

## P0 — Testnet contract, marketplace, settlement, and audit

### Contract roles, wallet signatures, and chain state
- [ ] Implement a deployable Rust/near-sdk Bond Vault/Escrow contract on NEAR Testnet with provider, buyer, Auditor, Guardian, and governance roles. Governance controls policy parameters. Every on-chain action by Auditor/Guardian is signed through a user-controlled Testnet wallet using the demo role switcher; the app stores no agent keys.
- [ ] The initial deployer full-access key can replace contract code. Do not claim the no-single-party guarantee is absolute while that key remains. Key removal is irreversible, outside this approval, and requires a separate explicit approval after the exact account/key is known.
- [ ] Testnet contract/RPC state is authoritative for bond, reservations, escrow, settlement, reputation, and transaction hashes. Database snapshots and demo metadata must never be presented as on-chain truth.
- [ ] Reject unauthorized actors, invalid/duplicate transitions, malformed or oversized inputs, same Buyer/Provider account, insufficient available bond, and orders exceeding available unreserved bond.
- [ ] Keep all wallet, RPC, contract IDs, transaction links, and signing flows explicitly on NEAR Testnet. Never request, store, or expose a private key or seed phrase in chat, source, frontend, logs, or database.

### Bond, escrow, appeal, and settlement
- [ ] Provider deposits bond and publishes an offer; the offer can be deactivated by its Provider. Buyer selects an active on-chain offer and locks escrow with provider, order value, SLA, specification, and verification criteria recorded.
- [ ] At escrow lock, reserve `order value × current provider bond ratio`. Only that order’s reservation is slashable. Release the reservation after successful release, refund without slash, or after slashing and any appeal are complete. Reject a new order if active reservations would exceed available bond.
- [ ] On success, release escrow to the Provider and apply the configured reputation increase. On an Auditor verdict followed by the required Guardian/governance approvals, return escrow to Buyer and distribute slash proceeds: 70% Buyer compensation, 20% insurance pool, 10% Auditor share.
- [ ] Hold the Auditor’s 10% share until the appeal window ends. If the verdict is overturned by governance or appeal, forfeit that share to the insurance pool and reduce Auditor reputation by 20 points per overturned verdict. No fixed review fee in the MVP.
- [ ] Demo appeal window is 1 minute; production appeal window is 10 minutes. Keep them as separate parameters. Report slash-finalization time separately before and after the appeal window; target final slash execution is under 60 seconds after the window closes.
- [ ] If the SLA expires without a submitted result, Buyer can claim an escrow refund. Do not slash automatically; reduce Provider reputation by 10 points. Slashing can occur only through the Auditor-verdict and Guardian-approval path.
- [ ] The insurance pool only receives/holds and displays its balance in the MVP. There is no withdrawal operation.

### Approval rules and governance
- [ ] Large slash threshold is **more than 10 test NEAR**; confidence below 80% also triggers escalation.
- [ ] For small cases, Guardian + Auditor approval is sufficient. For a case over threshold or below 80% confidence, approval must include human governance. The 2-of-3 signers are distinct Testnet accounts for Guardian, Auditor, and governance, all controlled by the project owner through the demo role switcher; every transaction still requires a wallet signature.
- [ ] Governance account controls policy parameters. Parameter updates and authorization are recorded in the audit trail. Key deletion remains excluded from this decision record.

### Reputation, bond ratio, demo accounts, and claims
- [ ] Provider reputation starts at **0** and is clamped to **0–100**. Apply **+10 per successful order in the demo profile**, **+2 in the production profile**, **−30 per slash**, and **−10 after an SLA timeout without result**. The demo/production profiles and policy values are governance parameters.
- [ ] Minimum bond ratio is `100 − 0.75 × provider reputation` percent: reputation 0 requires 100%; reputation 100 requires 25%.
- [ ] Register Agent A (honest) and Agent B (dishonest, cheaper) as real Provider accounts in the Testnet contract. Build their reputation histories through wallet-signed Testnet setup orders before the live demo; never hard-code their numeric reputation. Database seed stores metadata/presentation reputation only, is labelled demo, and must not imply Testnet registration or balance.
- [ ] Buyer and Provider must be different accounts. Enforce a maximum of **3 slash claims per Buyer–Provider pair in any 24-hour period**.

### Auditor, verification, and confidentiality limits
- [ ] Auditor evaluates structured, verifiable criteria and emits a repeatable pass/fail verdict, evidence/reason, and confidence. Subjective judgments are out of scope. Treat submitted results/evidence as untrusted, validate structure and size, and resist prompt injection.
- [ ] AI/automation may recommend a verdict but cannot transfer funds, sign on behalf of an agent, or bypass deterministic contract rules.
- [ ] Auditor targets are at least 90% fake-result detection and at most 5% false-positive slashing on an internal evaluation set; report these as unmeasured targets until tested.
- [ ] State the intended display model: parties see their transaction details; authorized Guardian/Auditor/external auditor can inspect authorized history; public reputation may be visible.
- [ ] Clearly disclose that Testnet contract amounts and events are public in explorers. Role-based screens are demo presentation only—not encryption, production authorization, cryptographic privacy, or zero-knowledge. Do not claim production confidentiality or hidden on-chain values.

### NEAR Intents boundary
- [ ] NEAR Intents payment remains simulated/inactive because no Testnet deployment exists. Do not create an Intents transaction, claim a real cross-chain swap/confidential settlement, call Intents mainnet, transfer mainnet assets, or switch networks in this scope.
- [ ] Keep a replaceable adapter boundary for possible future work; do not show it as active until network and integration are verified.

## P1 — Dashboard, governance review, and reports

- [ ] English-language Overview, Marketplace, Transactions/Detail, Guardian Queue, and Audit Log screens. Show Testnet connection, wallet/account, live contract status, providers/offers, reputation, order state, approval queue, decisions, and transaction hashes.
- [ ] Support Buyer, Provider, Auditor, Guardian, governance, and external-auditor demo contexts. Clearly disclose that a demo role switch is not authentication or production authorization.
- [ ] Escalation view shows reason, evidence, confidence, threshold, required human-governance approval, signers, and final result.
- [ ] Export an audit report as CSV containing the reason and actor for every decision. PDF is optional only if it does not destabilize the Testnet demo.
- [ ] Dashboard bond trend uses the approved formula from 100% at reputation 0 to 25% at reputation 100; display actual Testnet history rather than fabricated scores.

## P2 — Appeal submission and future privacy proof

- [ ] Provider can submit an appeal during the configured 1-minute demo or 10-minute production window. Log the appeal and defer final slash/release of the reserved collateral until appeal handling completes.
- [ ] A threshold-sufficient bond assertion without revealing the amount is future work unless a real privacy mechanism is implemented and validated. Otherwise label any range/proof UI as presentation-only; do not claim zero-knowledge.

## Demo, engineering, and release readiness

- [ ] Complete the repeatable demo in under three minutes: show real Testnet Agent A/B accounts and setup-order reputation history; select B and sign escrow lock; label NEAR Intents simulated; submit fake work; show Auditor evidence/confidence; obtain Guardian and, if escalated, human governance signatures; display the 1-minute appeal countdown; after it closes, slash, compensate Buyer, update reputation, show the public transaction hash, compare explorer/audit view, and export CSV.
- [ ] Target slash finalization under 60 seconds **after appeal-window closure**; report time spent before the window closes separately. Report Auditor accuracy/false-positive and latency objectives as targets until measured.
- [ ] Provide a deterministic simulation/backup-recording path for slow RPC or wallet, visually distinct from confirmed Testnet activity.
- [ ] Use the Swiss International editorial control-room style from `plan.md`; risky CTAs disclose their effects and the Testnet/simulation boundary.
- [ ] MySQL persistence uses additive migrations and idempotent demo seeds that do not overwrite user changes on restart. Store provider/offer/criteria/verdict/decision/audit metadata and indexed transaction facts only; chain stays authoritative.
- [ ] Unit/integration tests cover authorization, all state transitions, bond reservation, escrow, release/refund/slash distribution, auditor incentive/overturn, appeal timing, governance requirements, SLA timeout, reputation profiles, claim caps, pool no-withdrawal, and audit export. All tests pass before deployment.
- [ ] Verify no private key/seed phrase in repo, database, frontend, or logs. Prepare an English README, architecture, one-command setup/test steps, and Testnet/privacy limitations. Prepare for public submission but do not publish the repo unless separately requested.
- [ ] No Testnet deployment or demo setup transaction until tests pass and each action is signed by the user-controlled wallet. No mainnet actions.

## Approved Section 9 decision record

Approved by the project owner on **22 October 2026**. All listed parameters may be implemented; full-access key removal remains a separate, irreversible action requiring explicit approval.

1. Auditor’s 10% share is held until the appeal window closes; if a verdict is overturned, the share goes to insurance and Auditor reputation drops by 20; no fixed MVP fee.
2. Escalated cases require a human-governance signer; 2-of-3 Testnet signers are Guardian, Auditor, and governance. Small cases require Guardian + Auditor.
3. Reserve order value × current bond ratio at lock; only that reservation is slashable; release it after release, refund without slash, or slash plus completed appeal; reject over-reserved orders.
4. Large-slash threshold >10 test NEAR; bond ratio `100 − 0.75 × reputation`; reputation changes: demo success +10, production success +2, slash −30. Values are governance parameters.
5. Governance controls parameters. Deployer full-access keys remain during development; key deletion is not approved here and requires separate explicit approval after the exact key/account is known.
6. Provider reputation starts at 0 and is clamped to 0–100; Agent A/B histories come from Testnet setup orders, not hard-coded scores.
7. No result by SLA: Buyer may refund, no automatic slash, Provider reputation −10; slash requires Auditor verdict and Guardian approval.
8. MVP insurance pool holds and displays balance only; no withdrawals.
9. Buyer and Provider must be distinct accounts; maximum 3 slash claims per pair per 24 hours.
10. Appeal window: demo 1 minute, production 10 minutes, separate parameters. The slash-finalization target is <60 seconds after appeal-window closure; elapsed pre-closure time is reported separately.
