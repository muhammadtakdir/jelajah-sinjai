require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const multer = require('multer');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Verbose Log
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`);
  next();
});

// ==========================================
// AUTH & ADMIN UTILS
// ==========================================
const ADMIN_GOOGLE_SUBS = [
  "108894884918420715569", 
  "123456789012345678901"
];

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token diperlukan" });

  const token = authHeader.split(' ')[1];
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    req.googleUser = ticket.getPayload();
    next();
  } catch (error) {
    console.error("[AUTH] Gagal verifikasi:", error.message);
    res.status(403).json({ error: "Token tidak valid" });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.googleUser || !ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub)) {
    return res.status(403).json({ error: "Akses khusus admin" });
  }
  next();
};

async function getOrCreateUser(googleUser, suiAddress) {
  if (!suiAddress) throw new Error("SUI Address is required");
  let user = await prisma.user.findUnique({ where: { suiAddress } });
  if (!user) {
    console.log(`[USER] Membuat user baru: ${suiAddress}`);
    user = await prisma.user.create({
      data: { suiAddress, nama: googleUser.name || "Traveler" }
    });
  }
  return user;
}

// ==========================================
// ENDPOINT UPLOAD
// ==========================================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const fileUrl = `https://db.sinjaikab.go.id/wisata/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// ==========================================
// ENDPOINT LOKASI (FIX: FOTO MAPPING)
// ==========================================
app.get('/api/lokasi', async (req, res) => {
  try {
    // Pastikan fotoUtama terkirim
    const lokasi = await prisma.lokasiWisata.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(lokasi);
  } catch (error) { res.status(500).json({ error: "Gagal ambil data" }); }
});

app.post('/api/lokasi', authenticateJWT, async (req, res) => {
  // Tangkap baik 'foto' maupun 'fotoUtama' dari frontend
  const { nama, kategori, deskripsi, latitude, longitude, foto, fotoUtama, suiAddress } = req.body;
  
  // FIX: Prioritaskan fotoUtama, fallback ke foto
  const finalFoto = fotoUtama || foto;

  try {
    await getOrCreateUser(req.googleUser, suiAddress);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    
    console.log(`[LOKASI] Menyimpan lokasi baru: ${nama} (Verified: ${isAdmin}) Foto: ${finalFoto ? 'Ada' : 'Tidak'}`);

    const lokasiBaru = await prisma.lokasiWisata.create({
      data: { 
        nama, kategori, deskripsi, 
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        fotoUtama: finalFoto, // Pastikan masuk ke kolom yang benar
        suiAddress, 
        isVerified: isAdmin
      }
    });
    res.json(lokasiBaru);
  } catch (error) { 
    console.error("[LOKASI] Error:", error);
    res.status(500).json({ error: "Gagal simpan lokasi" }); 
  }
});

app.patch('/api/lokasi/:id', authenticateJWT, adminOnly, async (req, res) => {
  try {
    // Handle verifikasi status (jika dikirim status: 1)
    const updateData = {};
    if (req.body.status !== undefined) updateData.isVerified = req.body.status === 1;
    if (req.body.nama) updateData.nama = req.body.nama;
    if (req.body.kategori) updateData.kategori = req.body.kategori;
    if (req.body.deskripsi) updateData.deskripsi = req.body.deskripsi;
    if (req.body.foto || req.body.fotoUtama) updateData.fotoUtama = req.body.foto || req.body.fotoUtama;

    const updated = await prisma.lokasiWisata.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });
    res.json(updated);
  } catch (error) { res.status(500).json({ error: "Gagal update lokasi" }); }
});

app.delete('/api/lokasi/:id', authenticateJWT, adminOnly, async (req, res) => {
  try {
    await prisma.lokasiWisata.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: "Dihapus" });
  } catch (error) { res.status(500).json({ error: "Gagal hapus" }); }
});

// Detail Lokasi (tetap sama)
app.get('/api/lokasi/:id', async (req, res) => {
  try {
    const lokasi = await prisma.lokasiWisata.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        _count: { select: { likes: true, comments: true, checkIns: true } },
        likes: { select: { user: { select: { suiAddress: true } } } },
        owner: { select: { nama: true, suiAddress: true } },
        comments: {
          where: { parentId: null, isHidden: false },
          orderBy: { waktu: 'desc' },
          include: { user: { select: { nama: true } }, replies: { where: { isHidden: false }, include: { user: { select: { nama: true } } } } }
        },
        checkIns: {
          where: { isHidden: false }, take: 10, orderBy: { waktu: 'desc' },
          include: { user: { select: { nama: true, suiAddress: true } }, likes: { select: { user: { select: { suiAddress: true } } } }, _count: { select: { likes: true } } }
        }
      }
    });
    if (!lokasi) return res.status(404).json({ error: "Lokasi tidak ditemukan" });
    res.json(lokasi);
  } catch (error) { res.status(500).json({ error: "Gagal ambil detail" }); }
});

// ==========================================
// ADMIN DASHBOARD - KLAIM (FIX: DEBUG)
// ==========================================
app.get('/api/admin/claims', authenticateJWT, adminOnly, async (req, res) => {
  console.log("[ADMIN] Mengambil daftar klaim pending...");
  try {
    // Pastikan kita query ke tabel ClaimRequest, bukan LocationClaim
    const claims = await prisma.claimRequest.findMany({
      where: { status: 'pending' },
      include: { 
        user: { select: { nama: true, suiAddress: true } }, 
        lokasi: { select: { nama: true } } 
      }
    });
    console.log(`[ADMIN] Ditemukan ${claims.length} klaim pending.`);
    res.json(claims);
  } catch (error) { 
    console.error("[ADMIN] Gagal ambil klaim:", error);
    res.status(500).json({ error: "Gagal ambil daftar klaim" }); 
  }
});

app.patch('/api/admin/claims/:id', authenticateJWT, adminOnly, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  console.log(`[ADMIN] Memproses klaim ID ${id} -> ${status}`);
  try {
    const claim = await prisma.claimRequest.update({
      where: { id: parseInt(id) },
      data: { status: status },
      include: { lokasi: true, user: true }
    });
    
    if (status === 'approved') {
      await prisma.lokasiWisata.update({
        where: { id: claim.lokasiId },
        data: { ownerId: claim.userId }
      });
      console.log(`[ADMIN] Kepemilikan lokasi ${claim.lokasi.nama} ditransfer ke ${claim.user.nama}`);
    }
    res.json(claim);
  } catch (error) { 
    console.error("[ADMIN] Gagal proses klaim:", error);
    res.status(500).json({ error: "Gagal update klaim" }); 
  }
});

// ==========================================
// ENDPOINT SOSIAL & NOTIFIKASI
// ==========================================
// (Tetap sama seperti versi sebelumnya)
app.post('/api/user', authenticateJWT, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    res.json(user);
  } catch (error) { res.status(500).json({ error: "Gagal sinkronisasi user" }); }
});

app.get('/api/user/:suiAddress/riwayat', async (req, res) => {
  try {
    const data = await prisma.user.findUnique({
      where: { suiAddress: req.params.suiAddress },
      include: { checkIns: { include: { lokasi: true }, orderBy: { waktu: 'desc' } } }
    });
    if (!data) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json(data);
  } catch (error) { res.status(500).json({ error: "Gagal ambil riwayat" }); }
});

app.post('/api/lokasi/:id/like', authenticateJWT, async (req, res) => { /* ... sama ... */ 
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    const existing = await prisma.locationLike.findUnique({
      where: { userId_lokasiId: { userId: user.id, lokasiId: parseInt(req.params.id) } }
    });
    if (existing) {
      await prisma.locationLike.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.locationLike.create({ data: { userId: user.id, lokasiId: parseInt(req.params.id) } });
      res.json({ liked: true });
    }
  } catch (error) { res.status(500).json({ error: "Gagal Like" }); }
});

app.post('/api/lokasi/:id/comment', authenticateJWT, async (req, res) => { /* ... sama ... */
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    const comment = await prisma.comment.create({
      data: { 
        userId: user.id, 
        lokasiId: parseInt(req.params.id), 
        text: req.body.text, 
        parentId: req.body.parentId ? parseInt(req.body.parentId) : null 
      },
      include: { user: { select: { nama: true } } }
    });
    res.json(comment);
  } catch (error) { res.status(500).json({ error: "Gagal Comment" }); }
});

app.post('/api/checkin', authenticateJWT, async (req, res) => { /* ... sama ... */
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    const record = await prisma.checkIn.create({
      data: { 
        userId: user.id, 
        lokasiId: parseInt(req.body.lokasiId), 
        fotoUser: req.body.fotoUser, 
        komentar: req.body.komentar 
      }
    });
    await prisma.user.update({ where: { id: user.id }, data: { totalCheckIn: { increment: 1 } } });
    res.json(record);
  } catch (error) { res.status(500).json({ error: "Gagal Check-in" }); }
});

app.post('/api/lokasi/:id/claim', authenticateJWT, async (req, res) => {
  const { suiAddress } = req.body;
  try {
    const user = await getOrCreateUser(req.googleUser, suiAddress);
    // Cek apakah sudah ada claim pending untuk lokasi ini dari user ini
    const existing = await prisma.claimRequest.findFirst({
      where: { userId: user.id, lokasiId: parseInt(req.params.id), status: 'pending' }
    });
    
    if (existing) return res.status(400).json({ error: "Klaim sedang diproses" });

    const claim = await prisma.claimRequest.create({
      data: { 
        userId: user.id, 
        lokasiId: parseInt(req.params.id), 
        status: 'pending' 
      }
    });
    console.log(`[CLAIM] Pengajuan baru dari ${user.nama} untuk Lokasi ID ${req.params.id}`);
    res.json(claim);
  } catch (error) { 
    console.error("[CLAIM] Error:", error);
    res.status(500).json({ error: "Gagal klaim" }); 
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const data = await prisma.notification.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (error) { res.status(500).json({ error: "Gagal ambil notifikasi" }); }
});

app.post('/api/notifications', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const notif = await prisma.notification.create({ 
      data: { title: req.body.title, message: req.body.message, type: req.body.type } 
    });
    res.json(notif);
  } catch (error) { res.status(500).json({ error: "Gagal buat notifikasi" }); }
});

app.get('/api/health', (req, res) => {
  res.json({ status: "ok", version: "1.1.4-fixed-photos", time: new Date() });
});

// Handling 404
app.use((req, res) => {
  res.status(404).json({ error: "Rute tidak ditemukan" });
});

app.listen(PORT, () => console.log(`Backend 1.1.4-fixed berjalan di ${PORT}`));
