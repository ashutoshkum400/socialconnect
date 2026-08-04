// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — AWS DynamoDB Store
//
// A persistence layer that mirrors the existing SupabaseStore interface so it
// can be dropped into server.js with minimal changes. It loads all collections
// into the in-memory `db` Maps on server start, and pushes changes back to
// DynamoDB whenever saveDb() is called.
//
// Schema (single table, generic store rows):
//   PK   = STORE#<collection>   (e.g. STORE#users)
//   SK   = ID#<id>              (the Map key / id)
//   value = JSON string of the full entry
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');

// ─── Config ──────────────────────────────────────────────────────────────────
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const TABLE_NAME = process.env.TABLE_NAME || 'Sathi';

// Map an in-memory db Map key to a collection prefix used in the PK.
const COLLECTION_MAP = {
  users:                'users',
  posts:                'posts',
  reels:                'reels',
  chats:                'chats',
  notifications:        'notifications',
  friendRequests:       'friendRequests',
  relationships:        'relationships',
  powerBotInteractions: 'powerBotInteractions',
};

class DynamoDBStore {
  constructor() {
    this.enabled = Boolean(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY);
    this.tableName = TABLE_NAME;
    this.db = null;
    this.stats = {
      enabled: this.enabled,
      loads: 0,
      saves: 0,
      errors: 0,
      lastSync: null,
    };

    if (this.enabled) {
      this.client = new DynamoDBClient({
        region: AWS_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      });
      this.docClient = DynamoDBDocumentClient.from(this.client);
    } else {
      this.client = null;
      this.docClient = null;
      console.warn('⚠️  DynamoDB not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY missing). Falling back to Supabase/data.json.');
    }
  }

  init(db) {
    this.db = db;
    return this;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Deep-clone an object, converting Date instances to ISO strings so
   * DynamoDB's marshaller won't choke on unsupported types.
   */
  _sanitize(value) {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((v) => this._sanitize(v));
    if (typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this._sanitize(v);
      }
      return out;
    }
    return value;
  }

  _pk(collection) {
    return `STORE#${collection}`;
  }

  _sk(id) {
    return `ID#${String(id)}`;
  }

  async _chunkedBatchWrite(items) {
    if (!items.length) return;
    // DynamoDB BatchWrite supports max 25 items per request.
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25);
      await this.docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: chunk.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );
    }
  }

  // ─── Load all data from DynamoDB into the in-memory db ───────────────────
  async load() {
    if (!this.enabled || !this.db) return false;
    this.stats.loads++;

    try {
      // Scan the whole table for STORE# rows (per collection).
      const loaded = {};
      let lastEvaluatedKey = undefined;
      do {
        const params = {
          TableName: this.tableName,
          FilterExpression: 'begins_with(#pk, :prefix)',
          ExpressionAttributeNames: { '#pk': 'PK' },
          ExpressionAttributeValues: { ':prefix': 'STORE#' },
          ExclusiveStartKey: lastEvaluatedKey,
        };
        const result = await this.docClient.send(new ScanCommand(params));
        for (const item of result.Items || []) {
          const collection = item.PK.slice('STORE#'.length);
          const id = item.SK.slice('ID#'.length);
          if (!loaded[collection]) loaded[collection] = {};
          loaded[collection][id] = item.value;
        }
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      for (const [dbKey, collection] of Object.entries(COLLECTION_MAP)) {
        const map = this.db[dbKey];
        if (!(map instanceof Map)) continue;
        const rows = loaded[collection];
        if (!rows) continue;
        const fresh = new Map();
        for (const [id, value] of Object.entries(rows)) {
          fresh.set(id, value);
        }
        this.db[dbKey] = fresh;
      }

      this.stats.lastSync = new Date().toISOString();
      console.log(`✅ DynamoDB data loaded (${this._sumSizes()} entries)`);
      return true;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ DynamoDB load error:', err.message);
      return false;
    }
  }

  // ─── Save all data from the in-memory db back to DynamoDB ────────────────
  async save() {
    if (!this.enabled || !this.db) return;
    this.stats.saves++;

    try {
      const items = [];
      for (const [dbKey, collection] of Object.entries(COLLECTION_MAP)) {
        const map = this.db[dbKey];
        if (!(map instanceof Map)) continue;
        for (const [id, value] of map.entries()) {
          items.push({
            PK: this._pk(collection),
            SK: this._sk(id),
            value: this._sanitize(value),
          });
        }
      }
      await this._chunkedBatchWrite(items);
      this.stats.lastSync = new Date().toISOString();
    } catch (err) {
      this.stats.errors++;
      console.error('❌ DynamoDB save error:', err.message);
    }
  }

  // ─── Fast targeted save of a single collection entry ─────────────────────
  async saveEntry(dbKey, id, value) {
    if (!this.enabled || !this.db) return;
    const collection = COLLECTION_MAP[dbKey];
    if (!collection) return;

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            PK: this._pk(collection),
            SK: this._sk(id),
            value: this._sanitize(value),
          },
        })
      );
      this.stats.saves++;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ DynamoDB saveEntry error:', err.message);
    }
  }

  // ─── Delete a single entry from a collection ─────────────────────────────
  async deleteEntry(dbKey, id) {
    if (!this.enabled || !this.db) return;
    const collection = COLLECTION_MAP[dbKey];
    if (!collection) return;

    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: this._pk(collection),
            SK: this._sk(id),
          },
        })
      );
    } catch (err) {
      this.stats.errors++;
      console.error('❌ DynamoDB deleteEntry error:', err.message);
    }
  }

  getStats() {
    return {
      ...this.stats,
      tableName: this.tableName,
      region: AWS_REGION,
      lastSync: this.stats.lastSync,
    };
  }

  _sumSizes() {
    let total = 0;
    for (const [dbKey, map] of Object.entries(this.db)) {
      if (map instanceof Map) total += map.size;
    }
    return total;
  }
}

module.exports = { DynamoDBStore };
