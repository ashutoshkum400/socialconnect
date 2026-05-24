const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const GIRL_NAMES = [
  'Priya Sharma', 'Aisha Kapoor', 'Emma Wilson', 'Sophia Patel', 'Olivia Singh',
  'Ishita Verma', 'Maya Desai', 'Zara Khan', 'Ananya Gupta', 'Lily Chen',
  'Riya Joshi', 'Neha Aggarwal', 'Sarah Johnson', 'Kavya Nair', 'Amara Reddy',
  'Diya Malhotra', 'Mira Iyer', 'Arya Bhat', 'Sana Sheikh', 'Elena Torres',
  'Chloe Martin', 'Sakshi Jain', 'Pooja Mehta', 'Harper Lee', 'Aria Bose',
  'Naya Williams', 'Mia Brown', 'Anika Choudhury', 'Tara Das', 'Rhea Saxena',
  'Isha Krishnan', 'Stella Davis', 'Amaya Taylor', 'Navya Srinivas', 'Kiara Roy',
  'Anvi Narayan', 'Luna Garcia', 'Sia Menon', 'Myra Chopra', 'Eva Thomas',
  'Aditi Rao', 'Ira Malik', 'Leela Subramanian', 'Zoya Ali', 'Inaya Thakur',
  'Sara Joseph', 'Veda Pillai', 'Alia Bhatt', 'Nitya Kumar', 'Aadhya Mishra',
  'Kimaya Mehta', 'Saanvi Bhatia', 'Tiya Kapadia', 'Arohi Sinha', 'Paridhi Lall',
  'Jiya Saxena', 'Navya Kulkarni', 'Sana D\'Souza', 'Ananya Reddy', 'Kriti Rana',
  'Pari Bhat', 'Kyra Gill', 'Nysa Devgan', 'Ahana Sen', 'Ira Dubey',
  'Aleeza Shah', 'Shanaya Khanna', 'Mishka Oberoi', 'Natasha Roy', 'Tanya Grewal',
  'Ritika Bansal', 'Simran Kaur', 'Deepika Sood', 'Niharika Singh', 'Sonia Mehra',
  'Aparna Nair', 'Shreya Ghosh', 'Tanvi Kale', 'Bhavna Saxena', 'Chetna Arora',
  'Divya Joshi', 'Ekta Sharma', 'Gauri Patil', 'Hema Reddy', 'Jasmine Kaur',
  'Kiran Bhat', 'Laxmi Iyer', 'Mandeep Kaur', 'Nandini Rao', 'Pinky Singh',
  'Radhika Kumar', 'Sujata Verma', 'Tina D\'Mello', 'Uma Srinivas', 'Vani Kapoor',
  'Yamini Trivedi', 'Zara Sheikh', 'Alisha Vohra', 'Bhavika Shah', 'Charvi Deshmukh',
];

const LOCATIONS = [
  'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune',
  'Ahmedabad', 'Jaipur', 'Lucknow', 'New York', 'Los Angeles', 'Chicago',
  'San Francisco', 'Austin', 'Seattle', 'Boston', 'London', 'Dubai', 'Toronto',
];

const BIOS = [
  'Life is a beautiful journey ✨',
  'Coffee, books & good vibes ☕📚',
  'Living my best life one day at a time 💫',
  'Fitness freak & food lover 💪🍕',
  'Travel enthusiast | Photography | Art 🎨',
  'Music is my escape 🎵',
  'Dreamer | Believer | Achiever 🌟',
  'Simplicity is the ultimate sophistication',
  'Dancing through life 💃',
  'Making memories around the world 🌎',
  'Kind heart, fierce mind, brave spirit 💜',
  'Adventure awaits! 🌄',
  'Yoga | Meditation | Peace ☮️',
  'Exploring new places & meeting new people 🌍',
  'Just a girl who loves to travel ✈️',
  'Positive vibes only ✨',
  'Fashion | Beauty | Lifestyle 💄',
  'Foodie at heart 🍝',
  'Nature lover 🌿',
  'Creating my own sunshine ☀️',
];

const INTERESTS_POOL = [
  'Travel', 'Photography', 'Music', 'Art', 'Fitness', 'Gaming', 'Cooking',
  'Reading', 'Movies', 'Sports', 'Technology', 'Fashion', 'Nature', 'Yoga',
  'Dancing', 'Writing', 'Coffee', 'Pets', 'Hiking', 'Nightlife', 'Shopping',
  'Beach', 'Camping', 'Painting', 'Singing',
];

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPicks(arr, min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split('T')[0];
}

function generateBot(id) {
  const name = GIRL_NAMES[parseInt(id.replace('bot_', '')) % GIRL_NAMES.length];
  const username = name.toLowerCase().replace(/\s+/g, '_') + '_' + id.slice(-4);
  const email = `${username}@socialconnect.com`;
  const location = randomPick(LOCATIONS);
  const bio = randomPick(BIOS);
  const interests = randomPicks(INTERESTS_POOL, 2, 5);
  const birthDate = randomDate(new Date('1996-01-01'), new Date('2005-12-31'));
  const seed = id;
  const avatar = `https://picsum.photos/seed/${seed}/200/200`;
  const coverPhoto = `https://picsum.photos/seed/${seed}_cover/800/300`;

  return {
    id,
    username,
    email,
    password: null,
    role: 'user',
    name,
    bio,
    avatar,
    coverPhoto,
    photos: [],
    friends: [],
    followers: [],
    following: [],
    connections: [],
    relationships: [],
    blocked: false,
    joinedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    lastSeen: new Date().toISOString(),
    location,
    birthDate,
    gender: 'female',
    interests,
    lookingFor: randomPick(['friends', 'dating', 'relationship', null]),
    relationshipStatus: randomPick(['single', 'single', 'single', 'single', 'in a relationship', 'complicated']),
    isBot: true,
  };
}

function createBotUsers(count) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const id = `bot_${String(i + 1).padStart(3, '0')}`;
    users.push(generateBot(id));
  }
  return users;
}

const postTexts = [
  'Beautiful sunset at the beach today! 🏖️✨',
  'Coffee and conversations make the best mornings ☕💬',
  'New beginnings are always exciting! 🌟',
  'Tried a new recipe today and it turned out amazing! 🍝',
  'Weekend vibes with good music and great company 🎵',
  'Exploring new places, making new memories! 🌍',
  'Grateful for all the wonderful people in my life 💜',
  'Sometimes you just need a little adventure 🏔️',
  'Booked my next vacation! Can\'t wait! ✈️',
  'Nothing beats a beautiful sunrise 🌅',
  'Dance like nobody\'s watching 💃',
  'Fresh air, clear mind, new perspectives 🌿',
  'Happy vibes only today! ✨',
  'Trying to capture moments, not things 📸',
  'Good food, good mood 🍕',
  'Another day, another opportunity to shine 💫',
  'Nature is the best therapist 🌳',
  'Making progress every single day 📈',
  'Sunday reset mode activated 🔄',
  'Life is better with friends by your side 👯‍♀️',
];

const comments = [
  'This is amazing! 😍',
  'Love this! 💕',
  'So beautiful! ✨',
  'You look great! 🌟',
  'Can relate to this 💯',
  'Absolutely stunning! 🔥',
  'Goals! 👏',
  'Keep it up! 💪',
  'Wonderful! 😊',
  'Love your vibe! 💜',
  'So true! 🙌',
  'You\'re killing it! 🔥',
  'Beautiful view! 🌄',
  'This made my day! ☀️',
  'Same here! 🙋‍♀️',
  'Stay blessed! 💫',
  'Incredible! 🎉',
  'You go girl! 💃',
  'Living your best life! ✨',
  'Love this energy! ⚡',
];

const botUsers = createBotUsers(100);

async function seedBots(db, io) {
  let botCount = 0;
  const batchSize = 10;
  for (let i = 0; i < botUsers.length; i += batchSize) {
    const batch = botUsers.slice(i, i + batchSize);
    const hashes = await Promise.all(batch.map(() => bcrypt.hash('Bot@123456', 4)));
    batch.forEach((bot, idx) => {
      const existingUser = [...db.users.values()].find(u => u.email === bot.email);
      if (existingUser) {
        botCount++;
        return;
      }
      bot.password = hashes[idx];
      db.users.set(bot.id, bot);
      db.notifications.set(bot.id, []);
      db.friendRequests.set(bot.id, []);
      db.relationships.set(bot.id, []);
      botCount++;
    });
  }

  const activeBots = [...db.users.values()].filter(u => u.isBot);
  console.log(`✅ ${activeBots.length} bot accounts ready`);
  return activeBots;
}

const ACTIVITY_INTERVAL = 30000;

function startBotActivity(db, io, activeBots) {
  if (!activeBots || activeBots.length === 0) return;

  console.log(`🤖 Bot activity system started (${activeBots.length} bots, every ${ACTIVITY_INTERVAL / 1000}s)`);

  function doBotActivity() {
    const onlineBots = activeBots.filter(b => Math.random() < 0.3);

    onlineBots.forEach(bot => {
      const realUsers = [...db.users.values()].filter(u =>
        u.role !== 'admin' && !u.isBot && u.id !== bot.id
      );

      if (realUsers.length === 0) return;

      const target = randomPick(realUsers);
      const activity = Math.random();

      try {
        if (activity < 0.15) {
          if (!(target.friends || []).includes(bot.id) && !(db.friendRequests.get(target.id) || []).some(r => r.from === bot.id)) {
            if (!db.friendRequests.has(target.id)) db.friendRequests.set(target.id, []);
            db.friendRequests.get(target.id).push({ from: bot.id, time: new Date().toISOString() });
            const notifText = `${bot.name} sent you a friend request`;
            if (db.notifications.has(target.id)) {
              db.notifications.get(target.id).unshift({
                id: uuidv4(), type: 'friend_request', fromId: bot.id, text: notifText,
                priority: 'high', read: false, time: new Date().toISOString(),
              });
              const socketId = Array.from(io?.sockets?.sockets?.values() || [])
                .find(s => s.userId === target.id)?.id;
              if (socketId) io.to(socketId).emit('notification', {
                id: uuidv4(), type: 'friend_request', fromId: bot.id, text: notifText,
                priority: 'high', fromName: bot.name, fromAvatar: bot.avatar,
                read: false, time: new Date().toISOString(),
              });
            }
          }
        } else if (activity < 0.3) {
          if (!(target.followers || []).includes(bot.id)) {
            if (!target.followers) target.followers = [];
            target.followers.push(bot.id);
            if (!bot.following) bot.following = [];
            if (!bot.following.includes(target.id)) bot.following.push(target.id);
            const notifText = `${bot.name} started following you`;
            if (db.notifications.has(target.id)) {
              db.notifications.get(target.id).unshift({
                id: uuidv4(), type: 'follow', fromId: bot.id, text: notifText,
                priority: 'medium', read: false, time: new Date().toISOString(),
              });
            }
          }
        } else if (activity < 0.4) {
          if (!(target.connections || []).includes(bot.id)) {
            if (!bot.connections) bot.connections = [];
            bot.connections.push(target.id);
            const notifText = `${bot.name} wants to connect with you 💜`;
            if (db.notifications.has(target.id)) {
              db.notifications.get(target.id).unshift({
                id: uuidv4(), type: 'connect_request', fromId: bot.id, text: notifText,
                priority: 'high', read: false, time: new Date().toISOString(),
              });
            }
          }
        } else if (activity < 0.55) {
          const posts = [...db.posts.values()].filter(p => p.authorId !== bot.id && !(p.likes || []).includes(bot.id));
          if (posts.length > 0) {
            const post = randomPick(posts);
            if (!post.likes) post.likes = [];
            post.likes.push(bot.id);
            if (post.authorId && db.notifications.has(post.authorId)) {
              db.notifications.get(post.authorId).unshift({
                id: uuidv4(), type: 'like', fromId: bot.id, postId: post.id,
                text: `${bot.name} liked your post`, priority: 'low',
                read: false, time: new Date().toISOString(),
              });
            }
          }
        } else if (activity < 0.7) {
          const posts = [...db.posts.values()].filter(p => p.authorId !== bot.id);
          if (posts.length > 0) {
            const post = randomPick(posts);
            const commentText = randomPick(comments);
            const comment = {
              id: uuidv4(), userId: bot.id, text: commentText,
              time: new Date().toISOString(),
              user: { id: bot.id, name: bot.name, avatar: bot.avatar },
            };
            if (!post.comments) post.comments = [];
            post.comments.push(comment);
            if (post.authorId && db.notifications.has(post.authorId)) {
              db.notifications.get(post.authorId).unshift({
                id: uuidv4(), type: 'comment', fromId: bot.id, postId: post.id,
                text: `${bot.name} commented on your post`, priority: 'low',
                read: false, time: new Date().toISOString(),
              });
            }
          }
        } else if (activity < 0.85) {
          const postText = randomPick(postTexts);
          const postId = uuidv4();
          const post = {
            id: postId, authorId: bot.id, authorName: bot.name, authorAvatar: bot.avatar,
            text: postText, media: { photos: [], videos: [], audio: [] },
            location: null, feeling: null, activity: null, tags: [],
            mentions: [], highlights: [],
            privacySettings: { sharedWith: 'public' },
            timestamp: new Date().toISOString(), createdAt: new Date(),
            likes: [], comments: [], shares: [], views: [bot.id],
            saves: [], reactions: {},
            interactionMetrics: { impressions: 1, engagementRate: 0, reachCount: 0 },
          };
          db.posts.set(postId, post);
        } else {
          const posts = [...db.posts.values()].filter(p => p.authorId !== bot.id);
          if (posts.length > 0) {
            const post = randomPick(posts);
            if (!post.shares) post.shares = [];
            if (!post.shares.includes(bot.id)) {
              post.shares.push(bot.id);
            }
          }
        }
      } catch (e) {
        console.error(`Bot activity error (${bot.name}):`, e.message);
      }
    });

    if (typeof global.saveDb === 'function') {
      global.saveDb();
    }
  }

  const intervalId = setInterval(doBotActivity, ACTIVITY_INTERVAL);

  doBotActivity();

  return intervalId;
}

module.exports = { seedBots, startBotActivity, botUsers };
