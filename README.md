# Jelajah Sinjai - Web3 Tourism Platform

Jelajah Sinjai adalah aplikasi pariwisata berbasis Web3 yang dibangun untuk Kabupaten Sinjai. Aplikasi ini memungkinkan pengguna untuk menemukan lokasi wisata, kuliner, dan fasilitas publik melalui peta interaktif, serta melakukan "Check-In" menggunakan wallet digital di jaringan Sui untuk memverifikasi kunjungan mereka.

## 🚀 Fitur Utama

- **Peta Interaktif (Leaflet):** Menampilkan lokasi wisata berdasarkan koordinat real-time.
- **Integrasi Google Login (zkLogin):** Login menggunakan akun Google untuk pengalaman Web2 yang mulus namun tetap berbasis blockchain di belakang layar.
- **Check-In On-Chain:** Verifikasi kehadiran di lokasi wisata dengan foto dan komentar.
- **Kontribusi Komunitas:** Pengguna dapat mengusulkan lokasi baru lengkap dengan foto.
- **Responsive Design:** Tampilan modern berbasis mobile-first menggunakan Tailwind CSS 4.0.

## 🛠️ Tech Stack

- **Framework:** Next.js 15+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4.0
- **Web3 Library:** @mysten/dapp-kit, @mysten/sui
- **State Management:** TanStack React Query v5
- **Map:** React Leaflet & OpenStreetMap

## 📋 Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:
- Node.js (v18 atau lebih baru)
- npm / yarn / pnpm

## ⚙️ Konfigurasi Environment

Buat file `.env.local` di direktori utama dan isi dengan konfigurasi berikut:

```env
# Sui Network Configuration (testnet / mainnet)
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_TESTNET_URL=https://fullnode.testnet.sui.io:443
NEXT_PUBLIC_SUI_MAINNET_URL=https://fullnode.mainnet.sui.io:443

# API Configuration
NEXT_PUBLIC_API_BASE_URL=https://db.sinjaikab.go.id/wisata/api

# Admin Configuration (Daftar alamat wallet yang dianggap admin, pisahkan dengan koma)
NEXT_PUBLIC_ADMIN_ADDRESSES=0x_alamat_admin_1,0x_alamat_admin_2
```

## 🏃 Cara Menjalankan

1. Clone repository:
   ```bash
   git clone https://github.com/muhammadtakdir/jelajah-sinjai.git
   cd jelajah-sinjai
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Jalankan server development:
   ```bash
   npm run dev
   ```

4. Buka [http://localhost:3000](http://localhost:3000) di browser Anda.

## 📂 Struktur Proyek

- `src/app/`: Layout dan halaman utama (App Router).
- `src/components/`: Komponen UI (Navbar, Map, Modal, dsb).
- `src/lib/`: Konfigurasi API, Tipe data, dan Network.
- `src/hooks/`: Custom hooks untuk logika bisnis.

## 🛡️ Panduan Admin (Persetujuan Lokasi)

Untuk mengelola lokasi yang masuk dari user:
1. Alamat wallet Admin harus didaftarkan di `NEXT_PUBLIC_ADMIN_ADDRESSES` pada file `.env`.
2. Saat Admin login, sistem dapat menampilkan dashboard khusus (opsional) atau tombol "Hapus/Edit" pada marker peta.
3. Persetujuan (Approval) dilakukan di sisi Backend API dengan mengubah status lokasi dari `pending` ke `approved`.

---
© 2026 Pemerintah Kabupaten Sinjai - Dinas Pariwisata & Kebudayaan.
Diberdayakan oleh Sui Network.
