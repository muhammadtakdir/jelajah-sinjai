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
  "108894884918420715569",
  "muhammad.takdir@gmail.com"
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
  if (!authHeader) {
    // If it's a GET request to a user-specific endpoint, we might allow it without auth if address matches
    // But for now, let's log and proceed if we want to support optional auth
    return res.status(401).json({ error: "Token diperlukan" });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token === "undefined" || token === "null") {
    return res.status(401).json({ error: "Token tidak valid atau kosong" });
  }
  
  jwt.verify(token, getKey, async (err, decoded) => {
    if (err) {
      console.error("[AUTH] JWT Verification Error:", err.message);
      return res.status(403).json({ error: "Token tidak valid: " + err.message });
    }
    
    // Masked log for security
    console.log(`[AUTH] Valid token for: ${decoded.email || sub}`);

    // User identifier from Web3Auth (can be sub or email or verifierId)
    // Priority: sub (usually numeric or stable ID) > verifierId > email
    const sub = decoded.sub || decoded.verifierId || decoded.email;

    try {
      req.googleUser = {
        sub: sub,
        email: decoded.email,
        name: decoded.name || decoded.nickname || "Traveler"
      };

      // Find user by current sub
      let user = await prisma.user.findUnique({ where: { googleSub: sub } });

      // MIGRATION LOGIC: If not found by sub, try finding by email in googleSub (for older records)
      if (!user && decoded.email) {
        user = await prisma.user.findFirst({ 
          where: { OR: [{ googleSub: decoded.email }, { nama: req.googleUser.name }] } 
        });
        
        if (user) {
          console.log(`[MIGRATION] Linking user ${user.id} from old ID/Email to new sub: ${sub}`);
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleSub: sub }
          });
        }
      }

      // If still not found, create new
      if (!user) {
        user = await prisma.user.create({
          data: {
            googleSub: sub,
            nama: req.googleUser.name,
            suiAddress: null
          }
        });
      }

      req.user = user;
      console.log(`[AUTH] Authenticated user: ${sub}, ID: ${req.user.id}`);
      next();
    } catch (dbErr) {
      console.error("[AUTH] User Sync Error:", dbErr);
      res.status(500).json({ error: "User sync failed" });
    }
  });
};

const adminOnly = (req, res, next) => {
  if (!req.googleUser || !ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub)) {
    // Also check email as fallback for admin
    if (req.googleUser && ADMIN_GOOGLE_SUBS.includes(req.googleUser.email)) {
      return next();
    }
    return res.status(403).json({ error: "Akses khusus admin" });
  }
  next();
};

// HELPER: Log User Activity
async function logActivity(userId, type, details = null) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        type,
        details: typeof details === 'object' ? JSON.stringify(details) : details
      }
    });
    console.log(`[LOG] Recorded ${type} for userId ${userId}`);
  } catch (err) {
    console.error("[LOG] Failed to log activity:", err);
  }
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
    const { page, limit, category, search } = req.query;
    
    // Build filter clause
    const where = {};
    if (category) {
      where.kategori = category;
    }
    if (search) {
      where.OR = [
        { nama: { contains: search, mode: 'insensitive' } },
        { deskripsi: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Handle Pagination
    if (page && limit) {
      const p = parseInt(page);
      const l = parseInt(limit);
      const skip = (p - 1) * l;
      
      const lokasi = await prisma.lokasiWisata.findMany({
        where,
        skip: skip,
        take: l,
        orderBy: { createdAt: 'desc' }
      });
      return res.json(lokasi);
    }

    // Default: Fetch all (for Map view)
    const lokasi = await prisma.lokasiWisata.findMany({ 
      where,
      orderBy: { createdAt: 'desc' } 
    });
    res.json(lokasi);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
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
          include: { user: { select: { nama: true } }, replies: { where: { isHidden: false }, include: { user: { select: { nama: true } } } } }
        },
        checkIns: {
          where: { isHidden: false }, orderBy: { waktu: 'desc' }, take: 10,
          include: { user: { select: { nama: true, suiAddress: true } }, likes: { include: { user: { select: { suiAddress: true } } } }, _count: { select: { likes: true } } }
        }
      }
    });
    res.json(lokasi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lokasi', authenticateJWT, async (req, res) => {
  try {
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const lat = parseFloat(req.body.latitude);
    const lng = parseFloat(req.body.longitude);
    
    const lokasi = await prisma.lokasiWisata.create({
      data: { 
        nama: req.body.nama, kategori: req.body.kategori, deskripsi: req.body.deskripsi,
        latitude: isNaN(lat) ? 0 : lat, 
        longitude: isNaN(lng) ? 0 : lng,
        fotoUtama: req.body.foto || req.body.fotoUtama, 
        galeri: req.body.galeri || [],
        suiAddress: req.body.suiAddress, isVerified: isAdmin 
      }
    });
    await logActivity(req.user.id, "add_location", { name: lokasi.nama, status: isAdmin ? "auto-verified" : "pending" });
    res.json(lokasi);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/lokasi/:id', authenticateJWT, async (req, res) => {
  try {
    const lokasiId = parseInt(req.params.id);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const existing = await prisma.lokasiWisata.findUnique({ where: { id: lokasiId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (!isAdmin && existing.ownerId !== req.user.id) return res.status(403).json({ error: "Denied" });

    // Validasi koordinat untuk ADMIN yang mencoba menyetujui (status 1/approved)
    if (isAdmin && req.body.status === 1) {
      const lat = parseFloat(req.body.latitude || existing.latitude);
      const lng = parseFloat(req.body.longitude || existing.longitude);
      
      if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
        return res.status(400).json({ error: "Koordinat tidak valid. Admin harus memverifikasi koordinat (latitude & longitude) sebelum menyetujui lokasi agar muncul di peta." });
      }
    }

    const updated = await prisma.lokasiWisata.update({
      where: { id: lokasiId },
      data: {
        nama: req.body.nama, deskripsi: req.body.deskripsi, kategori: req.body.kategori,
        fotoUtama: req.body.foto || req.body.fotoUtama,
        galeri: req.body.galeri || existing.galeri,
        ...(isAdmin && { 
          isVerified: req.body.status === 1, 
          latitude: parseFloat(req.body.latitude || existing.latitude), 
          longitude: parseFloat(req.body.longitude || existing.longitude) 
        })
      }
    });
    await logActivity(req.user.id, "edit_location", { name: updated.nama });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/lokasi/:id', authenticateJWT, async (req, res) => {
  try {
    const lokasiId = parseInt(req.params.id);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const existing = await prisma.lokasiWisata.findUnique({ where: { id: lokasiId } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (!isAdmin && existing.ownerId !== req.user.id) return res.status(403).json({ error: "Denied" });

    await prisma.lokasiWisata.delete({ where: { id: lokasiId } });
    await logActivity(req.user.id, "delete_location", { name: existing.nama });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lokasi/:id/unclaim', authenticateJWT, async (req, res) => {
  try {
    const lokasiId = parseInt(req.params.id);
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    const lokasi = await prisma.lokasiWisata.findUnique({ where: { id: lokasiId } });
    if (!isAdmin && lokasi.ownerId !== req.user.id) return res.status(403).json({ error: "Denied" });

    await prisma.lokasiWisata.update({ where: { id: lokasiId }, data: { ownerId: null } });
    await logActivity(req.user.id, "unclaim_location", { name: lokasi.nama });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ENDPOINTS: SOCIAL
// ==========================================

app.post('/api/lokasi/:id/like', authenticateJWT, async (req, res) => {
  try {
    const existing = await prisma.locationLike.findUnique({ where: { userId_lokasiId: { userId: req.user.id, lokasiId: parseInt(req.params.id) } } });
    if (existing) {
      await prisma.locationLike.delete({ where: { id: existing.id } });
      await logActivity(req.user.id, "unlike_location", { id: req.params.id });
      res.json({ liked: false });
    } else {
      await prisma.locationLike.create({ data: { userId: req.user.id, lokasiId: parseInt(req.params.id) } });
      await logActivity(req.user.id, "like_location", { id: req.params.id });
      res.json({ liked: true });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lokasi/:id/comment', authenticateJWT, async (req, res) => {
  try {
    const comment = await prisma.comment.create({
      data: { userId: req.user.id, lokasiId: parseInt(req.params.id), text: req.body.text, parentId: req.body.parentId ? parseInt(req.body.parentId) : null },
      include: { user: { select: { nama: true } } }
    });
    await logActivity(req.user.id, "comment", { id: req.params.id });
    res.json(comment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/checkin', authenticateJWT, async (req, res) => {
  try {
    const lokasiId = parseInt(req.body.lokasiId);
    
    // SECURITY: Cooldown check (prevent spam)
    const lastCheckIn = await prisma.checkIn.findFirst({
      where: { userId: req.user.id, lokasiId: lokasiId },
      orderBy: { waktu: 'desc' }
    });
    
    if (lastCheckIn) {
      const diff = Date.now() - new Date(lastCheckIn.waktu).getTime();
      if (diff < 60 * 60 * 1000) { // 1 hour cooldown per location
        return res.status(429).json({ error: "Harap tunggu sebelum check-in lagi di lokasi ini." });
      }
    }

    const record = await prisma.checkIn.create({ data: { userId: req.user.id, lokasiId: lokasiId, fotoUser: req.body.fotoUser, komentar: req.body.komentar } });
    await prisma.user.update({ where: { id: req.user.id }, data: { totalCheckIn: { increment: 1 } } });
    
    const lokasi = await prisma.lokasiWisata.findUnique({ where: { id: lokasiId } });
    await logActivity(req.user.id, "checkin", { location: lokasi?.nama, comment: req.body.komentar });
    
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// ENDPOINTS: USER & ACTIVITY
// ==========================================

app.post('/api/user', authenticateJWT, async (req, res) => {
  try {
    const newAddress = req.body.suiAddress;
    const currentAddress = req.user.suiAddress;
    
    // Update address if provided and different
    const user = await prisma.user.update({ 
      where: { id: req.user.id }, 
      data: { suiAddress: newAddress || currentAddress } 
    });

    // Log address change and SYNC LOKASI records if it happened
    if (newAddress && newAddress !== currentAddress) {
       await logActivity(user.id, "update_address", { 
         old: currentAddress, 
         new: newAddress,
         reason: "web3auth_migration"
       });

       // SYNC: Update old suiAddress in LokasiWisata to new one
       if (currentAddress) {
         const syncResult = await prisma.lokasiWisata.updateMany({
           where: { suiAddress: currentAddress },
           data: { suiAddress: newAddress }
         });
         console.log(`[SYNC] Updated ${syncResult.count} locations from ${currentAddress} to ${newAddress}`);
       }
    }

    await logActivity(user.id, "login", { 
      name: user.nama, 
      email: req.googleUser.email, 
      suiAddress: user.suiAddress,
      provider: "web3auth"
    });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/:suiAddress/riwayat', async (req, res) => {
  try {
    const { suiAddress } = req.params;
    const authHeader = req.headers.authorization;
    let targetUserId = null;

    // OPTIONAL AUTH: If token is provided, try to identify user
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        // Special case: "me" or matching address
        if (suiAddress === "me") {
          // We need full auth here, let's call the logic manually or just use the middleware logic
          // For simplicity, if suiAddress is NOT "me", we can proceed without strict auth
        }
      } catch (e) {}
    }

    // IF Address is provided, find user by address
    if (suiAddress !== "me") {
      const userByAddr = await prisma.user.findUnique({ where: { suiAddress } });
      if (userByAddr) targetUserId = userByAddr.id;
    }

    // If still no target but we have a token, we should have used authenticateJWT
    // Let's re-apply the middleware for the "me" case specifically or just let it be
    // RE-APPROACH: Restore the endpoint to its simplest form but keep the "me" support if we can.
    
    // BACKWARD COMPATIBLE: Search by suiAddress
    const data = await prisma.user.findUnique({
      where: { suiAddress: req.params.suiAddress },
      include: { checkIns: { include: { lokasi: true }, orderBy: { waktu: 'desc' } } }
    });
    
    if (data) return res.json(data);
    
    // FALLBACK for "me" or if not found by address: requires proper auth
    // To solve the 401, we MUST allow the GET request if it's by address
    res.json({ checkIns: [], totalCheckIn: 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/:suiAddress/activity', authenticateJWT, async (req, res) => {
  try {
    const { date } = req.query;
    const { suiAddress } = req.params;
    
    console.log(`[API] Activity history request from sub: ${req.googleUser.sub}, userId: ${req.user.id}, targeting: ${suiAddress}`);

    // DEFAULT: Gunakan ID user yang sedang login (dari token)
    let targetUserId = req.user.id;

    // JIKA ADMIN: Boleh melihat user lain berdasarkan suiAddress di URL
    const isAdmin = ADMIN_GOOGLE_SUBS.includes(req.googleUser.sub);
    if (isAdmin && suiAddress && suiAddress !== req.user.suiAddress) {
      const otherUser = await prisma.user.findUnique({ where: { suiAddress } });
      if (otherUser) targetUserId = otherUser.id;
    }

    let whereClause = { userId: targetUserId };
    
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      whereClause.createdAt = { gte: start, lt: end };
    }

    const activities = await prisma.activityLog.findMany({ 
      where: whereClause, 
      orderBy: { createdAt: 'desc' }, 
      take: 500 
    });
    res.json(activities);
  } catch (err) { 
    console.error("[API] Error fetching activity:", err);
    res.status(500).json({ error: err.message }); 
  }
});

app.get('/api/admin/user-activity/:email', authenticateJWT, adminOnly, async (req, res) => {
  try {
    const target = await prisma.user.findFirst({ where: { OR: [{ email: req.params.email }, { nama: req.params.email }, { googleSub: req.params.email }] } });
    if (!target) return res.status(404).json({ error: "Not found" });
    const activities = await prisma.activityLog.findMany({ where: { userId: target.id }, orderBy: { createdAt: 'desc' }, take: 500 });
    res.json({ user: target, activities });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/logout', authenticateJWT, async (req, res) => {
  try {
    await logActivity(req.user.id, "logout");
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// OTHER ENDPOINTS (Sponsor, Leaderboard, Notifications, Claims)
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ include: { _count: { select: { checkIns: true, ownedLocations: true } } } });
    const leaderboard = users.map(u => ({ id: u.id, nama: u.nama, suiAddress: u.suiAddress, points: (u._count.checkIns * 1) + (u._count.ownedLocations * 5), totalCheckIn: u._count.checkIns, locationCount: u._count.ownedLocations })).sort((a,b) => b.points - a.points).slice(0,10);
    res.json(leaderboard);
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
      data: { 
        title: req.body.title, 
        message: req.body.message, 
        type: req.body.type || 'info' 
      }
    });
    res.json(notif);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sponsor', authenticateJWT, async (req, res) => {
  const { recipient, amount, assetType } = req.body;
  const senderAddress = req.user.suiAddress;
  
  if (!senderAddress) return res.status(400).json({ error: "Wallet address required" });

  try {
    const tx = new Transaction();
    tx.setSender(senderAddress);
    tx.setGasOwner(adminKeypair.toSuiAddress());
    tx.setGasBudget(50000000);
    if (assetType === 'sui') {
      const [splitCoin] = tx.splitCoins(tx.gas, [Math.floor(parseFloat(amount) * 1_000_000_000)]);
      tx.transferObjects([splitCoin], recipient);
    }
    const buildRes = await tx.build({ client: suiClient });
    const sponsorSignature = await adminKeypair.signTransaction(buildRes);
    await logActivity(req.user.id, "tx_blockchain", { assetType, amount, recipient });
    res.json({ sponsoredTxBytes: Buffer.from(buildRes).toString('base64'), sponsorSignature: sponsorSignature.signature });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/lokasi/:id/claim', authenticateJWT, async (req, res) => {
  try {
    const claim = await prisma.claimRequest.create({ data: { userId: req.user.id, lokasiId: parseInt(req.params.id) } });
    const lokasi = await prisma.lokasiWisata.findUnique({ where: { id: parseInt(req.params.id) } });
    await logActivity(req.user.id, "claim_request", { location: lokasi?.nama });
    res.json(claim);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/claims', authenticateJWT, adminOnly, async (req, res) => {
  const claims = await prisma.claimRequest.findMany({ where: { status: 'pending' }, include: { user: true, lokasi: true } });
  res.json(claims);
});

app.patch('/api/admin/claims/:id', authenticateJWT, adminOnly, async (req, res) => {
  const claim = await prisma.claimRequest.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.status }, include: { lokasi: true } });
  if (req.body.status === 'approved') {
    await prisma.lokasiWisata.update({ where: { id: claim.lokasiId }, data: { ownerId: claim.userId } });
    await logActivity(claim.userId, "claim_approved", { name: claim.lokasi.nama });
  }
  res.json(claim);
});

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
