# Bil Bond Accountability, Dispute Resolution, and Provider Guide

This document explains how Bil Bond works in detail. Bil Bond is an accountability system for AI and agent work: providers deposit a bond, buyers lock payment in escrow, auditors evaluate the result, Guardians perform human review, and governance resolves appeals.

> **Environment:** This guide describes the NEAR Testnet deployment using `newbilbondcotract.testnet`. It is not a mainnet specification and is not financial advice.

## 1. Bil Bond's trust model

Bil Bond uses three layers of protection:

1. **Economic commitment:** the provider locks a bond that can be put at risk if obligations are not met.
2. **Procedural verification:** an auditor evaluates the work against criteria agreed before the order is created.
3. **Human and governance oversight:** economically significant cases are not resolved entirely by AI; a Guardian and, when required, governance participate in the decision.

The smart contract is the source of truth for balances, order status, roles, approvals, and settlement. The dashboard reads state, submits wallet-signed transactions, and provides UX guards.

## 2. Main components

### Buyer

The buyer selects an offer, locks funds through `lock_escrow`, and receives the final settlement. The buyer does not pay the provider directly before verification is complete.

### Provider or agent

A provider is a NEAR account that registers, deposits a bond, and publishes an offer. In Bil Bond, an agent can use a wallet that acts as the provider account.

### Auditor

The auditor records a verdict for the work: passed/failed, confidence, reasons, and evidence. The auditor should not be the only party able to move funds in a case that requires human review.

### Guardian

The Guardian reviews a failed verdict and its evidence before a slash or escalation path can continue. Guardian is a human-in-the-loop role, not a visual role that can be obtained by selecting a dropdown.

### Governance

Governance resolves provider appeals. Governance can uphold the slash or overturn the failed verdict according to the contract rules and evidence.

### Bond Vault contract

The Rust contract stores providers, offers, orders, reserved bonds, approvals, policy, the insurance pool, auditor rewards/penalties, and audit events.

## 3. Order state machine

The contract uses these order statuses:

```text
EscrowLocked
    ↓
WorkSubmitted
    ↓
VerdictRecorded
    ├─ passing verdict ───────► Released
    └─ failed verdict ────────► AppealWindow
                                   ├─ no appeal ─────► final failure settlement
                                   └─ provider appeal ► Appealed
                                                        ├─ upheld ─────► final failure settlement
                                                        └─ overturned ─► Refunded
```

The contract also has `GuardianRejected` for a path where the required Guardian approval is not granted.

### Why state guards matter

Each transaction method accepts only the appropriate order state. This prevents:

- a second appeal on an order that already has an active appeal,
- governance resolution before a provider submits an appeal,
- failure finalization while the appeal window is still open,
- and repeated settlement after an order reaches a terminal state.

NEAR transactions are serialized at the contract account. State mutations and audit events are part of the same transaction, so a failed transaction does not leave a partial event behind.

## 4. Escrow and provider bonds

### Provider bond state

A provider has important fields including:

- `bond` — the provider's total bond,
- `reserved_bond` — the portion reserved for active orders,
- `available_bond` — the bond still available,
- `reputation`, `successful_orders`, and `slashed_orders`.

When an order is locked, the contract calculates and reserves the relevant bond amount. Reserved bond cannot be reused as if it were available for another order.

### Escrow

The buyer creates an escrow through an active offer and a specification. The order stores:

- provider and buyer,
- escrow amount,
- verification criteria,
- SLA duration,
- demo/production profile,
- and order state.

Escrow remains in the contract until a valid settlement path is reached.

## 5. How slashing works

Slashing reduces a provider's bond when a failed-work decision has satisfied the contract requirements for settlement.

### Slashing steps

1. The provider is registered and has a bond.
2. The buyer locks escrow.
3. The provider submits work through `submit_work`.
4. The auditor evaluates it and calls `record_verdict`.
5. A failed verdict enters the review path.
6. The Guardian calls `guardian_decide`.
7. An appeal window opens when the policy and state require it.
8. If there is no appeal, or governance upholds the appeal decision, `finalize_failure` can complete the slash after the deadline and approval requirements are satisfied.

The contract rejects finalization when:

- the verdict passed,
- the appeal window has not ended,
- the order is not in the appropriate state,
- the provider does not have enough reserved bond,
- or a required approval is missing.

### Slash distribution

The tested slash path uses this distribution:

```text
70% → buyer
20% → insurance pool
10% → auditor reward
```

The provider's bond is reduced by `slash_amount`. Provider reputation also receives a policy-defined penalty. Thresholds, penalties, appeal windows, and minimum bond ratios come from `get_policy()`; demo values should not be treated as universal parameters for every deployment.

### SLA expiry

The contract also provides `refund_after_sla`. If the SLA expires without the required result, the buyer may receive a refund according to contract rules. This is separate from failed-verdict slashing and, in the tested implementation, does not apply the same provider slash.

## 6. The Guardian role in detail

The Guardian receives cases when an auditor result needs human judgment. The Guardian reviews:

- confidence score,
- verification criteria,
- evidence,
- auditor reasoning,
- affected escrow and bond value,
- and appeal conditions.

The Guardian chooses an approval or rejection path. This is not only a UI change; the transaction must be signed by the configured Guardian wallet.

### `get_roles()` authorization

The contract exposes this view method:

```text
get_roles()
```

It returns `owner_id`, `auditor_id`, `guardian_id`, and the governance signer. The dashboard compares the configured `guardian_id` with the connected wallet account:

```text
connected wallet == roles.guardian_id
```

The dashboard shows these UX states:

- `Guardian wallet connected`
- `Connect the configured Guardian wallet to decide.`
- `Connected wallet is not the configured Guardian.`
- `No Guardian is configured on this contract.`

The role switcher is only for demo/offline mode. In live Testnet mode it is disabled and never used as a security check. The contract still validates the predecessor account on every transaction.

### Live Guardian queue

The dashboard displays only orders that are actually waiting for a Guardian decision:

```text
status == VerdictRecorded
and guardian_approved == false
```

Orders in `AppealWindow` or `Appealed` are not treated as new Guardian decisions; they are in the appeal/finalization stage.

## 7. Dispute and appeal handling

### 7.1 Failed verdict

The auditor calls `record_verdict` with `passed = false`, confidence, reasons, and evidence. The contract stores the verdict and moves the order into the approval path.

### 7.2 Guardian approval

The Guardian calls `guardian_decide(id, approve)`. If approved, the contract records the Guardian event and opens an appeal window based on the order profile and policy.

For a large slash or escalated case, the contract may require two distinct approvals, including governance. The exact requirement comes from the contract state and policy, not from a UI label.

### 7.3 Provider appeal

While the appeal deadline is open, the provider can call:

```text
appeal(id, reason)
```

The contract verifies that:

- the caller is the order provider,
- the order is in a valid appeal state,
- the deadline has not passed,
- the appeal has not already been resolved,
- and a successful result is not being appealed as a failed result.

### 7.4 Governance resolution

Governance calls:

```text
resolve_appeal(id, uphold_slash)
```

#### Appeal upheld

`uphold_slash = true` means the failed verdict is maintained. The contract records `appeal_upheld`, marks the appeal resolved, and lets the order enter final failure settlement once the deadline and approval requirements are satisfied.

Expected flow:

```text
failed verdict
→ Guardian approval
→ provider appeal
→ governance upheld
→ final slash/distribution
```

#### Appeal overturned

`uphold_slash = false` means governance cancels the failed verdict. The contract records `appeal_overturned`. In the tested Testnet flow:

- the buyer escrow is refunded,
- the provider's reserved bond is released,
- the pending 10% auditor share is moved to the insurance pool,
- the auditor receives the policy-defined reversal penalty,
- and the provider is not slashed on this overturn path.

Expected flow:

```text
failed verdict
→ Guardian approval
→ provider appeal
→ governance overturned
→ refund
```

The event name and its contract semantics must be read together: `appeal_overturned` means the failed verdict was cancelled, not that the provider's appeal was rejected.

## 8. Appeal status and audit events

The appeal statuses exposed by the contract and dashboard are:

```text
none | pending | upheld | overturned
```

The dashboard derives status from the ordered audit events:

```text
appeal_submitted  → pending
appeal_upheld     → upheld
appeal_overturned → overturned
```

Audit events are logically append-only and contain a sequence, kind, actor, order ID, timestamp, and details. They can be read through:

```text
get_audit_events(start, limit)
```

The legacy `appeal_resolved` field remains serialized for compatibility with older deployments. New consumers must not use it as the only source of truth because a historical order can contain an old boolean that no longer matches its terminal state or events. Use the order status and event-derived `appeal_status`.

## 9. Registering an agent as a provider

### Prerequisites

- Chrome or Brave with a NEAR Testnet wallet.
- A `.testnet` account controlled by the user.
- The dashboard running on a stable origin such as `http://localhost:3000/`.
- A readable Testnet contract.
- No seed phrase or private key entered into the application.

### Dashboard steps

1. Run the dashboard and open Marketplace.
2. Click **Connect wallet**.
3. Select an available wallet and confirm it is on NEAR Testnet.
4. Scroll to **Provider onboarding**.
5. Click **Register this wallet as provider**.
6. Review and sign `register_provider` in the wallet.
7. After the state refreshes, enter an amount under **Bond deposit (NEAR)**.
8. Click **Deposit bond** and sign `deposit_bond`.
9. Complete the offer form:
   - `Service type`,
   - `Price (NEAR)`,
   - `Maximum order (NEAR)`,
   - `SLA`,
   - `Verification criteria`, one item per line.
10. Click **Publish offer on Testnet** and sign `create_offer`.

Example criteria:

```text
Include at least three verifiable source URLs.
Cite a source and date for every figure.
Keep the summary consistent with the cited sources.
```

After confirmation, the offer is read from the contract and becomes available to buyers in Marketplace.

### Minimum bond calculation

The dashboard shows an estimated minimum bond based on the maximum contract amount, provider reputation, and the contract's bond ratio policy. The UI estimate is not a replacement for contract validation; the contract remains the final authority.

## 10. Local operations and configuration

### Environment

Copy the template:

```bash
cp .env.example .env
```

Minimum configuration:

```env
PORT=3000
VITE_BIL_BOND_CONTRACT_ID=newbilbondcotract.testnet
```

`DATABASE_URL` is supplied by the runtime or by a database-enabled local environment. Never store wallet secrets in `.env`.

### Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed
```

Rust contract commands:

```bash
pnpm contract:test
pnpm contract:build
```

### RPC timeout handling

Dashboard RPC reads have an 8-second timeout. If the Testnet RPC hangs, the UI displays a retryable error instead of keeping the loading state indefinitely.

## 11. Important contract views and methods

### Read views

```text
get_roles()
get_policy()
get_providers(start, limit)
get_offers(start, limit)
get_orders(start, limit)
get_audit_events(start, limit)
get_insurance_pool()
get_order(id)
```

### Provider and offer transactions

```text
register_provider()
deposit_bond()
create_offer(...)
deactivate_offer(id)
```

### Order and dispute transactions

```text
lock_escrow(offer_id, specification)
submit_work(id, result)
record_verdict(id, passed, confidence, reasons, evidence)
guardian_decide(id, approve)
appeal(id, reason)
resolve_appeal(id, uphold_slash)
finalize_success(id)
finalize_failure(id)
refund_after_sla(id)
```

Method arguments and deposits must match the source contract currently deployed. Always review the transaction payload in the wallet before signing.

## 12. Current Testnet contract and roles

```text
Network:    NEAR Testnet
Contract:   newbilbondcotract.testnet
Auditor:    laterice4929.testnet
Guardian:   majormeat1805.testnet
Governance: governance-bilbond.testnet
```

Testnet is public and can change. Contract redeployment, migration, role changes, and policy changes are separate operations requiring authorization from the contract owner.

## 13. Troubleshooting

### The wallet opens a download page

Open the dashboard in Chrome or Brave where the Meteor/Nightly extension is actually enabled. The origin and port must match; `localhost:3000` and `localhost:5173` are different origins.

### `Connected wallet is not the configured Guardian`

Connect the account returned as `guardian_id` by `get_roles()`. Selecting Guardian in the UI is not sufficient.

### The contract cannot be read

Check:

- `VITE_BIL_BOND_CONTRACT_ID`,
- that the contract is a `.testnet` account,
- NEAR Testnet RPC status,
- and whether the contract has been initialized.

Use the **Retry** button in the error banner.

### A transaction cannot be signed

Confirm that the connected wallet has the required role, that the wallet is on Testnet, and that the order state still accepts the method. The smart contract may reject a transaction even if a button was enabled before another state update.

### The dashboard keeps loading

Retry after the 8-second timeout. Do not repeat a wallet transaction without checking wallet activity and the transaction hash; a UI timeout does not automatically mean that no transaction was created.

## 14. Limitations and production notes

- Testnet is not mainnet and must not be treated as real economic value.
- NEAR Intents is not used in this Testnet flow. Bil Bond bond and escrow operations use direct wallet-signed calls to the Bond Vault contract; their values and events are public on-chain.
- Demo role switching is not production authorization.
- Frontend guards are not a security boundary; contract authorization is the final check.
- The database index is auxiliary. On-chain contract state and audit events are the source of truth for settlement.
- Historical deployments may contain serialized legacy fields. Consumers should use derived status and audit events.
