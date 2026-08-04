// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Supabase Setup Helper
//
// This script:
//   1. Prints the schema SQL that you need to run in the Supabase SQL Editor.
//   2. Tests the connection to your Supabase project using the configured
//      SUPABASE_URL / SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY).
//
// Usage (from project root):
//   node scripts/setup-supabase.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('══════════════════════════════════════════════════════════════');
console.log('  SocialConnect — Supabase Setup Helper');
console.log('══════════════════════════════════════════════════════════════\n');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('❌ SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  console.log('   must be set in your .env file first.\n');
  console.log('   Add these to your .env:');
  console.log('   SUPABASE_URL=https://<project-ref>.supabase.co');
  console.log('   SUPABASE_ANON_KEY=sb_publishable_...  (or service_role key)\n');
  process.exit(1);
}

console.log(`📡 Supabase URL: ${SUPABASE_URL}`);
console.log(`🔑 Key prefix:   ${SUPABASE_KEY.slice(0, 15)}...\n`);

async function main() {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Test connection by reading a trivial query
  console.log('🔍 Testing connection...');
  try {
    const { error } = await client.from('users').select('id').limit(1);
    if (error) {
      // Table may not exist yet — that's expected before running the schema.
      console.log(`   ⚠️  Connection OK, but got: ${error.message}`);
      console.log('   → This is normal if you haven\'t created the tables yet.');
    } else {
      console.log('   ✅ Connection successful and "users" table exists.');
    }
  } catch (err) {
    console.log(`   ❌ Connection failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Print the schema SQL
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf-8') : '';

  console.log('\n📄 NEXT STEPS — Create the tables.');
  console.log('  1. Open the Supabase Dashboard for your project:');
  console.log(`     ${SUPABASE_URL.replace('https://', 'https://supabase.com/dashboard/project/')}`);
  console.log('  2. Go to SQL Editor → New query.');
  console.log('  3. Paste the contents of: supabase/schema.sql');
  console.log('  4. Click Run.\n');

  if (schema) {
    console.log('   ── Schema SQL preview (first 30 lines) ──');
    console.log(schema.split('\n').slice(0, 30).join('\n'));
    console.log('   ── end preview ──\n');
  }

  console.log('✅ Done. After running the schema, start your server with:');
  console.log('   npm start');
}

main().catch(err => {
  console.error('❌ Unexpected error:', err.message);
  process.exit(1);
});
