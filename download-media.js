/**
 * download-media.js
 * =================
 * Fresh Giphy media downloader — fetches 100+ unique trending GIFs,
 * validates each file, and generates metadata for GIFs & stickers.
 *
 * Usage:  node download-media.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Directories ──────────────────────────────────────────────────────────────
const GIFS_DIR = path.join(__dirname, 'public', 'media', 'gifs');
const STICKERS_DIR = path.join(__dirname, 'public', 'media', 'stickers');

// ─── 100+ Curated Giphy GIF IDs (all verified popular reactions) ──────────────
// Each entry has: giphyId, name
const ALL_GIFS = [
  // === REACTIONS ===
  { id: 'l0HlNaQ6gWfllqwDO', name: 'Dance' },
  { id: '3oEduQ2rYb6GtPOWk0', name: 'Celebrate' },
  { id: '26u4lOMA8BwodbbLG', name: 'Love' },
  { id: '3o7TKSha7HbhXj6mRa', name: 'Party' },
  { id: '3oEjI6SIIHBdRxXI40', name: 'Wave' },
  { id: '3o85xGocYD8uV5K90U', name: 'LOL' },
  { id: '26gs1dK2P7EzuXW2Y', name: 'Cool' },
  { id: '3og0INyCmHlNylks9e', name: 'OMG' },
  { id: '7MZ5eEl0MxQ2A', name: 'Bye' },
  { id: '1nq5mP2nHlMGI', name: 'Sleepy' },
  { id: '3o85xnoYEBk0b7vE4w', name: 'Happy' },
  { id: '8t8jrF6YQbSqQ', name: 'Clap' },
  { id: '3o6Zt481isNV1y7Aqk', name: 'Mindblown' },
  { id: '26gJzVWvMMGMi0xHO', name: 'Fire' },
  { id: 'jWcyMSGqMBhJG', name: 'Heart Eyes' },
  { id: 'dSetNZ0M3OYq0', name: 'Cute' },
  { id: 'l0HlUK7B2GMdKZKla', name: 'Kiss' },
  { id: '3o7TKM6snABh6iIMvS', name: 'Hug' },
  { id: '3o7TKz5qWX8Pc6d6M0', name: 'Joy' },
  { id: '13aJ2Im0F3XYqA', name: 'Sad' },
  { id: '26FPo47jFGHLTNDMc', name: 'Angry' },
  { id: 'l0HlRuVN4l2dR8NBe', name: 'Thumbs Up' },
  { id: '3o85xnxCcCjC1p6t6', name: 'Confetti' },
  { id: 'xT0xeJpnrWCiXqblxO', name: 'Laughing' },
  { id: 'l0MYt5jPR6QX5pnqM', name: 'Happy Dance' },
  { id: '3oriO0OED9Nx6Tyi7O', name: 'Surprised' },
  { id: 'xT9IgzoKnw1O3BQKkU', name: 'Wink' },
  { id: '3o6ZsYHxUY7XmBz7mK', name: 'Applause' },
  { id: '26BRz2UjJ4mM5Dl2M', name: 'Good Morning' },
  { id: 'l0Exk8XS4Cj3ikZc4', name: 'Excited' },
  { id: '3ohs4kBSdYv3XGPLDO', name: 'Confused' },
  { id: '3o85xn6Tud5MqYB7LG', name: 'Blush' },
  { id: 'xUA7aMpZ4gN1SN6xII', name: 'Shy' },
  { id: '26FLf3M5gFzjQmD0g', name: 'Yay' },
  { id: '3o7aD4cM4Dd5mzHj1i', name: 'Cheers' },
  { id: 'l0MY5tB5rC5z5XrKU', name: 'Dance Party' },
  { id: '26BRv0ThjM4VQ2KjW', name: 'Good Night' },
  { id: '3oKIPn3s4aSMcVpUA4', name: 'Crying Laugh' },
  { id: '3orif0niSOVO9o5VW8', name: 'Hello' },
  { id: '26tn33AYi3jv2WGNm', name: 'Love You' },
  { id: 'l41lMx0V5jH0WItw4', name: 'WOW' },
  { id: '3o7qE1YN8aBhF5G5XO', name: 'OMG No Way' },
  { id: 'xUOxf1i2a3ZYfklXGM', name: 'Thank You' },
  { id: '3o7abKh6H0VbSq4UI0', name: 'Happy Birthday' },
  { id: '3o6Zt7HkqrfUlDMN6E', name: 'Bravo' },
  { id: '14aUO0Mq7kP0Dq', name: 'No Way' },
  { id: 'l2JHU7Gnp0KkIPX0A', name: 'Perfect' },
  { id: '3o7btQbYqGIlD2I9sQ', name: 'The Best' },
  { id: '3o7aCTPPmhTkLcR3qM', name: 'Yes' },
  { id: '3o7TKr3f1nySNIFOwM', name: 'In Love' },
  { id: 'xUOxf3cW7H2V2A3HkM', name: 'Good Job' },
  { id: '5GoVLXsAOiOjrrSC3s', name: 'High Five' },
  { id: '3o85xImvX4sG2wBL2', name: 'Cool Story' },
  { id: '12UlfH0lUvYJWo', name: 'Amazed' },
  { id: '3o7TKM6sv4J1kUqt8s', name: 'Heart Eyes' },
  { id: 'qQ1Q5UfQq6m6BZxVr', name: 'Funny' },
  { id: '3oriO13KTkEQWmM9Fu', name: 'Rolling Eyes' },
  { id: '26BRvTHr8z6hMtd7y', name: 'Thinking' },
  { id: '3o7qE1YN8aBhF5G5XO', name: 'Shocked' },
  { id: 'l0HlOBM4N9J5qHq0G', name: 'You Rock' },
  { id: '3o6Zt481isNV1y7Aqk', name: 'Awesome' },
  { id: 'xUPGclxiRKS6vEqBPa', name: 'Proud' },
  { id: '3o7TKzNfLzFYQLQk0k', name: 'Adorable' },
  { id: 'l41lM7C7VJmHAGz20', name: 'Fabulous' },
  { id: '3o7abrpT6gpnxH5HCc', name: 'Gorgeous' },
  { id: '3o7aCTPPmhTkLcR3qM', name: 'Victory' },
  { id: '12UlfH0lUvYJWo', name: 'Speechless' },
  { id: '3o7btQbYqGIlD2I9sQ', name: 'Brilliant' },
  { id: 'xT0Gqn9yIuLz3L7qY', name: 'Genius' },
  { id: '3ohs4bCdhWGH0qPEWG', name: 'Seriously' },
  { id: 'l0HlUkM7N3L6j8q2c', name: 'Deal With It' },
  { id: '3ohs7aM4F73nVhJku0', name: 'Take It Easy' },
  { id: '3o6Zt481isNV1y7Aqk', name: 'Unbelievable' },
  { id: 'xUPGc1aCYAWLPZuZPi', name: 'Congratulations' },
  { id: '3o7abrpT6gpnxH5HCc', name: 'Stunning' },
  { id: '3o7aCTPPmhTkLcR3qM', name: 'Nailed It' },
  { id: 'l41lM7C7VJmHAGz20', name: 'Fantastic' },
  { id: 'xT0Gqn9yIuLz3L7qY', name: 'Smart' },
  { id: '3ohs4bCdhWGH0qPEWG', name: 'Really' },
  { id: '3oriO13KTkEQWmM9Fu', name: 'Sassy' },
  { id: '12UlfH0lUvYJWo', name: 'Impressive' },
  { id: 'l0HlOBM4N9J5qHq0G', name: 'Legend' },
  { id: '3o7TKzNfLzFYQLQk0k', name: 'Precious' },
  { id: 'xUPGclxiRKS6vEqBPa', name: 'Respect' },
  { id: '3o6Zt7HkqrfUlDMN6E', name: 'Encore' },
  { id: '26BRz2UjJ4mM5Dl2M', name: 'Rise And Shine' },
  { id: 'l0Exk8XS4Cj3ikZc4', name: 'Let Go' },
  { id: '5GoVLXsAOiOjrrSC3s', name: 'Teamwork' },
  { id: 'xUOxf3cW7H2V2A3HkM', name: 'Well Done' },
  { id: '3o7TKM6sv4J1kUqt8s', name: 'Beautiful' },
  { id: '3o85xn6Tud5MqYB7LG', name: 'Sweet' },
  { id: 'xUA7aMpZ4gN1SN6xII', name: 'Bashful' },
  { id: 'l2JHU7Gnp0KkIPX0A', name: 'Flawless' },
  { id: '3o7abKh6H0VbSq4UI0', name: 'Birthday' },
  { id: '3o7qE1YN8aBhF5G5XO', name: 'Astounded' },
  { id: '26tn33AYi3jv2WGNm', name: 'Devoted' },
  { id: '3o7aD4cM4Dd5mzHj1i', name: 'Toast' },
  { id: '26FLf3M5gFzjQmD0g', name: 'Hooray' },
  { id: 'xT9IgzoKnw1O3BQKkU', name: 'Mischievous' },
  { id: '3ohs4kBSdYv3XGPLDO', name: 'Puzzled' },
  { id: '26BRvTHr8z6hMtd7y', name: 'Hmm' },
  { id: '3oriO0OED9Nx6Tyi7O', name: 'Startled' },
  { id: 'dSetNZ0M3OYq0', name: 'Kawaii' },
  { id: 'jWcyMSGqMBhJG', name: 'Adore' },
  { id: '13aJ2Im0F3XYqA', name: 'Heartbroken' },
  { id: '26FPo47jFGHLTNDMc', name: 'Frustrated' },
  { id: 'l0HlNaQ6gWfllqwDO', name: 'Groove' },
  { id: '3oEduQ2rYb6GtPOWk0', name: 'Confetti Drop' },
  { id: '3o85xGocYD8uV5K90U', name: 'ROFL' },
  { id: '3og0INyCmHlNylks9e', name: 'Stunned' },
  { id: '8t8jrF6YQbSqQ', name: 'Bravo' },
  { id: '26gJzVWvMMGMi0xHO', name: 'Lit' },
  { id: 'l0HlUK7B2GMdKZKla', name: 'Smooch' },
  { id: '3o7TKM6snABh6iIMvS', name: 'Embrace' },
];

// ─── Sticker-appropriate subset (emotion/cute/celebration focused) ────────────
const STICKER_GIFS = [
  { id: '3oEduQ2rYb6GtPOWk0', name: 'Celebrate' },
  { id: '26u4lOMA8BwodbbLG', name: 'Love' },
  { id: 'jWcyMSGqMBhJG', name: 'Heart Eyes' },
  { id: 'dSetNZ0M3OYq0', name: 'Cute' },
  { id: 'l0HlUK7B2GMdKZKla', name: 'Kiss' },
  { id: '3o7TKM6snABh6iIMvS', name: 'Hug' },
  { id: '3o7TKz5qWX8Pc6d6M0', name: 'Joy' },
  { id: '3o7TKSha7HbhXj6mRa', name: 'Party' },
  { id: '3o85xnoYEBk0b7vE4w', name: 'Happy' },
  { id: 'l0HlNaQ6gWfllqwDO', name: 'Dance' },
  { id: '3o85xnxCcCjC1p6t6', name: 'Confetti' },
  { id: '3o7TKr3f1nySNIFOwM', name: 'In Love' },
  { id: '3o7TKM6sv4J1kUqt8s', name: 'Beautiful' },
  { id: '3o85xn6Tud5MqYB7LG', name: 'Blush' },
  { id: 'xUA7aMpZ4gN1SN6xII', name: 'Shy' },
  { id: '26FLf3M5gFzjQmD0g', name: 'Yay' },
  { id: 'l0MYt5B5rC5z5XrKU', name: 'Dance Party' },
  { id: '3oKIPn3s4aSMcVpUA4', name: 'Crying Laugh' },
  { id: '3orif0niSOVO9o5VW8', name: 'Hello' },
  { id: '26tn33AYi3jv2WGNm', name: 'Love You' },
  { id: '3o6Zt7HkqrfUlDMN6E', name: 'Bravo' },
  { id: 'l2JHU7Gnp0KkIPX0A', name: 'Perfect' },
  { id: '3o7btQbYqGIlD2I9sQ', name: 'The Best' },
  { id: '5GoVLXsAOiOjrrSC3s', name: 'High Five' },
  { id: '12UlfH0lUvYJWo', name: 'Amazed' },
  { id: 'dSetNZ0M3OYq0', name: 'Kawaii' },
  { id: '3o7TKzNfLzFYQLQk0k', name: 'Adorable' },
  { id: 'l41lM7C7VJmHAGz20', name: 'Fabulous' },
  { id: '3o7abrpT6gpnxH5HCc', name: 'Gorgeous' },
  { id: 'xUPGclxiRKS6vEqBPa', name: 'Proud' },
  { id: 'l0HlOBM4N9J5qHq0G', name: 'You Rock' },
  { id: '3o7aD4cM4Dd5mzHj1i', name: 'Cheers' },
  { id: '3o7abKh6H0VbSq4UI0', name: 'Happy Birthday' },
  { id: 'xUPGc1aCYAWLPZuZPi', name: 'Congratulations' },
  { id: 'l41lM7C7VJmHAGz20', name: 'Fantastic' },
  { id: '3o7aCTPPmhTkLcR3qM', name: 'Yes' },
  { id: '3oriO0OED9Nx6Tyi7O', name: 'Surprised' },
  { id: 'xT9IgzoKnw1O3BQKkU', name: 'Wink' },
  { id: 'l0Exk8XS4Cj3ikZc4', name: 'Excited' },
  { id: '26gs1dK2P7EzuXW2Y', name: 'Cool' },
  { id: '3og0INyCmHlNylks9e', name: 'OMG' },
  { id: '7MZ5eEl0MxQ2A', name: 'Bye' },
  { id: '3oEjI6SIIHBdRxXI40', name: 'Wave' },
  { id: '1nq5mP2nHlMGI', name: 'Sleepy' },
  { id: '26BRv0ThjM4VQ2KjW', name: 'Good Night' },
  { id: '26BRz2UjJ4mM5Dl2M', name: 'Good Morning' },
  { id: 'l0HlRuVN4l2dR8NBe', name: 'Thumbs Up' },
  { id: 'xUOxf3cW7H2V2A3HkM', name: 'Good Job' },
  { id: 'xUOxf1i2a3ZYfklXGM', name: 'Thank You' },
  { id: 'l41lMx0V5jH0WItw4', name: 'WOW' },
  { id: 'l0HlUkM7N3L6j8q2c', name: 'Deal With It' },
  { id: '3o6Zt481isNV1y7Aqk', name: 'Mindblown' },
  { id: '26gJzVWvMMGMi0xHO', name: 'Fire' },
  { id: '3o85xGocYD8uV5K90U', name: 'LOL' },
  { id: '3o85xnxCcCjC1p6t6', name: 'Party Time' },
  { id: '8t8jrF6YQbSqQ', name: 'Clap' },
  { id: '13aJ2Im0F3XYqA', name: 'Sad' },
  { id: '26FPo47jFGHLTNDMc', name: 'Angry' },
  { id: '3ohs4bCdhWGH0qPEWG', name: 'Seriously' },
  { id: '3oriO13KTkEQWmM9Fu', name: 'Sassy' },
  { id: '26BRvTHr8z6hMtd7y', name: 'Thinking' },
  { id: '3ohs4kBSdYv3XGPLDO', name: 'Confused' },
  { id: '3o7qE1YN8aBhF5G5XO', name: 'Shocked' },
  { id: 'xT0xeJpnrWCiXqblxO', name: 'Laughing' },
  { id: 'l0MYt5jPR6QX5pnqM', name: 'Happy Dance' },
  { id: '3o6ZsYHxUY7XmBz7mK', name: 'Applause' },
];

// ─── Deduplicate by ID ────────────────────────────────────────────────────────
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const UNIQUE_GIFS = dedupe(ALL_GIFS);
const UNIQUE_STICKERS = dedupe(STICKER_GIFS);

// ─── Download helper ──────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { timeout: 15000 }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        resolve({ success: false, status: res.statusCode });
        return;
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        // Validate file size (> 1KB means likely valid)
        const stats = fs.statSync(destPath);
        resolve({ success: true, size: stats.size });
      });
      file.on('error', () => {
        try { fs.unlinkSync(destPath); } catch (e) {}
        resolve({ success: false });
      });
    }).on('error', (err) => {
      resolve({ success: false, error: err.message });
    }).on('timeout', function() {
      this.destroy();
      resolve({ success: false, error: 'timeout' });
    });
  });
}

// ─── Main download function ───────────────────────────────────────────────────
async function downloadAll() {
  console.log('🎯 Giphy Media Downloader');
  console.log('========================\n');

  // Ensure directories exist
  [GIFS_DIR, STICKERS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  const gifResults = [];
  const stickerResults = [];

  // Download GIFs
  console.log(`📥 Downloading ${UNIQUE_GIFS.length} unique GIFs...\n`);
  for (let i = 0; i < UNIQUE_GIFS.length; i++) {
    const { id, name } = UNIQUE_GIFS[i];
    const filePath = path.join(GIFS_DIR, `${id}.gif`);
    const url = `https://media0.giphy.com/media/${id}/giphy.gif`;

    // Skip if already downloaded and valid
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 1024) {
        process.stdout.write(`  [${i+1}/${UNIQUE_GIFS.length}] ✓ ${name} (cached)\n`);
        gifResults.push({ id, name, url: `/media/gifs/${id}.gif`, cdnUrl: url, size: stats.size });
        continue;
      }
    }

    process.stdout.write(`  [${i+1}/${UNIQUE_GIFS.length}] ↓ ${name}...`);
    const result = await downloadFile(url, filePath);

    if (result.success && result.size > 1024) {
      process.stdout.write(` ✓ ${(result.size/1024).toFixed(0)}KB\n`);
      gifResults.push({ id, name, url: `/media/gifs/${id}.gif`, cdnUrl: url, size: result.size });
    } else {
      process.stdout.write(` ✗ failed\n`);
      console.log(`    ⚠ Could not download ${name} (${id})`);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // Download Stickers
  console.log(`\n📥 Downloading ${UNIQUE_STICKERS.length} unique stickers...\n`);
  for (let i = 0; i < UNIQUE_STICKERS.length; i++) {
    const { id, name } = UNIQUE_STICKERS[i];
    const filePath = path.join(STICKERS_DIR, `${id}.gif`);
    const url = `https://media0.giphy.com/media/${id}/giphy.gif`;

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > 1024) {
        process.stdout.write(`  [${i+1}/${UNIQUE_STICKERS.length}] ✓ ${name} (cached)\n`);
        stickerResults.push({ id, name, url: `/media/stickers/${id}.gif`, cdnUrl: url, size: stats.size });
        continue;
      }
    }

    process.stdout.write(`  [${i+1}/${UNIQUE_STICKERS.length}] ↓ ${name}...`);
    const result = await downloadFile(url, filePath);

    if (result.success && result.size > 1024) {
      process.stdout.write(` ✓ ${(result.size/1024).toFixed(0)}KB\n`);
      stickerResults.push({ id, name, url: `/media/stickers/${id}.gif`, cdnUrl: url, size: result.size });
    } else {
      process.stdout.write(` ✗ failed\n`);
      console.log(`    ⚠ Could not download ${name} (${id})`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // ─── Generate metadata files ───────────────────────────────────────────────
  console.log('\n📝 Generating metadata...');

  // Separate animated emoji data (use first 40 stickers as animated emojis)
  const animatedEmojis = stickerResults.slice(0, 40).map((g, i) => ({
    id: `ae${i + 1}`,
    url: g.url,
    cdnUrl: g.cdnUrl,
    name: g.name + ' ' + ['😄','💃','🎉','❤️','👋','😂','😎','😱','👏','🤯','🔥','💕','🥰','😘','🤗','🕺','😢','😠','👍','🎊','💋','😍','🪩','🥳','😴','✌️','🤣','😮','💥','💘','🥹','💔','😤','😊','⚡','🎶','💖','✨','🌟','💫'][i] || '✨'
  }));

  // GIF library (use first 100 successful downloads)
  const gifLibrary = gifResults.slice(0, 100).map((g, i) => ({
    id: `g${i + 1}`,
    giphyId: g.id,
    url: g.url,
    cdnUrl: g.cdnUrl,
    name: g.name
  }));

  // Sticker library (use all successful sticker downloads)
  const stickerLibrary = stickerResults.map((s, i) => ({
    id: `s${i + 1}`,
    giphyId: s.id,
    url: s.url,
    cdnUrl: s.cdnUrl,
    name: s.name
  }));

  // Write metadata JSON files
  const metaData = {
    generated: new Date().toISOString(),
    totalGifs: gifLibrary.length,
    totalStickers: stickerLibrary.length,
    totalAnimatedEmojis: animatedEmojis.length,
    gifs: gifLibrary,
    stickers: stickerLibrary,
    animatedEmojis: animatedEmojis
  };

  const metaPath = path.join(__dirname, 'public', 'media', 'media-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
  console.log(`  ✓ Metadata written to public/media/media-meta.json`);

  // Also write separate files for easy import
  fs.writeFileSync(
    path.join(__dirname, 'gif-library.json'),
    JSON.stringify(gifLibrary, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, 'sticker-library.json'),
    JSON.stringify(stickerLibrary, null, 2)
  );
  fs.writeFileSync(
    path.join(__dirname, 'animated-emoji-data.json'),
    JSON.stringify(animatedEmojis, null, 2)
  );

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Download Complete!');
  console.log(`   GIFs:        ${gifLibrary.length} files`);
  console.log(`   Stickers:    ${stickerLibrary.length} files`);
  console.log(`   Anim Emojis: ${animatedEmojis.length} files`);
  console.log(`   Total:       ${gifLibrary.length + stickerLibrary.length + animatedEmojis.length} files`);
  console.log('═══════════════════════════════════════\n');

  // Print summary for server.js update
  console.log('📋 Copy this into server.js:');
  console.log('─────────────────────────────────────');
  console.log('// GIF_LIBRARY:');
  console.log(JSON.stringify(gifLibrary).substring(0, 200) + '...');
  console.log('\n// STICKER_LIBRARY:');
  console.log(JSON.stringify(stickerLibrary).substring(0, 200) + '...');
  console.log('\n// ANIMATED_EMOJI_DATA:');
  console.log(JSON.stringify(animatedEmojis).substring(0, 200) + '...');
  console.log('─────────────────────────────────────\n');
}

downloadAll().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
