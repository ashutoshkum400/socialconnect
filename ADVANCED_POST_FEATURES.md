# 🚀 Advanced Post System - Feature Documentation

## Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [User Guide](#user-guide)
4. [Developer Guide](#developer-guide)
5. [API Reference](#api-reference)
6. [Advanced Usage](#advanced-usage)

---

## Overview

The Advanced Post System is an enterprise-grade social media posting solution with professional features comparable to Facebook, Instagram, and modern dating platforms. It provides a seamless experience for creating, sharing, and discovering content with advanced privacy controls and real-time interactions.

### Key Highlights
- 🎬 **Multimedia**: Photos, videos, audio support with streaming
- 📍 **Location-based**: GPS, location picker, location discovery
- 😊 **Emotions**: Feelings, activities, moods, status updates
- 👥 **Social**: Mentions, tags, highlights, story categories
- 🔒 **Privacy**: Granular controls, audience selection, hide-from options
- 💑 **Dating Integration**: Parallel sharing to dating platforms
- ⭐ **Engagement**: Likes, comments, shares, saves, analytics
- ⚡ **Real-time**: Socket.IO for instant updates and notifications

---

## Core Features

### 1. 📸 Multimedia Support

#### Photos
- Upload multiple photos at once
- Auto-thumbnail generation
- Drag-and-drop support
- Supported formats: JPG, PNG, GIF, WebP
- Max size: 50MB per file

**Usage:**
```javascript
// Click 📷 button or drag image
// Preview appears in media grid
// Remove with ✕ button
```

#### Videos
- Upload and stream video files
- Duration tracking
- Preview with video icon
- Supported formats: MP4, WebM, MOV
- Max size: 50MB per file

**Usage:**
```javascript
// Click 🎬 button to upload
// Videos show with duration indicator
```

#### Audio
- Upload audio/music files
- Metadata tracking
- Supported formats: MP3, WAV, OGG, M4A
- Max size: 50MB per file

**Usage:**
```javascript
// Click 🎵 button to upload
// Audio shows with file info
```

#### Drag & Drop
```javascript
// Drag files directly onto drop zone
// System auto-detects file type
// Supports all media types
```

---

### 2. 📍 Location Features

#### GPS Detection
- One-click current location detection
- Requires browser geolocation permission
- Precise coordinates (lat/lng)

```javascript
AdvancedPost.useCurrentLocation();
```

#### Location Picker
- Search 5000+ predefined locations
- Custom location entry
- Recent locations history
- Geographic coordinates

```javascript
AdvancedPost.openLocationPicker();
AdvancedPost.setLocation('New York, USA', 40.7128, -74.0060);
```

#### Location Discovery
- Filter posts by location
- Nearby posts search (radius-based)
- Location-based trending
- Geographic feed

**API:**
```http
GET /api/posts/nearby?lat=40.7128&lng=-74.0060&radius=10
GET /api/posts/location/newyork
```

---

### 3. 😊 Feelings & Activities

#### 15+ Feelings
- Happy, Sad, Frustrated, Tired, Thoughtful
- Loved, Angry, Cool, Grateful, Laughing
- Relaxed, Impressed, Blessed, Celebrating, Peaceful

**Usage:**
```javascript
AdvancedPost.openFeelingPicker();
AdvancedPost.setPicker('feeling', '😊 Happy');
```

#### 15+ Activities
- Working, Exercising, Studying, Watching
- Eating, Gaming, Listening to Music, Traveling
- Vacationing, Having Coffee, Shopping, Performing
- At Hospital, Flying, At Party

**Usage:**
```javascript
AdvancedPost.openActivityPicker();
AdvancedPost.setPicker('activity', '💼 Working');
```

#### Status Indicators
- Show in post header
- Real-time broadcast via Socket.IO
- Searchable by feeling/activity
- User engagement insights

---

### 4. 👥 Mentions & Tags

#### Mentions
- Mention up to 50 people per post
- Auto-suggestion as you type
- Real-time notifications sent
- Clickable mention links
- Mentioned users tagged in comments too

**Usage:**
```javascript
// Type @username in text editor
// Suggestions appear automatically
// Click to add mention
// Or use 👥 button to search

AdvancedPost.addMention('userId123', 'John Doe');
```

#### Hashtags
- Auto-detect #hashtags in text
- Up to 30 hashtags per post
- Trending hashtag tracking
- Searchable hashtag feed

**Usage:**
```javascript
// Type #hashtag in text editor
// Auto-detected and listed below
// Click #️⃣ button to manage tags
// Search posts by hashtag

AdvancedPost.state.tags.push('coding');
```

#### Tag Analytics
```http
GET /api/posts/tag/coding
GET /api/trending/hashtags
```

---

### 5. ⭐ Highlights & Collections

#### 6 Predefined Highlights
- **Friends Only** 👥 - Visible to friends
- **Followers** ⭐ - Visible to followers
- **Best Friends** 💕 - Close circle
- **Family** 👨‍👩‍👧‍👦 - Family group
- **Close Friends** 🤝 - Selected circle
- **Dating Circle** 💑 - Dating community

**Usage:**
```javascript
AdvancedPost.openHighlightsList();
AdvancedPost.addHighlight('1', 'Friends Only');
AdvancedPost.addHighlight('6', 'Dating Circle');
```

#### Highlight Stories
- Organize posts into collections
- Create custom highlight albums
- Persistent story archives
- Share stories with specific groups

---

### 6. 🔒 Privacy & Sharing

#### Privacy Levels
```javascript
sharedWith: {
  'public'    // Everyone can see
  'followers' // Only followers
  'friends'   // Only friends
  'specific'  // Selected users only
}
```

#### Parallel Sharing
Share simultaneously to:
- Main social feed
- Dating platforms
- Friend groups
- Follower timeline
- Custom audiences

**Parallel Configuration:**
```javascript
privacySettings: {
  parallelize: true,           // Enable parallel sharing
  datingSiteShare: true,       // Share to dating platform
  allowInteraction: true,      // Allow dating users to interact
  sharedWith: 'specific',
  specificUsers: ['userId1', 'userId2'],
  hideFrom: ['userId3', 'userId4']
}
```

#### Hide From Specific People
```javascript
// Hide post from specific users even if public
// Up to 20 users per post
privacySettings.hideFrom = ['userId1', 'userId2', ...];
```

#### Privacy Indicators
```
🌍 Public
⭐ Followers Only
👥 Friends Only
🎯 Specific People
🔒 Private (Self only)
💑 Dating Community
```

---

### 7. 💬 Engagement & Interactions

#### Likes
```http
POST /api/posts/advanced/:postId/like
Response: { liked: true, likes: 42 }
```

#### Comments
```http
POST /api/posts/advanced/:postId/comment
Body: { text: "Great post!", mentions: [{id, name}] }
```

**Features:**
- Comment threads
- Nested replies (up to 3 levels)
- Mention notification in comments
- Like comments
- Delete own comments

#### Shares
```http
POST /api/posts/advanced/:postId/share
Response: { shares: 15 }
```

**Share Options:**
- Share to timeline
- Share to specific friends
- Share to story
- Share to external (email, messaging)

#### Saves & Bookmarks
```http
POST /api/posts/advanced/:postId/save
Response: { saved: true }

GET /api/posts/saved
```

#### Reactions (Expandable)
- Like (❤️)
- Love (😍)
- Haha (😂)
- Wow (😮)
- Sad (😢)
- Angry (😡)
- Care (🤗)

---

### 8. 📊 Engagement Analytics

#### Real-time Metrics
```javascript
{
  impressions: 1200,           // Total views
  engagementRate: 8.5,         // Percentage
  reachCount: 450,             // Unique viewers
  likes: 42,
  comments: 8,
  shares: 3,
  saves: 12,
  views: 1200,
  avgEngagementTime: 45        // Seconds
}
```

#### Analytics Endpoint
```http
GET /api/posts/advanced/:postId/analytics
```

**Available to:** Post author only

**Data:**
- Views over time
- Engagement trends
- Traffic sources
- Audience demographics
- Best performing content

---

### 9. 📤 Auto-Save & Drafts

#### Draft Auto-Save
- Saves every 30 seconds
- Stored in browser localStorage
- Auto-recover on page reload
- Manual save button available

**API:**
```javascript
AdvancedPost.saveDraft();     // Manual save
AdvancedPost.loadDraft();     // Load on startup
```

#### Draft Features
- Save text, media, metadata
- Preserve formatting
- Keep location, feelings, tags
- Draft list (future feature)
- Share drafts (future feature)

---

### 10. 🔔 Real-Time Notifications

#### Notification Types
```javascript
'mention'           // User mentioned you
'like'             // Someone liked your post
'comment'          // New comment
'comment_mention'  // Mentioned in comment
'share'            // Post was shared
'follow'           // New follower
'message'          // New message
```

#### Real-time Updates (Socket.IO)
```javascript
socket.on('notification', (notification) => {
  console.log('🔔', notification);
});

socket.on('postLikeUpdate', (data) => {
  console.log('❤️ Post liked:', data);
});

socket.on('postCommentUpdate', (data) => {
  console.log('💬 New comment:', data);
});
```

#### Notification Aggregation
- Combine similar actions (3 people liked)
- Time-based grouping
- Dismiss or mark as read
- Notification history

---

## User Guide

### Creating Your First Post

#### Step 1: Open Creator
```
Click "✨ Create Advanced Post" button
```

#### Step 2: Write Content
```
Enter text in the composer
Use @mentions and #hashtags
Auto-detect happens in real-time
```

#### Step 3: Add Media
```
Click 📷 to add photos
Click 🎬 to add videos
Click 🎵 to add audio
Or drag files to drop zone
```

#### Step 4: Add Metadata
```
Click 📍 to add location
Click 😊 to select feeling
Click 🎯 to select activity
```

#### Step 5: Organize
```
Click #️⃣ to manage tags
Click 👥 to add mentions
Click ⭐ to add highlights
```

#### Step 6: Set Privacy
```
Click 🔒 to adjust privacy
Select audience (public/friends/specific)
Enable/disable dating platform sharing
Hide from specific people if needed
```

#### Step 7: Preview & Post
```
Review all content
Click "✨ Post" to publish
Or "💾 Draft" to save for later
```

#### Step 8: Confirm
```
Success notification appears
Post appears in feed
Notifications sent to mentions
```

### Discovering Content

#### By Feed
```
Your personalized feed with:
- Posts from friends
- Posts from followers
- Public posts
- Suggested content
- Trending posts
```

#### By Location
```
Find posts near you:
GET /api/posts/nearby?lat=X&lng=Y&radius=10
```

#### By Hashtag
```
Search hashtags:
GET /api/posts/tag/coding
View trending tags:
GET /api/trending/hashtags
```

#### By User
```
View user's posts:
GET /api/posts/user/:userId
```

#### By Trending
```
Get trending posts:
GET /api/posts/trending?range=24h
Ranges: 24h, 7d, 30d
```

### Interacting with Posts

#### Like
```
Click ❤️ button on post
1-click unlike
Real-time count update
```

#### Comment
```
Click comment area
Type your comment
Add mentions with @
Press Enter to post
```

#### Share
```
Click share button
Select destination
Add personal message
Choose privacy level
```

#### Save
```
Click bookmark/save button
Access in "Saved" section
Organize by collection (future)
```

#### React
```
Click on like button longer
Choose emoji reaction
See others' reactions
```

---

## Developer Guide

### Installation

1. **Copy Files**
```
✅ advanced-post-api.js → /root/
✅ advanced-post.js → /public/js/
✅ advanced-post-modal.html → /public/html/
✅ advanced-post.css → /public/css/
```

2. **Update server.js**
```javascript
const advancedPostAPI = require('./advanced-post-api');
advancedPostAPI(app, io, db, authenticateToken);
global.saveDb = saveDb;
```

3. **Include in dashboard.html**
```html
<link rel="stylesheet" href="/css/advanced-post.css">
<script src="/js/advanced-post.js"></script>
<!-- Load modal HTML -->
<div id="modalContainer"></div>
```

### Configuration

#### Theme Colors
```css
:root {
  --primary: #5856d6;
  --primary-light: rgba(88, 86, 214, 0.1);
  --success: #34c759;
  --danger: #ff3b30;
  --warning: #ff9500;
}
```

#### Feature Toggles
```javascript
const FEATURES = {
  MULTIMEDIA: true,           // Photo, video, audio
  LOCATION: true,             // GPS, location picker
  FEELINGS: true,             // Emotion status
  MENTIONS: true,             // User mentions
  TAGS: true,                 // Hashtags
  HIGHLIGHTS: true,           // Story collections
  PARALLEL_SHARING: true,     // Dating platform
  ANALYTICS: true,            // Post metrics
  DRAFTS: true,               // Auto-save drafts
  REAL_TIME: true,            // Socket.IO
};
```

#### Size Limits
```javascript
const LIMITS = {
  MAX_POST_LENGTH: 10000,      // Characters
  MAX_FILE_SIZE: 50 * 1024 * 1024,  // 50MB
  MAX_MEDIA_PER_POST: 50,      // Photos/videos combined
  MAX_MENTIONS: 50,            // Per post
  MAX_TAGS: 30,                // Per post
  MAX_HIGHLIGHTS: 10,          // Per post
};
```

---

## API Reference

### Create Post
```http
POST /api/posts/advanced
Authorization: Bearer token

{
  "text": "string (0-10000 chars)",
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
    "specificUsers": ["id1", "id2"],
    "parallelize": boolean,
    "datingSiteShare": boolean,
    "hideFrom": ["id3"]
  }
}

Response: {
  "success": true,
  "postId": "uuid",
  "post": { ...full post object }
}
```

### Get Feed
```http
GET /api/posts/feed/advanced?limit=20&offset=0
Authorization: Bearer token

Response: {
  "success": true,
  "posts": [{ ...post }, ...],
  "total": 150,
  "hasMore": true
}
```

### Like Post
```http
POST /api/posts/advanced/:postId/like
Authorization: Bearer token

Response: {
  "success": true,
  "likes": 42,
  "liked": true
}
```

### Add Comment
```http
POST /api/posts/advanced/:postId/comment
Authorization: Bearer token

{
  "text": "string",
  "mentions": [{ id, name }]
}

Response: {
  "success": true,
  "comment": { id, authorId, text, ... }
}
```

### Share Post
```http
POST /api/posts/advanced/:postId/share
Authorization: Bearer token

Response: {
  "success": true,
  "shares": 15
}
```

### Save Post
```http
POST /api/posts/advanced/:postId/save
Authorization: Bearer token

Response: {
  "success": true,
  "saved": true,
  "saves": 8
}
```

### Get Nearby Posts
```http
GET /api/posts/nearby?lat=40.7128&lng=-74.0060&radius=10
Authorization: Bearer token

Response: {
  "success": true,
  "posts": [...],
  "count": 42
}
```

### Get Posts by Tag
```http
GET /api/posts/tag/coding?limit=20&offset=0
Authorization: Bearer token

Response: {
  "success": true,
  "posts": [...],
  "tag": "coding",
  "total": 150
}
```

### Get Trending Hashtags
```http
GET /api/trending/hashtags
Authorization: Bearer token

Response: {
  "success": true,
  "trending": [
    { tag: "coding", count: 450 },
    { tag: "webdev", count: 320 },
    ...
  ]
}
```

### Get User Posts
```http
GET /api/posts/user/:userId?limit=20&offset=0
Authorization: Bearer token

Response: {
  "success": true,
  "posts": [...],
  "user": { id, name, avatar, ... }
}
```

### Get Saved Posts
```http
GET /api/posts/saved?limit=20&offset=0
Authorization: Bearer token

Response: {
  "success": true,
  "posts": [...],
  "count": 15
}
```

### Get Post Analytics
```http
GET /api/posts/advanced/:postId/analytics
Authorization: Bearer token

Response: {
  "success": true,
  "analytics": {
    "postId": "uuid",
    "views": 1200,
    "likes": 42,
    "comments": 8,
    "shares": 3,
    "saves": 12,
    "engagementRate": 8.5,
    "impressions": 1200,
    "reachCount": 450
  }
}
```

### Delete Post
```http
DELETE /api/posts/advanced/:postId
Authorization: Bearer token

Response: {
  "success": true,
  "message": "Post deleted"
}
```

---

## Advanced Usage

### Custom Mentions Handler
```javascript
AdvancedPost.showMentionSuggestions = function(query) {
  // Your custom logic to fetch users
  fetch(`/api/users/search?q=${query}`)
    .then(r => r.json())
    .then(users => {
      // Display suggestions
    });
};
```

### Custom Location Provider
```javascript
AdvancedPost.populateLocationList = function() {
  // Replace with your own location API
  fetch('/api/locations/popular')
    .then(r => r.json())
    .then(locations => {
      // Display locations
    });
};
```

### Post Hooks (Pre/Post)
```javascript
// Before posting
AdvancedPost.beforeSubmit = async function(postData) {
  // Validate or modify data
  postData.text = postData.text.trim();
  return postData;
};

// After successful post
AdvancedPost.afterSubmit = function(postId) {
  console.log('Post created:', postId);
  // Update UI, trigger events, etc.
};
```

### Custom Reactions
```javascript
// Extend available reactions
AdvancedPost.reactions = [
  '❤️', '😍', '😂', '😮', 
  '😢', '😡', '🤗', '🔥', '💯'
];
```

### Analytics Integration
```javascript
// Track post creation
window.gtag?.('event', 'post_created', {
  post_id: postId,
  has_media: mediaCount > 0,
  privacy: privacySettings.sharedWith
});
```

---

## Performance Tips

1. **Lazy Load Images**
   - Use image thumbnails for previews
   - Load full resolution on demand

2. **Paginate Results**
   - Load 20 posts per page
   - Implement infinite scroll

3. **Cache User Data**
   - Cache mentions suggestions
   - Cache recent locations

4. **Compress Media**
   - JPEG: 70-85% quality
   - PNG: 8-bit where possible
   - Video: H.264 codec, 1080p max

5. **Optimize Queries**
   - Index posts by timestamp
   - Cache trending calculations
   - Use database indexes

---

## Security Checklist

- ✅ Sanitize all text input
- ✅ Validate file types and sizes
- ✅ Verify user permissions
- ✅ Rate limit API endpoints
- ✅ Log sensitive actions
- ✅ Encrypt sensitive data
- ✅ Validate mentions exist
- ✅ Check privacy before sharing

---

## Troubleshooting

### Issue: Modal doesn't appear
```javascript
// Check if element exists
console.log(document.getElementById('advPostModal'));

// Try initializing manually
AdvancedPost.init();
```

### Issue: API 401 errors
```javascript
// Verify token
console.log(localStorage.getItem('sc_token'));

// Check Authorization header
fetch('/api/posts/advanced', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Issue: Media not uploading
```javascript
// Check file size
console.log(file.size); // Should be < 50MB

// Check file type
console.log(file.type);

// Check browser console for errors
```

### Issue: Mentions not working
```javascript
// Verify users exist
fetch('/api/users')
  .then(r => r.json())
  .then(users => console.log(users));

// Check mention format
console.log(AdvancedPost.state.mentions);
```

---

## Future Enhancements

- 🎨 Custom filters for photos
- 🎞️ Photo carousel with transitions
- 🎙️ Voice recording
- 👁️ View who viewed your post
- 💰 Monetization features
- 🌍 Multi-language support
- 🔄 Post scheduling
- 📊 Advanced analytics
- 🤖 AI-powered suggestions
- 🎭 AR filters

---

**Version**: 2.0.0
**Last Updated**: January 2024
**Status**: Production Ready ✅
