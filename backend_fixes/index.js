require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const multer = require('multer');
const path = require('path');

// ==========================================
// SUI SDK SETUP (MODERN V1.x)
// ==========================================
// Pastikan install: npm install @mysten/sui@1.21.1
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Transaction } = require('@mysten/sui/transactions');

// Inisialisasi Sui Client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// Inisialisasi Dompet Admin
let adminKeypair = null;
if (process.env.ADMIN_SECRET_KEY) {
  try {
    adminKeypair = Ed25519Keypair.fromSecretKey(process.env.ADMIN_SECRET_KEY);
    console.log("[SUI] Admin wallet loaded:", adminKeypair.toSuiAddress());
  } catch (e) {
    console.error("[SUI] Gagal memuat Admin Key:", e.message);
  }
}

// ==========================================
// DATABASE & SERVER SETUP
// ==========================================
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const app = express();
const PORT = 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json());

// Log Request
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
// ENDPOINT KESEHATAN
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: "ok", version: "1.2.0-modern", time: new Date() });
});

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
// ENDPOINT LOKASI
// ==========================================
app.get('/api/lokasi', async (req, res) => {
  try {
    const lokasi = await prisma.lokasiWisata.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(lokasi);
  } catch (error) { res.status(500).json({ error: "Gagal ambil data" }); }
});

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

app.post('/api/lokasi', authenticateJWT, async (req, res) => {
  const { nama, kategori, deskripsi, latitude, longitude, foto, fotoUtama, suiAddress } = req.body;
  const finalFoto = fotoUtama || foto;

  try {
    await getOrCreateUser(req.googleUser, suiAddress);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const lokasiBaru = await prisma.lokasiWisata.create({
      data: { 
        nama, kategori, deskripsi, 
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        fotoUtama: finalFoto, 
        suiAddress, 
        isVerified: isAdmin
      }
    });
    res.json(lokasiBaru);
  } catch (error) { res.status(500).json({ error: "Gagal simpan lokasi" }); }
});

app.patch('/api/lokasi/:id', authenticateJWT, adminOnly, async (req, res) => {
  try {
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

// ==========================================
// ENDPOINT SOSIAL & USER
// ==========================================
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

app.post('/api/lokasi/:id/like', authenticateJWT, async (req, res) => {
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

app.post('/api/lokasi/:id/comment', authenticateJWT, async (req, res) => {
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

app.post('/api/checkin', authenticateJWT, async (req, res) => {
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

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { totalCheckIn: 'desc' }, take: 10 });
    res.json(users.map(u => ({ ...u, points: u.totalCheckIn })));
  } catch (error) { res.status(500).json({ error: "Leaderboard fail" }); }
});

// ==========================================
// KLAIM & NOTIFIKASI
// ==========================================
app.post('/api/lokasi/:id/claim', authenticateJWT, async (req, res) => {
  const { suiAddress } = req.body;
  try {
    const user = await getOrCreateUser(req.googleUser, suiAddress);
    const existing = await prisma.claimRequest.findFirst({
      where: { userId: user.id, lokasiId: parseInt(req.params.id), status: 'pending' }
    });
    if (existing) return res.status(400).json({ error: "Klaim sedang diproses" });

    const claim = await prisma.claimRequest.create({
      data: { userId: user.id, lokasiId: parseInt(req.params.id), status: 'pending' }
    });
    res.json(claim);
  } catch (error) { res.status(500).json({ error: "Gagal klaim" }); }
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

app.get('/api/admin/claims', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const claims = await prisma.claimRequest.findMany({
      where: { status: 'pending' },
      include: { user: true, lokasi: true }
    });
    res.json(claims);
  } catch (error) { res.status(500).json({ error: "Gagal ambil daftar klaim" }); }
});

app.patch('/api/admin/claims/:id', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const claim = await prisma.claimRequest.update({
      where: { id: parseInt(req.params.id) },
      data: { status: req.body.status },
      include: { lokasi: true, user: true }
    });
    if (req.body.status === 'approved') {
      await prisma.lokasiWisata.update({
        where: { id: claim.lokasiId },
        data: { ownerId: claim.userId }
      });
    }
    res.json(claim);
  } catch (error) { res.status(500).json({ error: "Gagal update klaim" }); }
});

// ==========================================
// SPONSOR (GAS STATION - MODERN V1.x)
// ==========================================
app.post('/api/sponsor', async (req, res) => {
  const { txBytes, senderAddress } = req.body;
  if (!txBytes || !senderAddress) return res.status(400).json({ error: "Data tidak lengkap" });
  if (!adminKeypair) return res.status(500).json({ error: "Fitur sponsor belum dikonfigurasi (Admin Key)" });

  try {
    // Reconstruct Transaction (V1 Modern)
    const tx = Transaction.from(txBytes);
    tx.setSender(senderAddress);
    tx.setGasOwner(adminKeypair.toSuiAddress());
    
    // Build
    const buildRes = await tx.build({ client: suiClient });
    
    // Sign
    const sponsorSignature = await adminKeypair.signTransaction(buildRes);

    res.json({
      message: "Disponsori!",
      sponsoredTxBytes: Buffer.from(buildRes).toString('base64'),
      sponsorSignature: sponsorSignature.signature
    });
  } catch (error) {
    console.error("Sponsor Error:", error);
    res.status(500).json({ error: "Gagal sponsor: " + error.message });
  }
});

app.use((req, res) => res.status(404).json({ error: "Rute tidak ditemukan" }));

app.listen(PORT, () => console.log(`Backend 1.2.0-modern berjalan di ${PORT}`));
