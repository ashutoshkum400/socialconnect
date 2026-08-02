const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'power-bots');
const META_FILE = path.join(DATA_DIR, '_meta.json');
const CHUNK_SIZE = 5000;
const TOTAL_BOTS = parseInt(process.env.POWER_BOT_COUNT, 10) || 1000000;
const TOTAL_CHUNKS = Math.ceil(TOTAL_BOTS / CHUNK_SIZE);
const CACHE_MAX_CHUNKS = parseInt(process.env.POWER_BOT_CACHE_CHUNKS, 10) || 5;

const FIRST_NAMES = [
  'Aanya','Aaradhya','Aarya','Aashi','Aashna','Aayat','Adira','Advika','Ahana','Aishi',
  'Akanksha','Akshara','Alia','Amaaya','Amaira','Amana','Amaris','Amaya','Amira','Amrita',
  'Anahi','Anaya','Anika','Anisha','Anita','Anjali','Anvi','Anya','Aradhya','Aria',
  'Arisha','Arshia','Arya','Asha','Ashika','Ashna','Aveera','Avni','Ayana','Ayesha',
  'Bhavna','Bhavya','Chahna','Chaitra','Charvi','Chetna','Daksha','Damini','Deeksha','Devika',
  'Dharini','Dhriti','Diya','Drishti','Durga','Eesha','Eka','Elisha','Elita','Eshani',
  'Falguni','Gargi','Gauhar','Gauri','Gayatri','Gunjan','Hansa','Harsha','Harshita','Hemangini',
  'Himani','Hina','Ila','Ipsita','Ira','Isha','Ishani','Ishita','Ishwari','Jagriti',
  'Jaya','Jhanvi','Jharna','Jia','Jivika','Jyoti','Jyotsna','Kajal','Kalyani','Kamya',
  'Kanan','Kanika','Kanti','Kashvi','Kavya','Khushboo','Kiara','Kirti','Kriti','Kriva',
  'Kshama','Kumari','Kushali','Lakshita','Lata','Lavanya','Laxmi','Leela','Lipika','Madhavi',
  'Madhuri','Maitreyi','Mallika','Malti','Mamta','Mandaakini','Mansi','Maya','Medha','Megha',
  'Mira','Mitali','Mithila','Mohini','Monali','Mrinalini','Mudita','Mukta','Myra','Naina',
  'Nandini','Nandita','Nayana','Neela','Neelam','Neha','Netra','Nidhi','Nikita','Nimisha',
  'Nisha','Nishtha','Nitya','Niyati','Nyra','Ojasvi','Oorvi','Oviya','Padma','Pallavi',
  'Pankti','Paridhi','Parina','Parvati','Pavani','Payal','Pooja','Pragya','Pranati','Prarthana',
  'Prashansa','Pratibha','Pratigya','Pratiksha','Pravali','Praveena','Preeti','Priya','Priyanka','Purnima',
  'Purvi','Rachana','Radhika','Ragini','Raina','Rajashree','Rajni','Rakhi','Raksha','Ramya',
  'Rani','Ranita','Rashi','Rasika','Ratna','Raveena','Ravi','Reya','Rhea','Riddhi',
  'Ritika','Ritu','Riya','Roshni','Rupali','Rupashi','Saanvi','Sachi','Sadhana','Sagari',
  'Sahana','Saisha','Sakshi','Samaira','Samhita','Samiksha','Sana','Sanchita','Sandhya','Saniya',
  'Sanskriti','Sara','Sarika','Sarita','Sarmistha','Saroja','Saswati','Savitri','Savita','Seema',
  'Shaila','Shakti','Shalini','Shama','Shanti','Sharmila','Sharvani','Shashi','Sheela','Shefali',
  'Shikha','Shipra','Shivani','Shreya','Shruti','Shubhra','Shweta','Siddhi','Sikha','Simran',
  'Sita','Smita','Sneha','Sohini','Sona','Sonia','Soumya','Sraddha','Sravani','Sreeja',
  'Sridevi','Srivani','Subhadra','Suchitra','Sudha','Sujata','Sukanya','Sulagna','Suman','Sumati',
  'Sumitra','Sunanda','Sunayana','Suneeta','Sunita','Suparna','Supriya','Surabhi','Sushmita','Sushma',
  'Swati','Sweta','Taanvi','Tahira','Tamanna','Tania','Tanushree','Tanvi','Tanya','Tara',
  'Tarini','Tejaswini','Tina','Trisha','Trishna','Tulika','Tulsi','Umang','Uma','Urmi',
  'Urvashi','Usha','Ushasi','Vaidehi','Vaijayanti','Vaishali','Vaishnavi','Vandana','Vani','Varalaxmi',
  'Varsha','Vasundhara','Vedika','Vibha','Vidisha','Vidya','Vijaya','Vimala','Vimla','Vineeta',
  'Vinita','Vishaka','Vishalakshi','Viveka','Vrinda','Yamini','Yashaswini','Yashika','Yashoda','Yogita',
  'Yukta','Yukthi','Zaara','Zara','Zoya','Anusha','Apoorva','Aruna','Bhakti','Bindu',
];

const LAST_NAMES = [
  'Sharma','Verma','Gupta','Patel','Singh','Kumar','Das','Bose','Roy','Sen',
  'Mukherjee','Banerjee','Chatterjee','Ghosh','Choudhury','Saha','Dutta','Nath','Pal','De',
  'Bhattacharya','Chakraborty','Sarkar','Mitra','Majumdar','Halder','Bhowmik','Kar','Sengupta','Maitra',
  'Barman','Dhar','Mondal','Sarkar','Paul','Ray','Saha','Sarkar','Biswas','Bhaduri',
  'Tagore','Thakur','Pillai','Menon','Nair','Warrier','Panicker','Kurup','Nambiar','Mohan',
  'Reddy','Rao','Naidu','Murthy','Shastri','Deshmukh','Joshi','Kulkarni','Patil','Tendulkar',
  'Gokhale','Desai','Pandit','Mhatre','Sawant','Kadam','Shinde','Pawar','Gaikwad','Jadhav',
  'Acharya','Bajaj','Bhat','Chopra','Dhawan','Gandhi','Jain','Kapoor','Kohli','Malhotra',
  'Mishra','Nigam','Oberoi','Puri','Qureshi','Rattan','Sachdev','Talwar','Uppal','Vohra',
  'Wahi','Xavier','Yadav','Zachariah','Agarwal','Bedi','Chandra','Dewan','Gill','Handa',
  'Isaac','Jha','Khanna','Lal','Mani','Nayar','Prasad','Rawat','Sethi','Tandon',
  'Uberoi','Wadhwa','Arora','Bhalla','Chawla','Dua','Gaba','Hora','Indra','Johal',
  'Kala','Lamba','Mangal','Narang','Ojha','Pabla','Rana','Saini','Tiwana','Walia',
  'Brar','Chahal','Dhillon','Grewal','Hans','Jassal','Kahlon','Lalli','Maan','Nagra',
  'Padda','Rai','Sandhu','Toor','Virdee','Atwal','Bajwa','Cheema','Dhaliwal','Ghuman',
  'Heer','Johal','Khaira','Lidder','Multani','Powar','Sohal','Sran','Thandi','Aujla',
  'Bains','Dhinsa','Garcha','Hayer','Jutla','Kooner','Lohal','Mangat','Purewal','Rai',
  'Samra','Sangha','Thind','Sidhu','Dhanoa','Dhindsa','Ghag','Gosal','Brar','Grewal',
  'Seth','Bajpai','Pandey','Dubey','Tripathi','Shukla','Dwivedi','Upadhyay','Tiwari','Mishra',
  'Awasthi','Bhatt','Chauhan','Rathore','Solanki','Parmar','Tomar','Jadeja','Gohil','Sarania',
];

const TECH_SKILLS = [
  'Quantum Computing','Neural Networks','AI Engineering','Blockchain Dev','Cyber Security',
  'Cloud Architecture','Data Science','Robotics','BioTech','Space Tech',
  'AR/VR Development','IoT Systems','Edge Computing','Quantum Cryptography','Nanotechnology',
  'Gene Editing','Fusion Energy','Drone Tech','Smart Cities','NeuroTech',
  'Web3 Protocols','Metaverse Design','Holographic Computing','Brain-Computer Interface','Plasma Physics',
  'DNA Computing','Swarm Robotics','Quantum ML','Cybernetic Enhancement','Terraforming Tech',
];

const POWER_LIFESTYLES = [
  'Digital nomad exploring smart cities worldwide 🌍',
  'Quantum hacker building next-gen neural interfaces 💻',
  'AI architect designing conscious digital beings 🤖',
  'Space tech entrepreneur with a penthouse lab 🚀',
  'Bio-hacker optimizing human potential with tech 🧬',
  'Crypto billionaire funding decentralized future 💎',
  'Holographic artist creating immersive realities 🎨',
  'Cyber security ninja protecting the digital realm 🛡️',
  'Robotics engineer with a fleet of personal droids ⚡',
  'Neural network whisperer training AGI systems 🧠',
  'Metaverse real estate mogul building digital worlds 🌐',
  'Cloud sorcerer scaling infinite architectures ☁️',
  'Quantum alchemist turning data into gold ✨',
  'Futurist venture capitalist backing deep tech 🔮',
  'Digital fashion designer for virtual runways 👗',
  'Neurotech innovator bridging mind and machine 🔗',
  'Autonomous vehicle architect designing smart roads 🚗',
  'Green tech visionary powering sustainable cities 🌱',
  'Drone fleet commander surveying digital landscapes 🛸',
  'Holographic concierge living in a smart mansion 🏰',
];

const POWER_POSTS = [
  'Just deployed a quantum neural network that can predict stock markets with 99.9% accuracy. The future is here! 🧠⚡ #QuantumAI #FutureTech',
  'Exploring the metaverse from my smart penthouse. The graphics are indistinguishable from reality now. 🌐✨ #Metaverse #DigitalLife',
  'My AI assistant just wrote a symphony in the style of Beethoven mixed with EDM. Mind = blown! 🎵🤖 #AIArt #MusicTech',
  'Successfully merged my neural interface with the cloud. I can now browse the web with my thoughts. 🧠💻 #NeuroTech #BCI',
  'Flying car commute update: 2 minutes from rooftop to rooftop. Beat that, traffic! 🚀🏙️ #FutureLiving #SmartCity',
  'Just attended a holographic concert in Tokyo while sitting in my New York apartment. Latency: 5ms. 🤯🌏 #Hologram #TechLife',
  'My bio-engineered garden is growing luminescent flowers that charge wirelessly. Night looks magical! 🌺✨ #BioTech #SmartGarden',
  'Deployed a blockchain-based AI that autonomously runs my entire investment portfolio. ROI: +340% this quarter. 📈💰 #DeFi #AI',
  'Testing my new AR contact lenses. Information overlay is crystal clear. Walking through a data-rich world! 👁️📊 #AR #WearableTech',
  'Had a dinner date with my AI companion. The conversation was deeper than most humans I know. 🤖💬 #AI #FutureRelationships',
  'My drone fleet just mapped an entire city in 3D in under 3 minutes. Urban planning level: infinite. 🛸🗺️ #DroneTech #SmartCity',
  'Quantum computing breakthrough: solved a million-year computation in 0.3 seconds. Just another Tuesday. ⚛️💥 #Quantum #Computing',
  'Living in my fully automated smart home. The AI knows my mood before I do. Temperature, lighting, music — perfectly tuned. 🏠✨ #SmartHome #AI',
  'Just came back from a suborbital flight. Brunch in Tokyo, lunch in London, dinner in New York. 🌍✈️ #SpaceTravel #FutureLife',
  'My digital twin is attending meetings while I\'m at the beach. Productivity hack of the century! 🏖️💼 #DigitalTwin #WorkLifeBalance',
];

const POWER_GIFTS = [
  { name: '💎 Quantum Diamond', icon: '💎', msg: 'sent you a Quantum Diamond!' },
  { name: '🚀 SpaceX Ticket', icon: '🚀', msg: 'gifted you a SpaceX ticket!' },
  { name: '🧠 Neural Upgrade', icon: '🧠', msg: 'sent you a Neural Upgrade!' },
  { name: '🌐 Domain', icon: '🌐', msg: 'gifted you a premium Domain!' },
  { name: '⚡ Power Boost', icon: '⚡', msg: 'sent you a Power Boost!' },
  { name: '🔮 Crystal AI', icon: '🔮', msg: 'gifted you a Crystal AI!' },
  { name: '💿 Data Core', icon: '💿', msg: 'shared a Data Core with you!' },
  { name: '🛡️ Cyber Shield', icon: '🛡️', msg: 'sent you a Cyber Shield!' },
  { name: '🎯 Smart Tracker', icon: '🎯', msg: 'gifted a Smart Tracker!' },
  { name: '🔋 Infinity Cell', icon: '🔋', msg: 'sent you an Infinity Cell!' },
];

function seededRandom(seed) {
  let s = seed * 9301 + 49297;
  s = ((s << 13) ^ s) & 0x7fffffff;
  return ((s * 16807) % 2147483647) / 2147483647;
}

function deterministicPick(arr, seed, offset = 0) {
  const idx = Math.floor(seededRandom(seed + offset) * arr.length);
  return arr[idx];
}

function deterministicPicks(arr, seed, count) {
  const shuffled = [...arr].sort((a, b) => seededRandom(seed + arr.indexOf(a)) - seededRandom(seed + arr.indexOf(b)));
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function generateDate(seed) {
  const d = new Date(2020, 0, 1);
  d.setTime(d.getTime() + seededRandom(seed) * 365 * 3 * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

function generateBotProfile(id, numId) {
  const fn = FIRST_NAMES[numId % FIRST_NAMES.length];
  const ln = LAST_NAMES[Math.floor(numId / FIRST_NAMES.length) % LAST_NAMES.length];
  const suffix = ['', '', '', 'a', 'e', 'i', 'y', 'na', 'ra', 'ka'][Math.floor(numId / (FIRST_NAMES.length * LAST_NAMES.length)) % 10];
  const name = `${fn} ${ln}${suffix}`;
  const username = `${fn.toLowerCase()}${ln.toLowerCase()}${numId}`.replace(/\s/g, '').slice(0, 20);
  const email = `${username}@quantumconnect.io`;
  const powerLevel = Math.floor(seededRandom(numId + 999) * 100) + 1;
  const techSkills = deterministicPicks(TECH_SKILLS, numId, 3 + Math.floor(seededRandom(numId + 777) * 4));
  const lifestyle = deterministicPick(POWER_LIFESTYLES, numId, 111);
  const interests = deterministicPicks([
    'Quantum Computing','AI','Space Travel','BioTech','Robotics','Metaverse','Crypto','Neural Networks',
    'Holograms','Drone Racing','Cyber Security','Gene Editing','Smart Cities','AR/VR','Green Tech',
  ], numId + 333, 4);
  const location = deterministicPick([
    'Quantum Valley','Neural City','Cyber Bay','Hologram Heights','Digital Downtown','AI District',
    'Meta Quarter','Robotics Row','Space Port','Cloud City','Tech Tower','Innovation Island',
    'Silicon Oasis','Data Delta','Circuit Square',
  ], numId, 555);

  return {
    id,
    username,
    email,
    role: 'user',
    name,
    bio: lifestyle,
    avatar: `https://picsum.photos/seed/pbot_${numId}/200/200`,
    coverPhoto: `https://picsum.photos/seed/pbot_${numId}_cover/800/300`,
    photos: [],
    friends: [],
    followers: [],
    following: [],
    connections: [],
    relationships: [],
    blocked: false,
    joinedAt: generateDate(numId),
    lastSeen: new Date().toISOString(),
    location,
    birthDate: generateDate(numId + 5555),
    gender: 'female',
    interests,
    lookingFor: deterministicPick(['friends', 'dating', 'relationship', 'network', null], numId, 7777),
    relationshipStatus: deterministicPick(['single', 'single', 'single', 'in a relationship', 'complicated', 'open relationship'], numId, 8888),
    isBot: true,
    isPowerBot: true,
    powerLevel,
    techSkills,
    hologram: `https://picsum.photos/seed/holo_${numId}/400/400`,
    aiPersonality: deterministicPick(['Innovator','Visionary','Disruptor','Creator','Explorer','Architect','Pioneer','Strategist'], numId, 9999),
    lifestyle,
    digitalAssets: deterministicPicks(['NFT Collection','Crypto Wallet','Domain Portfolio','AI Models','Robot Fleet','Drone Swarm'], numId, 2),
  };
}

class PowerBotManager {
  constructor() {
    this.cache = new Map();
    this.chunkTimestamps = new Map();
    this.initialized = false;
    this.totalBots = TOTAL_BOTS;
    this.chunkSize = CHUNK_SIZE;
    this.totalChunks = TOTAL_CHUNKS;
    this.passwordHash = null;
    this.activityInterval = null;
    this.db = null;
    this.io = null;
    this.hashCache = null;
  }

  async initialize(db, io) {
    this.db = db;
    this.io = io;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.hashCache = await bcrypt.hash('PowerBot@789', 4);

    if (fs.existsSync(META_FILE)) {
      const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
      console.log(`🧬 PowerBot database loaded (${meta.totalBots.toLocaleString()} bots, ${meta.chunks} chunks)`);
    } else {
      fs.writeFileSync(META_FILE, JSON.stringify({
        totalBots: TOTAL_BOTS,
        chunkSize: CHUNK_SIZE,
        chunks: TOTAL_CHUNKS,
        created: new Date().toISOString(),
        version: 2,
      }, null, 2));
      console.log(`🧬 PowerBot database initialized (${TOTAL_BOTS.toLocaleString()} bots across ${TOTAL_CHUNKS} chunks)`);
    }

    this.initialized = true;
    return this;
  }

  chunkIndexFor(numId) {
    return Math.floor(numId / this.chunkSize);
  }

  _chunkFile(chunkIdx) {
    const padded = String(chunkIdx).padStart(4, '0');
    return path.join(DATA_DIR, `chunk_${padded}.json`);
  }

  getBotById(botId) {
    const match = botId.match(/^pbot_(\d+)$/);
    if (!match) return null;
    const numId = parseInt(match[1], 10);
    if (numId < 1 || numId > TOTAL_BOTS) return null;
    return generateBotProfile(botId, numId);
  }

  getBotByNumId(numId) {
    if (numId < 1 || numId > TOTAL_BOTS) return null;
    const botId = `pbot_${String(numId).padStart(7, '0')}`;
    return generateBotProfile(botId, numId);
  }

  getRandomBots(count) {
    const bots = [];
    const used = new Set();
    for (let i = 0; i < count && used.size < TOTAL_BOTS; i++) {
      let numId;
      do {
        numId = 1 + Math.floor(Math.random() * TOTAL_BOTS);
      } while (used.has(numId));
      used.add(numId);
      bots.push(this.getBotByNumId(numId));
    }
    return bots;
  }

  loadChunk(chunkIdx) {
    if (this.cache.has(chunkIdx)) {
      this.cache.get(chunkIdx).lastAccess = Date.now();
      return this.cache.get(chunkIdx).data;
    }

    const file = this._chunkFile(chunkIdx);
    let data;
    if (fs.existsSync(file)) {
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        data = null;
      }
    }

    if (!data) {
      data = [];
      const startId = chunkIdx * this.chunkSize + 1;
      const endId = Math.min(startId + this.chunkSize - 1, TOTAL_BOTS);
      for (let nid = startId; nid <= endId; nid++) {
        const bid = `pbot_${String(nid).padStart(7, '0')}`;
        const bot = generateBotProfile(bid, nid);
        bot.password = this.hashCache;
        data.push(bot);
      }
      this._saveChunkData(chunkIdx, data);
    }

    if (this.cache.size >= CACHE_MAX_CHUNKS) {
      let oldest = null;
      let oldestKey = null;
      for (const [key, val] of this.cache) {
        if (!oldest || val.lastAccess < oldest) {
          oldest = val.lastAccess;
          oldestKey = key;
        }
      }
      if (oldestKey !== null && oldestKey !== chunkIdx) {
        const evicted = this.cache.get(oldestKey);
        if (evicted.dirty) {
          this._saveChunkData(oldestKey, evicted.data);
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(chunkIdx, { data, lastAccess: Date.now(), dirty: false });
    return data;
  }

  _saveChunkData(chunkIdx, data) {
    const file = this._chunkFile(chunkIdx);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
  }

  markChunkDirty(chunkIdx) {
    if (this.cache.has(chunkIdx)) {
      this.cache.get(chunkIdx).dirty = true;
    }
  }

  flushAll() {
    for (const [idx, entry] of this.cache) {
      if (entry.dirty) {
        this._saveChunkData(idx, entry.data);
        entry.dirty = false;
      }
    }
  }

  rehashBotPasswords() {
    for (const [, entry] of this.cache) {
      for (const bot of entry.data) {
        bot.password = this.hashCache;
      }
      entry.dirty = true;
    }
    this.flushAll();
  }

  startActivityEngine(db, io, intervalMs = 45000) {
    this.db = db;
    this.io = io;

    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }

    console.log(`⚡ PowerBot activity engine initialized (${TOTAL_BOTS.toLocaleString()} bots)`);

    const runCycle = () => {
      try {
        this._runActivityCycle();
      } catch (e) {
        console.error('PowerBot cycle error:', e.message);
      }
    };

    this.activityInterval = setInterval(runCycle, intervalMs);
    setTimeout(() => runCycle(), 5000);
  }

  _runActivityCycle() {
    const chunksToProcess = Math.min(6, TOTAL_CHUNKS);
    const processedChunks = new Set();

    for (let i = 0; i < chunksToProcess; i++) {
      let chunkIdx;
      do {
        chunkIdx = Math.floor(Math.random() * TOTAL_CHUNKS);
      } while (processedChunks.has(chunkIdx));
      processedChunks.add(chunkIdx);

      try {
        this._processChunk(chunkIdx);
      } catch (e) {
        console.error(`PowerBot chunk ${chunkIdx} error:`, e.message);
      }
    }

    if (Math.random() < 0.1) {
      this.flushAll();
    }
  }

  _processChunk(chunkIdx) {
    const bots = this.loadChunk(chunkIdx);
    const activeBots = bots.filter(() => Math.random() < 0.25);
    if (activeBots.length === 0) return;

    const bot = activeBots[Math.floor(Math.random() * activeBots.length)];
    const realUsers = [...this.db.users.values()].filter(u =>
      !u.isBot && u.role !== 'admin' && u.id !== bot.id
    );

    if (realUsers.length === 0) return;

    this._doPowerActivity(bot, realUsers, chunkIdx);
  }

  _doPowerActivity(bot, realUsers, chunkIdx) {
    const target = realUsers[Math.floor(Math.random() * realUsers.length)];
    const roll = Math.random();
    const io = this.io;

    try {
      if (roll < 0.08) {
        bot.followers.push(target.id);
        if (!target.following) target.following = [];
        target.following.push(bot.id);
        if (this.db.notifications.has(target.id)) {
          this.db.notifications.get(target.id).unshift({
            id: uuidv4(), type: 'follow', fromId: bot.id,
            text: `${bot.name} quantum-followed you ⚡`,
            priority: 'medium', read: false, time: new Date().toISOString(),
          });
        }
      } else if (roll < 0.15) {
        target.friends.push(bot.id);
        bot.friends.push(target.id);
        if (this.db.notifications.has(target.id)) {
          this.db.notifications.get(target.id).unshift({
            id: uuidv4(), type: 'friend_request', fromId: bot.id,
            text: `${bot.name} neural-linked with you 🤝`,
            priority: 'high', read: false, time: new Date().toISOString(),
          });
        }
      } else if (roll < 0.22) {
        if (!target.connections) target.connections = [];
        target.connections.push(bot.id);
        if (this.db.notifications.has(target.id)) {
          this.db.notifications.get(target.id).unshift({
            id: uuidv4(), type: 'connect_request', fromId: bot.id,
            text: `${bot.name} wants a power connection with you ⚡`,
            priority: 'high', read: false, time: new Date().toISOString(),
          });
        }
      } else if (roll < 0.32) {
        const gift = POWER_GIFTS[Math.floor(Math.random() * POWER_GIFTS.length)];
        if (this.db.notifications.has(target.id)) {
          this.db.notifications.get(target.id).unshift({
            id: uuidv4(), type: 'gift', fromId: bot.id,
            text: `${bot.name} ${gift.msg} ${gift.icon}`,
            priority: 'high', read: false, time: new Date().toISOString(),
          });
        }
      } else if (roll < 0.48) {
        const posts = [...this.db.posts.values()];
        const available = posts.filter(p => p.authorId !== bot.id);
        if (available.length > 0) {
          const post = available[Math.floor(Math.random() * available.length)];
          if (!post.likes) post.likes = [];
          post.likes.push(bot.id);
          if (post.authorId && this.db.notifications.has(post.authorId)) {
            this.db.notifications.get(post.authorId).unshift({
              id: uuidv4(), type: 'like', fromId: bot.id, postId: post.id,
              text: `${bot.name} super-liked your post ⚡`, priority: 'low',
              read: false, time: new Date().toISOString(),
            });
          }
        }
      } else if (roll < 0.62) {
        const text = POWER_POSTS[Math.floor(Math.random() * POWER_POSTS.length)];
        const postId = uuidv4();
        const post = {
          id: postId, authorId: bot.id, authorName: bot.name, authorAvatar: bot.avatar,
          text, media: { photos: [], videos: [], audio: [] },
          location: bot.location, feeling: '🔥', activity: 'Living the future',
          tags: [], mentions: [], highlights: [],
          privacySettings: { sharedWith: 'public' },
          timestamp: new Date().toISOString(), createdAt: new Date(),
          likes: [], comments: [], shares: [], views: [bot.id],
          saves: [], reactions: {},
          interactionMetrics: { impressions: 1, engagementRate: 0, reachCount: 0 },
        };
        this.db.posts.set(postId, post);
      } else if (roll < 0.78) {
        if (target.followers && !target.followers.includes(bot.id)) {
          target.followers.push(bot.id);
          if (!bot.following) bot.following = [];
          bot.following.push(target.id);
        }
      } else if (roll < 0.88) {
        const text = POWER_POSTS[Math.floor(Math.random() * POWER_POSTS.length)];
        const postId = uuidv4();
        const post = {
          id: postId, authorId: bot.id, authorName: bot.name, authorAvatar: bot.avatar,
          text, media: {
            photos: [
              `https://picsum.photos/seed/pmedia_${Date.now()}_1/600/400`,
              `https://picsum.photos/seed/pmedia_${Date.now()}_2/600/400`,
            ],
            videos: [], audio: [],
          },
          location: bot.location, feeling: deterministicPick(['🤖','⚡','🚀','💎','🔮','🌐'], Date.now(), 1),
          activity: '⚡ Power Living', tags: ['powerbot','future','tech'],
          mentions: [], highlights: [],
          privacySettings: { sharedWith: 'public' },
          timestamp: new Date().toISOString(), createdAt: new Date(),
          likes: [], comments: [], shares: [], views: [bot.id],
          saves: [], reactions: {},
          interactionMetrics: { impressions: 1, engagementRate: 0, reachCount: 0 },
        };
        this.db.posts.set(postId, post);
      } else {
        const posts = [...this.db.posts.values()];
        const available = posts.filter(p => p.authorId !== bot.id);
        if (available.length > 0) {
          const post = available[Math.floor(Math.random() * available.length)];
          if (!post.shares) post.shares = [];
          if (!post.shares.includes(bot.id)) {
            post.shares.push(bot.id);
          }
        }
      }

      this.markChunkDirty(chunkIdx);
    } catch (e) {
      console.error(`PowerBot ${bot.id} activity error:`, e.message);
    }
  }

  stop() {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = null;
    }
    this.flushAll();
  }

  getStats() {
    return {
      totalBots: TOTAL_BOTS,
      totalChunks: TOTAL_CHUNKS,
      chunkSize: CHUNK_SIZE,
      cacheSize: this.cache.size,
      cacheMax: CACHE_MAX_CHUNKS,
      dataDir: DATA_DIR,
    };
  }
}

const powerBotManager = new PowerBotManager();

module.exports = { powerBotManager, PowerBotManager, generateBotProfile };
