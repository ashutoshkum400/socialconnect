// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Migrate Supabase Users → DynamoDB
//
// Reads ONLY users from the Supabase users table and writes them into
// the DynamoDB table. This is a one-time migration so old users can still
// login. All new data will be created directly in DynamoDB.
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

  // Build a temp db object with Maps so we can reuse store.saveEntry()
  const db = {
    users: new Map(),
    posts: new Map(),
    reels: new Map(),
    chats: new Map(),
    notifications: new Map(),
    friendRequests: new Map(),
    relationships: new Map(),
    powerBotInteractions: new Map(),
  };
  store.init(db);

  console.log('⬇️  Reading users from Supabase...');

  // Fetch all users in batches (Supabase returns max 1000 rows per query)
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('❌ Failed to read users from Supabase:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of data) {
      const id = row.id;
      if (id === undefined || id === null) continue;
      db.users.set(String(id), row.value);
    }

    console.log(`   Fetched ${data.length} users (total: ${db.users.size})`);

    if (data.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
  }

  if (db.users.size === 0) {
    console.error('❌ No users found in Supabase. Nothing to migrate.');
    process.exit(1);
  }

  console.log(`⬆️  Writing ${db.users.size} users to DynamoDB (table: ${store.tableName})...`);

  // Write each user individually using saveEntry for reliability
  let written = 0;
  let failed = 0;
  for (const [id, value] of db.users.entries()) {
    try {
      await store.saveEntry('users', id, value);
      written++;
    } catch (err) {
      failed++;
      console.error(`   ❌ Failed to write user ${id}:`, err.message);
    }
  }

  console.log('');
  console.log('✅ Migration complete.');
  console.log(`   Users migrated: ${written}`);
  if (failed > 0) {
    console.log(`   Users failed:   ${failed}`);
  }
  console.log('');
  console.log('   Old users can now login with their existing credentials.');
  console.log('   All new data will be stored directly in DynamoDB.');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
