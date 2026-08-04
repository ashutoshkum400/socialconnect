// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Append AWS DynamoDB config to .env (idempotent)
//
//   node scripts/setup-dynamodb-env.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

const APPEND = [
  '',
  '# ─── AWS DynamoDB (primary live database) ─────────────────────',
  'AWS_REGION=us-east-1',
  'AWS_ACCESS_KEY_ID=your-access-key-id',
  'AWS_SECRET_ACCESS_KEY=your-secret-access-key',
  'TABLE_NAME=Sathi',
  '',
];

let content = '';
if (fs.existsSync(envPath)) {
  content = fs.readFileSync(envPath, 'utf-8');
}

const present = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'TABLE_NAME'].filter(
  (key) => content.split('\n').some((line) => line.trim().startsWith(key + '='))
);

if (present.length > 0) {
  console.log('⚠️  The following AWS keys already exist in .env — skipping append:', present.join(', '));
  console.log('   If you want to update them, edit .env manually.');
  process.exit(0);
}

fs.appendFileSync(envPath, APPEND.join('\n'), 'utf-8');
console.log('✅ Appended AWS DynamoDB config to .env');
console.log('   - AWS_REGION=us-east-1');
console.log('   - AWS_ACCESS_KEY_ID=***');
console.log('   - AWS_SECRET_ACCESS_KEY=***');
console.log('   - TABLE_NAME=Sathi');
process.exit(0);
