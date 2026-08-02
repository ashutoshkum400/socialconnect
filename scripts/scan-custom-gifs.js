#!/usr/bin/env node
/**
 * Script: scan-custom-gifs.js
 *
 * Scans public/media/gifs/ for GIF files and rebuilds gif-library.json.
 * Skips garbage files (Chrome downloads, Giphy variants, etc.).
 *
 * Usage:  node scripts/scan-custom-gifs.js
 */

const fs = require('fs');
const path = require('path');

const GIFS_DIR = path.join(__dirname, '..', 'public', 'media', 'gifs');
const LIBRARY_PATH = path.join(__dirname, '..', 'gif-library.json');
const META_PATH = path.join(__dirname, '..', 'public', 'media', 'media-meta.json');

// Image extensions that the GIF picker can display via <img> tag
const IMAGE_EXTS = new Set(['.gif']);  // only GIFs for the picker

// Files matching these patterns (case-insensitive) are excluded as garbage
const GARBAGE_PATTERNS = [
  /^giphy-(downsized|preview|hd|loop|small)/,
  /^giphy_s\.(gif)$/i,
  /\d{4}-\d{2}-\d{2}T\d{6}/,       // Chrome download timestamps
  /^[\d_\(\)\s-]+\.gif$/,           // only digits/symbols before extension
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Turn "happy-birthday" or "happy_birthday (1)" into "Happy Birthday" */
function humanizeName(filename) {
  let name = filename
    .replace(/\.(gif|webp|png|jpg|jpeg)$/i, '')  // strip extension
    .replace(/ ?\(?\d+\)?$/, '')                   // strip trailing numbers (1), 1 etc
    .replace(/[_\-]+/g, ' ')                       // replace underscores & hyphens with space
    .replace(/\s+/g, ' ')                          // collapse multiple spaces
    .trim();
  // Capitalise first letter of each word
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. Clean up incomplete Chrome downloads (.crdownload)
  let cleaned = 0;
  try {
    const allFiles = fs.readdirSync(GIFS_DIR);
    allFiles.forEach(f => {
      if (f.toLowerCase().endsWith('.crdownload')) {
        const full = path.join(GIFS_DIR, f);
        fs.unlinkSync(full);
        console.log(`🧹 Removed incomplete download: ${f}`);
        cleaned++;
      }
    });
  } catch (e) {
    console.error('⚠ Could not clean .crdownload files:', e.message);
  }
  if (cleaned === 0) console.log('🧹 No .crdownload files to clean.');

  // 2. Read ALL image files from disk
  let files;
  try {
    files = fs.readdirSync(GIFS_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) return false;
      // Exclude files matching garbage patterns
      if (GARBAGE_PATTERNS.some(p => p.test(f))) {
        console.log(`🧹 Skipping garbage file: ${f}`);
        return false;
      }
      return true;
    });
  } catch (e) {
    console.error(`❌ Cannot read ${GIFS_DIR}:`, e.message);
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} image files in ${GIFS_DIR}`);

  if (files.length === 0) {
    console.log('⚠ No image files found. Nothing to do.');
    process.exit(0);
  }

  // 3. Generate fresh library entries for every file (replace entire library)
  const library = files.map(filename => {
    const name = humanizeName(filename);
    return {
      id: `g_${filename.replace(/[^a-zA-Z0-9]/g, '_')}`,
      giphyId: null,
      url: `/media/gifs/${filename}`,
      cdnUrl: null,
      name
    };
  });

  // 4. Sort alphabetically by name
  library.sort((a, b) => a.name.localeCompare(b.name));

  // 5. Write gif-library.json
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2), 'utf-8');
  console.log(`✅ Wrote ${library.length} entries to gif-library.json`);

  // 6. Update media-meta.json
  updateMeta(library.length, library);
}

function updateMeta(totalGifs, library) {
  if (!fs.existsSync(META_PATH)) {
    console.log('⚠ media-meta.json not found, skipping.');
    return;
  }
  try {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    meta.totalGifs = totalGifs;
    meta.gifs = library;
    meta.generated = new Date().toISOString();
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`✅ Updated media-meta.json → totalGifs: ${totalGifs}`);
  } catch (e) {
    console.error('⚠ Failed to update media-meta.json:', e.message);
  }
}

main();
