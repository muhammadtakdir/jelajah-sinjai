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

// ==========================================
// KONFIGURASI KEAMANAN ADMIN
// ==========================================
// DAFTARKAN ALAMAT SUI ADMIN DI SINI
const ADMIN_SUI_ADDRESSES = [
  "0x43a6446695f76a829d7e81d94b24e25066c0a61cad240477f872c71556e97c85", 
  "0x0062c0b4e3cef634b32f274a146ef026d6b7e8568fa59f627277f86fb1b99bb7"
];

const validateAdmin = (suiAddress) => {
  if (!suiAddress) return false;
  return ADMIN_SUI_ADDRESSES.includes(suiAddress.toLowerCase());
};

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
// ENDPOINT LOKASI (Publik bisa akses GET)
// ==========================================
app.get('/api/lokasi', async (req, res) => {
  try {
    const lokasi = await prisma.lokasiWisata.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(lokasi);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil data" });
  }
});

app.get('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const lokasi = await prisma.lokasiWisata.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: { select: { likes: true, comments: true, checkIns: true } },
        likes: { select: { user: { select: { suiAddress: true } } } },
        owner: { select: { nama: true, suiAddress: true } },
        comments: {
          where: { parentId: null, isHidden: false },
          orderBy: { waktu: 'desc' },
          include: { 
            user: { select: { nama: true } },
            replies: { where: { isHidden: false }, include: { user: { select: { nama: true } } } }
          }
        },
        checkIns: {
          where: { isHidden: false },
          take: 10,
          orderBy: { waktu: 'desc' },
          include: {
            user: { select: { nama: true, suiAddress: true } },
            likes: { select: { user: { select: { suiAddress: true } } } },
            _count: { select: { likes: true } }
          }
        }
      }
    });
    res.json(lokasi);
  } catch (error) {
    res.status(500).json({ error: "Gagal" });
  }
});

app.post('/api/lokasi', async (req, res) => {
  const { nama, kategori, deskripsi, latitude, longitude, fotoUtama, suiAddress, isVerified } = req.body;
  try {
    const lokasiBaru = await prisma.lokasiWisata.create({
      data: { 
        nama, kategori, deskripsi, 
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        fotoUtama, suiAddress, isVerified: isVerified === true 
      }
    });
    res.json(lokasiBaru);
  } catch (error) {
    res.status(500).json({ error: "Gagal simpan" });
  }
});

app.patch('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  const { nama, kategori, deskripsi, latitude, longitude, fotoUtama, status, adminAddress } = req.body;
  
  if (!validateAdmin(adminAddress)) return res.status(403).json({ error: "Unauthorized" });

  try {
    const updated = await prisma.lokasiWisata.update({
      where: { id: parseInt(id) },
      data: { 
        nama, kategori, deskripsi, 
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        fotoUtama,
        isVerified: status !== undefined ? status === 1 : undefined
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Gagal update" });
  }
});

app.delete('/api/lokasi/:id', async (req, res) => {
  const { id } = req.params;
  const { adminAddress } = req.body;
  if (!validateAdmin(adminAddress)) return res.status(403).json({ error: "Unauthorized" });
  try {
    await prisma.lokasiWisata.delete({ where: { id: parseInt(id) } });
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Gagal hapus" });
  }
});

// ==========================================
// ENDPOINT SOSIAL & INTERAKSI
// ==========================================
app.post('/api/user', async (req, res) => {
  const { suiAddress, nama } = req.body;
  try {
    let user = await prisma.user.findUnique({ where: { suiAddress } });
    if (!user) user = await prisma.user.create({ data: { suiAddress, nama } });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "User fail" });
  }
});

app.post('/api/lokasi/:id/like', async (req, res) => {
  const { id } = req.params;
  const { suiAddress } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    const existing = await prisma.locationLike.findUnique({
      where: { userId_lokasiId: { userId: user.id, lokasiId: parseInt(id) } }
    });
    if (existing) {
      await prisma.locationLike.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.locationLike.create({ data: { userId: user.id, lokasiId: parseInt(id) } });
      res.json({ liked: true });
    }
  } catch (error) { res.status(500).json({ error: "Like fail" }); }
});

app.post('/api/lokasi/:id/comment', async (req, res) => {
  const { id } = req.params;
  const { suiAddress, text, parentId } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    const comment = await prisma.comment.create({
      data: { userId: user.id, lokasiId: parseInt(id), text, parentId: parentId ? parseInt(parentId) : null },
      include: { user: { select: { nama: true } } }
    });
    res.json(comment);
  } catch (error) { res.status(500).json({ error: "Comment fail" }); }
});

app.post('/api/checkin', async (req, res) => {
  const { suiAddress, lokasiId, fotoUser, komentar } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { suiAddress } });
    const record = await prisma.checkIn.create({
      data: { userId: user.id, lokasiId: parseInt(lokasiId), fotoUser, komentar }
    });
    await prisma.user.update({ where: { id: user.id }, data: { totalCheckIn: { increment: 1 } } });
    res.json(record);
  } catch (error) { res.status(500).json({ error: "Checkin fail" }); }
});

app.get('/api/user/:suiAddress/riwayat', async (req, res) => {
  const { suiAddress } = req.params;
  try {
    const data = await prisma.user.findUnique({
      where: { suiAddress },
      include: { checkIns: { include: { lokasi: true }, orderBy: { waktu: 'desc' } } }
    });
    res.json(data);
  } catch (error) { res.status(500).json({ error: "History fail" }); }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { totalCheckIn: 'desc' }, take: 10 });
    // Point calculation simplified for backend logic speed
    const leaderboard = users.map(u => ({ ...u, points: u.totalCheckIn }));
    res.json(leaderboard);
  } catch (error) { res.status(500).json({ error: "Leaderboard fail" }); }
});

// ==========================================
// NOTIFIKASI & MODERASI
// ==========================================
app.get('/api/notifications', async (req, res) => {
  const data = await prisma.notification.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  res.json(data);
});

app.post('/api/notifications', async (req, res) => {
  const { title, message, type, adminAddress } = req.body;
  if (!validateAdmin(adminAddress)) return res.status(403).json({ error: "Forbidden" });
  const notif = await prisma.notification.create({ data: { title, message, type } });
  res.json(notif);
});

app.patch('/api/comment/:id/hide', async (req, res) => {
  const { id } = req.params;
  const { isHidden, adminAddress } = req.body;
  if (!validateAdmin(adminAddress)) return res.status(403).json({ error: "Forbidden" });
  const updated = await prisma.comment.update({ where: { id: parseInt(id) }, data: { isHidden } });
  res.json(updated);
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
