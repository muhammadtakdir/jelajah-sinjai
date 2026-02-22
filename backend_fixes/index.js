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

// Ambil detail lokasi beserta 5 check-in terakhir dan data sosial
app.get('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lokasi = await prisma.lokasiWisata.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { likes: true, comments: true, checkIns: true }
        },
        likes: { select: { userId: true, user: { select: { suiAddress: true } } } },
        comments: {
          take: 10,
          orderBy: { waktu: 'desc' },
          include: { user: { select: { nama: true } } }
        },
        checkIns: {
          take: 5,
          orderBy: { waktu: 'desc' },
          include: {
            user: { select: { nama: true, suiAddress: true } },
            likes: { select: { userId: true, user: { select: { suiAddress: true } } } },
            _count: { select: { likes: true } }
          }
        }
      }
    });
    if (!lokasi) return res.status(404).json({ error: "Lokasi tidak ditemukan" });
    res.json(lokasi);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil detail lokasi" });
  }
});

// Like/Unlike Lokasi
app.post('/api/lokasi/:id/like', async (req, res) => {
  const { id } = req.params;
  const { suiAddress } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const existingLike = await prisma.locationLike.findUnique({
      where: { userId_lokasiId: { userId: user.id, lokasiId: parseInt(id) } }
    });

    if (existingLike) {
      await prisma.locationLike.delete({ where: { id: existingLike.id } });
      return res.json({ message: "Like dihapus", liked: false });
    } else {
      await prisma.locationLike.create({
        data: { userId: user.id, lokasiId: parseInt(id) }
      });
      return res.json({ message: "Like ditambahkan", liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Gagal memproses like" });
  }
});

// Komentar Lokasi
app.post('/api/lokasi/:id/comment', async (req, res) => {
  const { id } = req.params;
  const { suiAddress, text } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const comment = await prisma.comment.create({
      data: {
        userId: user.id,
        lokasiId: parseInt(id),
        text: text
      },
      include: { user: { select: { nama: true } } }
    });
    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengirim komentar" });
  }
});

// Like/Unlike CheckIn
app.post('/api/checkin/:id/like', async (req, res) => {
  const { id } = req.params;
  const { suiAddress } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

    const existingLike = await prisma.checkInLike.findUnique({
      where: { userId_checkInId: { userId: user.id, checkInId: parseInt(id) } }
    });

    if (existingLike) {
      await prisma.checkInLike.delete({ where: { id: existingLike.id } });
      return res.json({ message: "Like dihapus", liked: false });
    } else {
      await prisma.checkInLike.create({
        data: { userId: user.id, checkInId: parseInt(id) }
      });
      return res.json({ message: "Like ditambahkan", liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Gagal memproses like checkin" });
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

// Endpoint Leaderboard (Top 10 User)
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Ambil user dengan check-in terbanyak (sebagai proxy poin aktivitas)
    // Idealnya, kita hitung juga jumlah lokasi yang ditambahkan (perlu relation)
    // Karena LokasiWisata menyimpan suiAddress (string) bukan relation, kita group by suiAddress dulu untuk lokasi
    
    const users = await prisma.user.findMany({
      orderBy: { totalCheckIn: 'desc' },
      take: 20 // Ambil 20 dulu untuk di-merge
    });

    const locations = await prisma.lokasiWisata.findMany({
      select: { suiAddress: true, isVerified: true }
    });

    // Hitung kontribusi lokasi per user
    const locationCounts = {};
    locations.forEach(loc => {
      if (loc.suiAddress && loc.isVerified) {
        locationCounts[loc.suiAddress] = (locationCounts[loc.suiAddress] || 0) + 1;
      }
    });

    // Gabungkan poin (1 CheckIn = 1 Poin, 1 Lokasi = 5 Poin - Bonus lebih besar untuk kontributor)
    const leaderboard = users.map(u => {
      const locCount = locationCounts[u.suiAddress] || 0;
      const points = u.totalCheckIn + (locCount * 5); // Bobot lokasi lebih tinggi
      return {
        ...u,
        locationCount: locCount,
        points: points
      };
    }).sort((a, b) => b.points - a.points).slice(0, 10);

    res.json(leaderboard);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Gagal mengambil leaderboard" });
  }
});

app.listen(PORT, () => {
  console.log(`Server API berjalan di http://localhost:${PORT}`);
});
