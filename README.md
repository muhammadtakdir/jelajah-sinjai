# Jelajah Sinjai - Web3 Tourism Platform

Jelajah Sinjai adalah aplikasi pariwisata modern berbasis Web3 untuk Kabupaten Sinjai. Menggabungkan kemudahan Web2 (Login Google) dengan transparansi blockchain Sui.

## 🚀 Fitur Utama

- **Peta Layar Penuh (Leaflet):** Eksplorasi interaktif dengan penanda (*marker*) kustom sesuai kategori.
- **Dynamic NFT Passport (Sui Dynamic Fields):** 
    - Setiap user mendapatkan NFT Paspor unik saat pertama kali login.
    - **Stempel Digital:** Setiap cekin di lokasi wisata akan menambahkan stempel ke dalam NFT tersebut secara on-chain.
    - **Evolusi Visual:** NFT berubah level dari **Bronze**, **Silver**, hingga **Gold** berdasarkan jumlah stempel yang dikumpulkan.
- **Gasless Experience:** Seluruh biaya transaksi blockchain (Mint NFT, Tambah Stempel, Kirim Aset) disponsori oleh Admin (Sponsor Wallet), sehingga user tidak butuh saldo SUI untuk membayar biaya gas.
- **Audit Trail (Admin History):** Setiap tindakan administratif (persetujuan lokasi, moderasi, hapus) dicatat lengkap dengan nama admin dan alamat wallet untuk transparansi antar tim admin.
- **Live User Tracking:** Lihat posisi GPS Anda secara real-time di peta (pulsing blue dot).
- **Integrasi Social Login via Web3Auth:** User login dengan Google (atau provider lain) dan secara otomatis mendapatkan wallet SUI yang terhubung.
- **Smart Cekin (Radius 20m):** Verifikasi kunjungan berbasis GPS dengan foto dan komentar.
- **Interaksi Sosial:**
    - Like & Diskusi (Komentar/Pertanyaan) di setiap lokasi.
    - Sistem Balasan Komentar (*Nested Replies*).
    - Like pada aktivitas cekin user lain.
- **Sistem Klaim Kepemilikan:** Pemilik usaha (kafe/hotel) dapat mengklaim lokasi mereka untuk verifikasi admin dan mengelola informasi secara mandiri.
- **Smart Add Location:** Fitur deteksi duplikasi nama tempat otomatis sebelum mengusulkan lokasi baru.
- **Leaderboard & Gamification:** Poin aktivitas dan Badge (Check-in Explorer, Location Explorer) untuk user teraktif.
- **Sistem Notifikasi:** Broadcast pengumuman dan event wisata langsung dari Admin ke semua user.
- **Multi-Bahasa (ID/EN):** Dukungan penuh Bahasa Indonesia dan Inggris.

## 🛠️ Tech Stack

- **Frontend:** Next.js 16+, Tailwind CSS 4.0, TanStack Query v5.
- **Web3:** @web3auth/no-modal (Identity), @mysten/sui (SDK).
- **Smart Contracts:** Sui Move (Dynamic Fields & Events).
- **Backend:** Node.js Express + Prisma (PostgreSQL).

## 📜 Smart Contracts (Sui Move)

Kontrak pintar berlokasi di folder `move/passport/`.

### Fitur Kontrak:
- **Paspor Dinamis:** Menggunakan `sui::dynamic_field` untuk menyimpan data stempel tanpa membatasi ukuran objek utama.
- **Threshold Evolusi:**
    - **Bronze:** 0-4 Stempel.
    - **Silver:** 5-14 Stempel (Visual Berubah).
    - **Gold:** 15+ Stempel (Visual Mewah).
- **Events:** Memancarkan `PassportMinted` dan `StampAdded` untuk tracking aktivitas on-chain.

**Package ID (Testnet):** `0x3732134993748c5f3d48edae049f45300444b51fab71a88bde0f82c9e3c45c6e`

## 📋 Konfigurasi Environment (.env.local)

```env
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_TESTNET_URL=https://fullnode.testnet.sui.io:443

# API Backend
NEXT_PUBLIC_API_BASE_URL=https://db.sinjaikab.go.id/wisata/api

# Admin Config (Daftar email & wallet admin dipisahkan koma)
NEXT_PUBLIC_ADMIN_EMAILS=muhammadtakdir@example.com
NEXT_PUBLIC_ADMIN_ADDRESSES=0x...admin_wallet_address

# Google Auth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_id.apps.googleusercontent.com
```

## 🛡️ Keamanan & Moderasi

1.  **Otorisasi Admin:** Endpoint sensitif (Delete, Approve, Hide) di backend dilindungi oleh *Whitelist Alamat SUI* dan Sub ID Google.
2.  **Audit Trail:** Setiap aksi admin dicatat di database aktivitas lengkap dengan Nama Admin dan Alamat Wallet untuk keperluan monitoring internal.
3.  **Filter Konten:** Filter otomatis terhadap kata kasar (*profanity*), iklan judi/spam, dan pesan berulang.
4.  **Moderasi Konten:** Admin dapat menyembunyikan komentar atau cekin yang melanggar etika langsung dari UI.
5.  **Verifikasi Lokasi:** Lokasi baru yang ditambahkan user tidak akan tampil di peta sebelum diverifikasi dan disetujui secara manual oleh admin.
6.  **Verifikasi Klaim:** Kepemilikan tempat harus melalui proses persetujuan manual oleh admin.

## 🔐 Status Web3 (Web3Auth)

- **Wallet Generation:** After social login, Web3Auth provides an Ethereum private key which is deterministically converted to an Ed25519 keypair. The resulting SUI address is used as the user's wallet and stored alongside their profile.
- **Transaksi:** Pengguna menandatangani langsung dengan kunci yang dihasilkan, tanpa memerlukan zk‑proof, ephemeral key, atau prover eksternal. Semua proses top‑up/gasless tetap ditangani oleh backend sponsor seperti sebelumnya.

_(Catatan: repository awal menggunakan zkLogin dan prover, tetapi sistem telah beralih ke Web3Auth untuk menyederhanakan proses dan menghilangkan ketergantungan terhadap layanan ZK. Jika Anda masih mengeksplorasi fitur zkLogin, lihat commit terdahulu atau gunakan branch khusus.)_

## 📂 Persyaratan Database (Prisma)

Gunakan file `backend_fixes/schema.prisma` sebagai acuan struktur tabel. Pastikan field `passportObjectId` pada model `User` tersedia untuk mencatat ID NFT Paspor user.

---
© 2026 Pemerintah Kabupaten Sinjai - Digitalisasi Wisata Sinjai.
Diberdayakan oleh Sui Network.
