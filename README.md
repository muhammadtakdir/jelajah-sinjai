# Jelajah Sinjai - Web3 Tourism Platform

Jelajah Sinjai adalah aplikasi pariwisata modern berbasis Web3 yang dibangun untuk Kabupaten Sinjai. Aplikasi ini menggabungkan kemudahan Web2 (Login Google) dengan transparansi blockchain Sui.

## 🚀 Fitur Utama

- **Peta Interaktif (Leaflet):** Eksplorasi destinasi wisata di Sinjai dengan koordinat real-time.
- **Login Google (zkLogin Identity):** Pengalaman login mulus tanpa perlu mengelola seed phrase. Sistem menghasilkan **Sui Address asli** berdasarkan akun Google user.
- **Cekin Pintar (Radius 20m):** User hanya bisa melakukan cekin jika berada dalam radius 20 meter dari lokasi untuk memastikan validitas kunjungan.
- **Upload Foto & Komentar:** Berbagi momen saat cekin atau saat mengusulkan lokasi baru.
- **Leaderboard & Gamification:**
    - **Poin:** 1 Poin per Cekin, 5 Poin per Tambah Lokasi.
    - **Badges:** Check-in Explorer & Location Explorer untuk Top 5 user.
    - **Real-time:** Peringkat dihitung langsung dari aktivitas database.
- **Multi-Bahasa (ID/EN):** Mendukung Bahasa Indonesia dan Bahasa Inggris.
- **Manajemen Lokasi (Dashboard):** Admin dapat memverifikasi usulan lokasi user.

## ⚠️ Persyaratan Backend Database

Pastikan tabel database backend memiliki struktur berikut:

| Tabel | Kolom Penting | Fungsi |
| :--- | :--- | :--- |
| `User` | `suiAddress`, `totalCheckIn` | Identitas & Skor |
| `LokasiWisata` | `suiAddress`, `isVerified`, `fotoUtama` | Kontribusi User |
| `CheckIn` | `userId`, `lokasiId`, `fotoUser`, `komentar` | Riwayat Aktivitas |

## 🔐 Status Web3 (zkLogin)

**1. Menerima Aset (Receive): ✅ BERFUNGSI**
*   Alamat yang muncul di profil (`0x...`) adalah alamat Sui yang valid.
*   Anda **BISA** mengirim token SUI (Testnet) atau NFT ke alamat tersebut.
*   Aset akan tersimpan aman di blockchain Sui di bawah kepemilikan akun Google user tersebut.

**2. Mengirim Aset (Spend/Transact): ⚠️ PERLU UPGRADE**
*   Saat ini aplikasi fokus pada *Read-Only Identity* untuk gamifikasi off-chain (poin database).
*   Untuk melakukan transaksi on-chain (misal: kirim koin keluar), diperlukan integrasi tambahan dengan **Salt Service** dan **Prover Service** (seperti Enoki/Shinami) agar user bisa menandatangani transaksi tanpa ribet.
*   **Penting:** Jangan ubah logika `getSalt` di frontend, atau alamat user akan berubah!

## 🏃 Cara Menjalankan

1. `npm install`
2. `npm run dev`
3. Akses via **HTTPS** untuk fungsionalitas GPS yang optimal.

---
© 2026 Pemerintah Kabupaten Sinjai - Digitalisasi Wisata Sinjai.
Diberdayakan oleh Sui Network.
