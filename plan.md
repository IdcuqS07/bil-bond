# Rencana Implementasi Bil Bond — NEAR Testnet

## Tujuan dan batasan

Membangun MVP web **berbahasa Inggris** yang memakai **kontrak Bond Vault/Escrow nyata pada NEAR Testnet** untuk menyetor bond, mengunci escrow, memverifikasi transisi persetujuan, dan mendistribusikan test token menurut aturan. Semua source code, identifiers, comments, tests, README, database/API naming, dan copy aplikasi ditulis dalam bahasa Inggris; PRD sumber tetap berbahasa Indonesia. Aplikasi menampilkan status jaringan serta transaction hash dari kontrak testnet. Kontrak treasury mandiri menjadi fallback yang memang diizinkan PRD karena integrasi API/SDK NEAR Business belum terverifikasi.

Ada batas material pada NEAR Intents: FAQ resminya menyatakan tidak ada deployment testnet dan tidak ada rencana untuk menyediakannya; integrasi 1Click mengharuskan aset pada jaringan yang didukung, sehingga tidak akan dipakai untuk alur yang harus tetap di testnet. Untuk tahap ini, NEAR Intents cross-chain tetap berupa status yang jelas ditandai **simulasi/tidak aktif**, bukan transaksi nyata. Saya tidak akan beralih ke Intents mainnet atau mengirim aset bernilai tanpa keputusan dan persetujuan terpisah. Referensi: [FAQ NEAR Intents](https://docs.near-intents.org/resources/faqs) dan [panduan deployment kontrak NEAR](https://docs.near.org/smart-contracts/quickstart).

Transaksi kontrak di Testnet tetap terlihat publik pada explorer. Karena itu nominal bond/escrow di kontrak Testnet **tidak rahasia secara on-chain**; UI dapat membatasi detail menurut peran untuk demo, tetapi tidak mengklaim enkripsi, bukti zero-knowledge, atau kerahasiaan produksi. Kerahasiaan lintas-chain Confidential Intents tersedia lewat 1Click API menurut pengumuman resmi, tetapi bukan pada NEAR Testnet. Referensi: [Confidential Intents](https://www.near.org/blog/announcing-general-availability-of-confidential-intents).

## Alur dan perilaku produk

1. Dashboard menampilkan jaringan **NEAR Testnet**, akun/kontrak yang terhubung, status wallet, nilai bond/escrow testnet, provider, kasus review, dan transaksi terbaru.
2. Langkah setup demo mendaftarkan Agen A (jujur) dan Agen B (curang, lebih murah) sebagai akun provider nyata di kontrak Testnet. Marketplace menampilkan penawaran, SLA, reputasi, dan tindakan pembelian. Seed database hanya menyimpan metadata serta reputasi tampilan berlabel demo—bukan registrasi atau saldo Testnet. Nominal kontrak Testnet ditandai publik, bukan rahasia.
3. Provider menghubungkan akun Testnet dan menyetor test token ke Bond Vault. Buyer memilih penawaran on-chain yang aktif lalu mengunci escrow melalui transaksi wallet Testnet. Semua aksi on-chain memerlukan tanda tangan wallet yang dikendalikan pengguna; aplikasi tidak menyimpan private key.
4. Provider mengirim hasil demo. Auditor menjalankan kriteria terstruktur deterministik dan menghasilkan verdict/rekomendasi, alasan/bukti, serta confidence. Setiap pencatatan on-chain atas nama Auditor tetap harus ditandatangani pengguna lewat wallet Testnet melalui pengalih peran demo; verdict tidak memindahkan dana.
5. Guardian menghasilkan rekomendasi berdasarkan kebijakan deterministik. Kasus slashing di atas 10 test NEAR atau confidence Auditor di bawah 80% wajib menyertakan persetujuan governance manusia; 2-dari-3 penanda tangan adalah Guardian, Auditor, dan governance. Kasus kecil cukup Guardian + Auditor. Setiap aksi on-chain atas nama Auditor/Guardian tetap ditandatangani pengguna lewat wallet Testnet melalui pengalih peran demo.
6. Jika lolos, kontrak melepaskan escrow ke provider dan reputasi bertambah. Jika gagal, slashing hanya terjadi melalui verdict Auditor dan persetujuan yang berlaku. Escrow kembali ke buyer; hasil bond dibagi 70% buyer, 20% pool asuransi, 10% Auditor. Bagian Auditor ditahan sampai jendela banding selesai; jika verdict dibatalkan, bagian itu dialihkan ke pool dan reputasi Auditor turun 20.
7. Reputasi provider mulai 0 dan dibatasi 0–100. Sukses menambah +10 pada profil demo atau +2 pada profil produksi; slashing mengurangi 30; SLA yang berakhir tanpa hasil mengurangi 10 dan membuka refund buyer tanpa auto-slash. Rasio bond minimum (%) = 100 − 0,75 × reputasi; skor 0 memerlukan 100%, skor 100 memerlukan 25%.
8. Integrasi NEAR Intents tidak mengirim transaksi; UI menyatakan keterbatasan testnet dengan jelas. Adapter 1Click dapat dipisahkan sebagai tahap selanjutnya hanya jika pemilik proyek memilih mainnet dan menyetujui risiko aset nyata.

## Rancangan implementasi

- **Frontend:** React + TypeScript; dashboard responsif dengan Overview, Marketplace, Transactions/Detail, Guardian Queue, dan Audit Log. Pengalih peran demo menyediakan konteks Buyer, Provider, Auditor, Guardian, dan governance, tetapi tidak dianggap autentikasi/otorisasi produksi. Wallet Testnet tetap menandatangani setiap transaksi peran.
- **Kontrak:** Rust + `near-sdk` untuk Bond Vault/Escrow. Fungsi dibatasi oleh role dan state machine deterministik: deposit bond, offer activation/deactivation, lock escrow/reservasi `order value × bond ratio`, hasil, verdict, approval, release/refund/slash, timeout SLA, appeal, claim limit, reputasi, dan audit event. Rasio adalah `100 − 0,75 × reputation`; reputasi demo/produksi +10/+2 per sukses, −30 per slash, −10 pada SLA timeout, dan Auditor −20 pada verdict batal. Kebijakan dan profil dikendalikan governance; model AI tidak memindahkan dana.
- **Jaringan:** konfigurasi `testnet` eksplisit di semua operasi. UI/backend menolak chain selain Testnet untuk fitur on-chain tahap ini. Tidak memakai NEAR mainnet, token bernilai, atau NEAR Intents mainnet dalam cakupan yang disetujui.
- **Backend/database:** server Node.js untuk orkestrasi, validasi, indexing/snapshot demo dan ekspor; database MySQL terkelola untuk provider, penawaran, kriteria, verdict, keputusan, serta audit metadata. Data hasil blockchain diverifikasi dengan RPC Testnet; kontrak adalah sumber kebenaran untuk saldo/state on-chain.
- **Privasi:** data yang dipublikasikan pada kontrak testnet dianggap publik. Penyaringan UI untuk peran demo tidak dianggap kontrol akses produksi. Jangan menaruh rahasia atau kunci pada database/frontend.
- **Integrasi NEAR Business:** tidak diklaim aktif. Gunakan kontrak treasury mandiri sebagai fallback PRD sampai API/SDK integrasi NEAR Business benar-benar tersedia dan diverifikasi.
- **Pengujian:** unit test seluruh parameter final dan aturan kontrak, sandbox integration test untuk deposit/reservasi/escrow/release/refund/slash/appeal/SLA/claim cap, lalu deployment Testnet hanya setelah tes lulus dan ada akun Testnet yang dikendalikan pengguna. Setiap tindakan on-chain ditandatangani wallet pengguna. Tidak meminta atau menyimpan seed phrase/private key. Penghapusan full-access key tidak termasuk persetujuan ini.
- **Toolchain:** periksa Rust/Cargo, Node/pnpm, dan CLI terkait sebelum instalasi; jangan memasang toolchain mesin/global tanpa izin khusus. Kontrak dapat diuji di NEAR Sandbox sebelum deployment.

## Struktur proyek yang diusulkan

```text
/
├── client/                 # React UI, wallet, halaman, komponen dan gaya
├── server/                 # API, validasi, orkestrasi RPC dan audit
├── contracts/bond-vault/   # Kontrak Rust/near-sdk dan tes sandbox
├── shared/                 # Tipe, status workflow dan aturan ekonomi
├── drizzle/                # Skema MySQL dan migrasi additive
├── public/                 # Aset statis dan manus-routes.json
├── tests/                  # Tes integrasi UI/API dan ekspor audit
├── plan.md                 # Rencana yang diperbarui ini
├── TODO.md                 # Hasil produk dan kriteria yang disepakati
└── PRD_Bil_Bond_v0.3.docx  # Sumber kebutuhan terkini
```

Struktur akhir akan menyesuaikan keadaan direktori project yang sebenarnya tanpa menimpa dokumen PRD atau metadata Manus.

## Arah desain

Tiga alternatif gaya: Swiss International editorial control room (probabilitas 0,07); terminal neo-brutalist berkontras tinggi (0,04); ledger civic hangat dengan nuansa kertas arsip (0,08). Dipilih **Swiss International editorial control room** agar status blockchain, keputusan, dan bukti mudah dipindai.

- **Prinsip inti:** keterbacaan operasional; status jaringan dan bukti lebih menonjol daripada dekorasi; aksi berisiko menjelaskan dampaknya; batas Testnet/simulasi selalu terlihat.
- **Warna:** kanvas arang-biru gelap, putih hangat, teal untuk bukti terverifikasi, amber untuk review/eskalasi, merah untuk kegagalan/slashing.
- **Tata letak:** sidebar operasional ramping, header akun dan jaringan, konten asimetris dengan ringkasan transaksi di sisi kanan; menghindari dashboard kotak-kotak seragam.
- **Motif:** garis jejak audit antartahap, chip status berlabel aktor/jaringan, identitas/hash transaksi monospace.
- **Interaksi:** aksi deposit, lock, release, refund, dan slash memiliki preview dampak serta meminta tanda tangan wallet untuk transaksi Testnet; detail audit dapat dibuka sesuai persona demo.
- **Animasi:** transisi status 160–220 ms dan sorotan singkat untuk event baru; tidak ada animasi berulang yang menyamarkan status transaksi.
- **Tipografi:** sans-serif modern dengan angka tabular; monospace hanya untuk hash, akun, dan event ID.
- **Inti merek:** jaminan yang membuat kerja antar-agen dapat dipertanggungjawabkan; tenang, presisi, dapat diaudit.
- **Suara merek:** seluruh CTA dan microcopy berbahasa Inggris, misalnya “Review evidence before deciding.” dan “Approve Testnet slashing.”
- **Wordmark/logo:** dua lintasan yang saling mengunci mengelilingi titik bukti, bukan ikon perisai generik.
- **Warna khas:** teal-kehijauan untuk bukti yang telah diverifikasi.

## Cakupan yang disetujui

**Kontrak Bil Bond sungguhan pada NEAR Testnet + transaksi wallet yang ditandatangani pengguna + NEAR Intents tetap simulasi/nonaktif + tidak ada mainnet atau aset nyata.** Target track adalah Agent Economy, AI Security & Defense, dan Autonomous Business; Privacy & Private AI bukan target versi ini. Keputusan ekonomi Bagian 9 telah disetujui pemilik proyek pada 22 Oktober 2026. Jendela banding demo 1 menit dan produksi 10 menit; target slash final <60 detik setelah jendela ditutup. Selama deployer full-access key masih ada, pemegangnya dapat mengganti kode; penghapusannya bersifat tidak dapat dibatalkan dan memerlukan persetujuan eksplisit tersendiri. Dokumentasi resmi NEAR menyatakan Intents 1Click tidak memiliki deployment testnet. Jika nanti NEAR Intents sungguhan wajib dipakai, target jaringan dan risiko harus disepakati ulang.


## Referensi teknis resmi

- NEAR Intents FAQ — menyatakan tidak ada deployment testnet dan menyarankan pengujian pada mainnet dengan akun terpisah: https://docs.near-intents.org/resources/faqs
- NEAR smart-contract quickstart — membuat akun Testnet, membangun, menguji, dan men-deploy kontrak: https://docs.near.org/smart-contracts/quickstart
- NEAR Web3 app quickstart — integrasi React, wallet, dan panggilan kontrak: https://docs.near.org/web3-apps/quickstart
- NEAR Wallet Selector core / modal UI — konfigurasi wallet selector `network: "testnet"` dan modal: https://github.com/near/wallet-selector/blob/main/packages/core/README.md dan https://raw.githubusercontent.com/near/wallet-selector/main/packages/modal-ui/README.md
- Wallet Selector v10 migration — gunakan `actionCreators.functionCall` dengan nilai gas/deposit `BigInt` sebelum `wallet.signAndSendTransaction`: https://github.com/near/wallet-selector/blob/main/MIGRATION-v10.md
- NEAR Confidential Intents announcement — ketersediaan 1Click confidential flow tidak menambah deployment Testnet: https://www.near.org/blog/announcing-general-availability-of-confidential-intents
