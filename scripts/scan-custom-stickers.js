#!/usr/bin/env node
/**
 * Script: scan-custom-stickers.js
 *
 * Scans public/media/stickers/ for image files and rebuilds sticker-library.json.
 *
 * Usage:  node scripts/scan-custom-stickers.js
 */

const fs = require('fs');
const path = require('path');

const STICKERS_DIR = path.join(__dirname, '..', 'public', 'media', 'stickers');
const LIBRARY_PATH = path.join(__dirname, '..', 'sticker-library.json');
const META_PATH = path.join(__dirname, '..', 'public', 'media', 'media-meta.json');

// Image extensions that can be displayed as stickers via <img> tag
const IMAGE_EXTS = new Set(['.gif', '.png', '.webp', '.jpg', '.jpeg', '.svg']);

// Skip non-sticker files (Chrome downloads, config files, etc.)
const GARBAGE_PATTERNS = [
  /\.crdownload$/i,
  /^manifest\.json$/i,
  /^brand-palettes\.json$/i,
  /^followings\.json$/i,
  /^pages\.json$/i,
  /^search.*\.json$/i,
  /^related.*\.json$/i,
  /^subscriptions\.json$/i,
  /^strapi-search.*\.json$/i,
  /^new-search.*\.json$/i,
  /^Unconfirmed/i,
  /\.mp4$/i,
  /\.lottie$/i,
  /\.avif$/i,
];

/** Turn filename into a human-readable name */
function humanizeName(filename) {
  const base = filename.replace(/\.(gif|png|webp|jpg|jpeg|svg)$/i, '');
  let name = base
    .replace(/ ?\(?\d+\)?$/, '')
    .replace(/[_\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) name = base; // fallback for numeric-only filenames
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function main() {
  // Clean up incomplete Chrome downloads
  let cleaned = 0;
  try {
    const allFiles = fs.readdirSync(STICKERS_DIR);
    allFiles.forEach(f => {
      if (f.toLowerCase().endsWith('.crdownload')) {
        fs.unlinkSync(path.join(STICKERS_DIR, f));
        console.log(`🧹 Removed incomplete download: ${f}`);
        cleaned++;
      }
    });
  } catch (e) {
    console.error('⚠ Could not clean .crdownload files:', e.message);
  }
  if (cleaned === 0) console.log('🧹 No .crdownload files to clean.');

  // Read image files
  let files;
  try {
    files = fs.readdirSync(STICKERS_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) return false;
      if (GARBAGE_PATTERNS.some(p => p.test(f))) {
        console.log(`🧹 Skipping garbage file: ${f}`);
        return false;
      }
      return true;
    });
  } catch (e) {
    console.error(`❌ Cannot read ${STICKERS_DIR}:`, e.message);
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} image files in ${STICKERS_DIR}`);

  if (files.length === 0) {
    console.log('⚠ No image files found. Nothing to do.');
    process.exit(0);
  }

  // Generate library entries
  const library = files.map((filename, index) => {
    const name = humanizeName(filename);
    return {
      id: `s_${index + 1}`,
      url: `/media/stickers/${filename}`,
      name
    };
  });

  // Sort alphabetically by name
  library.sort((a, b) => a.name.localeCompare(b.name));

  // Re-assign IDs after sorting
  library.forEach((entry, index) => {
    entry.id = `s_${index + 1}`;
  });

  // Write sticker-library.json
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2), 'utf-8');
  console.log(`✅ Wrote ${library.length} entries to sticker-library.json`);

  // Update media-meta.json
  updateMeta(library.length, library);
}

function updateMeta(totalStickers, library) {
  if (!fs.existsSync(META_PATH)) {
    console.log('⚠ media-meta.json not found, skipping.');
    return;
  }
  try {
    const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
    meta.totalStickers = totalStickers;
    meta.stickers = library;
    meta.generated = new Date().toISOString();
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`✅ Updated media-meta.json → totalStickers: ${totalStickers}`);
  } catch (e) {
    console.error('⚠ Failed to update media-meta.json:', e.message);
  }
}

main();
