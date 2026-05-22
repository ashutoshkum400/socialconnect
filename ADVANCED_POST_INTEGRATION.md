<!-- ═════════════════════════════════════════════════════════════════════════════
     ADVANCED POST SYSTEM - INTEGRATION GUIDE
     ═════════════════════════════════════════════════════════════════════════════ -->

# 🚀 Advanced Post System - Ultra High-End Integration Guide

## Overview
This guide integrates a professional-grade advanced posting system with multimedia support, social features, and interaction mechanics similar to Facebook and dating platforms.

## Features Implemented

✅ **Multimedia Support**
- Photos (with thumbnail preview)
- Videos (with duration tracking)
- Audio files (with metadata)
- Drag & drop support

✅ **Location Features**
- GPS-based location detection
- Location picker with search
- Geographic post filtering
- Location-based discovery

✅ **Social Features**
- Feelings & Activities (emoji-based)
- User mentions with notifications
- Hashtag detection and trending
- Highlights (custom story categories)

✅ **Privacy & Sharing**
- Public, Followers, Friends, Specific Users
- Parallel sharing to dating platforms
- Hide from specific people
- Cross-platform interaction

✅ **Interaction Metrics**
- Real-time likes, comments, shares
- Engagement rate calculation
- View tracking
- Save/Bookmark functionality

✅ **User Experience**
- Draft auto-save (every 30 seconds)
- Real-time character counter
- Auto-detect hashtags & mentions
- Modal animations & transitions

---

## 📁 File Structure

```
havana/
├── public/
│   ├── js/
│   │   ├── advanced-post.js          ← Main JavaScript logic
│   │   ├── app.js                    ← Include this script
│   │   └── dashboard.js              ← Include this script
│   ├── html/
│   │   └── advanced-post-modal.html  ← Modal markup
│   ├── css/
│   │   ├── advanced-post.css         ← Modal styles
│   │   ├── style.css                 ← Existing styles
│   │   └── responsive.css            ← Responsive styles
│   └── index.html, dashboard.html    ← Include modal
├── advanced-post-api.js              ← Backend endpoints
└── server.js                         ← Include API module

```

---

## 🔧 Installation Steps

### Step 1: Update server.js

Add this to your `server.js` after other route definitions:

```javascript
// ─── Load Advanced Post API ──────────────────────────────────────────
const advancedPostAPI = require('./advanced-post-api');
advancedPostAPI(app, io, db, authenticateToken);

// Export saveDb globally for advanced-post-api
global.saveDb = saveDb;
```

**Location in server.js:**
- Add this AFTER you have set up `authenticateToken` middleware
- Add this BEFORE you call `server.listen()`

### Step 2: Add Modal to dashboard.html

Add this near the end of your `public/dashboard.html` (before `</body>`):

```html
<!-- Include Advanced Post Modal -->
<script src="/js/advanced-post.js"></script>
<link rel="stylesheet" href="/css/advanced-post.css">

<!-- Modal and Components -->
<div id="advancedPostContainer">
  <!-- Load from advanced-post-modal.html -->
</div>

<script>
  // Load modal HTML
  fetch('/html/advanced-post-modal.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('advancedPostContainer').innerHTML = html;
      // Initialize Advanced Post System
      if (window.AdvancedPost) {
        AdvancedPost.init();
      }
    });
</script>
```

### Step 3: Add Post Button to Feed Section

In your `public/dashboard.html`, add this button in the feed section:

```html
<!-- Advanced Post Button in Feed/Sidebar -->
<button id="advancedPostBtn" type="button">
  ✨ Create Advanced Post
</button>
```

**Or in your create-post section, replace the existing button with:**

```html
<div class="feed-create-post">
  <div style="display: flex; gap: 10px;">
    <img id="createPostAvatar" src="" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
    <button id="advancedPostBtn" type="button" style="flex: 1; padding: 10px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 20px; text-align: left; cursor: pointer;">
      What's on your mind? ✨
    </button>
  </div>
</div>
```

### Step 4: Load Modal HTML Dynamically

Add this script in your dashboard.html:

```html
<script>
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/html/advanced-post-modal.html');
    const html = await response.text();
    
    // Create a container if it doesn't exist
    let container = document.getElementById('modalContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modalContainer';
      document.body.appendChild(container);
    }
    
    container.innerHTML = html;
    
    // Initialize the Advanced Post System
    setTimeout(() => {
      if (window.AdvancedPost) {
        AdvancedPost.init();
      }
    }, 100);
  } catch (error) {
    console.error('Failed to load advanced post modal:', error);
  }
});
</script>
```

### Step 5: Update CSS Imports

In your `public/dashboard.html` (in `<head>`), add:

```html
<link rel="stylesheet" href="/css/advanced-post.css">
```

### Step 6: Connect with Socket.IO

In your existing socket.io setup in `dashboard.js`, add these event handlers:

```javascript
// ─── Advanced Post Interactions ──────────────────────────────────────
socket.on('newPost', (data) => {
  console.log('📮 New post received:', data);
  // Reload feed or prepend post
  if (window.loadFeed) {
    loadFeed();
  }
});

socket.on('postLiked', (data) => {
  console.log('❤️ Post liked:', data);
  // Update like count UI
});

socket.on('postCommented', (data) => {
  console.log('💬 New comment:', data);
  // Update comments UI
});

socket.on('postShared', (data) => {
  console.log('📤 Post shared:', data);
  // Update share count
});
```

---

## 📡 API Endpoints Reference

### Create Advanced Post
```http
POST /api/posts/advanced
Content-Type: application/json
Authorization: Bearer <token>

{
  "text": "Post content",
  "media": {
    "photos": [{ data, name, size }],
    "videos": [{ data, name, size }],
    "audio": [{ data, name, size }]
  },
  "location": { name, lat, lng },
  "feeling": "😊 Happy",
  "activity": "💼 Working",
  "tags": ["tech", "coding"],
  "mentions": [{ id, name }],
  "highlights": [{ id, name }],
  "privacySettings": {
    "sharedWith": "public|followers|friends|specific",
    "specificUsers": ["userId1", "userId2"],
    "parallelize": true,
    "datingSiteShare": false,
    "hideFrom": ["userId3"]
  }
}
```

### Get Feed with Advanced Posts
```http
GET /api/posts/feed/advanced?limit=20&offset=0
Authorization: Bearer <token>
```

### Like Post
```http
POST /api/posts/advanced/:postId/like
Authorization: Bearer <token>
```

### Add Comment
```http
POST /api/posts/advanced/:postId/comment
Authorization: Bearer <token>

{
  "text": "Comment text",
  "mentions": [{ id, name }]
}
```

### Share Post
```http
POST /api/posts/advanced/:postId/share
Authorization: Bearer <token>
```

### Save Post
```http
POST /api/posts/advanced/:postId/save
Authorization: Bearer <token>
```

### Get Posts by Tag
```http
GET /api/posts/tag/:tag?limit=20&offset=0
Authorization: Bearer <token>
```

### Get Posts by Location
```http
GET /api/posts/location/:location?limit=20&offset=0
Authorization: Bearer <token>
```

### Get Trending Hashtags
```http
GET /api/trending/hashtags
Authorization: Bearer <token>
```

### Delete Post
```http
DELETE /api/posts/advanced/:postId
Authorization: Bearer <token>
```

---

## 🎨 Customization

### Colors & Theme
Edit `public/css/advanced-post.css`:

```css
:root {
  --primary: #5856d6;           /* Change primary color */
  --primary-light: rgba(88, 86, 214, 0.1);
  --danger: #ff3b30;
  --success: #34c759;
}
```

### Feelings & Activities
Edit `public/js/advanced-post.js`:

```javascript
loadEmojis() {
  this.emojis = {
    feelings: [
      // Add your custom feelings
    ],
    activities: [
      // Add your custom activities
    ]
  };
}
```

### Character Limit
Edit in `advanced-post.js`:

```javascript
const maxChars = 10000; // Change this value
```

### Auto-save Interval
Edit in `advanced-post.js`:

```javascript
setInterval(() => {
  // Change interval (in milliseconds)
}, 30000); // Currently 30 seconds
```

---

## 🔐 Security Considerations

1. **Authorization**: All endpoints require `authenticateToken` middleware
2. **Privacy Checks**: Verify `privacySettings` on every fetch
3. **Input Validation**: Sanitize text input to prevent XSS
4. **File Upload**: Validate file types and sizes
5. **Mentions**: Verify user IDs exist before creating notifications

### Add to advanced-post-api.js:

```javascript
// Input validation
function sanitizeText(text) {
  return text
    .trim()
    .slice(0, 10000)
    .replace(/<script>/gi, ''); // Remove script tags
}

// File size validation
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
if (file.size > MAX_FILE_SIZE) {
  return res.status(400).json({ error: 'File too large' });
}
```

---

## 📊 Data Structure Example

### Post Object
```javascript
{
  id: "uuid",
  authorId: "userId",
  authorName: "User Name",
  authorAvatar: "url",
  text: "Post content",
  media: {
    photos: [{ id, name, size, data, thumbnail }],
    videos: [{ id, name, size, data, duration }],
    audio: [{ id, name, size, data, duration }]
  },
  location: {
    name: "New York, USA",
    lat: 40.7128,
    lng: -74.0060
  },
  feeling: "😊 Happy",
  activity: "💼 Working",
  tags: ["tech", "coding"],
  mentions: [{ id: "userId", name: "User Name" }],
  highlights: [{ id, name }],
  privacySettings: {
    sharedWith: "public",
    parallelShares: { datingPlatform: true, allowInteraction: true }
  },
  timestamp: "2024-01-01T00:00:00Z",
  likes: ["userId1", "userId2"],
  comments: [{ id, authorId, text, timestamp, replies: [] }],
  shares: ["userId3"],
  saves: ["userId4"],
  views: ["userId1", "userId2"],
  interactionMetrics: {
    impressions: 100,
    engagementRate: 12.5,
    reachCount: 150
  }
}
```

---

## 🧪 Testing

### Test in Browser Console

```javascript
// Check if Advanced Post System is initialized
console.log(AdvancedPost);

// Open post modal
AdvancedPost.openPostModal();

// Set a location
AdvancedPost.setLocation('New York, USA', 40.7128, -74.0060);

// Add a mention
AdvancedPost.addMention('userId', 'User Name');

// Add a tag
AdvancedPost.state.tags.push('testing');

// Check state
console.log(AdvancedPost.state);

// Submit post (when ready)
AdvancedPost.submitPost();
```

---

## 🐛 Troubleshooting

### Modal Not Appearing
```javascript
// Check if modal exists
console.log(document.getElementById('advPostModal'));

// Try to initialize manually
AdvancedPost.init();

// Check console for errors
```

### API 401 Unauthorized
- Verify token is stored in localStorage
- Check `Authorization` header is being sent
- Verify `authenticateToken` middleware is applied

### Media Not Uploading
- Check file size (max 50MB)
- Verify file type is supported
- Check browser console for errors

### Socket.IO Not Working
- Verify Socket.IO is initialized: `const socket = io();`
- Check WebSocket connection in DevTools
- Verify socket event names match

---

## 🚀 Advanced Features

### Real-time Notifications
Already configured with Socket.IO. Users receive instant notifications for:
- ❤️ Likes
- 💬 Comments
- 📤 Shares
- 👥 Mentions
- 💕 Dating interactions

### Parallel Sharing
Enable cross-platform posting:
```javascript
privacySettings: {
  parallelize: true,
  datingSiteShare: true,
  allowInteraction: true
}
```

### Location-based Discovery
Posts are indexed by location and searchable.

### Trending System
Hashtags are automatically tracked and ranked.

---

## 📈 Performance Optimization

1. **Lazy Load Media**: Videos/Audio load on demand
2. **Pagination**: Feed loads 20 posts at a time
3. **Caching**: Draft auto-save stored in localStorage
4. **Efficient Queries**: Index posts by tag and location

---

## 📝 Quick Start Checklist

- [ ] Copy `advanced-post-api.js` to root
- [ ] Copy `advanced-post.js` to `/public/js/`
- [ ] Copy `advanced-post-modal.html` to `/public/html/`
- [ ] Copy `advanced-post.css` to `/public/css/`
- [ ] Update `server.js` with API module
- [ ] Add modal to `dashboard.html`
- [ ] Add post button to feed section
- [ ] Test modal opens
- [ ] Test post creation
- [ ] Verify API calls in Network tab
- [ ] Check notifications work
- [ ] Test on mobile

---

## 💬 Support

For issues or questions, check:
1. Browser console for JavaScript errors
2. Network tab for API responses
3. Verify all files are in correct locations
4. Check token is valid and properly stored
5. Ensure Socket.IO is connected

---

**System Ready! 🎉 Your advanced post system is now live with professional-grade features!**
