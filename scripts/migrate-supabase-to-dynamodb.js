// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Migrate Supabase → DynamoDB
//
// Reads all collections from the Supabase tables (the same layout used by
// supabase-store.js) and writes them into the DynamoDB table using the
// DynamoDBStore persistence layer (STORE#<collection> keys).
//
// Usage:
//   node scripts/migrate-supabase-to-dynamodb.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { DynamoDBStore } = require('../dynamodb-store');

// ─── Supabase config (mirrors supabase-store.js) ────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_KEY ||
  '';

const TABLE_MAP = {
  users:                 { table: 'users',                 keyField: 'id' },
  posts:                 { table: 'posts',                 keyField: 'id' },
  reels:                 { table: 'reels',                 keyField: 'id' },
  chats:                 { table: 'chats',                 keyField: 'key' },
  notifications:         { table: 'notifications',         keyField: 'user_id' },
  friendRequests:        { table: 'friend_requests',       keyField: 'user_id' },
  relationships:         { table: 'relationships',         keyField: 'user_id' },
  powerBotInteractions:  { table: 'power_bot_interactions', keyField: 'bot_id' },
};

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ SUPABASE_URL and SUPABASE_KEY must be set in .env to run this migration.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const store = new DynamoDBStore();

  if (!store.enabled) {
    console.error('❌ DynamoDB not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY missing).');
    process.exit(1);
  }

  // Build a temp db object with Maps so we can reuse store.save()
  const db = {};
  for (const key of Object.keys(TABLE_MAP)) {
    db[key] = new Map();
  }
  store.init(db);

  console.log('⬇️  Reading data from Supabase...');

  let total = 0;
  for (const [dbKey, { table, keyField }] of Object.entries(TABLE_MAP)) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`❌ Failed to read ${table}:`, error.message);
      continue;
    }
    if (!data) continue;

    for (const row of data) {
      const id = row[keyField];
      if (id === undefined || id === null) continue;
      db[dbKey].set(String(id), row.value);
    }
    console.log(`   ${table}: ${db[dbKey].size} rows`);
    total += db[dbKey].size;
  }

  console.log(`⬆️  Writing ${total} entries to DynamoDB (table: ${store.tableName})...`);
  await store.save();

  console.log('✅ Migration complete.');
  console.log('   Summary:');
  for (const [dbKey, map] of Object.entries(db)) {
    console.log(`   - ${dbKey}: ${map.size}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
