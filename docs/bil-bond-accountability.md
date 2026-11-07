# Bil Bond Accountability, Dispute Resolution, and Provider Guide

Dokumen ini menjelaskan cara kerja Bil Bond secara lebih rinci. Bil Bond adalah sistem accountability untuk pekerjaan AI/agent: provider memberikan bond, buyer mengunci pembayaran dalam escrow, auditor memeriksa hasil, Guardian melakukan human review, dan governance menyelesaikan appeal.

> **Environment:** dokumen ini mengacu pada implementasi NEAR Testnet dengan contract `newbilbondcotract.testnet`. Ini bukan spesifikasi untuk mainnet dan bukan nasihat keuangan.

## 1. Model kepercayaan Bil Bond

Bil Bond menggunakan tiga lapisan perlindungan:

1. **Economic commitment:** provider mengunci bond yang dapat berisiko jika kewajiban tidak dipenuhi.
2. **Procedural verification:** auditor menilai pekerjaan berdasarkan kriteria yang disepakati sebelum order dibuat.
3. **Human and governance oversight:** kasus yang memerlukan tindakan ekonomi tidak diselesaikan sepenuhnya oleh AI; Guardian dan, bila diperlukan, governance ikut memutuskan.

Smart contract menjadi sumber kebenaran untuk saldo, status order, role, approval, dan settlement. Dashboard hanya membaca state, mengirim transaksi yang ditandatangani wallet, dan memberikan guard UX.

## 2. Komponen utama

### Buyer

Buyer memilih offer, mengirim dana melalui `lock_escrow`, dan menerima hasil settlement. Buyer tidak langsung mengirim pembayaran kepada provider sebelum proses verifikasi selesai.

### Provider atau agent

Provider adalah akun NEAR yang mendaftarkan diri, menyetor bond, dan menerbitkan offer. Dalam konteks Bil Bond, agent dapat menggunakan wallet yang bertindak sebagai provider.

### Auditor

Auditor mencatat verdict terhadap pekerjaan: passed/failed, confidence, reasons, dan evidence. Auditor tidak boleh menjadi satu-satunya pihak yang memindahkan dana pada kasus yang memerlukan review manusia.

### Guardian

Guardian memeriksa failed verdict dan bukti sebelum jalur slash atau escalation dapat dilanjutkan. Guardian adalah human-in-the-loop, bukan role visual yang dapat diperoleh hanya dengan memilih dropdown.

### Governance

Governance menyelesaikan appeal provider. Governance dapat mempertahankan slash atau membatalkan failed verdict sesuai aturan contract dan evidence.

### Bond Vault contract

Contract Rust menyimpan provider, offer, order, reserved bond, approval, policy, insurance pool, auditor reward/penalty, dan audit event.

## 3. State machine order

Status order yang dipakai contract:

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

Contract juga memiliki `GuardianRejected` untuk jalur ketika keputusan Guardian tidak menyetujui approval yang dibutuhkan.

### Mengapa state guard penting?

Setiap method transaksi hanya menerima status yang sesuai. Ini mencegah:

- appeal kedua pada order yang sudah memiliki appeal aktif,
- resolusi governance sebelum provider mengajukan appeal,
- finalisasi failure ketika appeal window masih terbuka,
- settlement ulang setelah order sudah terminal.

Transaksi NEAR diproses secara serial pada account contract. State mutation dan audit event berada dalam transaksi yang sama sehingga transaksi yang gagal tidak meninggalkan event setengah jadi.

## 4. Escrow dan provider bond

### Provider onboarding state

Provider memiliki field penting:

- `bond` — total bond provider,
- `reserved_bond` — bagian bond yang dicadangkan untuk order aktif,
- `available_bond` — bond yang masih tersedia,
- `reputation`, `successful_orders`, dan `slashed_orders`.

Ketika order dikunci, contract menghitung dan mencadangkan bagian bond yang relevan. Bond yang reserved tidak boleh digunakan seolah-olah masih bebas untuk order lain.

### Escrow

Buyer membuat escrow melalui offer aktif dan specification. Order menyimpan:

- provider dan buyer,
- amount escrow,
- verification criteria,
- SLA duration,
- profile demo/production,
- dan state order.

Escrow tetap berada di contract sampai salah satu jalur settlement yang valid tercapai.

## 5. Mekanisme slashing

Slashing adalah pengurangan bond provider ketika failed work telah memenuhi syarat contract untuk settlement.

### Tahapan slashing

1. Provider sudah terdaftar dan memiliki bond.
2. Buyer mengunci escrow.
3. Provider mengirim hasil melalui `submit_work`.
4. Auditor menjalankan evaluasi dan memanggil `record_verdict`.
5. Failed verdict menempatkan order ke jalur review.
6. Guardian memanggil `guardian_decide`.
7. Appeal window dibuka jika jalur tersebut memenuhi policy.
8. Jika appeal tidak ada atau governance meng-uphold appeal, `finalize_failure` dapat menyelesaikan slash setelah deadline.

Contract menolak finalisasi jika:

- verdict ternyata passed,
- appeal window belum berakhir,
- order tidak berada pada state yang sesuai,
- provider tidak memiliki reserved bond yang cukup,
- atau approval yang diwajibkan belum terpenuhi.

### Distribusi slash

Pada jalur slash yang diuji di contract:

```text
70% → buyer
20% → insurance pool
10% → auditor reward
```

Provider bond dikurangi sebesar `slash_amount`. Reputation provider juga menerima penalty sesuai policy. Nilai threshold, penalty, appeal window, dan minimum bond berasal dari `get_policy()`; jangan menganggap angka demo sebagai parameter universal untuk semua deployment.

### SLA expiry

Contract juga memiliki `refund_after_sla`. Jika SLA berakhir tanpa hasil yang diperlukan, buyer dapat menerima refund sesuai aturan contract. Jalur ini berbeda dari failed verdict slash dan pada implementasi yang diuji tidak menerapkan provider slash yang sama.

## 6. Peran Guardian secara rinci

Guardian menerima kasus ketika hasil auditor membutuhkan keputusan manusia. Guardian membaca:

- confidence score,
- verification criteria,
- evidence,
- alasan auditor,
- nilai escrow dan bond yang terdampak,
- serta kondisi appeal.

Guardian kemudian memilih jalur approval atau rejection. Keputusan tersebut bukan sekadar perubahan UI; transaksi harus ditandatangani wallet Guardian.

### Otorisasi `get_roles()`

Contract menyediakan view method:

```text
get_roles()
```

View tersebut mengembalikan `owner_id`, `auditor_id`, `guardian_id`, dan governance signer. Dashboard membandingkan `guardian_id` dengan account wallet yang sedang terhubung:

```text
connected wallet == roles.guardian_id
```

Status UX yang ditampilkan dashboard:

- `Guardian wallet connected`
- `Connect the configured Guardian wallet to decide.`
- `Connected wallet is not the configured Guardian.`
- `No Guardian is configured on this contract.`

Role switcher hanya untuk demo/offline view. Pada live Testnet, role switcher dinonaktifkan dan tidak pernah digunakan sebagai security check. Contract tetap memvalidasi predecessor account pada setiap transaksi.

### Guardian queue live

Dashboard hanya menampilkan order yang benar-benar menunggu keputusan Guardian:

```text
status == VerdictRecorded
and guardian_approved == false
```

Order pada `AppealWindow` atau `Appealed` tidak dianggap sebagai keputusan Guardian baru; order tersebut berada pada tahap appeal/finalization.

## 7. Penanganan sengketa dan appeal

### 7.1 Failed verdict

Auditor memanggil `record_verdict` dengan `passed = false`, confidence, reasons, dan evidence. Contract menyimpan verdict dan memindahkan order ke jalur yang memerlukan approval.

### 7.2 Guardian approval

Guardian memanggil `guardian_decide(id, approve)`. Jika disetujui, contract mencatat event Guardian dan membuka appeal window berdasarkan profile order dan policy.

Untuk large slash atau escalated case, contract dapat membutuhkan dua approval berbeda termasuk governance. Detail kewajiban ditentukan oleh state dan policy contract, bukan oleh label pada UI.

### 7.3 Provider appeal

Selama appeal deadline belum lewat, provider dapat memanggil:

```text
appeal(id, reason)
```

Contract memastikan bahwa:

- caller adalah provider order,
- order berada pada state appeal yang valid,
- deadline belum lewat,
- appeal belum diselesaikan,
- dan hasil yang sukses tidak diajukan banding sebagai failed result.

### 7.4 Governance resolution

Governance memanggil:

```text
resolve_appeal(id, uphold_slash)
```

#### Appeal upheld

`uphold_slash = true` berarti failed verdict dipertahankan. Contract mencatat `appeal_upheld`, menandai appeal resolved, dan membiarkan order masuk ke final failure settlement setelah syarat deadline/approval terpenuhi.

Hasil yang diharapkan:

```text
failed verdict
→ Guardian approval
→ provider appeal
→ governance upheld
→ final slash/distribution
```

#### Appeal overturned

`uphold_slash = false` berarti governance membatalkan failed verdict. Contract mencatat `appeal_overturned`. Pada alur implementation Testnet yang diuji:

- buyer escrow direfund,
- reserved bond provider dilepas,
- pending 10% auditor share dipindahkan ke insurance pool,
- auditor menerima reversal penalty sesuai policy,
- tidak ada provider slash pada jalur overturn tersebut.

Hasil yang diharapkan:

```text
failed verdict
→ Guardian approval
→ provider appeal
→ governance overturned
→ refund
```

Nama event dan maknanya harus dibaca bersama aturan contract: `appeal_overturned` berarti failed verdict dibatalkan, bukan appeal provider ditolak.

## 8. Appeal status dan audit events

Status appeal yang dipakai view contract dan dashboard adalah:

```text
none | pending | upheld | overturned
```

Dashboard menurunkan status dari urutan audit event:

```text
appeal_submitted → pending
appeal_upheld    → upheld
appeal_overturned→ overturned
```

Audit event bersifat append-only secara logika aplikasi dan memuat sequence, kind, actor, order ID, timestamp, serta details. Event dapat dibaca melalui:

```text
get_audit_events(start, limit)
```

Legacy field `appeal_resolved` masih tersimpan untuk kompatibilitas serialized state pada deployment lama. Consumer baru tidak boleh menjadikannya satu-satunya sumber kebenaran karena historical order dapat memiliki boolean lama yang tidak selaras dengan status/event terminal. Gunakan order status dan event-derived `appeal_status`.

## 9. Cara mendaftarkan agent sebagai provider

### Prasyarat

- Chrome atau Brave dengan wallet NEAR yang mendukung Testnet.
- Akun `.testnet` yang dikontrol pengguna.
- Dashboard berjalan pada origin tetap, misalnya `http://localhost:3000/`.
- Contract Testnet dapat dibaca.
- Tidak ada seed phrase atau private key yang dimasukkan ke aplikasi.

### Langkah dashboard

1. Jalankan dashboard dan buka Marketplace.
2. Klik **Connect wallet**.
3. Pilih wallet yang tersedia dan pastikan jaringan wallet adalah NEAR Testnet.
4. Scroll ke **Provider onboarding**.
5. Klik **Register this wallet as provider**.
6. Review dan sign transaksi `register_provider` di wallet.
7. Setelah state refresh, masukkan jumlah pada **Bond deposit (NEAR)**.
8. Klik **Deposit bond** dan sign transaksi `deposit_bond`.
9. Isi form offer:
   - `Service type`,
   - `Price (NEAR)`,
   - `Maximum order (NEAR)`,
   - `SLA`,
   - `Verification criteria`, satu item per baris.
10. Klik **Publish offer on Testnet** dan sign transaksi `create_offer`.

Contoh criteria:

```text
Include at least three verifiable source URLs.
Cite a source and date for every figure.
Keep the summary consistent with the cited sources.
```

Setelah transaksi terkonfirmasi, offer dibaca dari contract dan dapat dipilih buyer di Marketplace.

### Perhitungan minimum bond

Dashboard menampilkan estimasi minimum bond berdasarkan maximum contract amount, reputation provider, dan policy bond ratio contract. Estimasi UI bukan pengganti validasi contract; contract tetap menjadi pemeriksa akhir.

## 10. Operasi dan konfigurasi lokal

### Environment

Salin template:

```bash
cp .env.example .env
```

Konfigurasi minimum:

```env
PORT=3000
VITE_BIL_BOND_CONTRACT_ID=newbilbondcotract.testnet
```

Aplikasi hanya menerima contract account `.testnet`. `DATABASE_URL` disediakan oleh runtime atau environment database. Jangan menyimpan secret wallet di `.env`.

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

Contract Rust:

```bash
pnpm contract:test
pnpm contract:build
```

### Timeout RPC

Pembacaan RPC dashboard memiliki timeout 8 detik. Jika Testnet RPC menggantung, UI menampilkan error yang dapat dicoba ulang dan tidak mempertahankan loading tanpa batas.

## 11. Contract views dan methods penting

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

Nama argument dan deposit aktual harus mengikuti source contract yang sedang di-deploy. Selalu review transaction payload di wallet sebelum signing.

## 12. Testnet contract dan role saat ini

```text
Network:    NEAR Testnet
Contract:   newbilbondcotract.testnet
Auditor:    laterice4929.testnet
Guardian:   majormeat1805.testnet
Governance: governance-bilbond.testnet
```

Testnet bersifat publik dan dapat berubah. Contract redeploy, migration, role change, atau policy change adalah operasi terpisah yang membutuhkan otorisasi account contract owner.

## 13. Troubleshooting

### Wallet mengarah ke halaman download

Buka dashboard di Chrome atau Brave yang benar-benar memiliki extension Meteor/Nightly aktif. Origin dan port harus sama; `localhost:3000` dan `localhost:5173` dianggap origin berbeda.

### `Connected wallet is not the configured Guardian`

Hubungkan account yang sama dengan `guardian_id` dari `get_roles()`. Memilih role Guardian di UI tidak cukup.

### Contract tidak terbaca

Periksa:

- `VITE_BIL_BOND_CONTRACT_ID`,
- contract account `.testnet`,
- status NEAR Testnet RPC,
- dan apakah contract benar-benar sudah diinisialisasi.

Gunakan tombol **Retry** pada error banner.

### Transaksi tidak dapat ditandatangani

Pastikan wallet account memiliki role yang diperlukan, jaringan wallet adalah Testnet, dan state order masih menerima method tersebut. Smart contract dapat menolak transaksi walaupun tombol sempat aktif sebelum state berubah.

### Dashboard loading terlalu lama

Refresh setelah timeout 8 detik. Jangan mengulang transaksi wallet tanpa memeriksa activity wallet dan transaction hash; request UI yang timeout tidak otomatis berarti transaksi tidak pernah dibuat.

## 14. Batasan dan catatan produksi

- Testnet bukan mainnet dan tidak boleh digunakan sebagai nilai ekonomi nyata.
- NEAR Intents pada environment ini masih simulated/unavailable.
- Role switching demo bukan production authorization.
- Frontend guard bukan security boundary; contract authorization adalah pemeriksaan final.
- Database index bersifat pendukung. State on-chain dan audit events contract adalah sumber kebenaran untuk settlement.
- Historical deployment dapat memiliki serialized legacy fields. Consumer harus memakai derived status dan audit events.
