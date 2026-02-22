# Jelajah Sinjai - Web3 Tourism Platform

Jelajah Sinjai adalah aplikasi pariwisata modern berbasis Web3 yang dibangun untuk Kabupaten Sinjai. Aplikasi ini menggabungkan kemudahan Web2 (Login Google) dengan transparansi blockchain Sui.

## 🚀 Fitur Utama

- **Peta Interaktif (Leaflet):** Eksplorasi destinasi wisata di Sinjai dengan koordinat real-time.
- **Login Google (zkLogin Identity):** Pengalaman login mulus tanpa perlu mengelola seed phrase. Sistem menghasilkan **Sui Address asli** berdasarkan akun Google user.
- **Cekin Pintar (Radius 20m):** User hanya bisa melakukan cekin jika berada dalam radius 20 meter dari lokasi untuk memastikan validitas kunjungan.
- **Upload Foto & Komentar:** Berbagi momen saat cekin atau saat mengusulkan lokasi baru.
- **Multi-Bahasa (ID/EN):** Mendukung Bahasa Indonesia dan Bahasa Inggris yang dapat diganti di halaman Profil.
- **Manajemen Lokasi (Dashboard):**
    - **User:** Melihat status usulan lokasi (Pending/Disetujui).
    - **Admin:** Verifikasi, setujui, atau hapus usulan lokasi dari user langsung di aplikasi.
- **Navigasi Mobile-First:** Menu melayang di bawah (Home, History, Cekin, Browse, Profile).

## 🛠️ Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Web3:** @mysten/sui/zklogin (Identity Generation)
- **Auth:** @react-oauth/google
- **State:** TanStack React Query v5
- **Map:** React Leaflet & OpenStreetMap

## 📋 Konfigurasi Environment (.env.local)

```env
# Sui Network
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_TESTNET_URL=https://fullnode.testnet.sui.io:443

# API Backend
NEXT_PUBLIC_API_BASE_URL=https://db.sinjaikab.go.id/wisata/api

# Admin Config (Daftar email admin dipisahkan koma)
NEXT_PUBLIC_ADMIN_EMAILS=muhammadtakdir@example.com

# Google Auth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 🔐 Status Web3 (zkLogin & Sui Address)

Aplikasi ini menggunakan konsep **Invisible Blockchain**:
1.  **Address Generation:** Alamat SUI yang muncul di profil adalah **Alamat Asli** yang diturunkan secara deterministik dari JWT Google Anda. Alamat ini **dapat menerima** token/NFT di jaringan Sui.
2.  **Transactions (Send/Mint):** Untuk melakukan transaksi keluar (mengirim token) atau mencetak NFT secara otomatis (Gasless), diperlukan integrasi tambahan dengan **Prover Service** dan **Salt Service** di sisi backend (seperti Enoki atau Shinami) untuk menandatangani transaksi tanpa meminta user mengelola gas.
3.  **Salt Management:** Saat ini menggunakan *deterministic salt* berbasis identitas user untuk konsistensi alamat tanpa database backend.

## 🏃 Cara Menjalankan

1. `npm install`
2. `npm run dev`
3. Akses via **HTTPS** untuk fungsionalitas GPS yang optimal.

---
© 2026 Pemerintah Kabupaten Sinjai - Digitalisasi Wisata Sinjai.
Diberdayakan oleh Sui Network.
