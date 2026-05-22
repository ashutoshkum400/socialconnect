/* ═════════════════════════════════════════════════════════════════════════════
   ADVANCED POST API INTEGRATION - Code to add to server.js
   Copy the sections below and integrate into your existing server.js
   ═════════════════════════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 1: Add this AFTER all other route definitions and BEFORE server.listen()
   ────────────────────────────────────────────────────────────────────────────── */

// ═════════════════════════════════════════════════════════════════════════════
// ADVANCED POST SYSTEM - Ultra High-End Features
// ═════════════════════════════════════════════════════════════════════════════

// Store globally for access from API module
global.saveDb = saveDb;

// Load Advanced Post API Module
const advancedPostAPI = require('./advanced-post-api');
advancedPostAPI(app, io, db, authenticateToken);

console.log('✅ Advanced Post System loaded successfully');


/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 2: Add Socket.IO event handlers in your existing socket connection
   Search for: socket.on('authenticate', ...) 
   And add these handlers in the same area
   ────────────────────────────────────────────────────────────────────────────── */

// ─── Advanced Post Real-Time Events ──────────────────────────────────────────
socket.on('newPost', (postData) => {
  console.log('📮 New post broadcast:', postData.postId);
  // Post data already broadcast by API, this is for client tracking
});

socket.on('likePost', (data) => {
  console.log('❤️ Post liked:', data);
  io.emit('postLikeUpdate', {
    postId: data.postId,
    likes: data.likeCount,
    timestamp: new Date().toISOString()
  });
});

socket.on('commentPost', (data) => {
  console.log('💬 Comment added:', data);
  io.emit('postCommentUpdate', {
    postId: data.postId,
    commentId: data.commentId,
    comments: data.commentCount,
    timestamp: new Date().toISOString()
  });
});

socket.on('sharePost', (data) => {
  console.log('📤 Post shared:', data);
  io.emit('postShareUpdate', {
    postId: data.postId,
    shares: data.shareCount,
    timestamp: new Date().toISOString()
  });
});


/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 3: Add helper functions to sanitize and validate input
   Add these functions near your existing helper functions
   ────────────────────────────────────────────────────────────────────────────── */

/**
 * Sanitize post text to prevent XSS
 */
function sanitizePostText(text) {
  if (!text) return '';
  return text
    .trim()
    .slice(0, 10000)
    .replace(/<script>/gi, '')
    .replace(/<\/script>/gi, '')
    .replace(/<iframe>/gi, '')
    .replace(/<\/iframe>/gi, '');
}

/**
 * Validate file type
 */
function isValidMediaFile(file, type) {
  const validTypes = {
    photo: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']
  };
  return validTypes[type]?.includes(file.type) || false;
}

/**
 * Validate file size (50MB limit)
 */
function isValidFileSize(fileSize) {
  const maxSize = 50 * 1024 * 1024; // 50MB
  return fileSize <= maxSize;
}

/**
 * Extract mentions from text
 */
function extractMentions(text) {
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Extract hashtags from text
 */
function extractHashtags(text) {
  const hashtagRegex = /#(\w+)/g;
  const tags = [];
  let match;
  while ((match = hashtagRegex.exec(text)) !== null) {
    tags.push(match[1].toLowerCase());
  }
  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Check privacy permissions
 */
function hasPostAccess(post, userId) {
  if (post.authorId === userId) return true; // Own posts
  
  if (post.hideFrom?.includes(userId)) return false; // Hidden from user
  
  switch (post.privacySettings?.sharedWith) {
    case 'public':
      return true;
    case 'followers':
      return post.visibleTo?.includes(userId);
    case 'friends':
      return post.visibleTo?.includes(userId);
    case 'specific':
      return post.visibleTo?.includes(userId);
    default:
      return false;
  }
}


/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 4: Add endpoints for location and trending (if using advanced-post-api)
   These are examples of additional endpoints you might want to add
   ────────────────────────────────────────────────────────────────────────────── */

// Get nearby posts by location (geospatial query)
app.get('/api/posts/nearby', authenticateToken, (req, res) => {
  try {
    const { lat, lng, radius = 10 } = req.query; // radius in km
    const userId = req.user.id;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const posts = Array.from(db.posts.values())
      .filter(post => {
        if (!post.location) return false;
        
        // Simple distance calculation (Haversine formula)
        const distance = getDistance(
          parseFloat(lat), 
          parseFloat(lng),
          post.location.lat,
          post.location.lng
        );
        
        return distance <= parseFloat(radius);
      })
      .filter(post => hasPostAccess(post, userId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);

    res.json({ success: true, posts, count: posts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Get user's own posts
app.get('/api/posts/user/:userId', authenticateToken, (req, res) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user.id;
    
    const user = db.users.get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const posts = Array.from(db.posts.values())
      .filter(post => post.authorId === userId)
      .filter(post => hasPostAccess(post, currentUserId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, posts, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get trending posts
app.get('/api/posts/trending', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const timeRange = req.query.range || '24h'; // 24h, 7d, 30d

    // Calculate time threshold
    const now = new Date();
    let threshold;
    
    switch(timeRange) {
      case '24h': threshold = new Date(now - 24*60*60*1000); break;
      case '7d': threshold = new Date(now - 7*24*60*60*1000); break;
      case '30d': threshold = new Date(now - 30*24*60*60*1000); break;
      default: threshold = new Date(now - 24*60*60*1000);
    }

    const posts = Array.from(db.posts.values())
      .filter(post => new Date(post.timestamp) > threshold)
      .filter(post => hasPostAccess(post, userId))
      .map(post => ({
        ...post,
        engagement: post.likes.length + post.comments.length + post.shares.length
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 50)
      .map(({ engagement, ...post }) => post);

    res.json({ success: true, posts, timeRange });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's saved posts
app.get('/api/posts/saved', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    const savedPosts = Array.from(db.posts.values())
      .filter(post => post.saves?.includes(userId))
      .filter(post => hasPostAccess(post, userId))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ success: true, posts: savedPosts, count: savedPosts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get post analytics (for post author)
app.get('/api/posts/advanced/:postId/analytics', authenticateToken, (req, res) => {
  try {
    const post = db.posts.get(req.params.postId);
    const userId = req.user.id;

    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.authorId !== userId) return res.status(403).json({ error: 'Unauthorized' });

    const analytics = {
      postId: post.id,
      views: post.views.length,
      likes: post.likes.length,
      comments: post.comments.length,
      shares: post.shares.length,
      saves: post.saves.length,
      engagementRate: post.interactionMetrics.engagementRate,
      impressions: post.interactionMetrics.impressions,
      reachCount: post.interactionMetrics.reachCount,
      avgEngagementTime: post.comments.length * 2 + post.likes.length * 0.5 + post.shares.length * 3,
      topReferrers: 'In Development',
      createdAt: post.createdAt,
    };

    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 5: Add persistence for new post features
   Add this to your saveDb() function if not already included
   ────────────────────────────────────────────────────────────────────────────── */

function dbToJSON() {
  const obj = {};
  for (const [key, map] of Object.entries(db)) {
    obj[key] = Object.fromEntries(map);
  }
  return obj;
}

function saveDb() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbToJSON(), null, 2), 'utf-8');
    console.log('✅ Database saved with advanced posts');
  } catch (err) {
    console.error('❌ Failed to persist data:', err.message);
  }
}

// Auto-save every 5 minutes
setInterval(() => {
  if (global.saveDb) {
    global.saveDb();
  }
}, 5 * 60 * 1000);


/* ──────────────────────────────────────────────────────────────────────────────
   SECTION 6: Complete Integration Example
   Show where everything goes in context
   ────────────────────────────────────────────────────────────────────────────── */

/*
COMPLETE server.js INTEGRATION ORDER:

1. Imports (at top)
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
// ... other imports

2. Config
const PORT = process.env.PORT || 3000;
// ... other config

3. App / Server
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

4. In-Memory Store
const db = { users: new Map(), posts: new Map(), ... };

5. Middleware
app.use(express.json({ limit: "50mb" }));
// ... other middleware

6. Authentication Middleware
function authenticateToken(req, res, next) { ... }

7. Socket.IO Setup
io.on('connection', (socket) => {
  socket.on('authenticate', (token) => { ... });
  
  // ADD: Advanced Post Event Handlers (SECTION 2)
  socket.on('newPost', (postData) => { ... });
  
  socket.disconnect();
});

8. Regular API Routes
app.post('/api/auth/login', ...);
app.get('/api/users', ...);
// ... other routes

9. ADD: Advanced Post Features
- Helper functions (SECTION 3)
- Location endpoint (SECTION 4)
- Post analytics (SECTION 4)
- Advanced Post API Module (SECTION 1)

10. Server Listen
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
*/

// ═════════════════════════════════════════════════════════════════════════════
// END OF ADVANCED POST API INTEGRATION CODE
// ═════════════════════════════════════════════════════════════════════════════
