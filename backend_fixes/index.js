require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const multer = require('multer');
const path = require('path');

// 1. Membuat folder 'uploads' bisa diakses publik (Static Hosting)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 2. Konfigurasi Multer (Penyimpanan & Penamaan File)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Tujuan folder
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});

// Filter hanya untuk gambar
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar yang diperbolehkan!'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });

// 3. Endpoint Khusus untuk Upload Foto
// NOTE: Frontend sekarang mengirim field 'foto', sesuaikan jika perlu.
app.post('/api/upload', upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Tidak ada file yang diunggah" });
  }
  
  const fileUrl = `https://db.sinjaikab.go.id/wisata/uploads/${req.file.filename}`;
  
  res.json({ 
    message: "Upload berhasil", 
    url: fileUrl 
  });
});

// ==========================================
// ENDPOINT ROOT & LOKASI
// ==========================================
app.get('/', (req, res) => {
  res.json({ message: "API Pariwisata Sinjai Berjalan Lancar!" });
});

app.get('/api/lokasi', async (req, res) => {
  try {
    // FIX: Hapus filter where: { isVerified: true } agar Admin bisa lihat pending
    // Frontend yang akan melakukan filter sendiri
    const lokasi = await prisma.lokasiWisata.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(lokasi);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data lokasi" });
  }
});

app.post('/api/lokasi', async (req, res) => {
  // FIX: Terima fotoUtama, suiAddress, dan isVerified
  const { nama, kategori, deskripsi, latitude, longitude, fotoUtama, suiAddress, isVerified } = req.body;
  try {
    const lokasiBaru = await prisma.lokasiWisata.create({
      data: { 
        nama, 
        kategori, 
        deskripsi, 
        latitude: parseFloat(latitude), 
        longitude: parseFloat(longitude),
        fotoUtama,   // Simpan foto
        suiAddress,  // Simpan pengusul
        isVerified: isVerified === true // Simpan status
      }
    });
    res.json(lokasiBaru);
  } catch (error) {
    console.error("Error saving location:", error);
    res.status(500).json({ error: "Gagal menyimpan lokasi" });
  }
});

// Update lokasi (Edit Full atau Approve/Reject)
app.patch('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  // Ambil semua field yang mungkin diedit
  const { nama, kategori, deskripsi, latitude, longitude, fotoUtama, status } = req.body;
  
  try {
    const dataToUpdate = {};
    if (nama) dataToUpdate.nama = nama;
    if (kategori) dataToUpdate.kategori = kategori;
    if (deskripsi) dataToUpdate.deskripsi = deskripsi;
    if (latitude) dataToUpdate.latitude = parseFloat(latitude);
    if (longitude) dataToUpdate.longitude = parseFloat(longitude);
    if (fotoUtama) dataToUpdate.fotoUtama = fotoUtama;
    if (status !== undefined) dataToUpdate.isVerified = status === 1;

    const updatedLokasi = await prisma.lokasiWisata.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });
    res.json(updatedLokasi);
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ error: "Gagal mengupdate lokasi" });
  }
});

// Hapus lokasi
app.delete('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.lokasiWisata.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: "Lokasi berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ error: "Gagal menghapus lokasi" });
  }
});

// ==========================================
// ENDPOINT USER (Untuk Sui zkLogin)
// ==========================================
app.post('/api/user', async (req, res) => {
  const { suiAddress, nama } = req.body;
  try {
    let user = await prisma.user.findUnique({
      where: { suiAddress: suiAddress }
    });

    if (!user) {
      user = await prisma.user.create({
        data: { suiAddress, nama }
      });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Gagal memproses data user" });
  }
});

// ==========================================
// ENDPOINT CHECK-IN & GAMIFICATION
// ==========================================
app.post('/api/checkin', async (req, res) => {
  // FIX: Terima fotoUser dan komentar
  const { suiAddress, lokasiId, fotoUser, komentar } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const recordCheckIn = await prisma.checkIn.create({
      data: {
        userId: user.id,
        lokasiId: parseInt(lokasiId),
        fotoUser, // Simpan foto user
        komentar  // Simpan komentar
      }
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { totalCheckIn: user.totalCheckIn + 1 }
    });

    res.json({
      message: "Check-in berhasil! NFT/Badge dipicu.",
      record: recordCheckIn,
      totalCheckInSekarang: updatedUser.totalCheckIn
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ error: "Gagal melakukan check-in" });
  }
});

app.get('/api/user/:suiAddress/riwayat', async (req, res) => {
  const { suiAddress } = req.params;
  try {
    const riwayat = await prisma.user.findUnique({
      where: { suiAddress },
      include: {
        checkIns: {
          include: { lokasi: true }
        }
      }
    });
    res.json(riwayat);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil riwayat" });
  }
});

app.listen(PORT, () => {
  console.log(`Server API berjalan di http://localhost:${PORT}`);
});
