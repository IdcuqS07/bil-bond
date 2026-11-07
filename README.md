# Bil Bond

Bil Bond adalah dashboard accountability untuk pekerjaan AI dan agent yang menggunakan escrow, provider bond, verifikasi auditor, human-in-the-loop Guardian, appeal governance, dan audit trail pada NEAR Testnet.

Sistem ini mengubah pekerjaan agent dari sekadar kepercayaan pada output menjadi alur kerja dengan jaminan ekonomi, aturan settlement yang dapat diverifikasi, dan proses sengketa yang dapat diaudit.

## Fitur utama

- **Provider bond** — provider menyetor jaminan ekonomi sebelum menawarkan layanan.
- **Escrow** — dana buyer ditahan oleh smart contract sampai pekerjaan diverifikasi.
- **Deterministic verification** — auditor mengevaluasi hasil berdasarkan SLA dan verification criteria.
- **Guardian queue** — keputusan berisiko membutuhkan human approval; AI tidak dapat melakukan slash sendirian.
- **Appeal dan governance** — provider dapat mengajukan banding dalam appeal window.
- **On-chain auditability** — order, role, policy, state transition, dan audit event dapat dibaca dari contract.
- **Wallet authorization** — transaksi live harus ditandatangani wallet `.testnet` dengan role yang sesuai.
- **Network safety** — aplikasi membatasi konfigurasi ke NEAR Testnet dan menangani timeout RPC.

## Alur singkat

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
                    Audit events on-chain
```

## Contract Testnet

- **Network:** NEAR Testnet
- **Contract:** [`newbilbondcotract.testnet`](https://testnet.nearblocks.io/address/newbilbondcotract.testnet)
- **Configured roles:**
  - Auditor: `laterice4929.testnet`
  - Guardian: `majormeat1805.testnet`
  - Governance: `governance-bilbond.testnet`
- **Dashboard:** `http://localhost:3000/` saat dijalankan secara lokal
- **NEAR Intents:** simulated/unavailable on Testnet pada konfigurasi ini

Semua nilai dan transaksi di atas bersifat publik di Testnet. Jangan memasukkan seed phrase atau private key ke file proyek.

## Quick start

### Prasyarat

- Node.js `>=20.19`
- `pnpm` `12.3.4` atau kompatibel
- Browser Chrome atau Brave
- Wallet NEAR yang mendukung Testnet, misalnya Meteor atau Nightly
- Akun NEAR Testnet untuk transaksi yang ingin ditandatangani

### Instalasi

```bash
pnpm install
cp .env.example .env
```

Pastikan `.env` menunjuk ke contract yang benar:

```env
PORT=3000
VITE_BIL_BOND_CONTRACT_ID=newbilbondcotract.testnet
```

`DATABASE_URL` disediakan oleh runtime Manus atau environment lokal yang memiliki database. Jangan menyimpan secret wallet di `.env`.

### Menjalankan dashboard

```bash
pnpm dev
```

Buka [http://localhost:3000/](http://localhost:3000/). Pertahankan port yang sama karena wallet selector menyimpan koneksi berdasarkan origin.

Untuk persistence lokal, gunakan migration dan seed sesuai environment database:

```bash
pnpm db:migrate
pnpm db:seed
```

### Validasi proyek

```bash
pnpm typecheck
pnpm test
pnpm build
```

Test suite mencakup state transition, verifikasi, contract mapping, RPC timeout, dan otorisasi Guardian.

## Arsitektur singkat

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
  ├─ Auditor, Guardian, Governance authorization
  ├─ Appeal and settlement state machine
  └─ Append-only audit events
```

Pada mode live, smart contract adalah sumber kebenaran untuk authorization dan state. Role switching yang terlihat di dashboard hanya berlaku untuk demo dan bukan production authorization.

## Dokumentasi detail

Penjelasan mekanisme dan operasi tersedia di [`docs/bil-bond-accountability.md`](docs/bil-bond-accountability.md), termasuk:

- escrow dan provider bond,
- slashing dan distribusi settlement,
- peran Guardian,
- appeal `upheld` dan `overturned`,
- onboarding provider/agent,
- `get_roles()` dan wallet authorization,
- state transition serta audit event,
- troubleshooting Testnet.

## Status appeal pada Testnet

Dashboard tidak menggunakan legacy boolean `appeal_resolved` sebagai satu-satunya sumber status. Status appeal diturunkan dari order state dan audit event menjadi:

```text
none | pending | upheld | overturned
```

`appeal_overturned` berarti governance membatalkan failed verdict. Pada alur contract yang diuji, escrow buyer direfund dan tidak terjadi provider slash. Detail kompatibilitas historical state dijelaskan di [panduan accountability](docs/bil-bond-accountability.md).

## Catatan keamanan

- Gunakan hanya akun Testnet untuk environment ini.
- Jangan membagikan seed phrase atau private key.
- Pemilihan role pada UI tidak memberikan hak on-chain.
- Otorisasi final dilakukan oleh `env::predecessor_account_id()` di smart contract.
- Semua transaksi Testnet dan nilai bond/escrow dapat dilihat publik.
