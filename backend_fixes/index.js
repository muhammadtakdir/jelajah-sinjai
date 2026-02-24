require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const multer = require('multer');
const path = require('path');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// ==========================================
// SUI SDK SETUP (MODERN V1.x)
// ==========================================
const { SuiClient } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Transaction } = require('@mysten/sui/transactions');

const SUI_RPC_URL = process.env.SUI_RPC_URL || "https://fullnode.testnet.sui.io:443";
const suiClient = new SuiClient({ url: SUI_RPC_URL });

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
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
const PORT = 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// AUTH & ADMIN UTILS (WEB3AUTH READY)
// ==========================================
const ADMIN_GOOGLE_SUBS = [
  "kilas.kareba@gmail.com", 
  "108894884918420715569"
];

const w3aClient = jwksClient({
  jwksUri: 'https://api-auth.web3auth.io/jwks',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5
});

function getKey(header, callback){
  w3aClient.getSigningKey(header.kid, function(err, key) {
    if (err) return callback(err);
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token diperlukan" });

  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, getKey, (err, decoded) => {
    if (err) {
      console.error("[AUTH] JWT Verification Error:", err.message);
      return res.status(403).json({ error: "Token tidak valid: " + err.message });
    }
    
    const userId = decoded.sub || decoded.verifierId || (decoded.wallets && decoded.wallets[0].address);

    req.googleUser = {
      sub: userId,
      email: decoded.email,
      name: decoded.name || decoded.nickname || "Traveler"
    };
    next();
  });
};

const adminOnly = (req, res, next) => {
  if (!req.googleUser || !ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub)) {
    console.warn("[ADMIN] Access Denied for:", req.googleUser?.sub);
    return res.status(403).json({ error: "Akses khusus admin" });
  }
  next();
};

// HELPER: Get or Create User based on JWT data
async function getOrCreateUser(googleUser, suiAddress = null) {
  return await prisma.user.upsert({
    where: { googleSub: googleUser.sub },
    update: suiAddress ? { suiAddress } : {},
    create: {
      googleSub: googleUser.sub,
      nama: googleUser.name || googleUser.email?.split('@')[0] || "Traveler",
      suiAddress: suiAddress
    }
  });
}

// ==========================================
// ENDPOINTS: UPLOAD & LOKASI
// ==========================================

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
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('/api/lokasi', async (req, res) => {
  try {
    const lokasi = await prisma.lokasiWisata.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(lokasi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/lokasi/:id', async (req, res) => {
  try {
    const lokasi = await prisma.lokasiWisata.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        _count: { select: { likes: true, comments: true, checkIns: true } },
        owner: { select: { nama: true, suiAddress: true } },
        likes: { include: { user: { select: { suiAddress: true } } } },
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
          orderBy: { waktu: 'desc' },
          take: 10,
          include: { 
            user: { select: { nama: true, suiAddress: true } },
            likes: { include: { user: { select: { suiAddress: true } } } },
            _count: { select: { likes: true } }
          }
        }
      }
    });
    res.json(lokasi);
  } catch (err) { 
    console.error("[API] Error fetching lokasi detail:", err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/lokasi', authenticateJWT, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const lokasi = await prisma.lokasiWisata.create({
      data: { 
        nama: req.body.nama,
        kategori: req.body.kategori,
        deskripsi: req.body.deskripsi,
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        fotoUtama: req.body.foto || req.body.fotoUtama,
        suiAddress: req.body.suiAddress,
        isVerified: isAdmin 
      }
    });
    res.json(lokasi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/lokasi/:id', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const updated = await prisma.lokasiWisata.update({
      where: { id: parseInt(req.params.id) },
      data: { 
          isVerified: req.body.status === 1,
          nama: req.body.nama,
          deskripsi: req.body.deskripsi,
          fotoUtama: req.body.foto || req.body.fotoUtama
      }
    });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ENDPOINTS: SOSIAL (LIKE, COMMENT, CHECKIN)
// ==========================================

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
  } catch (err) { 
    console.error("[API] Error processing like:", err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/checkin/:id/like', authenticateJWT, async (req, res) => {
  try {
    const user = await getOrCreateUser(req.googleUser, req.body.suiAddress);
    const existing = await prisma.checkInLike.findUnique({
      where: { userId_checkInId: { userId: user.id, checkInId: parseInt(req.params.id) } }
    });
    if (existing) {
      await prisma.checkInLike.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.checkInLike.create({ data: { userId: user.id, checkInId: parseInt(req.params.id) } });
      res.json({ liked: true });
    }
  } catch (err) { 
    console.error("[API] Error processing checkin like:", err);
    res.status(500).json({ error: err.message }); 
  }
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
  } catch (err) { 
    console.error("[API] Error processing comment:", err);
    res.status(500).json({ error: err.message }); 
  }
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
  } catch (err) { 
    console.error("[API] Error processing checkin:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================================
// ENDPOINTS: USER, LEADERBOARD, NOTIF, SPONSOR
// ==========================================

app.post('/api/user', authenticateJWT, async (req, res) => {
  const { suiAddress } = req.body;
  try {
    const user = await getOrCreateUser(req.googleUser, suiAddress);
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/:suiAddress/riwayat', async (req, res) => {
  try {
    const data = await prisma.user.findUnique({
      where: { suiAddress: req.params.suiAddress },
      include: { checkIns: { include: { lokasi: true }, orderBy: { waktu: 'desc' } } }
    });
    if (!data) return res.status(404).json({ error: "User tidak ditemukan" });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { totalCheckIn: 'desc' }, take: 10 });
    res.json(users.map(u => ({ ...u, points: u.totalCheckIn })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const data = await prisma.notification.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/notifications', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const notif = await prisma.notification.create({ 
      data: { title: req.body.title, message: req.body.message, type: req.body.type } 
    });
    res.json(notif);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sponsor', async (req, res) => {
  const { senderAddress, recipient, amount, assetType, objectId } = req.body;
  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.setGasOwner(adminKeypair.toSuiAddress());
    tx.setGasBudget(50000000);

    if (assetType === 'sui') {
      // Ambil koin SUI milik USER (bukan milik Admin/Gas)
      const coins = await suiClient.getCoins({ owner: senderAddress });
      if (coins.data.length === 0) throw new Error("Saldo SUI Anda tidak mencukupi");
      
      const [primaryCoin, ...mergeCoins] = coins.data.map(c => c.coinObjectId);
      if (mergeCoins.length > 0) tx.mergeCoins(primaryCoin, mergeCoins);
      
      const [splitCoin] = tx.splitCoins(primaryCoin, [Math.floor(parseFloat(amount) * 1_000_000_000)]);
      tx.transferObjects([splitCoin], recipient);
    } else if (assetType === 'token') {
        const coins = await suiClient.getCoins({ owner: senderAddress, coinType: objectId });
        const [primaryCoin, ...mergeCoins] = coins.data.map(c => c.coinObjectId);
        if (mergeCoins.length > 0) tx.mergeCoins(primaryCoin, mergeCoins);
        const [splitCoin] = tx.splitCoins(primaryCoin, [Math.floor(parseFloat(amount) * 1_000_000_000)]);
        tx.transferObjects([splitCoin], recipient);
    } else if (assetType === 'nft') {
      tx.transferObjects([objectId], recipient);
    }

    const buildRes = await tx.build({ client: suiClient });
    const sponsorSignature = await adminKeypair.signTransaction(buildRes);
    res.json({
      sponsoredTxBytes: Buffer.from(buildRes).toString('base64'),
      sponsorSignature: sponsorSignature.signature
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
