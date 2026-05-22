/* ═════════════════════════════════════════════════════════════════════════════
   ADVANCED POST API ENDPOINTS
   Features: Multimedia, Location, Feelings, Tags, Mentions, Highlights, Privacy
   ═════════════════════════════════════════════════════════════════════════════ */

'use strict';

// This module should be included in your server.js
// Usage: require('./advanced-post-api')(app, io, db, authenticateToken);

module.exports = function(app, io, db, authenticateToken) {

  // ───────────────────────────────────────────────────────────────────────────
  // CREATE ADVANCED POST
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/api/posts/advanced', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const user = db.users.get(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const {
        text,
        media,
        location,
        feeling,
        activity,
        tags,
        mentions,
        highlights,
        privacySettings,
      } = req.body;

      const postId = require('uuid').v4();
      const timestamp = new Date();

      // Create post object
      const post = {
        id: postId,
        authorId: userId,
        authorName: user.name,
        authorAvatar: user.avatar,
        text: text || '',
        media: media || { photos: [], videos: [], audio: [] },
        location: location || null,
        feeling: feeling || null,
        activity: activity || null,
        tags: tags || [],
        mentions: mentions || [],
        highlights: highlights || [],
        privacySettings: privacySettings || { sharedWith: 'public', parallelize: false, datingSiteShare: false },
        timestamp: timestamp.toISOString(),
        createdAt: timestamp,
        likes: [],
        comments: [],
        shares: [],
        views: [userId],
        saves: [],
        reactions: {},
        interactionMetrics: {
          impressions: 1,
          engagementRate: 0,
          reachCount: 0,
        },
      };

      // Store post
      db.posts.set(postId, post);

      // Process mentions - send notifications
      if (mentions && mentions.length > 0) {
        mentions.forEach(mention => {
          const mentionedUser = db.users.get(mention.id);
          if (mentionedUser) {
            const notification = {
              id: require('uuid').v4(),
              type: 'mention',
              from: userId,
              fromName: user.name,
              postId: postId,
              content: `${user.name} mentioned you in a post`,
              timestamp: timestamp.toISOString(),
              read: false,
            };
            if (!db.notifications.has(mention.id)) db.notifications.set(mention.id, []);
            db.notifications.get(mention.id).push(notification);

            // Real-time notification via Socket.IO
            if (io) {
              io.to(`user_${mention.id}`).emit('notification', notification);
            }
          }
        });
      }

      // Process tags for trending
      if (tags && tags.length > 0) {
        tags.forEach(tag => {
          // Could be used for trending tags feature
          console.log(`📌 Post tagged with: #${tag}`);
        });
      }

      // Handle privacy settings
      let visibleTo = [];
      if (privacySettings.sharedWith === 'public') {
        visibleTo = Array.from(db.users.keys());
      } else if (privacySettings.sharedWith === 'followers') {
        visibleTo = user.followers || [];
      } else if (privacySettings.sharedWith === 'friends') {
        visibleTo = user.friends || [];
      } else if (privacySettings.sharedWith === 'specific') {
        visibleTo = privacySettings.specificUsers || [];
      }

      // Store visibility info
      post.visibleTo = visibleTo;
      post.hideFrom = privacySettings.hideFrom || [];

      // Parallel sharing to dating sites if enabled
      if (privacySettings.parallelize && privacySettings.datingSiteShare) {
        post.parallelShares = {
          datingPlatform: true,
          allowInteraction: privacySettings.datingSiteShare,
          sharedAt: timestamp.toISOString(),
        };
        console.log(`💑 Post shared in parallel to dating platform`);
      }

      // Update user's posts
      if (!user.posts) user.posts = [];
      user.posts.push(postId);
      db.users.set(userId, user);

      // Broadcast to followers via socket
      if (io) {
        visibleTo.forEach(visibleUserId => {
          io.to(`user_${visibleUserId}`).emit('newPost', {
            post: post,
            fromUser: { id: user.id, name: user.name, avatar: user.avatar }
          });
        });
      }

      // Save to database
      if (global.saveDb) global.saveDb();

      res.json({
        success: true,
        postId: postId,
        post: post,
        message: '✅ Post created successfully'
      });

    } catch (err) {
      console.error('❌ Advanced post error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET ADVANCED POST DETAILS
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/api/posts/advanced/:postId', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const userId = req.user.id;

      // Check privacy
      if (post.privacySettings?.sharedWith === 'specific' && !post.visibleTo?.includes(userId)) {
        return res.status(403).json({ error: 'You do not have access to this post' });
      }

      // Add view
      if (!post.views.includes(userId)) {
        post.views.push(userId);
        post.interactionMetrics.impressions = post.views.length;
      }

      res.json({
        success: true,
        post: post,
        author: db.users.get(post.authorId),
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET FEED WITH ADVANCED POSTS
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/api/posts/feed/advanced', authenticateToken, (req, res) => {
    try {
      const userId = req.user.id;
      const user = db.users.get(userId);
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const feed = [];

      for (const [postId, post] of db.posts) {
        // Check visibility
        if (post.hideFrom?.includes(userId)) continue;

        if (post.privacySettings?.sharedWith === 'public') {
          feed.push(post);
        } else if (post.privacySettings?.sharedWith === 'followers' && post.visibleTo?.includes(userId)) {
          feed.push(post);
        } else if (post.privacySettings?.sharedWith === 'friends' && user.friends?.includes(post.authorId)) {
          feed.push(post);
        } else if (post.privacySettings?.sharedWith === 'specific' && post.visibleTo?.includes(userId)) {
          feed.push(post);
        } else if (post.authorId === userId) {
          feed.push(post);
        }
      }

      // Sort by date (newest first)
      feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Paginate
      const paginatedFeed = feed.slice(offset, offset + limit);

      // Enrich with author info
      const enrichedFeed = paginatedFeed.map(post => ({
        ...post,
        author: db.users.get(post.authorId),
        liked: post.likes?.includes(userId) || false,
        saved: post.saves?.includes(userId) || false,
      }));

      res.json({
        success: true,
        posts: enrichedFeed,
        total: feed.length,
        hasMore: offset + limit < feed.length,
      });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // LIKE ADVANCED POST
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/api/posts/advanced/:postId/like', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      const userId = req.user.id;

      if (!post) return res.status(404).json({ error: 'Post not found' });

      const index = post.likes.indexOf(userId);
      if (index === -1) {
        post.likes.push(userId);
        post.interactionMetrics.engagementRate = (post.likes.length + post.comments.length + post.shares.length) / post.views.length * 100;

        // Notification
        if (post.authorId !== userId) {
          const notification = {
            id: require('uuid').v4(),
            type: 'like',
            from: userId,
            fromName: db.users.get(userId)?.name,
            postId: req.params.postId,
            content: `Someone liked your post`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          if (!db.notifications.has(post.authorId)) db.notifications.set(post.authorId, []);
          db.notifications.get(post.authorId).push(notification);
          if (io) io.to(`user_${post.authorId}`).emit('notification', notification);
        }
      } else {
        post.likes.splice(index, 1);
      }

      res.json({ success: true, likes: post.likes.length, liked: index === -1 });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ADD COMMENT TO ADVANCED POST
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/api/posts/advanced/:postId/comment', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      const userId = req.user.id;
      const user = db.users.get(userId);
      const { text, mentions } = req.body;

      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });

      const comment = {
        id: require('uuid').v4(),
        authorId: userId,
        authorName: user.name,
        authorAvatar: user.avatar,
        text: text,
        mentions: mentions || [],
        timestamp: new Date().toISOString(),
        likes: [],
        replies: [],
      };

      post.comments.push(comment);
      post.interactionMetrics.engagementRate = (post.likes.length + post.comments.length + post.shares.length) / post.views.length * 100;

      // Notification
      if (post.authorId !== userId) {
        const notification = {
          id: require('uuid').v4(),
          type: 'comment',
          from: userId,
          fromName: user.name,
          postId: req.params.postId,
          content: `${user.name} commented on your post`,
          timestamp: new Date().toISOString(),
          read: false,
        };
        if (!db.notifications.has(post.authorId)) db.notifications.set(post.authorId, []);
        db.notifications.get(post.authorId).push(notification);
        if (io) io.to(`user_${post.authorId}`).emit('notification', notification);
      }

      // Notify mentioned users
      if (mentions && mentions.length > 0) {
        mentions.forEach(mention => {
          const notification = {
            id: require('uuid').v4(),
            type: 'comment_mention',
            from: userId,
            fromName: user.name,
            postId: req.params.postId,
            content: `${user.name} mentioned you in a comment`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          if (!db.notifications.has(mention.id)) db.notifications.set(mention.id, []);
          db.notifications.get(mention.id).push(notification);
          if (io) io.to(`user_${mention.id}`).emit('notification', notification);
        });
      }

      res.json({ success: true, comment: comment });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SHARE ADVANCED POST
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/api/posts/advanced/:postId/share', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      const userId = req.user.id;

      if (!post) return res.status(404).json({ error: 'Post not found' });

      if (!post.shares.includes(userId)) {
        post.shares.push(userId);
        post.interactionMetrics.engagementRate = (post.likes.length + post.comments.length + post.shares.length) / post.views.length * 100;

        // Notification
        if (post.authorId !== userId) {
          const notification = {
            id: require('uuid').v4(),
            type: 'share',
            from: userId,
            fromName: db.users.get(userId)?.name,
            postId: req.params.postId,
            content: `Someone shared your post`,
            timestamp: new Date().toISOString(),
            read: false,
          };
          if (!db.notifications.has(post.authorId)) db.notifications.set(post.authorId, []);
          db.notifications.get(post.authorId).push(notification);
          if (io) io.to(`user_${post.authorId}`).emit('notification', notification);
        }
      }

      res.json({ success: true, shares: post.shares.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SAVE POST
  // ───────────────────────────────────────────────────────────────────────────
  app.post('/api/posts/advanced/:postId/save', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      const userId = req.user.id;

      if (!post) return res.status(404).json({ error: 'Post not found' });

      const index = post.saves.indexOf(userId);
      if (index === -1) {
        post.saves.push(userId);
      } else {
        post.saves.splice(index, 1);
      }

      res.json({ success: true, saved: index === -1, saves: post.saves.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET POSTS BY TAG
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/api/posts/tag/:tag', authenticateToken, (req, res) => {
    try {
      const tag = req.params.tag.toLowerCase();
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const taggedPosts = Array.from(db.posts.values())
        .filter(post => post.tags?.some(t => t.toLowerCase() === tag))
        .filter(post => !post.hideFrom?.includes(userId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(offset, offset + limit);

      res.json({
        success: true,
        posts: taggedPosts,
        tag: tag,
        total: taggedPosts.length,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET POSTS BY LOCATION
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/api/posts/location/:location', authenticateToken, (req, res) => {
    try {
      const location = req.params.location.toLowerCase();
      const userId = req.user.id;
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const locationPosts = Array.from(db.posts.values())
        .filter(post => post.location?.name.toLowerCase().includes(location))
        .filter(post => !post.hideFrom?.includes(userId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(offset, offset + limit);

      res.json({
        success: true,
        posts: locationPosts,
        location: location,
        total: locationPosts.length,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // GET TRENDING HASHTAGS
  // ───────────────────────────────────────────────────────────────────────────
  app.get('/api/trending/hashtags', authenticateToken, (req, res) => {
    try {
      const tagMap = {};

      for (const post of db.posts.values()) {
        post.tags?.forEach(tag => {
          tagMap[tag] = (tagMap[tag] || 0) + 1;
        });
      }

      const trending = Object.entries(tagMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => ({ tag, count }));

      res.json({ success: true, trending });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE ADVANCED POST
  // ───────────────────────────────────────────────────────────────────────────
  app.delete('/api/posts/advanced/:postId', authenticateToken, (req, res) => {
    try {
      const post = db.posts.get(req.params.postId);
      const userId = req.user.id;

      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (post.authorId !== userId) return res.status(403).json({ error: 'Unauthorized' });

      db.posts.delete(req.params.postId);

      const user = db.users.get(userId);
      if (user && user.posts) {
        user.posts = user.posts.filter(id => id !== req.params.postId);
      }

      if (global.saveDb) global.saveDb();

      res.json({ success: true, message: 'Post deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log('✅ Advanced Post API endpoints loaded');
};
