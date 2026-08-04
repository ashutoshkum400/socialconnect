"use strict";
require('dotenv').config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const https = require("https");
const cors = require("cors");
const { seedBots, startBotActivity } = require('./seed-bots');
const { powerBotManager } = require('./power-bots');
global.powerBotManager = powerBotManager;
const { DataManager } = require('./data-manager');
const { registerSystemVolumeRoute } = require('./system-volume');
const { SupabaseStore } = require('./supabase-store');
const { DynamoDBStore } = require('./dynamodb-store');
const { importUsersFromCsvFile } = require('./backend/services/user-import.service.cjs');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "socialconnect-secret-key-2024";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "Admin@2024";
const DATA_FILE = path.join(__dirname, "data.json");

// ─── Google OAuth (Sign in with Gmail) ───────────────────────────────────────
// The Google Client ID is PUBLIC by design — Google Identity Services requires
// it to be embedded in browser-side code. It is safe to keep a hardcoded
// default so Gmail sign-in works on Render even if the env var is not set.
// You can still override it via the GOOGLE_CLIENT_ID env var.
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "965817059764-nqnm69ngsr3i1h3mdqqmi2160d4n1m3u.apps.googleusercontent.com";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

/**
 * Verify a Google ID token using Google's tokeninfo endpoint.
 * Returns the decoded profile payload or null if invalid/expired.
 */
async function verifyGoogleToken(idToken) {
  if (!idToken) return null;
  try {
    const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (!payload || payload.error) return null;
    // If a client id is configured, ensure the token was issued for our app
    if (GOOGLE_CLIENT_ID && payload.aud && payload.aud !== GOOGLE_CLIENT_ID) {
      console.warn("⚠ Google token audience mismatch:", payload.aud);
      return null;
    }
    return payload;
  } catch (err) {
    console.error("Google token verification error:", err.message);
    return null;
  }
}

const supabaseStore = new SupabaseStore();
const dynamoDBStore = new DynamoDBStore();
const dataManager = new DataManager({ dataFile: DATA_FILE });
const REEL_SAMPLE_URLS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
];

// ─── App / Server ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
  maxHttpBufferSize: 100 * 1024 * 1024,
});

// ─── In-Memory Store ─────────────────────────────────────────────────────────
const db = {
  users: new Map(), // id -> user object
  posts: new Map(), // id -> post object
  chats: new Map(), // `${uid1}_${uid2}` sorted -> [messages]
  notifications: new Map(), // userId -> [notifications]
  friendRequests: new Map(), // userId -> [{from, time}]
  relationships: new Map(), // userId -> [{withUserId, type, time}]
  powerBotInteractions: new Map(), // botId -> { friends:[], followers:[], following:[], connections:[] }
  reels: new Map(), // id -> reel object
};
const onlineUsers = new Map(); // userId -> socketId
const groupCalls = new Map(); // callId -> { id, creatorId, participants: Map<userId, {socketId, joinedAt}>, callType, active, startedAt }
dataManager.db = db;

// ─── Persistence ──────────────────────────────────────────────────────────────
/**
 * Convert all db Maps to plain objects for JSON serialisation.
 */
function dbToJSON() {
  const obj = {};
  for (const [key, map] of Object.entries(db)) {
    obj[key] = Object.fromEntries(map);
  }
  return obj;
}

/**
 * Reconstruct db Maps from a previously-serialised JSON object.
 */
function dbFromJSON(json) {
  for (const [key, obj] of Object.entries(json)) {
    if (db[key] instanceof Map) {
      db[key] = new Map(Object.entries(obj));
    }
  }
}

/**
 * Persist the entire db to disk (synchronous to avoid race conditions
 * on server shutdown / restart).
 */
function saveDb() {
  dataManager.save();
  // Also push the latest state to DynamoDB (fire-and-forget, best-effort)
  if (dynamoDBStore.enabled) {
    dynamoDBStore.save();
  }
  // Also push the latest state to Supabase (fire-and-forget, best-effort)
  if (supabaseStore.enabled) {
    supabaseStore.save();
  }
}

/**
 * Load db from disk. Returns true if data was loaded, false otherwise.
 */
function loadDb() {
  return dataManager.load();
}

/**
 * Load db from Supabase. Returns true if data was loaded from Supabase,
 * false otherwise (e.g. not configured, or no data yet).
 */
async function loadSupabaseDb() {
  if (!supabaseStore.enabled) return false;
  return supabaseStore.load();
}

/**
 * Load db from DynamoDB. Returns true if data was loaded from DynamoDB,
 * false otherwise (e.g. not configured, or no data yet).
 */
async function loadDynamoDb() {
  if (!dynamoDBStore.enabled) return false;
  return dynamoDBStore.load();
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ─── Socket.IO Client (served locally, no CDN dependency) ──────────────────
// The official CDN (cdn.socket.io) is frequently blocked or unreachable on
// some networks, which left `io` undefined in the browser and broke the
// dashboard (no data loaded). Serve the client bundle from our own node_modules.
app.get("/socket.io/socket.io.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "socket.io", "client-dist", "socket.io.js"));
});
app.get("/socket.io/socket.io.min.js", (req, res) => {
  res.sendFile(path.join(__dirname, "node_modules", "socket.io", "client-dist", "socket.io.min.js"));
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/yt-reels", (req, res) => { res.sendFile(path.join(__dirname, "video.html")); });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function resolveUser(userId) {
  return db.users.get(userId) || powerBotManager.getBotById(userId) || null;
}

function getPowerBotSample(count) {
  const bots = [];
  const used = new Set();
  for (let i = 0; i < count && used.size < 1000000; i++) {
    let numId;
    do { numId = 1 + Math.floor(Math.random() * 1000000); }
    while (used.has(numId));
    used.add(numId);
    bots.push(powerBotManager.getBotByNumId(numId));
  }
  return bots.filter(Boolean);
}

const NOTIF_PRIORITY = {
  friend_request: 'high',
  friend_accept: 'high',
  connect_request: 'high',
  connect_accept: 'high',
  match: 'high',
  follow: 'medium',
  follow_back: 'medium',
  like: 'low',
  comment: 'low',
  share: 'low',
  message: 'medium',
};

function addNotification(userId, type, fromId, text, priority) {
   if (!db.notifications.has(userId)) db.notifications.set(userId, []);
   const notif = {
     id: uuidv4(),
     type,
     fromId: fromId || null,
     text,
     priority: priority || NOTIF_PRIORITY[type] || 'medium',
     read: false,
     time: new Date().toISOString(),
   };
   db.notifications.get(userId).unshift(notif);
   const socketId = onlineUsers.get(userId);
   if (socketId) io.to(socketId).emit("notification", notif);
 }

 function addNotificationWithPost(userId, type, fromId, text, postId, priority) {
   if (!db.notifications.has(userId)) db.notifications.set(userId, []);
   const notif = {
     id: uuidv4(),
     type,
     fromId: fromId || null,
     text,
     postId: postId || null,
     priority: priority || NOTIF_PRIORITY[type] || 'medium',
     read: false,
     time: new Date().toISOString(),
   };
   db.notifications.get(userId).unshift(notif);
   const socketId = onlineUsers.get(userId);
   if (socketId) io.to(socketId).emit("notification", notif);
 }

function chatKey(a, b) {
  return [a, b].sort().join("_");
}

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

// Optional auth — doesn't reject if no/invalid token, just leaves req.user undefined
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      req.user = { id: payload.id, role: payload.role };
    } catch {}
  }
  next();
}

// ─── Load Advanced Post API ────────────────────────────────────────────────
const advancedPostAPI = require('./advanced-post-api');
advancedPostAPI(app, io, db, authenticate);
registerSystemVolumeRoute(app);
global.saveDb = saveDb;
global.dataManager = dataManager;

// ─── Seed Data ───────────────────────────────────────────────────────────────
async function seedData() {
  // If data was restored from DynamoDB, do NOT re-seed
  if (dynamoDBStore.enabled && dynamoDBStore.db && dynamoDBStore.db.users && dynamoDBStore.db.users.size > 0) {
    console.log("🗄️  Using persisted data from DynamoDB");
    return;
  }
  // If data was restored from Supabase, do NOT re-seed
  if (supabaseStore.enabled && supabaseStore.db && supabaseStore.db.users && supabaseStore.db.users.size > 0) {
    console.log("📦 Using persisted data from Supabase");
    return;
  }
  // If data was restored from disk, do NOT re-seed
  if (loadDb()) {
    console.log("📂 Using persisted data from disk");
    return;
  }

  const hash = (pw) => bcrypt.hashSync(pw, 10);

  const importedUsers = importUsersFromCsvFile(path.join(__dirname, "data", "users_rows.csv"));
  for (const importedUser of importedUsers) {
    if (!db.users.has(importedUser.id)) {
      db.users.set(importedUser.id, importedUser);
      db.notifications.set(importedUser.id, []);
      db.friendRequests.set(importedUser.id, []);
      db.relationships.set(importedUser.id, []);
    }
  }

  // Admin
  db.users.set("admin", {
    id: "admin",
    username: "admin",
    email: "admin@socialconnect.com",
    password: hash("Admin@123"),
    role: "admin",
    name: "Admin User",
    bio: "Platform administrator",
    avatar:
      "https://ui-avatars.com/api/?name=Admin+User&background=random&size=128",
    coverPhoto: "https://picsum.photos/seed/admin/800/300",
    photos: [],
    friends: [],
    followers: [],
    following: [],
    connections: [],
    blocked: false,
    joinedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    location: "HQ",
    birthDate: "1990-01-01",
    gender: "other",
    interests: [],
    lookingFor: null,
    relationshipStatus: null,
  });

// Sample users
   const samples = [
     {
       id: "u1",
       name: "Alice Johnson",
       username: "alice_j",
       email: "alice@example.com",
       gender: "female",
       location: "New York",
     },
     {
       id: "u2",
       name: "Bob Smith",
       username: "bob_smith",
       email: "bob@example.com",
       gender: "male",
       location: "San Francisco",
     },
     {
       id: "u3",
       name: "Carol Williams",
       username: "carol_w",
       email: "carol@example.com",
       gender: "female",
       location: "Los Angeles",
     },
     {
       id: "u4",
       name: "David Brown",
       username: "david_b",
       email: "david@example.com",
       gender: "male",
       location: "Chicago",
     },
     {
       id: "u5",
       name: "Emma Davis",
       username: "emma_d",
       email: "emma@example.com",
       gender: "female",
       location: "Austin",
     },
     {
       id: "u6",
       name: "Frank Wilson",
       username: "frank_w",
       email: "frank@example.com",
       gender: "male",
       location: "Miami",
     },
   ];

    for (const s of samples) {
      db.users.set(s.id, {
        ...s,
        password: hash("Password@123"),
        role: "user",
        bio: `Hi, I'm ${s.name.split(" ")[0]}! Nice to meet you.`,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random&size=128`,
        coverPhoto: `https://picsum.photos/seed/${s.id}/800/300`,
        photos: [],
        friends: [],
        followers: [],
        following: [],
        connections: [],
        relationships: [],
        blocked: false,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        birthDate: "1995-06-15",
        interests: ["music", "travel", "food"],
        lookingFor: "friends",
        relationshipStatus: "single",
      });
      db.notifications.set(s.id, []);
      db.friendRequests.set(s.id, []);
      db.relationships.set(s.id, []);
    }
    db.notifications.set("admin", []);
    db.friendRequests.set("admin", []);
    db.relationships.set("admin", []);

           // Initialize relationships for sample users
           for (const s of samples) {
             db.relationships.set(s.id, []);
           }

  // u1 and u2 are already friends
  db.users.get("u1").friends.push("u2");
  db.users.get("u2").friends.push("u1");

  // Sample posts
  const postData = [
    {
      id: "p1",
      authorId: "u1",
      text: "Just arrived in New York! The city that never sleeps ✨",
      image: "https://picsum.photos/seed/p1/600/400",
    },
    {
      id: "p2",
      authorId: "u2",
      text: "Golden Gate Bridge at sunset 🌉 San Francisco is magical.",
      image: "https://picsum.photos/seed/p2/600/400",
    },
    {
      id: "p3",
      authorId: "u3",
      text: "Hollywood Hills hike done! Views were absolutely breathtaking 🏔️",
      image: "https://picsum.photos/seed/p3/600/400",
    },
    {
      id: "p4",
      authorId: "u4",
      text: "Deep dish pizza in Chicago hits different every single time 🍕",
      image: "https://picsum.photos/seed/p4/600/400",
    },
    {
      id: "p5",
      authorId: "u5",
      text: "Austin live music scene is incredible! So many talented artists 🎸",
      image: "https://picsum.photos/seed/p5/600/400",
    },
    {
      id: "p6",
      authorId: "u6",
      text: "Miami beach vibes on a Friday evening 🌊 Life is good.",
      image: "https://picsum.photos/seed/p6/600/400",
    },
  ];

  const now = Date.now();
  postData.forEach((p, i) => {
    db.posts.set(p.id, {
      ...p,
      likes: [],
      comments: [
        {
          id: uuidv4(),
          userId:
            "u" + ((i % 6) + 1 === i + 1 ? ((i + 1) % 6) + 1 : (i % 6) + 1),
          text: "Looks amazing! 😍",
          time: new Date(now - 3600000).toISOString(),
        },
      ],
      time: new Date(now - (i + 1) * 3600000 * 2).toISOString(),
    });
  });
  // Add some likes to p1
  db.posts.get("p1").likes = ["u2", "u3", "u4"];
  db.posts.get("p2").likes = ["u1", "u5"];
  db.posts.get("p3").likes = ["u2", "u6"];

  // Sample chat between u1 and u2
  const ck = chatKey("u1", "u2");
  db.chats.set(ck, [
    {
      id: uuidv4(),
      senderId: "u1",
      receiverId: "u2",
      text: "Hey Bob! How are you doing?",
      time: new Date(now - 7200000).toISOString(),
      read: true,
    },
    {
      id: uuidv4(),
      senderId: "u2",
      receiverId: "u1",
      text: "Alice! Great to hear from you. Doing well, thanks!",
      time: new Date(now - 7100000).toISOString(),
      read: true,
    },
    {
      id: uuidv4(),
      senderId: "u1",
      receiverId: "u2",
      text: "We should catch up sometime soon 😊",
      time: new Date(now - 7000000).toISOString(),
      read: false,
    },
  ]);

  // Persist the freshly-seeded data so future restarts find it
  saveDb();
  console.log("✅ Seed data loaded and persisted");
}

function seedReelsIfEmpty() {
  if (db.reels.size > 0) return;
  const now = Date.now();
  const sampleReels = [
    { id: 'r1', authorId: 'u1', caption: 'Sunset vibes in NYC 🌆', audio: 'Sunset Dreams - Lofi', tags: ['sunset', 'nyc', 'lofi'] },
    { id: 'r2', authorId: 'u2', caption: 'Morning coffee ritual ☕', audio: 'Chill Morning', tags: ['coffee', 'morning'] },
    { id: 'r3', authorId: 'u3', caption: 'Dance challenge! Who\'s next? 💃', audio: 'Upbeat Vibes - Remix', tags: ['dance', 'challenge'] },
    { id: 'r4', authorId: 'u4', caption: 'Cooking my favorite pasta 🍝', audio: 'Kitchen Session', tags: ['cooking', 'pasta', 'food'] },
    { id: 'r5', authorId: 'u5', caption: 'Guitar cover of Stairway 🎸', audio: 'Stairway to Heaven', tags: ['guitar', 'music', 'cover'] },
    { id: 'r6', authorId: 'u6', caption: 'Beach day! 🏖️', audio: 'Ocean Waves', tags: ['beach', 'summer'] },
    { id: 'r7', authorId: 'u1', caption: 'New fit check 🔥', audio: 'Trendsetter', tags: ['fashion', 'fit'] },
    { id: 'r8', authorId: 'u2', caption: 'Gym PR today! 💪', audio: 'Workout Hype', tags: ['gym', 'fitness'] },
  ];
  sampleReels.forEach((r, i) => {
    const user = db.users.get(r.authorId);
    db.reels.set(r.id, {
      ...r,
      authorName: user?.name || 'Unknown',
      authorAvatar: user?.avatar || '',
      videoUrl: REEL_SAMPLE_URLS[i % REEL_SAMPLE_URLS.length],
      thumbnailUrl: null,
      likes: [],
      comments: [],
      saves: [],
      views: Math.floor(Math.random() * 10000) + 500,
      time: new Date(now - (i + 1) * 3600000).toISOString(),
      blocked: false,
      reported: false,
    });
  });
  saveDb();
  console.log("✅ Sample reels seeded (" + db.reels.size + " reels)");
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      gender,
      birthDate,
      location,
      bio,
    } = req.body;
    if (!name || !username || !email || !password)
      return res
        .status(400)
        .json({ error: "name, username, email, and password are required" });

    for (const u of db.users.values()) {
      if (u.email === email)
        return res.status(409).json({ error: "Email already registered" });
      if (u.username === username)
        return res.status(409).json({ error: "Username already taken" });
    }

const id = uuidv4();
     const user = {
       id,
       username,
       email,
       password: await bcrypt.hash(password, 10),
       role: "user",
       name,
       bio: bio || "",
       avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
       coverPhoto: `https://picsum.photos/seed/${id}/800/300`,
       photos: [],
       friends: [],
       followers: [],
       following: [],
       connections: [],
       relationships: [],
       blocked: false,
       joinedAt: new Date().toISOString(),
       lastSeen: new Date().toISOString(),
       location: location || "",
       birthDate: birthDate || "",
       gender: gender || "",
       interests: [],
        lookingFor: null,
        relationshipStatus: null,
        chatTheme: 'default',
        chatThemeCustom: null,
      };

    db.users.set(id, user);
    db.notifications.set(id, []);
    db.friendRequests.set(id, []);

    saveDb();

    const token = jwt.sign({ id, role: "user" }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = [...db.users.values()].find((u) => u.email === email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (user.blocked)
      return res.status(403).json({ error: "Account is blocked" });

    // Google-only accounts have no local password set
    if (!user.password) {
      return res.status(401).json({ error: "This account uses Google sign-in. Please use the \"Continue with Google\" button." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    user.lastSeen = new Date().toISOString();
    saveDb();
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GOOGLE OAUTH ROUTES (Sign in with Gmail) ────────────────────────────────
app.get("/api/auth/config", (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID, googleEnabled: Boolean(GOOGLE_CLIENT_ID) });
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: "Google credential is required" });
    }

    // Verify the ID token against Google
    const profile = await verifyGoogleToken(credential);
    if (!profile) {
      return res.status(401).json({ error: "Google sign-in verification failed. Please try again." });
    }

    const email = (profile.email || "").toLowerCase();
    const googleId = profile.sub;
    const name = profile.name || profile.email || "Google User";
    const avatar = profile.picture || null;

    if (!email && !googleId) {
      return res.status(400).json({ error: "Google account has no email or ID." });
    }

    // Existing user by Google sub, then by email
    let user = [...db.users.values()].find((u) => u.googleId === googleId);
    if (!user && email) {
      user = [...db.users.values()].find((u) => u.email === email);
    }

    let created = false;
    if (user) {
      // Attach googleId to existing account if not already set
      if (!user.googleId) user.googleId = googleId;
      if (avatar && !user.avatar) user.avatar = avatar;
    } else {
      // Auto-create a new account from the Google profile
      let username = (profile.email ? profile.email.split("@")[0] : "googleuser");
      username = username.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || `guser${googleId.slice(0, 6)}`;
      // Ensure unique username
      const taken = new Set([...db.users.values()].map((u) => u.username));
      let finalUsername = username;
      let i = 1;
      while (taken.has(finalUsername)) {
        finalUsername = `${username}${i++}`;
      }

      const id = uuidv4();
      user = {
        id,
        googleId,
        username: finalUsername,
        email: email || null,
        password: null, // No local password for Google-only accounts
        role: "user",
        name,
        bio: "",
        avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
        coverPhoto: `https://picsum.photos/seed/${id}/800/300`,
        photos: [],
        friends: [],
        followers: [],
        following: [],
        connections: [],
        relationships: [],
        blocked: false,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        location: "",
        birthDate: "",
        gender: "",
        interests: [],
        lookingFor: null,
        relationshipStatus: null,
        authProvider: "google",
      };
      db.users.set(id, user);
      db.notifications.set(id, []);
      db.friendRequests.set(id, []);
      db.relationships.set(id, []);
      created = true;
    }

    user.lastSeen = new Date().toISOString();
    saveDb();

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(created ? 201 : 200).json({
      token,
      user: sanitizeUser(user),
      created,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN AUTH ROUTES (for triple-space popup) ───────────────────────────────
app.post("/api/auth/admin-register", async (req, res) => {
  try {
    const { name, email, password, adminSecret } = req.body;
    if (!name || !email || !password || !adminSecret)
      return res.status(400).json({ error: "All fields including admin secret are required" });

    if (adminSecret !== ADMIN_SECRET)
      return res.status(403).json({ error: "Invalid admin secret key" });

    for (const u of db.users.values()) {
      if (u.email === email)
        return res.status(409).json({ error: "Email already registered" });
    }

    const id = uuidv4();
    const user = {
      id,
      username: `admin_${id.slice(0, 6)}`,
      email,
      password: await bcrypt.hash(password, 10),
      role: "admin",
      name,
      bio: "Administrator",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
      coverPhoto: `https://picsum.photos/seed/${id}/800/300`,
      photos: [],
      friends: [],
      followers: [],
      following: [],
      connections: [],
      blocked: false,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      location: "",
      birthDate: "",
      gender: "",
      interests: [],
      lookingFor: null,
      relationshipStatus: null,
    };

    db.users.set(id, user);
    db.notifications.set(id, []);
    db.friendRequests.set(id, []);

    saveDb();

    const token = jwt.sign({ id, role: "admin" }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER ROUTES ──────────────────────────────────────────────────────────────
app.get("/api/me", authenticate, (req, res) => {
  const user = db.users.get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(sanitizeUser(user));
});

app.put("/api/me", authenticate, (req, res) => {
  const user = db.users.get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const allowed = [
    "name",
    "bio",
    "location",
    "birthDate",
    "gender",
    "interests",
    "lookingFor",
    "relationshipStatus",
    "relationshipWith",
    "relationshipVisibility",
    "avatar",
    "coverPhoto",
    "photos",
    "chatTheme",
    "chatThemeCustom",
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  saveDb();
  res.json(sanitizeUser(user));
});

app.get("/api/users/all", authenticate, adminOnly, (req, res) => {
  const realUsers = [...db.users.values()];
  const sampleBots = getPowerBotSample(50);
  res.json([...realUsers, ...sampleBots].map(sanitizeUser));
});

app.get("/api/users", authenticate, (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  let users = [...db.users.values()].filter(
    (u) => u.role !== "admin" && u.id !== req.user.id,
  );
  if (q) {
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.location || "").toLowerCase().includes(q),
    );
  } else {
    const botCount = Math.min(20, Math.max(6, Math.floor(Math.random() * 10) + 6));
    const powerBots = getPowerBotSample(botCount);
    users = [...users, ...powerBots];
  }
  res.json(users.map(sanitizeUser));
});

app.get("/api/users/:id", authenticate, (req, res) => {
  const user = resolveUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(sanitizeUser(user));
});

app.put("/api/users/:id", authenticate, adminOnly, (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const forbidden = ["id", "password"];
  for (const [k, v] of Object.entries(req.body)) {
    if (!forbidden.includes(k)) user[k] = v;
  }
  saveDb();
  res.json(sanitizeUser(user));
});

app.delete("/api/users/:id", authenticate, adminOnly, (req, res) => {
  if (!db.users.has(req.params.id))
    return res.status(404).json({ error: "User not found" });
  db.users.delete(req.params.id);
  saveDb();
  res.json({ message: "User deleted" });
});

app.post("/api/users/:id/block", authenticate, adminOnly, (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.blocked = true;
  saveDb();
  res.json({ message: "User blocked", user: sanitizeUser(user) });
});

app.post("/api/users/:id/unblock", authenticate, adminOnly, (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.blocked = false;
  saveDb();
  res.json({ message: "User unblocked", user: sanitizeUser(user) });
});

// ─── SOCIAL ROUTES ────────────────────────────────────────────────────────────
app.post("/api/friends/request/:id", authenticate, (req, res) => {
  const toId = req.params.id;
  const fromId = req.user.id;
  if (toId === fromId)
    return res.status(400).json({ error: "Cannot send request to yourself" });

  const toUser = resolveUser(toId);
  if (!toUser) return res.status(404).json({ error: "User not found" });

  if (isPowerBot(toId)) {
    const inter = getPowerBotInteractions(toId);
    if (inter.friends.includes(fromId))
      return res.status(409).json({ error: "Already friends" });
    inter.friends.push(fromId);
    const fromUser = db.users.get(fromId);
    if (fromUser && !fromUser.friends.includes(toId)) fromUser.friends.push(toId);
    saveDb();
    const fName = toUser.name || toId;
    addNotification(fromId, "friend_accept", toId, `${fName} accepted your friend request instantly ⚡`);
    return res.json({ message: "PowerBot accepted your friend request!" });
  }

  if (!db.friendRequests.has(toId)) db.friendRequests.set(toId, []);
  const existing = db.friendRequests.get(toId).find((r) => r.from === fromId);
  if (existing)
    return res.status(409).json({ error: "Friend request already sent" });

  if (toUser.friends.includes(fromId))
    return res.status(409).json({ error: "Already friends" });

  db.friendRequests
    .get(toId)
    .push({ from: fromId, time: new Date().toISOString() });

  saveDb();

  const fromUser = db.users.get(fromId);
  addNotification(
    toId,
    "friend_request",
    fromId,
    `${fromUser.name} sent you a friend request`,
  );
  res.json({ message: "Friend request sent" });
});

app.post("/api/friends/accept/:id", authenticate, (req, res) => {
  const fromId = req.params.id; // the one who originally sent
  const acceptId = req.user.id;

  if (!db.friendRequests.has(acceptId))
    return res.status(404).json({ error: "No pending request" });
  const requests = db.friendRequests.get(acceptId);
  const idx = requests.findIndex((r) => r.from === fromId);
  if (idx === -1)
    return res.status(404).json({ error: "No pending request from that user" });

  requests.splice(idx, 1);

  const acceptUser = db.users.get(acceptId);
  const fromUser = db.users.get(fromId);
  if (!acceptUser || !fromUser)
    return res.status(404).json({ error: "User not found" });

  if (!acceptUser.friends.includes(fromId)) acceptUser.friends.push(fromId);
  if (!fromUser.friends.includes(acceptId)) fromUser.friends.push(acceptId);

  saveDb();

  addNotification(
    fromId,
    "friend_accept",
    acceptId,
    `${acceptUser.name} accepted your friend request`,
  );
  res.json({ message: "Friend request accepted" });
});

app.post("/api/friends/reject/:id", authenticate, (req, res) => {
  const fromId = req.params.id;
  const rejectId = req.user.id;

  if (!db.friendRequests.has(rejectId))
    return res.status(404).json({ error: "No pending request" });
  const requests = db.friendRequests.get(rejectId);
  const idx = requests.findIndex((r) => r.from === fromId);
  if (idx === -1)
    return res.status(404).json({ error: "No pending request from that user" });

  requests.splice(idx, 1);
  saveDb();
  res.json({ message: "Friend request rejected" });
});

app.get("/api/friends/requests", authenticate, (req, res) => {
  const requests = db.friendRequests.get(req.user.id) || [];
  const enriched = requests.map((r) => ({
    ...r,
    user: sanitizeUser(resolveUser(r.from)),
  }));
  res.json(enriched);
});

app.get("/api/friends/list", authenticate, (req, res) => {
  const user = db.users.get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const friendIds = user.friends || [];
  const friends = friendIds
    .map(id => sanitizeUser(resolveUser(id)))
    .filter(Boolean);
  res.json(friends);
});

app.get("/api/friends/sent", authenticate, (req, res) => {
  const userId = req.user.id;
  const sent = [];
  for (const [toId, requests] of db.friendRequests) {
    const reqFromUser = requests.find(r => r.from === userId);
    if (reqFromUser) {
      sent.push({ ...reqFromUser, to: toId, user: sanitizeUser(resolveUser(toId)) });
    }
  }
  res.json(sent);
});

app.post("/api/friends/remove/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const userId = req.user.id;
  const user = db.users.get(userId);
  const target = resolveUser(targetId);
  if (!user || !target) return res.status(404).json({ error: "User not found" });

  user.friends = (user.friends || []).filter(id => id !== targetId);
  if (!isPowerBot(targetId)) {
    const targetUser = db.users.get(targetId);
    if (targetUser) {
      targetUser.friends = (targetUser.friends || []).filter(id => id !== userId);
    }
  } else {
    const inter = getPowerBotInteractions(targetId);
    if (inter) inter.friends = (inter.friends || []).filter(id => id !== userId);
  }
  saveDb();
  res.json({ message: "Friend removed" });
});

app.post("/api/friends/cancel/:id", authenticate, (req, res) => {
  const toId = req.params.id;
  const userId = req.user.id;
  if (!db.friendRequests.has(toId))
    return res.status(404).json({ error: "No pending request" });
  const requests = db.friendRequests.get(toId);
  const idx = requests.findIndex(r => r.from === userId);
  if (idx === -1)
    return res.status(404).json({ error: "No pending request to that user" });
  requests.splice(idx, 1);
  saveDb();
  res.json({ message: "Friend request cancelled" });
});

app.post("/api/follow/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;
  if (targetId === followerId)
    return res.status(400).json({ error: "Cannot follow yourself" });

  const target = resolveUser(targetId);
  const follower = db.users.get(followerId);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (isPowerBot(targetId)) {
    const inter = getPowerBotInteractions(targetId);
    if (!inter.followers.includes(followerId)) inter.followers.push(followerId);
    if (!inter.following.includes(followerId)) inter.following.push(followerId);
    if (follower && !follower.following.includes(targetId)) follower.following.push(targetId);
    saveDb();
    return res.json({ message: "Followed PowerBot successfully ⚡" });
  }

  if (!target.followers.includes(followerId)) {
    target.followers.push(followerId);
    addNotification(
      targetId,
      "follow",
      followerId,
      `${follower.name} started following you`,
    );
    if (follower.following.includes(targetId)) {
      addNotification(
        followerId,
        "follow_back",
        targetId,
        `${target.name} followed you back`,
      );
    }
  }
  if (!follower.following.includes(targetId)) follower.following.push(targetId);

  saveDb();
  res.json({ message: "Followed successfully" });
});

app.post("/api/unfollow/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;

  const target = resolveUser(targetId);
  const follower = db.users.get(followerId);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (isPowerBot(targetId)) {
    const inter = getPowerBotInteractions(targetId);
    inter.followers = inter.followers.filter((id) => id !== followerId);
    inter.following = inter.following.filter((id) => id !== followerId);
    if (follower) follower.following = follower.following.filter((id) => id !== targetId);
    saveDb();
    return res.json({ message: "Unfollowed PowerBot" });
  }

  target.followers = target.followers.filter((id) => id !== followerId);
  follower.following = follower.following.filter((id) => id !== targetId);
  saveDb();
  res.json({ message: "Unfollowed successfully" });
});

app.post("/api/connect/:id", authenticate, (req, res) => {
   const targetId = req.params.id;
   const requesterId = req.user.id;
   if (targetId === requesterId)
     return res.status(400).json({ error: "Cannot connect with yourself" });

   const target = resolveUser(targetId);
   const requester = db.users.get(requesterId);
   if (!target) return res.status(404).json({ error: "User not found" });

   if (isPowerBot(targetId)) {
     const inter = getPowerBotInteractions(targetId);
     if (!requester.connections.includes(targetId)) requester.connections.push(targetId);
     if (!inter.connections.includes(requesterId)) inter.connections.push(requesterId);
     saveDb();
     addNotification(requesterId, "match", targetId, `You matched with ${target.name}! 🎉⚡`);
     return res.json({ message: "It's a match!", match: true });
   }

   if (!requester.connections.includes(targetId))
     requester.connections.push(targetId);

   saveDb();

   // Check for mutual connection (match)
   if (target.connections.includes(requesterId)) {
     addNotification(
       targetId,
       "match",
       requesterId,
       `You matched with ${requester.name}! 🎉`,
     );
     addNotification(
       requesterId,
       "match",
       targetId,
       `You matched with ${target.name}! 🎉`,
     );
     return res.json({ message: "It's a match!", match: true });
   }

  addNotification(
    targetId,
    "connect_request",
    requesterId,
    `${requester.name} wants to connect with you`,
  );
  res.json({ message: "Connection request sent", match: false });
});

// Accept connection request and set relationship type
app.post("/api/connect/accept/:id", authenticate, (req, res) => {
  const fromId = req.params.id;
  const acceptId = req.user.id;
  const { relationshipType } = req.body; // 'single', 'dating', 'relationship', 'married', 'complicated'

  const validTypes = ['single', 'dating', 'relationship', 'married', 'complicated', 'engaged', 'open', 'partner'];
  const relType = validTypes.includes(relationshipType) ? relationshipType : 'single';

  const acceptor = db.users.get(acceptId);
  const requester = db.users.get(fromId);
  if (!acceptor || !requester) return res.status(404).json({ error: "User not found" });

  // Add each other to connections
  if (!acceptor.connections.includes(fromId)) acceptor.connections.push(fromId);
  if (!requester.connections.includes(acceptId)) requester.connections.push(acceptId);

  // Set relationship
  if (!db.relationships.has(acceptId)) db.relationships.set(acceptId, []);
  if (!db.relationships.has(fromId)) db.relationships.set(fromId, []);
  
  db.relationships.get(acceptId).push({
    withUserId: fromId,
    type: relType,
    time: new Date().toISOString()
  });
  db.relationships.get(fromId).push({
    withUserId: acceptId,
    type: relType,
    time: new Date().toISOString()
  });

  // Update relationship status on both users
  const relStatusMap = {
    single: 'Single',
    dating: 'Dating',
    relationship: 'In a Relationship',
    married: 'Married',
    complicated: "It's Complicated",
    engaged: 'Engaged',
    open: 'Open Relationship',
    partner: 'Life Partner'
  };
  acceptor.relationshipStatus = relStatusMap[relType];
  requester.relationshipStatus = relStatusMap[relType];
  // Set relationshipWith (who they are in a relationship with)
  if (relType !== 'single' && relType !== '') {
    acceptor.relationshipWith = fromId;
    requester.relationshipWith = acceptId;
    acceptor.relationshipVisibility = acceptor.relationshipVisibility || 'show';
    requester.relationshipVisibility = requester.relationshipVisibility || 'show';
  }

  saveDb();

  addNotification(
    fromId,
    "connect_accept",
    acceptId,
    `${acceptor.name} accepted your connection (${relType})`,
  );

  res.json({ message: "Connection accepted", relationshipType: relType });
});

// Follow back endpoint
app.post("/api/follow/back/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;
  if (targetId === followerId)
    return res.status(400).json({ error: "Cannot follow yourself" });

  const target = resolveUser(targetId);
  const follower = db.users.get(followerId);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (isPowerBot(targetId)) {
    const inter = getPowerBotInteractions(targetId);
    if (!inter.followers.includes(followerId)) inter.followers.push(followerId);
    if (!inter.following.includes(followerId)) inter.following.push(followerId);
    if (follower && !follower.following.includes(targetId)) follower.following.push(targetId);
    saveDb();
    return res.json({ message: "Follow back PowerBot successful ⚡" });
  }

  if (!target.followers.includes(followerId)) target.followers.push(followerId);
  if (!follower.following.includes(targetId)) follower.following.push(targetId);
  saveDb();
  res.json({ message: "Follow back successful" });
});

// ─── POST ROUTES ──────────────────────────────────────────────────────────────
function populatePost(post) {
  const author = sanitizeUser(resolveUser(post.authorId));
  const comments = (post.comments || []).map((c) => ({
    ...c,
    user: sanitizeUser(resolveUser(c.userId)),
  }));
  return { ...post, author, comments };
}

function getPowerBotInteractions(botId) {
  if (!db.powerBotInteractions.has(botId)) {
    db.powerBotInteractions.set(botId, { friends: [], followers: [], following: [], connections: [] });
  }
  return db.powerBotInteractions.get(botId);
}

function isPowerBot(userId) {
  return /^pbot_\d+$/.test(userId);
}

app.get("/api/posts", authenticate, (req, res) => {
  const { userId } = req.query;
  let posts = [...db.posts.values()];
  if (userId) posts = posts.filter((p) => p.authorId === userId);
  posts.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(posts.map(populatePost));
});

app.post("/api/posts", authenticate, (req, res) => {
  const { text, image } = req.body;
  if (!text && !image)
    return res.status(400).json({ error: "Post must have text or image" });

  const post = {
    id: uuidv4(),
    authorId: req.user.id,
    text: text || "",
    image: image || null,
    likes: [],
    comments: [],
    time: new Date().toISOString(),
  };
  db.posts.set(post.id, post);
  saveDb();

  const populated = populatePost(post);
  io.emit("new_post", populated);
  res.status(201).json(populated);
});

app.delete("/api/posts/:id", authenticate, (req, res) => {
  const post = db.posts.get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  if (post.authorId !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Not authorized" });

  db.posts.delete(req.params.id);
  saveDb();
  io.emit("delete_post", req.params.id);
  res.json({ message: "Post deleted" });
});

app.post("/api/posts/:id/like", authenticate, (req, res) => {
   const post = db.posts.get(req.params.id);
   if (!post) return res.status(404).json({ error: "Post not found" });

   const uid = req.user.id;
   const idx = post.likes.indexOf(uid);
   if (idx === -1) {
     post.likes.push(uid);
     if (post.authorId !== uid) {
       const liker = db.users.get(uid);
       addNotificationWithPost(
         post.authorId,
         "like",
         uid,
         `${liker.name} liked your post`,
         post.id
       );
     }
   } else {
     post.likes.splice(idx, 1);
   }

   saveDb();
   io.emit("post_like", { postId: post.id, likes: post.likes });
   res.json({ likes: post.likes });
 });

app.post("/api/posts/:id/comment", authenticate, (req, res) => {
   const post = db.posts.get(req.params.id);
   if (!post) return res.status(404).json({ error: "Post not found" });

   const { text } = req.body;
   if (!text) return res.status(400).json({ error: "Comment text required" });

   const commenter = db.users.get(req.user.id);
   const comment = {
     id: uuidv4(),
     userId: req.user.id,
     text,
     time: new Date().toISOString(),
   };
   post.comments.push(comment);
   saveDb();

   if (post.authorId !== req.user.id) {
     addNotificationWithPost(
       post.authorId,
       "comment",
       req.user.id,
       `${commenter.name} commented on your post`,
       post.id
     );
   }

   const enriched = { ...comment, user: sanitizeUser(commenter) };
   io.emit("new_comment", { postId: post.id, comment: enriched });
   res.status(201).json(enriched);
 });

// ─── REELS ROUTES ──────────────────────────────────────────────────────────────
function populateReel(reel) {
  const author = reel.authorId ? sanitizeUser(resolveUser(reel.authorId)) : null;
  const comments = (reel.comments || []).map(c => ({
    ...c,
    user: sanitizeUser(resolveUser(c.userId)),
  }));
  return { ...reel, author, comments };
}

app.get("/api/reels", optionalAuth, (req, res) => {
  const { userId, type, search, page = 1, limit = 10 } = req.query;
  let reels = [...db.reels.values()].filter(r => !r.blocked);
  if (userId) reels = reels.filter(r => r.authorId === userId);
  if (search) {
    const q = search.toLowerCase();
    reels = reels.filter(r =>
      (r.caption || '').toLowerCase().includes(q) ||
      (r.authorName || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (type === 'trending') {
    reels.sort((a, b) => ((b.likes?.length || 0) + (b.views || 0)) - ((a.likes?.length || 0) + (a.views || 0)));
  } else if (type === 'following') {
    const userId = req.user?.id;
    const user = userId ? db.users.get(userId) : null;
    const following = user?.following || [];
    reels = reels.filter(r => following.includes(r.authorId));
    reels.sort((a, b) => new Date(b.time) - new Date(a.time));
  } else {
    reels.sort((a, b) => new Date(b.time) - new Date(a.time));
  }
  const start = (parseInt(page) - 1) * parseInt(limit);
  const paged = reels.slice(start, start + parseInt(limit));
  res.json({
    reels: paged.map(populateReel),
    total: reels.length,
    page: parseInt(page),
    hasMore: start + parseInt(limit) < reels.length,
  });
});

app.get("/api/reels/pexels", optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = Math.min(parseInt(req.query.per_page) || 10, 20);
    const q = req.query.q ? '&q=' + encodeURIComponent(req.query.q) : '';
    const pixabayKey = process.env.PIXABAY_API_KEY;
    if (!pixabayKey) return res.status(400).json({ error: "PIXABAY_API_KEY not set in .env" });
    const pbRes = await fetch(`https://pixabay.com/api/videos/?key=${pixabayKey}&page=${page}&per_page=${perPage}${q}&safesearch=true`);
    if (!pbRes.ok) throw new Error('Pixabay API error: ' + pbRes.status);
    const data = await pbRes.json();
    const videos = (data.hits || []).map(v => {
      const videos = v.videos || {};
      const medium = videos.medium || videos.small || videos.tiny || {};
      return {
        id: 'pixabay_' + v.id,
        videoUrl: medium.url || '',
        username: v.user || 'Pixabay User',
        userAvatar: v.userImageURL || '',
        caption: v.tags || 'Via Pixabay',
        duration: v.duration,
        width: medium.width || 0,
        height: medium.height || 0,
        thumbnail: medium.thumbnail || '',
      };
    });
    res.json({ videos, total: data.total, page, hasMore: (page * perPage) < data.totalHits });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get("/api/reels/:id", optionalAuth, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  res.json(populateReel(reel));
});

app.post("/api/reels", authenticate, (req, res) => {
  const { caption, audio, videoUrl, tags } = req.body;
  if (!videoUrl) return res.status(400).json({ error: "Video URL required" });
  const user = db.users.get(req.user.id);
  const reel = {
    id: uuidv4(),
    authorId: req.user.id,
    authorName: user?.name || 'Unknown',
    authorAvatar: user?.avatar || '',
    videoUrl,
    thumbnailUrl: null,
    caption: caption || '',
    audio: audio || '',
    tags: tags || [],
    likes: [],
    comments: [],
    saves: [],
    views: 0,
    time: new Date().toISOString(),
    blocked: false,
    reported: false,
  };
  db.reels.set(reel.id, reel);
  saveDb();
  const populated = populateReel(reel);
  io.emit("new_reel", populated);
  res.status(201).json(populated);
});

app.delete("/api/reels/:id", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  if (reel.authorId !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Not authorized" });
  db.reels.delete(req.params.id);
  saveDb();
  io.emit("delete_reel", req.params.id);
  res.json({ message: "Reel deleted" });
});

app.put("/api/reels/:id", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  if (reel.authorId !== req.user.id && req.user.role !== "admin")
    return res.status(403).json({ error: "Not authorized" });
  const { caption, audio, tags } = req.body;
  if (caption !== undefined) reel.caption = caption;
  if (audio !== undefined) reel.audio = audio;
  if (tags !== undefined) reel.tags = tags;
  saveDb();
  res.json(populateReel(reel));
});

app.post("/api/reels/:id/like", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const uid = req.user.id;
  const idx = reel.likes.indexOf(uid);
  if (idx === -1) {
    reel.likes.push(uid);
    if (reel.authorId !== uid) {
      const liker = db.users.get(uid);
      addNotification(reel.authorId, "like", uid, `${liker?.name || 'Someone'} liked your reel`);
    }
  } else {
    reel.likes.splice(idx, 1);
  }
  saveDb();
  io.emit("reel_like", { reelId: reel.id, likes: reel.likes });
  res.json({ likes: reel.likes });
});

app.post("/api/reels/:id/comment", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Comment text required" });
  const commenter = db.users.get(req.user.id);
  const comment = {
    id: uuidv4(),
    userId: req.user.id,
    text,
    time: new Date().toISOString(),
  };
  reel.comments.push(comment);
  saveDb();
  if (reel.authorId !== req.user.id) {
    addNotification(reel.authorId, "comment", req.user.id, `${commenter?.name || 'Someone'} commented on your reel`);
  }
  const enriched = { ...comment, user: sanitizeUser(commenter) };
  io.emit("reel_comment", { reelId: reel.id, comment: enriched });
  res.status(201).json(enriched);
});

app.post("/api/reels/:id/save", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  const uid = req.user.id;
  const idx = reel.saves.indexOf(uid);
  if (idx === -1) reel.saves.push(uid);
  else reel.saves.splice(idx, 1);
  saveDb();
  res.json({ saves: reel.saves });
});

app.post("/api/reels/:id/view", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  reel.views = (reel.views || 0) + 1;
  saveDb();
  res.json({ views: reel.views });
});

app.post("/api/reels/:id/report", authenticate, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  reel.reported = true;
  saveDb();
  res.json({ message: "Reel reported" });
});

app.post("/api/reels/:id/block", authenticate, adminOnly, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  reel.blocked = true;
  saveDb();
  res.json({ message: "Reel blocked" });
});

app.post("/api/reels/:id/unblock", authenticate, adminOnly, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  reel.blocked = false;
  saveDb();
  res.json({ message: "Reel unblocked" });
});

// ─── PIXABAY REELS PROXY ──────────────────────────────────────────────────────
// ─── CHAT ROUTES ──────────────────────────────────────────────────────────────
// GET recent conversations (WhatsApp-style chat list)
app.get("/api/chat/recent", authenticate, (req, res) => {
  const myId = req.user.id;
  const recents = [];
  for (const [key, msgs] of db.chats.entries()) {
    const parts = key.split("_");
    if (!parts.includes(myId)) continue;
    const otherId = parts.find(id => id !== myId);
    if (!otherId || !msgs.length) continue;
    const user = db.users.get(otherId);
    const last = msgs[msgs.length - 1];
    const unread = msgs.filter(m => m.receiverId === myId && !m.read).length;
    recents.push({
      user: user ? sanitizeUser(user) : { id: otherId },
      lastMessage: last,
      unread,
      updatedAt: last.time,
    });
  }
  recents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(recents);
});

// GET unread message counts per user
app.get("/api/chat/unread/counts", authenticate, (req, res) => {
  const myId = req.user.id;
  const counts = {};
  let total = 0;
  for (const [key, msgs] of db.chats.entries()) {
    const parts = key.split('_');
    if (parts.includes(myId)) {
      const otherId = parts.find(id => id !== myId);
      const unread = msgs.filter(m => m.receiverId === myId && !m.read).length;
      if (unread > 0) {
        counts[otherId] = (counts[otherId] || 0) + unread;
        total += unread;
      }
    }
  }
  res.json({ total, counts });
});

app.get("/api/chat/:userId", authenticate, (req, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  const key = chatKey(myId, otherId);

  if (!db.chats.has(key)) db.chats.set(key, []);
  const messages = db.chats.get(key);

  // Mark received messages as read and persist
  let changed = false;
  const newlyRead = [];
  messages.forEach((m) => {
    if (m.receiverId === myId && !m.read) {
      m.read = true; changed = true;
      newlyRead.push(m.id);
    }
  });
  if (changed) saveDb();

  // Notify the sender in real time so their ticks turn blue (✓✓)
  if (newlyRead.length) {
    const senderSocket = onlineUsers.get(otherId);
    if (senderSocket) {
      io.to(senderSocket).emit("messages_read", { chatKey: key, messageIds: newlyRead, byUserId: myId });
    }
  }

  res.json(messages);
});

// ─── AI CHAT ROUTE ────────────────────────────────────────────────────────────
// AI Chat — Default provider: Groq (fast & free AI inference)
// Users can add their own API key in settings (Groq, OpenAI, OpenRouter, or Gemini)
const AI_API_KEY = process.env.AI_API_KEY || "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";
const AI_MODEL = "llama-3.3-70b-versatile";
const AI_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const AI_FALLBACK = [
  "That's a great question! On SocialConnect, you can connect with people by sending friend requests, following them, or sending connection requests. Head to the 'Find People' tab to discover new people!",
  "I'd be happy to help with that! SocialConnect offers features like posting updates, chatting with friends, voice/video calls, and building your network. What would you like to know more about?",
  "Great question! You can customize your profile by going to Settings. Update your photo, bio, location, and more to make your profile stand out!",
  "Here's a tip: being active on SocialConnect helps you build connections. Share posts, comment on others' content, and engage with your community regularly.",
  "That's interesting! SocialConnect is designed to help you build meaningful connections. Whether you're here to make friends, network professionally, or just share your thoughts, there's a place for you!",
];

app.post("/api/ai/chat", authenticate, async (req, res) => {
  const { message, history, apiKey } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: "Message is required" });
  }

  const activeKey = (apiKey || AI_API_KEY || '').trim();
  const isGemini = activeKey.startsWith('AIza');
  const isOpenRouter = activeKey.startsWith('sk-or-v1-');
  const isGroq = activeKey.startsWith('gsk_');

  // If no API key is configured at all, return fallback immediately
  if (!activeKey) {
    return res.json({
      response: AI_FALLBACK[Math.floor(Math.random() * AI_FALLBACK.length)] + "\n\n💡 _No API key configured. Go to settings ⚙️ and add your own key (Groq, OpenRouter, OpenAI, or Gemini) to use the full AI chat._",
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }

  const sysPrompt = "You are SocialConnect AI, a helpful assistant for a social networking platform. Be concise, friendly, and helpful. Use emojis occasionally. Keep responses under 150 words.";

  try {
    let reply;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    if (isGemini) {
      const contents = [];
      if (Array.isArray(history)) {
        for (const h of history.slice(-20)) {
          if (h.role && h.content && h.role !== 'system') {
            contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] });
          }
        }
      }
      contents.push({ role: "user", parts: [{ text: message }] });

      const gRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + encodeURIComponent(activeKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: sysPrompt }] },
          generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => '');
        console.error('Gemini AI error:', gRes.status, errText.slice(0, 300));
        if (gRes.status === 403 || gRes.status === 401) return res.json({ response: "⚠️ Invalid Gemini API key.", timestamp: new Date().toISOString() });
        if (gRes.status === 429) return res.json({ response: "⚠️ Too many requests! Try again later.", timestamp: new Date().toISOString() });
        throw new Error(errText || `HTTP ${gRes.status}`);
      }
      const gData = await gRes.json();
      reply = gData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
    } else if (isOpenRouter) {
      const messages = [{ role: "system", content: sysPrompt }];
      if (Array.isArray(history)) {
        for (const h of history.slice(-20)) {
          if (h.role && h.content && h.role !== 'system') {
            messages.push({ role: h.role, content: h.content });
          }
        }
      }
      messages.push({ role: "user", content: message });

      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + activeKey,
          'HTTP-Referer': 'https://socialconnect.local',
          'X-Title': 'SocialConnect'
        },
        body: JSON.stringify({ model: "deepseek/deepseek-v4-flash:free", messages, max_tokens: 500, temperature: 0.7 }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!orRes.ok) {
        const errText = await orRes.text().catch(() => '');
        console.error('OpenRouter AI error:', orRes.status, errText.slice(0, 300));
        if (orRes.status === 403 || orRes.status === 401) return res.json({ response: "⚠️ Invalid OpenRouter API key.", timestamp: new Date().toISOString() });
        if (orRes.status === 429) return res.json({ response: "⚠️ Too many requests! Try again later.", timestamp: new Date().toISOString() });
        throw new Error(errText || `HTTP ${orRes.status}`);
      }
      const orData = await orRes.json();
      reply = orData.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";
    } else {
      // Default: OpenAI-compatible API (OpenRouter, OpenAI, or any OpenAI-compatible endpoint)
      const messages = [{ role: "system", content: sysPrompt }];
      if (Array.isArray(history)) {
        for (const h of history.slice(-20)) {
          if (h.role && h.content && h.role !== 'system') {
            messages.push({ role: h.role, content: h.content });
          }
        }
      }
      messages.push({ role: "user", content: message });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + activeKey
      };

      // If pointing to OpenRouter, include required headers
      if (AI_API_URL.includes('openrouter.ai')) {
        headers['HTTP-Referer'] = 'https://socialconnect.local';
        headers['X-Title'] = 'SocialConnect';
      }

      const response = await fetch(AI_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: 500, temperature: 0.7 }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error('AI API error:', response.status, errText.slice(0, 300));
        if (response.status === 403 || response.status === 401) return res.json({ response: "⚠️ Invalid API key. Go to settings ⚙️ and add a valid key.", timestamp: new Date().toISOString() });
        if (response.status === 429) return res.json({ response: "⚠️ Too many requests! Try again later.", timestamp: new Date().toISOString() });
        throw new Error(errText || `HTTP ${response.status}`);
      }
      const data = await response.json();
      reply = data.choices?.[0]?.message?.content || "I'm not sure how to respond to that.";
    }

    res.json({ response: reply.trim(), timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('AI chat error:', err.message);
    res.json({
      response: AI_FALLBACK[Math.floor(Math.random() * AI_FALLBACK.length)] + "\n\n_(AI API unavailable — using offline fallback. Add your own API key in settings ⚙️ for full AI chat.)_",
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
});

// ─── NOTIFICATION ROUTES ──────────────────────────────────────────────────────
app.get("/api/notifications", authenticate, (req, res) => {
  const notifs = db.notifications.get(req.user.id) || [];
  const enriched = notifs.map(n => {
    const fromUser = n.fromId ? resolveUser(n.fromId) : null;
    return {
      ...n,
      fromName: fromUser ? fromUser.name : null,
      fromAvatar: fromUser ? fromUser.avatar : null,
    };
  });
  // Sort: unread first, then by priority (high > medium > low), then by time
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  enriched.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    const pDiff = (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    if (pDiff !== 0) return pDiff;
    return new Date(b.time) - new Date(a.time);
  });
  res.json(enriched);
});

app.put("/api/notifications/read", authenticate, (req, res) => {
  const notifs = db.notifications.get(req.user.id) || [];
  notifs.forEach((n) => {
    n.read = true;
  });
  saveDb();
  res.json({ message: "All notifications marked as read" });
});

app.put("/api/notifications/read/:id", authenticate, (req, res) => {
  const notifs = db.notifications.get(req.user.id) || [];
  const notif = notifs.find(n => n.id === req.params.id);
  if (notif) {
    notif.read = true;
    saveDb();
    res.json({ message: "Notification marked as read" });
  } else {
    res.status(404).json({ error: "Notification not found" });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get("/api/admin/stats", authenticate, adminOnly, (req, res) => {
  const allUsers = [...db.users.values()];
  let totalMessages = 0;
  for (const msgs of db.chats.values()) totalMessages += msgs.length;

  res.json({
    totalUsers: allUsers.filter((u) => u.role !== "admin").length,
    powerBots: 1000000,
    blockedUsers: allUsers.filter((u) => u.blocked).length,
    activeUsers: onlineUsers.size,
    totalPosts: db.posts.size,
    totalReels: db.reels.size,
    totalMessages,
  });
});

app.get("/api/admin/reels", authenticate, adminOnly, (req, res) => {
  const reels = [...db.reels.values()].map(populateReel);
  reels.sort((a, b) => new Date(b.time) - new Date(a.time));
  res.json(reels);
});

app.post("/api/admin/reels/:id/block", authenticate, adminOnly, (req, res) => {
  const reel = db.reels.get(req.params.id);
  if (!reel) return res.status(404).json({ error: "Reel not found" });
  reel.blocked = true;
  saveDb();
  io.emit("reel_blocked", req.params.id);
  res.json({ message: "Reel blocked" });
});

app.post("/api/admin/users", authenticate, adminOnly, async (req, res) => {
  try {
    const { name, username, email, password, role, gender, location } =
      req.body;
    if (!name || !username || !email || !password)
      return res
        .status(400)
        .json({ error: "name, username, email, and password are required" });

    for (const u of db.users.values()) {
      if (u.email === email)
        return res.status(409).json({ error: "Email already registered" });
      if (u.username === username)
        return res.status(409).json({ error: "Username already taken" });
    }

    const id = uuidv4();
    const user = {
      id,
      username,
      email,
      password: await bcrypt.hash(password, 10),
      role: role || "user",
      name,
      bio: "",
      photos: [],
      friends: [],
      followers: [],
      following: [],
      connections: [],
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=128`,
      coverPhoto: `https://picsum.photos/seed/${id}/800/300`,
      blocked: false,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      location: location || "",
      birthDate: "",
      gender: gender || "",
      interests: [],
      lookingFor: null,
      relationshipStatus: null,
    };

    db.users.set(id, user);
    db.notifications.set(id, []);
    db.friendRequests.set(id, []);
    saveDb();
    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KEEP-ALIVE / PHONE CONTROL ROUTES ───────────────────────────────────────
app.get("/api/control/status", (req, res) => {
  res.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    totalUsers: db.users.size,
    activeUsers: onlineUsers.size,
    totalPosts: db.posts.size,
totalChats: db.chats.size,
    dataManager: dataManager.getStats(),
    supabase: supabaseStore.getStats(),
    dynamodb: dynamoDBStore.getStats(),
    message: "Control endpoint is active",
  });
});

app.get("/api/control/ping", (req, res) => {
  console.log("📡 Keep-alive ping received from", req.ip);
  res.json({
    status: "pong",
    serverTime: new Date().toISOString(),
    message: "Server is awake",
  });
});

app.post("/api/control/wake", (req, res) => {
  console.log("🚀 Wake request received from", req.ip);
  res.json({
    status: "woken",
    serverTime: new Date().toISOString(),
    message: "Server wake signal received",
  });
});

// ─── Load media libraries from JSON (generated by download-media.js) ────────
const GIFS_DIR = path.join(__dirname, 'public', 'media', 'gifs');
const STICKERS_DIR = path.join(__dirname, 'public', 'media', 'stickers');

const GIF_LIBRARY_PATH = path.join(__dirname, 'gif-library.json');
const STICKER_LIBRARY_PATH = path.join(__dirname, 'sticker-library.json');
const ANIMATED_EMOJI_PATH = path.join(__dirname, 'animated-emoji-data.json');
const META_PATH = path.join(__dirname, 'public', 'media', 'media-meta.json');

function loadJsonOrFallback(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`⚠ Could not load ${filePath}: ${e.message}`);
  }
  return fallback;
}

function humanizeName(filename) {
  const base = filename.replace(/\.(gif|png|webp|jpg|jpeg|svg)$/i, '');
  let name = base
    .replace(/ ?\(?\d+\)?$/, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) name = base;
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function scanDirectory(dir, exts, garbagePatterns) {
  const results = [];
  try {
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); return results; }
    const files = fs.readdirSync(dir);
    files.forEach(f => {
      const ext = path.extname(f).toLowerCase();
      if (!exts.has(ext)) return;
      if (garbagePatterns.some(p => p.test(f))) return;
      // Skip tiny tracking pixels (< 1KB)
      try {
        const stat = fs.statSync(path.join(dir, f));
        if (stat.size < 1024) return;
      } catch (_) { return; }
      results.push(f);
    });
  } catch (e) {
    console.warn(`⚠ Could not scan ${dir}: ${e.message}`);
  }
  return results.sort();
}

function buildGifLibraryFromDisk() {
  const exts = new Set(['.gif', '.png', '.webp', '.jpg', '.jpeg']);
  const garbage = [/^giphy-(downsized|preview|hd|loop|small)/, /\d{4}-\d{2}-\d{2}T\d{6}/];
  const files = scanDirectory(GIFS_DIR, exts, garbage);
  return files.map(filename => {
    const name = humanizeName(filename);
    return {
      id: `g_${filename.replace(/[^a-zA-Z0-9]/g, '_')}`,
      giphyId: null,
      url: `/media/gifs/${filename}`,
      cdnUrl: null,
      name
    };
  });
}

function buildStickerLibraryFromDisk() {
  const exts = new Set(['.gif', '.png', '.webp', '.jpg', '.jpeg', '.svg']);
  const garbage = [/\.crdownload$/i, /\.json$/i, /\.mp4$/i, /\.lottie$/i, /\.avif$/i, /^Unconfirmed/i];
  const files = scanDirectory(STICKERS_DIR, exts, garbage);
  return files.map((filename, i) => ({
    id: `s_${i + 1}`,
    url: `/media/stickers/${filename}`,
    name: humanizeName(filename)
  }));
}

let GIF_LIBRARY = buildGifLibraryFromDisk();
let STICKER_LIBRARY = buildStickerLibraryFromDisk();
let ANIMATED_EMOJI_DATA = loadJsonOrFallback(ANIMATED_EMOJI_PATH, []);

// Periodically re-scan for new files (every 30s)
setInterval(() => {
  const freshGifs = buildGifLibraryFromDisk();
  if (freshGifs.length !== GIF_LIBRARY.length) {
    console.log(`🔄 GIF library updated: ${GIF_LIBRARY.length} → ${freshGifs.length}`);
    GIF_LIBRARY = freshGifs;
  }
}, 30000);
setInterval(() => {
  const freshStickers = buildStickerLibraryFromDisk();
  if (freshStickers.length !== STICKER_LIBRARY.length) {
    console.log(`🔄 Sticker library updated: ${STICKER_LIBRARY.length} → ${freshStickers.length}`);
    STICKER_LIBRARY = freshStickers;
  }
}, 30000);

// Ensure directories exist
[GIFS_DIR, STICKERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Emoji / GIF / Sticker library ──────────────────────────────────────────────
const EMOJI_DATA = {
    "Smileys": ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🥳","🥺","😢","😭","😤","😠","😡","🤬","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💋","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","🫶","✨","🌟","⭐","🌠","🔥","💫","⭐️","🌟","✨","⚡","☄️","💥","💢","💦","💨","🕳️","💬","🗯️","💭","🫥","😶‍🌫️","😮‍💨","😵‍💫","🥹","🫨","🫵","🫆","🫰","🫱","🫲","🫳","🫴","🫵","🫶","🫷","🫸","🫹","🫺","🫻","🫼","🫽","🫾","🫿","😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","🥲","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥴","😵","🤯","🥳","🥺","😢","😭","😤","😠","😡","🤬","💀","☠️","👻","👽","👾","🤖","💩","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
    "People": ["👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛","🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦","👶","🧒","👦","👧","🧑","👱","👨","👩","🧔","👴","👵","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","👮","🕵️","💂","🥷","👳","👸","🤴","👰","🤵","🤰","🫃","🫄","👼","🎅","🤶","🦸","🦹","🧙","🧚","🧛","🧜","🧝","🧞","🧟","🧌","💆","💇","🚶","🧍","🧎","🏃","💃","🕺","🕴️","👯","🧖","🧗","🤸","⛹️","🏋️","🚴","🚵","🤼","🤽","🤾","🤺","⛷️","🏂","🏄","🚣","🏊","🤿","🤽‍♀️","🤽‍♂️","🤾‍♀️","🤾‍♂️","🤺","⛷️","🏂","🏋️‍♀️","🏋️‍♂️","🚴‍♀️","🚴‍♂️","🚵‍♀️","🚵‍♂️","🤸‍♀️","🤸‍♂️","🤼‍♀️","🤼‍♂️","🤽‍♀️","🤽‍♂️","🤾‍♀️","🤾‍♂️","⛹️‍♀️","⛹️‍♂️","🏌️‍♀️","🏌️‍♂️","🏄‍♀️","🏄‍♂️","🚣‍♀️","🚣‍♂️","🏊‍♀️","🏊‍♂️","🤿","🧗‍♀️","🧗‍♂️","🧘‍♀️","🧘‍♂️","🛀","🛌","👼","🎅","🤶","🦸‍♀️","🦸‍♂️","🦹‍♀️","🦹‍♂️","🧙‍♀️","🧙‍♂️","🧚‍♀️","🧚‍♂️","🧛‍♀️","🧛‍♂️","🧜‍♀️","🧜‍♂️","🧝‍♀️","🧝‍♂️","🧞‍♀️","🧞‍♂️","🧟‍♀️","🧟‍♂️","🧌","💆‍♀️","💆‍♂️","💇‍♀️","💇‍♂️","🚶‍♀️","🚶‍♂️","🧍‍♀️","🧍‍♂️","🧎‍♀️","🧎‍♂️","🏃‍♀️","🏃‍♂️","💃","🕺"],
    "Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐒","🐔","🐧","🐦","🐤","🐣","🐥","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🪸","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦤","🦚","🦜","🦢","🦩","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐾","🐉","🐲","🐕‍🦺","🐈‍⬛","🪿","🪼","🪹","🪺","🪻","🪴","🪷","🪸","🪼","🪿","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪰","🪲","🪳","🦟","🦗","🕷️","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🦍","🦧","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔","🐾"],
    "Food": ["🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫒","🧄","🧅","🥔","🍠","🫘","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🦴","🌭","🍔","🍟","🍕","🫓","🥪","🥙","🧆","🌮","🌯","🫔","🥗","🥘","🫕","🥫","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜","🍯","🥛","🍼","🫖","☕","🍵","🧃","🥤","🧋","🍶","🍺","🍻","🥂","🍷","🫗","🥃","🍸","🍹","🧉","🍾","🧊","🥄","🍴","🥣","🍽️","🔪","🫙","🫘","🫚","🫛","🫐","🫑","🫒","🫓","🫔","🫕","🫖","🫗","🫘","🫙","🫚","🫛","🥑","🥒","🥬","🥦","🫑","🌶️","🫚","🫛","🥕","🌽","🥔","🍠","🫐","🍇","🍈","🍉","🍊","🍋","🍌","🍍","🥭","🍎","🍏","🍐","🍑","🍒","🍓","🫐","🥝","🍅","🫘","🫒","🧄","🧅","🥥","🥑","🍆","🥦","🥬","🥒","🌶️","🫑","🌽","🥕","🫘","🫒","🧄","🧅","🥔","🍠","🥐","🍞","🥖","🥨","🧀","🥚","🍳","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌭","🍔","🍟","🍕","🥪","🥙","🧆","🌮","🌯","🥗","🥘","🍝","🍜","🍲","🍛","🍣","🍱","🥟","🦪","🍤","🍙","🍚","🍘","🍥","🥠","🥮","🍢","🍡","🍧","🍨","🍦","🥧","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🥜"],
    "Travel": ["🌍","🌎","🌏","🌐","🗺️","🗾","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏘️","🏚️","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉","🌌","🎠","🎡","🎢","💈","🎪","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🚛","🚜","🏎️","🏍️","🛵","🛺","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","⛽","🛞","🚨","🚥","🚦","🛑","🚧","⚓","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🛹","🛼","🛻","🛴","🛵","🛺","🚲","🛞","🛟","⛵","🛶","🚤","🛳️","⛴️","🛥️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟","🚠","🚡","🛰️","🚀","🛸","🌍","🌎","🌏","🌐","🗺️","🗾","🧭","🏔️","⛰️","🌋","🗻","🏕️","🏖️","🏜️","🏝️","🏞️","🏟️","🏛️","🏗️","🧱","🪨","🪵","🛖","🏘️","🏚️","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽"],
    "Activities": ["🎃","🎄","🎆","🎇","🧨","✨","🎈","🎉","🎊","🎋","🎍","🎎","🎏","🎐","🎑","🧧","🎀","🎁","🎗️","🎟️","🎫","🎖️","🏆","🏅","🥇","🥈","🥉","⚽","⚾","🥎","🏀","🏐","🏈","🏉","🎾","🥏","🎳","🏏","🏑","🏒","🥍","🏓","🏸","🥊","🥋","🥅","⛳","⛸️","🎣","🤿","🎽","🎿","🛷","🥌","🎯","🪀","🪁","🔫","🎱","🔮","🪄","🎮","🕹️","🎰","🎲","🧩","♟️","🎴","🃏","🎭","🖼️","🎨","🧵","🪡","🧶","🪢","🪩","🪪","🪫","🪬","🪭","🪮","🪯","🪰","🪱","🪲","🪳","🪴","🪵","🪶","🪷","🪸","🪹","🪺","🪻","🪼","🪽","🪾","🪿","🫀","🫁","🫂","🫃","🫄","🫅","🫆","🫇","🫈","🫉","🫊","🫋","🫌","🫍","🫎","🫏","🫐","🫑","🫒","🫓","🫔","🫕","🫖","🫗","🫘","🫙","🫚","🫛","🫜","🫝","🫞","🫟","🫠","🫡","🫢","🫣","🫤","🫥","🫦","🫧","🫨","🫩","🫪","🫫","🫬","🫭","🏓","🏸","🥊","🥋","🥅","⛳","⛸️","🎣","🤿","🎽","🎿","🛷","🥌","🎯","🪀","🪁","🎱","🔮","🪄","🎮","🕹️","🎰","🎲","🧩","♟️","🎴","🃏","🎭","🎨","🧵","🪡","🧶"],
    "Objects": ["👓","🕶️","🥽","🥼","🦺","👔","👕","👖","🧣","🧤","🧥","🧦","👗","👘","🥻","🩱","🩲","🩳","👙","👚","👛","👜","👝","🛍️","🎒","🩴","👞","👟","🥾","🥿","👠","👡","🩰","👢","👑","👒","🎩","🎓","🧢","🪖","⛑️","💄","💍","💎","🔇","🔈","🔉","🔊","📢","📣","📯","🔔","🔕","🎼","🎵","🎶","🎙️","📻","🎛️","🎤","🎧","📻","🎷","🪗","🎸","🎺","🎻","🪘","🥁","🪇","📱","📲","☎️","📞","📟","📠","🔋","🪫","🔌","💻","🖥️","🖨️","⌨️","🖱️","🖲️","💽","💾","💿","📀","🧮","🎥","🎞️","📽️","🎬","📺","📷","📸","📹","🎥","📼","🔍","🔎","🕯️","💡","🔦","🏮","🪔","📔","📕","📖","📗","📘","📙","📚","📓","📒","📃","📜","📄","📰","🗞️","📑","🔖","🏷️","💰","🪙","💴","💵","💶","💷","💸","💳","🧾","✉️","📧","📨","📩","📤","📥","📦","📫","📪","📬","📭","📮","🗳️","✏️","✒️","🖋️","🖊️","🖌️","🖍️","📝","💼","📁","📂","🗂️","📅","📆","🗒️","🗓️","📇","📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️","🗑️","🔑","🗝️","🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️","💣","🪃","🏹","🛡️","🪚","🔧","🪛","🔩","⚙️","🗜️","⚖️","🦯","🔗","⛓️","🪝","🧰","🧲","🪜","⚗️","🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊","🩹","🩺","🚪","🛗","🪞","🪟","🛏️","🛋️","🪑","🚽","🚿","🛁","🪤","🪥","🪣","🧴","🪒","🧹","🪠","🧺","🧻","🪈","🪭","🪮","🪪","🗣️","👤","👥","🫂","👪"],
    "Symbols": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","🦉","🪯","🔱","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚕️","♻️","⚜️","🔰","🔱","⭕","✅","☑️","✔️","❌","❎","➰","〰️","➿","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","◼️","◻️","◾","◽","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔳","🔲","🏧","🚮","🚰","♿","🚹","🚺","🚻","🚼","🚾","🛂","🛃","🛄","🛅","⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","📵","🔞","☢️","☣️","💹","〽️","✳️","✴️","❇️","🈯","🈳","🈴","🈵","🈶","🈷️","🈸","🈹","🈺","🉐","🉑","🈲","🈻","㊗️","㊙️","🆚","💮","🉠","🉡","🉤","🉥","🆎","🆑","🆒","🆓","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🈂️","🅰️","🅱️","🅾️","🅿️","🆎","🈳","🈴","🈵","🈶","🈷️","🈸","🈹","🈺","🉐","🉑","🉈","🉉","🉊","🉋","🉌","🉍","🉎","🉏","🉐","🆑","🆒","🆓","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🈂️","🅰️","🅱️","🅾️","🅿️","🆎","Ⓜ️","🅱️","🅰️","🆑","🆒","🆓","ℹ️","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🈂️","🅿️","🆎","🆑","🆒","🆓","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🈂️"],
    "Flags": ["🏳️","🏴","🏁","🚩","🎌","🏴‍☠️","🇺🇳","🇦🇫","🇦🇱","🇩🇿","🇦🇩","🇦🇴","🇦🇬","🇦🇷","🇦🇲","🇦🇺","🇦🇹","🇦🇿","🇧🇸","🇧🇭","🇧🇩","🇧🇧","🇧🇾","🇧🇪","🇧🇿","🇧🇯","🇧🇹","🇧🇴","🇧🇦","🇧🇼","🇧🇷","🇧🇳","🇧🇬","🇧🇫","🇧🇮","🇰🇭","🇨🇲","🇨🇦","🇨🇻","🇨🇫","🇹🇩","🇨🇱","🇨🇳","🇨🇴","🇰🇲","🇨🇬","🇨🇩","🇨🇷","🇭🇷","🇨🇺","🇨🇾","🇨🇿","🇩🇰","🇩🇯","🇩🇲","🇩🇴","🇪🇨","🇪🇬","🇸🇻","🇬🇶","🇪🇷","🇪🇪","🇪🇹","🇫🇯","🇫🇮","🇫🇷","🇬🇦","🇬🇲","🇬🇪","🇩🇪","🇬🇭","🇬🇷","🇬🇩","🇬🇹","🇬🇳","🇬🇼","🇬🇾","🇭🇹","🇭🇳","🇭🇺","🇮🇸","🇮🇳","🇮🇩","🇮🇷","🇮🇶","🇮🇪","🇮🇱","🇮🇹","🇯🇲","🇯🇵","🇯🇴","🇰🇿","🇰🇪","🇰🇮","🇰🇵","🇰🇷","🇽🇰","🇰🇼","🇰🇬","🇱🇦","🇱🇻","🇱🇧","🇱🇸","🇱🇷","🇱🇾","🇱🇮","🇱🇹","🇱🇺","🇲🇬","🇲🇼","🇲🇾","🇲🇻","🇲🇱","🇲🇹","🇲🇭","🇲🇷","🇲🇺","🇲🇽","🇫🇲","🇲🇩","🇲🇨","🇲🇳","🇲🇪","🇲🇦","🇲🇿","🇲🇲","🇳🇦","🇳🇷","🇳🇵","🇳🇱","🇳🇿","🇳🇮","🇳🇪","🇳🇬","🇳🇴","🇴🇲","🇵🇰","🇵🇼","🇵🇸","🇵🇦","🇵🇬","🇵🇾","🇵🇪","🇵🇭","🇵🇱","🇵🇹","🇶🇦","🇷🇴","🇷🇺","🇷🇼","🇰🇳","🇱🇨","🇻🇨","🇼🇸","🇸🇲","🇸🇹","🇸🇦","🇸🇳","🇷🇸","🇸🇨","🇸🇱","🇸🇬","🇸🇰","🇸🇮","🇸🇧","🇸🇴","🇿🇦","🇸🇸","🇪🇸","🇱🇰","🇸🇩","🇸🇷","🇸🇪","🇨🇭","🇸🇾","🇹🇼","🇹🇯","🇹🇿","🇹🇭","🇹🇱","🇹🇬","🇹🇴","🇹🇹","🇹🇳","🇹🇷","🇹🇲","🇹🇻","🇺🇬","🇺🇦","🇦🇪","🇬🇧","🇺🇸","🇺🇾","🇺🇿","🇻🇺","🇻🇦","🇻🇪","🇻🇳","🇾🇪","🇿🇲","🇿🇼","🇦🇨","🇧🇻","🇨🇵","🇩🇬","🇪🇦","🇪🇺","🇫🇴","🇬🇱","🇭🇰","🇮🇨","🇮🇴","🇲🇴","🇲🇶","🇳🇨","🇵🇫","🇵🇲","🇷🇪","🇸🇭","🇸🇯","🇹🇦","🇹🇫","🇹🇰","🇻🇦","🇼🇫","🇾🇹"],
    "Animated": ANIMATED_EMOJI_DATA.length > 0 ? ANIMATED_EMOJI_DATA : [],
    "Trending": ["🔥","💀","😍","🥰","😭","😂","🤣","😘","💯","✨","⭐","🌟","💥","💫","🫶","🙌","👏","🎉","🎊","💪","🤙","🧠","👀","🗣️","💬","📸","🎥","🎧","💿","📀","💽","💾","💻","📱","⌚️","💍","👑","💎","🔮","🪄","💵","💰","💳","🛒","🛍️","🎁","🧧","💝","💖","💗","💓","💞","💕","❣️","💔","❤️‍🔥","❤️‍🩹","💘","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔","⚕️","♻️","⚜️","🔰","🔱","⭕","✅","☑️","✔️","❌","❎","➰","〰️","➿","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪","🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","◼️","◻️","◾","◽","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔳","🔲","🏧","🚮","🚰","♿","🚹","🚺","🚻","🚼","🚾","🛂","🛃","🛄","🛅","⚠️","🚸","⛔","🚫","🚳","🚭","🚯","🚱","📵","🔞","☢️","☣️","💹","〽️","✳️","✴️","❇️","🈯","🈳","🈴","🈵","🈶","🈷️","🈸","🈹","🈺","🉐","🉑","🈲","㊗️","㊙️","🆚","💮","🆎","🆑","🆒","🆓","🆔","🆕","🆖","🆗","🆘","🆙","🆚","🈁","🅰️","🅱️","🅾️","🅿️","🆎","Ⓜ️","🅱️","🅰️","ℹ️","🅿️","🥇","🥈","🥉","🏆","🏅","🎖️","🏵️","🎗️","📿","💈","⚗️","🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊","🩹","🩺","🚿","🛁","🪥","🪒","🧴","🧹","🧺","🧻","🚽","🪠","🪤","🪣","🪥","🪦","🪧","🪨","🪩","🪪","🪫","🪬","🪭","🪮","🪯"]
  };



// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("authenticate", (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const userId = payload.id;
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

      socket.join(`user_${userId}`);

      socket.emit("authenticated", { userId });
      io.emit("user_online", { userId, online: true });
    } catch {
      socket.emit("auth_error", { error: "Invalid token" });
    }
  });

  socket.on("join_chat", ({ withUserId }) => {
    if (!socket.userId) return;
    const room = chatKey(socket.userId, withUserId);
    socket.join(room);
  });

  socket.on("send_message", async ({ toUserId, text, type, mediaUrl, mediaType, duration, fileName, fileSize, clientId }) => {
    if (!socket.userId) return;
    if (!text && !mediaUrl) return;

    if (mediaUrl && mediaUrl.startsWith('data:')) {
      try {
        const matches = mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const ext = mime.split('/')[1] || 'bin';
          const buf = Buffer.from(matches[2], 'base64');
          const safeName = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
          const fname = `${safeName}_${Date.now()}.${ext}`;
          const fpath = path.join(CHAT_FILES_DIR, fname);
          fs.writeFileSync(fpath, buf);
          mediaUrl = `/media/chat-files/${fname}`;
          fileSize = buf.length;
        }
      } catch (e) {
        console.error('Base64 file save error:', e);
      }
    }

    const key = chatKey(socket.userId, toUserId);
    if (!db.chats.has(key)) db.chats.set(key, []);

    const recipientSocket = onlineUsers.get(toUserId);

    const message = {
      id: uuidv4(),
      clientId: clientId || null,
      senderId: socket.userId,
      receiverId: toUserId,
      text: text || '',
      type: type || 'text', // text, emoji, gif, sticker, audio, image, video, file
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null, // gif, sticker, image, video, file
      duration: duration || null, // audio duration in seconds
      fileName: fileName || null,
      fileSize: fileSize || null,
      time: new Date().toISOString(),
      delivered: Boolean(recipientSocket),
      read: false,
    };
    db.chats.get(key).push(message);
    saveDb();

    io.to(key).emit("message", { chatKey: key, message });

    const sender = db.users.get(socket.userId);

    let recipientName = null;
    if (isPowerBot(toUserId)) {
      const pbot = powerBotManager.getBotById(toUserId);
      recipientName = pbot ? pbot.name : toUserId;
    }

    if (recipientSocket) {
      // Show appropriate preview text based on message type
      let previewText = text;
      if (type === 'audio') previewText = '🎤 Voice message';
      else if (type === 'gif') previewText = '🎞️ GIF';
      else if (type === 'sticker') previewText = '🎭 Sticker';
      else if (type === 'emoji') previewText = text;
      else if (type === 'image') previewText = '🖼️ Photo';
      else if (type === 'video') previewText = '🎬 Video';
      else if (type === 'file') previewText = '📎 ' + (fileName || 'File');

      io.to(recipientSocket).emit("new_message_notif", {
        from: sender ? sanitizeUser(sender) : { id: socket.userId },
        text: previewText,
        time: message.time,
      });
    }
  });

  socket.on("typing", ({ toUserId, typing }) => {
    if (!socket.userId) return;
    const room = chatKey(socket.userId, toUserId);
    socket.to(room).emit("typing", { userId: socket.userId, typing });
  });

  socket.on("mark_read", ({ withUserId }) => {
    if (!socket.userId || !withUserId) return;
    const key = chatKey(socket.userId, withUserId);
    const msgs = db.chats.get(key);
    if (!msgs) return;
    let changed = false;
    const newlyRead = [];
    msgs.forEach((m) => {
      if (m.senderId === withUserId && !m.read) {
        m.read = true; changed = true;
        newlyRead.push(m.id);
      }
    });
    if (changed) saveDb();
    if (newlyRead.length) {
      const senderSocket = onlineUsers.get(withUserId);
      if (senderSocket) {
        io.to(senderSocket).emit("messages_read", { chatKey: key, messageIds: newlyRead, byUserId: socket.userId });
      }
    }
  });

  // ─── WebRTC Calling ───────────────────────────────────────────────────────
  socket.on("call_user", ({ toUserId, callType }) => {
    if (!socket.userId) return;
    const caller = db.users.get(socket.userId);
    const recipientSocket = onlineUsers.get(toUserId);
    if (recipientSocket) {
      io.to(recipientSocket).emit("incoming_call", {
        from: caller ? sanitizeUser(caller) : { id: socket.userId },
        callType,
      });
    } else {
      socket.emit("user_not_available", { toUserId });
    }
  });

  socket.on("call_accepted", ({ toUserId }) => {
    if (!socket.userId) return;
    const callerSocket = onlineUsers.get(toUserId);
    if (callerSocket) {
      io.to(callerSocket).emit("call_accepted", { from: socket.userId });
    }
  });

  socket.on("call_rejected", ({ toUserId }) => {
    if (!socket.userId) return;
    const callerSocket = onlineUsers.get(toUserId);
    if (callerSocket) {
      io.to(callerSocket).emit("call_rejected", { from: socket.userId });
    }
  });

  socket.on("call_end", ({ toUserId }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("call_ended", { from: socket.userId });
    }
  });

  socket.on("webrtc_offer", ({ toUserId, offer }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("webrtc_offer", { from: socket.userId, offer });
    }
  });

  socket.on("webrtc_answer", ({ toUserId, answer }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("webrtc_answer", { from: socket.userId, answer });
    }
  });

  socket.on("webrtc_ice_candidate", ({ toUserId, candidate }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("webrtc_ice_candidate", { from: socket.userId, candidate });
    }
  });

  // ─── Group Calling ─────────────────────────────────────────────────────
  socket.on("create_group_call", ({ callType }) => {
    if (!socket.userId) return;
    const callId = uuidv4();
    const call = {
      id: callId,
      creatorId: socket.userId,
      participants: new Map(),
      callType: callType || 'audio',
      active: true,
      startedAt: new Date().toISOString(),
    };
    call.participants.set(socket.userId, { socketId: socket.id, joinedAt: new Date().toISOString() });
    groupCalls.set(callId, call);
    socket.join(`group_call_${callId}`);
    socket.emit("group_call_created", { callId });
  });

  socket.on("group_call_invite", ({ callId, userIds }) => {
    if (!socket.userId) return;
    const call = groupCalls.get(callId);
    if (!call || !call.active) { socket.emit("group_call_error", { error: "Call not found or ended" }); return; }
    const caller = db.users.get(socket.userId);
    (userIds || []).forEach(uid => {
      const targetSocket = onlineUsers.get(uid);
      if (targetSocket) {
        io.to(targetSocket).emit("group_call_incoming", {
          callId,
          from: caller ? sanitizeUser(caller) : { id: socket.userId },
          callType: call.callType,
          participants: [...call.participants.keys()],
        });
      }
    });
  });

  socket.on("group_call_join", ({ callId }) => {
    if (!socket.userId) return;
    const call = groupCalls.get(callId);
    if (!call || !call.active) { socket.emit("group_call_error", { error: "Call not found or ended" }); return; }
    if (!call.participants.has(socket.userId)) {
      call.participants.set(socket.userId, { socketId: socket.id, joinedAt: new Date().toISOString() });
    }
    socket.join(`group_call_${callId}`);
    socket.emit("group_call_joined", { callId, participants: [...call.participants.keys()] });
    // Notify existing participants
    socket.to(`group_call_${callId}`).emit("group_call_participant_joined", {
      userId: socket.userId,
      participants: [...call.participants.keys()],
    });
  });

  socket.on("group_call_leave", ({ callId }) => {
    if (!socket.userId) return;
    const call = groupCalls.get(callId);
    if (call) {
      call.participants.delete(socket.userId);
      socket.leave(`group_call_${callId}`);
      socket.to(`group_call_${callId}`).emit("group_call_participant_left", {
        userId: socket.userId,
        participants: [...call.participants.keys()],
      });
      if (call.participants.size === 0) {
        call.active = false;
        groupCalls.delete(callId);
      }
    }
  });

  socket.on("group_call_end", ({ callId }) => {
    if (!socket.userId) return;
    const call = groupCalls.get(callId);
    if (call && (call.creatorId === socket.userId)) {
      call.active = false;
      io.to(`group_call_${callId}`).emit("group_call_ended", { callId });
      groupCalls.delete(callId);
    }
  });

  socket.on("group_call_add_participant", ({ callId, userId }) => {
    if (!socket.userId) return;
    const call = groupCalls.get(callId);
    if (!call || !call.active) return;
    const targetSocket = onlineUsers.get(userId);
    if (targetSocket) {
      const caller = db.users.get(socket.userId);
      io.to(targetSocket).emit("group_call_incoming", {
        callId,
        from: caller ? sanitizeUser(caller) : { id: socket.userId },
        callType: call.callType,
        participants: [...call.participants.keys()],
      });
    }
  });

  // Group call WebRTC signaling
  socket.on("group_webrtc_offer", ({ callId, toUserId, offer }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("group_webrtc_offer", { from: socket.userId, callId, offer });
    }
  });

  socket.on("group_webrtc_answer", ({ callId, toUserId, answer }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("group_webrtc_answer", { from: socket.userId, callId, answer });
    }
  });

  socket.on("group_webrtc_ice_candidate", ({ callId, toUserId, candidate }) => {
    if (!socket.userId) return;
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) {
      io.to(targetSocket).emit("group_webrtc_ice_candidate", { from: socket.userId, callId, candidate });
    }
  });

  // Group call speaker change
  socket.on("group_call_speaker_change", ({ callId, activeSpeakerId }) => {
    if (!socket.userId) return;
    socket.to(`group_call_${callId}`).emit("group_call_speaker_change", {
      activeSpeakerId,
      userId: socket.userId,
    });
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      // Remove from any active group calls
      for (const [callId, call] of groupCalls) {
        if (call.participants.has(socket.userId)) {
          call.participants.delete(socket.userId);
          socket.to(`group_call_${callId}`).emit("group_call_participant_left", {
            userId: socket.userId,
            participants: [...call.participants.keys()],
          });
          if (call.participants.size === 0) {
            call.active = false;
            groupCalls.delete(callId);
          }
        }
      }
      onlineUsers.delete(socket.userId);
      const user = db.users.get(socket.userId);
      if (user) {
        user.lastSeen = new Date().toISOString();
        saveDb();
      }
      io.emit("user_online", { userId: socket.userId, online: false });
    }
  });
});

// ─── API: Emoji / GIF / Sticker Library ────────────────────────────────────────
app.get("/api/emoji", (req, res) => {
  res.json({ success: true, data: EMOJI_DATA });
});

app.get("/api/gifs", (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  let data = GIF_LIBRARY;
  if (q) data = data.filter(g => g.name.toLowerCase().includes(q));
  res.json({ success: true, data, total: data.length });
});

app.get("/api/stickers", (req, res) => {
  const page  = Math.max(0, parseInt(req.query.page)  || 0);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 80));
  const q     = (req.query.q || '').toLowerCase().trim();

  let data = STICKER_LIBRARY;
  if (q) data = data.filter(s => s.name.toLowerCase().includes(q));

  const total  = data.length;
  const paged  = data.slice(page * limit, (page + 1) * limit);
  const hasMore = (page + 1) * limit < total;

  // Encode file paths for safe <img src> rendering
  const safe = paged.map(s => ({ ...s, url: encodeURI(s.url) }));
  res.json({ success: true, data: safe, total, page, limit, hasMore });
});

// ─── API: Media Upload (Multer) ─────────────────────────────────────────────
const multer = require('multer');

const GIFS_DIR_STORAGE = path.join(__dirname, 'public', 'media', 'gifs');
const STICKERS_DIR_STORAGE = path.join(__dirname, 'public', 'media', 'stickers');
[GIFS_DIR_STORAGE, STICKERS_DIR_STORAGE].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.body.type || 'gif';
    const dir = type === 'sticker' ? STICKERS_DIR_STORAGE : GIFS_DIR_STORAGE;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = file.originalname.replace(ext, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedGif = ['.gif', '.png', '.webp', '.jpg', '.jpeg'];
    const allowedSticker = ['.gif', '.png', '.webp', '.jpg', '.jpeg', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    const type = req.body.type || 'gif';
    const allowed = type === 'sticker' ? allowedSticker : allowedGif;
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed for ${type}`));
    }
  }
});

app.post("/api/admin/media/upload", authenticate, adminOnly, uploadMedia.array('files', 50), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }
    const uploaded = req.files.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      size: f.size,
      path: f.path,
      url: `/media/${req.body.type === 'sticker' ? 'stickers' : 'gifs'}/${f.filename}`,
      type: req.body.type || 'gif'
    }));
    // Trigger library rescan
    if (req.body.type === 'sticker') {
      STICKER_LIBRARY = buildStickerLibraryFromDisk();
    } else {
      GIF_LIBRARY = buildGifLibraryFromDisk();
    }
    res.json({ success: true, uploaded, count: uploaded.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/media", authenticate, adminOnly, (req, res) => {
  try {
    const { url, type } = req.body;
    if (!url) return res.status(400).json({ error: "Missing url" });
    
    const isSticker = type === 'sticker' || url.includes('/stickers/');
    const dir = isSticker ? STICKERS_DIR_STORAGE : GIFS_DIR_STORAGE;
    const filename = path.basename(url);
    const filepath = path.join(dir, filename);
    
    // Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      // Rebuild library
      if (isSticker) {
        STICKER_LIBRARY = buildStickerLibraryFromDisk();
      } else {
        GIF_LIBRARY = buildGifLibraryFromDisk();
      }
      res.json({ success: true, deleted: filename });
    } else {
      // Remove from library if file not found
      if (isSticker) {
        STICKER_LIBRARY = buildStickerLibraryFromDisk();
      } else {
        GIF_LIBRARY = buildGifLibraryFromDisk();
      }
      res.json({ success: true, deleted: filename, note: "File not on disk, library rebuilt" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/media/rescan", authenticate, adminOnly, (req, res) => {
  try {
    GIF_LIBRARY = buildGifLibraryFromDisk();
    STICKER_LIBRARY = buildStickerLibraryFromDisk();
    res.json({
      success: true,
      gifs: { count: GIF_LIBRARY.length },
      stickers: { count: STICKER_LIBRARY.length }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Reel Video Upload ─────────────────────────────────────────────────
const REEL_VIDEOS_DIR = path.join(__dirname, 'public', 'media', 'reels');
if (!fs.existsSync(REEL_VIDEOS_DIR)) fs.mkdirSync(REEL_VIDEOS_DIR, { recursive: true });

const reelVideoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REEL_VIDEOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `reel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});

const uploadReelVideo = multer({
  storage: reelVideoStorage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid video format. Allowed: mp4, webm, mov, avi, mkv'));
  }
});

app.post("/api/reels/upload", authenticate, (req, res) => {
  uploadReelVideo.single('video')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Video too large (max 200 MB)' });
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: "No video file uploaded" });
      const videoUrl = `/media/reels/${req.file.filename}`;
      res.json({ success: true, videoUrl, filename: req.file.filename, size: req.file.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// ─── API: Audio Upload ─────────────────────────────────────────────────────────
const AUDIO_DIR = path.join(__dirname, 'public', 'media', 'audio');
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

app.post("/api/upload/audio", authenticate, express.raw({ type: 'audio/webm', limit: '15mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: "No audio data provided" });
    }
    const filename = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webm`;
    const filepath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filepath, req.body);
    res.json({ success: true, url: `/media/audio/${filename}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: Chat Theme Background Upload ────────────────────────────────────────
const CHAT_BG_DIR = path.join(__dirname, 'public', 'media', 'chat-bg');
if (!fs.existsSync(CHAT_BG_DIR)) fs.mkdirSync(CHAT_BG_DIR, { recursive: true });

const chatBgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHAT_BG_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `chatbg_${req.user.id}_${Date.now()}${ext}`;
    cb(null, name);
  }
});

const uploadChatBg = multer({
  storage: chatBgStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid file type. Allowed: jpg, png, webp, gif'));
  }
});

app.post("/api/upload/chat-bg", authenticate, uploadChatBg.single('background'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = `/media/chat-bg/${req.file.filename}`;
    const user = db.users.get(req.user.id);
    if (user) {
      user.chatThemeCustom = user.chatThemeCustom || {};
      user.chatThemeCustom.backgroundImage = url;
      saveDb();
    }
    res.json({ success: true, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: File upload for chat attachments ──────────────────────────────────
const CHAT_FILES_DIR = path.join(__dirname, 'public', 'media', 'chat-files');
if (!fs.existsSync(CHAT_FILES_DIR)) fs.mkdirSync(CHAT_FILES_DIR, { recursive: true });

const chatFileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, CHAT_FILES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = file.originalname.replace(ext, '')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 60);
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const uploadChatFile = multer({
  storage: chatFileStorage,
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

app.post("/api/upload/chat-file", authenticate, (req, res) => {
  uploadChatFile.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 1 GB)' });
      return res.status(400).json({ error: err.message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const url = `/media/chat-files/${req.file.filename}`;
      res.json({ success: true, url, name: req.file.originalname, size: req.file.size });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
});

// ─── API: Power Bots ──────────────────────────────────────────────────────────
app.get("/api/power-bots/stats", (req, res) => {
  res.json({ success: true, stats: powerBotManager.getStats() });
});

app.get("/api/power-bots/random", authenticate, (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 10, 50);
  const bots = powerBotManager.getRandomBots(count);
  res.json({ success: true, bots: bots.map(sanitizeUser) });
});

app.get("/api/power-bots/:id", (req, res) => {
  const bot = powerBotManager.getBotById(req.params.id);
  if (!bot) return res.status(404).json({ error: "PowerBot not found" });
  res.json({ success: true, bot: sanitizeUser(bot) });
});

// ─── Root route (explicit) ───────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Page routes (static HTML pages) ────────────────────────────────────────────
const PAGE_ROUTES = new Map([
  ["dashboard", "dashboard.html"],
  ["profile", "profile.html"],
  ["friend", "friend.html"],
  ["admin", "admin.html"],
  ["signup", "signup.html"],
  ["index", "index.html"],
  ["login", "index.html"],
  ["ai", "ai.html"],
  ["control", "control.html"],
]);

app.get(/^\/([a-zA-Z0-9_-]+)(?:\.html)?$/, (req, res, next) => {
  const page = req.params[0];
  if (!PAGE_ROUTES.has(page)) {
    return next();
  }

  const htmlFile = PAGE_ROUTES.get(page);
  return res.sendFile(path.join(__dirname, "public", htmlFile));
});

// ─── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function startServer() {
  // Initialize the stores with the db reference FIRST so that load() works
  // (they require this.db to be set).
  dynamoDBStore.init(db);
  supabaseStore.init(db);

  // Load persisted data. Prefer DynamoDB, then Supabase, then data.json.
  async function loadPersistedData() {
    let loadedFromDynamo = false;
    if (dynamoDBStore.enabled) {
      try {
        loadedFromDynamo = await loadDynamoDb();
      } catch (err) {
        console.error('⚠️ DynamoDB load failed:', err.message);
        loadedFromDynamo = false;
      }
    }
    if (loadedFromDynamo) {
      console.log('🗄️  Using DynamoDB as the live data source');
      return true;
    }

    let loadedFromSupabase = false;
    if (supabaseStore.enabled) {
      try {
        loadedFromSupabase = await loadSupabaseDb();
      } catch (err) {
        console.error('⚠️ Supabase load failed:', err.message);
        loadedFromSupabase = false;
      }
    }
    if (loadedFromSupabase) {
      console.log('📦 Using Supabase as the live data source');
    } else {
      // Fall back to local disk
      if (loadDb()) {
        console.log('📂 Using persisted data from data.json');
      } else {
        console.log('🆕 No existing data — will seed fresh data');
      }
    }
    return loadedFromSupabase;
  }

  const loadedFromSupabase = await loadPersistedData();

  try {
    await seedData();
    await seedBots(db, io);
  } catch (err) {
    // Never let a seeding error crash the app — serve anyway with whatever data we have.
    console.error("⚠️ Data seeding failed (continuing anyway):", err);
  }

  try {
    await powerBotManager.initialize(db, io);
    dataManager.init(db, powerBotManager);
    saveDb();
    seedReelsIfEmpty();
    dataManager.createBackup();
  } catch (err) {
    console.error("⚠️ DataManager/PowerBot init failed (continuing anyway):", err);
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server started`);
    console.log(`🚀 SocialConnect running on port ${PORT}`);
    console.log(
      `📁 Serving static files from: ${path.join(__dirname, "public")}`,
    );
  });

  server.on("error", (err) => {
    console.error("❌ Server error:", err.message);
  });

  // Activity engines are best-effort; never let a cycle crash the process.
  const activeBots = [...db.users.values()].filter(u => u.isBot);
  try { startBotActivity(db, io, activeBots); } catch (err) { console.error("⚠️ Bot activity failed to start:", err.message); }
  try { powerBotManager.startActivityEngine(db, io, 45000); } catch (err) { console.error("⚠️ PowerBot engine failed to start:", err.message); }

  setInterval(() => {
    const onlineBefore = onlineUsers.size;
    const powerBotIds = [];
    for (let i = 0; i < 150; i++) {
      const numId = 1 + Math.floor(Math.random() * 1000000);
      const bid = `pbot_${String(numId).padStart(7, '0')}`;
      if (!onlineUsers.has(bid)) {
        powerBotIds.push(bid);
        onlineUsers.set(bid, `pbot_sim_${bid}`);
      }
    }
    if (powerBotIds.length > 0) {
      powerBotIds.forEach(id => io.emit("user_online", { userId: id, online: true }));
    }
  }, 20000);

  setInterval(() => {
    const toRemove = [];
    for (const [uid] of onlineUsers) {
      if (uid.startsWith('pbot_') && Math.random() < 0.4) {
        toRemove.push(uid);
      }
    }
    toRemove.forEach(id => {
      onlineUsers.delete(id);
      io.emit("user_online", { userId: id, online: false });
    });
  }, 25000);
}

startServer();
