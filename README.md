# Bil Bond

Bil Bond is an accountability dashboard for AI and agent work. It combines escrow, provider bonds, auditor verification, human-in-the-loop Guardian review, governance appeals, and on-chain audit trails on NEAR Testnet.

The system turns agent work from a simple trust-based interaction into a workflow with economic guarantees, verifiable settlement rules, and an auditable dispute process.

## Key features

- **Provider bonds** — providers deposit an economic commitment before offering a service.
- **Escrow** — buyer funds are held by the smart contract until the work is verified.
- **Deterministic verification** — auditors evaluate work against the agreed SLA and verification criteria.
- **Guardian queue** — high-risk decisions require human approval; AI cannot slash funds on its own.
- **Appeals and governance** — providers can appeal during the configured appeal window.
- **On-chain auditability** — orders, roles, policy, state transitions, and audit events can be read from the contract.
- **Wallet authorization** — live transactions must be signed by the appropriate `.testnet` wallet.
- **Network safety** — the application is restricted to NEAR Testnet and handles RPC timeouts.

## High-level flow

```text
Provider registration
        │
        ▼
Deposit bond ──► Publish offer
                         │
                         ▼
Buyer locks escrow ──► Provider submits work
                         │
                         ▼
                 Auditor records verdict
                    │              │
                  pass            fail
                    │              ▼
                    │       Guardian review
                    │              │
                    │        Appeal window
                    │              │
                    │       Governance decision
                    │              │
                    └──────┬───────┘
                           ▼
                 Release / Refund / Slash
                           │
                           ▼
                    On-chain audit events
```

## Testnet contract

- **Network:** NEAR Testnet
- **Contract:** [`newbilbondcotract.testnet`](https://testnet.nearblocks.io/address/newbilbondcotract.testnet)
- **Configured roles:**
  - Auditor: `laterice4929.testnet`
  - Guardian: `majormeat1805.testnet`
  - Governance: `governance-bilbond.testnet`
- **Local dashboard:** `http://localhost:3000/` or the port printed by the dev server
- **NEAR Intents:** not used in this Testnet flow; bond and escrow use direct contract calls

All values and transactions above are public on Testnet. Never put a seed phrase or private key in the project.

## Quick start

### Prerequisites

- Node.js `>=20.19`
- `pnpm` `12.3.4` or a compatible version
- Chrome or Brave
- A NEAR wallet that supports Testnet, such as Meteor or Nightly
- A NEAR Testnet account for transactions you want to sign

### Install

```bash
pnpm install
cp .env.example .env
```

Make sure `.env` points to the active contract:

```env
PORT=3000
VITE_BIL_BOND_CONTRACT_ID=newbilbondcotract.testnet
```

`DATABASE_URL` is supplied by the Manus runtime or by a local environment with a database. Never store wallet secrets in `.env`.

### Run the dashboard

```bash
pnpm dev
```

Open [http://localhost:3000/](http://localhost:3000/). Keep the same port because wallet selector sessions are origin-specific.

For local persistence, run migrations and seed data when a database is configured:

```bash
pnpm db:migrate
pnpm db:seed
```

### Validate the project

```bash
pnpm typecheck
pnpm test
pnpm build
```

The test suite covers state transitions, verification, contract mapping, RPC timeout handling, and Guardian authorization.

## Architecture at a glance

```text
React dashboard
  ├─ Wallet Selector / Testnet wallet
  ├─ NEAR RPC read views
  ├─ Signed contract transactions
  └─ Guardian and provider UX guards

Express API + Drizzle
  ├─ Optional transaction indexing
  ├─ Persistence confirmations
  └─ Demo/database fallback

Bond Vault contract (Rust / near-sdk)
  ├─ Provider, offer, bond, and escrow state
  ├─ Auditor, Guardian, and Governance authorization
  ├─ Appeal and settlement state machine
  └─ Append-only audit events
```

In live mode, the smart contract is the source of truth for authorization and state. The role switcher shown in the dashboard is for demo/offline mode only and is not production authorization.

## Detailed documentation

See [`docs/bil-bond-accountability.md`](docs/bil-bond-accountability.md) for:

- escrow and provider bonds,
- slashing and settlement distribution,
- the Guardian role,
- `upheld` and `overturned` appeals,
- provider/agent onboarding,
- `get_roles()` and wallet authorization,
- state transitions and audit events,
- Testnet operations and troubleshooting.

## Appeal status on Testnet

The dashboard does not use the legacy `appeal_resolved` boolean as its only source of truth. Appeal status is derived from order state and audit events:

```text
none | pending | upheld | overturned
```

`appeal_overturned` means governance cancelled the failed verdict. In the tested contract flow, the buyer escrow is refunded and the provider is not slashed. Historical-state compatibility is explained in the [accountability guide](docs/bil-bond-accountability.md).

## Security notes

- Use Testnet accounts only in this environment.
- Never share a seed phrase or private key.
- Selecting a role in the UI does not grant on-chain permission.
- Final authorization is enforced by `env::predecessor_account_id()` in the smart contract.
- Testnet transactions and bond/escrow values are publicly inspectable.
