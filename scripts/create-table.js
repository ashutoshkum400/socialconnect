// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Create DynamoDB Table
//
// Creates the Sathi table with PK/SK schema used by dynamodb-store.js.
// Usage: node scripts/create-table.js
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const TABLE_NAME = process.env.TABLE_NAME || 'Sathi';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in .env');
  process.exit(1);
}

const client = new DynamoDBClient({
  region: AWS_REGION,
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
});

async function main() {
  // Check if table already exists
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ Table "${TABLE_NAME}" already exists. Skipping creation.`);
    return;
  } catch (err) {
    if (err.name !== 'ResourceNotFoundException') {
      console.error('❌ Error checking table:', err.message);
      process.exit(1);
    }
    // Table doesn't exist — create it
  }

  console.log(`Creating DynamoDB table "${TABLE_NAME}"...`);

  const command = new CreateTableCommand({
    TableName: TABLE_NAME,
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });

  const response = await client.send(command);
  console.log(`✅ Table "${response.TableDescription?.TableName}" created successfully.`);
  console.log(`   Table ARN: ${response.TableDescription?.TableArn}`);
  console.log(`   Status: ${response.TableDescription?.TableStatus}`);
}

main().catch((err) => {
  console.error('❌ Failed to create table:', err.message);
  process.exit(1);
});
