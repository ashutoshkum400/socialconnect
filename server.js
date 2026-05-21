"use strict";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const cors = require("cors");

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "socialconnect-secret-key-2024";

// ─── App / Server ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

// ─── In-Memory Store ─────────────────────────────────────────────────────────
const db = {
  users: new Map(), // id -> user object
  posts: new Map(), // id -> post object
  chats: new Map(), // `${uid1}_${uid2}` sorted -> [messages]
  notifications: new Map(), // userId -> [notifications]
  friendRequests: new Map(), // userId -> [{from, time}]
};
const onlineUsers = new Map(); // userId -> socketId

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

function addNotification(userId, type, fromId, text) {
  if (!db.notifications.has(userId)) db.notifications.set(userId, []);
  const notif = {
    id: uuidv4(),
    type,
    fromId,
    text,
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

// ─── Seed Data ───────────────────────────────────────────────────────────────
async function seedData() {
  const hash = (pw) => bcrypt.hashSync(pw, 10);

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
  }
  db.notifications.set("admin", []);
  db.friendRequests.set("admin", []);

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

  console.log("✅ Seed data loaded");
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
      blocked: false,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      location: location || "",
      birthDate: birthDate || "",
      gender: gender || "",
      interests: [],
      lookingFor: null,
      relationshipStatus: null,
    };

    db.users.set(id, user);
    db.notifications.set(id, []);
    db.friendRequests.set(id, []);

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

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    user.lastSeen = new Date().toISOString();
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token, user: sanitizeUser(user) });
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
    "avatar",
    "coverPhoto",
    "photos",
  ];
  for (const field of allowed) {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  }
  res.json(sanitizeUser(user));
});

app.get("/api/users/all", authenticate, adminOnly, (req, res) => {
  res.json([...db.users.values()].map(sanitizeUser));
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
  }
  res.json(users.map(sanitizeUser));
});

app.get("/api/users/:id", authenticate, (req, res) => {
  const user = db.users.get(req.params.id);
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
  res.json(sanitizeUser(user));
});

app.delete("/api/users/:id", authenticate, adminOnly, (req, res) => {
  if (!db.users.has(req.params.id))
    return res.status(404).json({ error: "User not found" });
  db.users.delete(req.params.id);
  res.json({ message: "User deleted" });
});

app.post("/api/users/:id/block", authenticate, adminOnly, (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.blocked = true;
  res.json({ message: "User blocked", user: sanitizeUser(user) });
});

app.post("/api/users/:id/unblock", authenticate, adminOnly, (req, res) => {
  const user = db.users.get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.blocked = false;
  res.json({ message: "User unblocked", user: sanitizeUser(user) });
});

// ─── SOCIAL ROUTES ────────────────────────────────────────────────────────────
app.post("/api/friends/request/:id", authenticate, (req, res) => {
  const toId = req.params.id;
  const fromId = req.user.id;
  if (toId === fromId)
    return res.status(400).json({ error: "Cannot send request to yourself" });

  const toUser = db.users.get(toId);
  if (!toUser) return res.status(404).json({ error: "User not found" });

  if (!db.friendRequests.has(toId)) db.friendRequests.set(toId, []);
  const existing = db.friendRequests.get(toId).find((r) => r.from === fromId);
  if (existing)
    return res.status(409).json({ error: "Friend request already sent" });

  if (toUser.friends.includes(fromId))
    return res.status(409).json({ error: "Already friends" });

  db.friendRequests
    .get(toId)
    .push({ from: fromId, time: new Date().toISOString() });

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
  res.json({ message: "Friend request rejected" });
});

app.get("/api/friends/requests", authenticate, (req, res) => {
  const requests = db.friendRequests.get(req.user.id) || [];
  const enriched = requests.map((r) => ({
    ...r,
    user: sanitizeUser(db.users.get(r.from)),
  }));
  res.json(enriched);
});

app.post("/api/follow/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;
  if (targetId === followerId)
    return res.status(400).json({ error: "Cannot follow yourself" });

  const target = db.users.get(targetId);
  const follower = db.users.get(followerId);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (!target.followers.includes(followerId)) {
    target.followers.push(followerId);
    addNotification(
      targetId,
      "follow",
      followerId,
      `${follower.name} started following you`,
    );
  }
  if (!follower.following.includes(targetId)) follower.following.push(targetId);

  res.json({ message: "Followed successfully" });
});

app.post("/api/unfollow/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const followerId = req.user.id;

  const target = db.users.get(targetId);
  const follower = db.users.get(followerId);
  if (!target) return res.status(404).json({ error: "User not found" });

  target.followers = target.followers.filter((id) => id !== followerId);
  follower.following = follower.following.filter((id) => id !== targetId);
  res.json({ message: "Unfollowed successfully" });
});

app.post("/api/connect/:id", authenticate, (req, res) => {
  const targetId = req.params.id;
  const requesterId = req.user.id;
  if (targetId === requesterId)
    return res.status(400).json({ error: "Cannot connect with yourself" });

  const target = db.users.get(targetId);
  const requester = db.users.get(requesterId);
  if (!target) return res.status(404).json({ error: "User not found" });

  if (!requester.connections.includes(targetId))
    requester.connections.push(targetId);

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
    "connect",
    requesterId,
    `${requester.name} wants to connect with you`,
  );
  res.json({ message: "Connection request sent", match: false });
});

// ─── POST ROUTES ──────────────────────────────────────────────────────────────
function populatePost(post) {
  const author = sanitizeUser(db.users.get(post.authorId));
  const comments = post.comments.map((c) => ({
    ...c,
    user: sanitizeUser(db.users.get(c.userId)),
  }));
  return { ...post, author, comments };
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
      addNotification(
        post.authorId,
        "like",
        uid,
        `${liker.name} liked your post`,
      );
    }
  } else {
    post.likes.splice(idx, 1);
  }

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

  if (post.authorId !== req.user.id) {
    addNotification(
      post.authorId,
      "comment",
      req.user.id,
      `${commenter.name} commented on your post`,
    );
  }

  const enriched = { ...comment, user: sanitizeUser(commenter) };
  io.emit("new_comment", { postId: post.id, comment: enriched });
  res.status(201).json(enriched);
});

// ─── CHAT ROUTES ──────────────────────────────────────────────────────────────
app.get("/api/chat/:userId", authenticate, (req, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;
  const key = chatKey(myId, otherId);

  if (!db.chats.has(key)) db.chats.set(key, []);
  const messages = db.chats.get(key);

  // Mark received messages as read
  messages.forEach((m) => {
    if (m.receiverId === myId) m.read = true;
  });

  res.json(messages);
});

// ─── NOTIFICATION ROUTES ──────────────────────────────────────────────────────
app.get("/api/notifications", authenticate, (req, res) => {
  res.json(db.notifications.get(req.user.id) || []);
});

app.put("/api/notifications/read", authenticate, (req, res) => {
  const notifs = db.notifications.get(req.user.id) || [];
  notifs.forEach((n) => {
    n.read = true;
  });
  res.json({ message: "All notifications marked as read" });
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────
app.get("/api/admin/stats", authenticate, adminOnly, (req, res) => {
  const allUsers = [...db.users.values()];
  let totalMessages = 0;
  for (const msgs of db.chats.values()) totalMessages += msgs.length;

  res.json({
    totalUsers: allUsers.filter((u) => u.role !== "admin").length,
    blockedUsers: allUsers.filter((u) => u.blocked).length,
    activeUsers: onlineUsers.size,
    totalPosts: db.posts.size,
    totalMessages,
  });
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
    res.status(201).json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  socket.on("authenticate", (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const userId = payload.id;
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;

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

  socket.on("send_message", ({ toUserId, text }) => {
    if (!socket.userId || !text) return;
    const key = chatKey(socket.userId, toUserId);
    if (!db.chats.has(key)) db.chats.set(key, []);

    const message = {
      id: uuidv4(),
      senderId: socket.userId,
      receiverId: toUserId,
      text,
      time: new Date().toISOString(),
      read: false,
    };
    db.chats.get(key).push(message);

    io.to(key).emit("message", { chatKey: key, message });

    const recipientSocket = onlineUsers.get(toUserId);
    const sender = db.users.get(socket.userId);
    if (recipientSocket) {
      io.to(recipientSocket).emit("new_message_notif", {
        from: sender ? sanitizeUser(sender) : { id: socket.userId },
        text,
        time: message.time,
      });
    }
  });

  socket.on("typing", ({ toUserId, typing }) => {
    if (!socket.userId) return;
    const room = chatKey(socket.userId, toUserId);
    socket.to(room).emit("typing", { userId: socket.userId, typing });
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      const user = db.users.get(socket.userId);
      if (user) user.lastSeen = new Date().toISOString();
      io.emit("user_online", { userId: socket.userId, online: false });
    }
  });
});

// ─── Root route (explicit) ───────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── SPA Catch-all ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
seedData()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server started`);
      console.log(`🚀 SocialConnect running on port ${PORT}`);
      console.log(
        `📁 Serving static files from: ${path.join(__dirname, "public")}`,
      );
    });
  })
  .catch((err) => {
    console.error("❌ Failed to seed data:", err);
    process.exit(1);
  });
