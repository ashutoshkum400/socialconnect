// ═══════════════════════════════════════════════════════════════════════════
// SocialConnect — Supabase Store
//
// A persistence layer that mirrors the existing DataManager (data.json) but
// uses Supabase as the source of truth. It loads all collections into the
// in-memory `db` Maps on server start, and pushes changes back to Supabase
// whenever saveDb() is called.
//
// Tables (each row = one Map entry, with the full value stored as jsonb):
//   users, posts, reels, chats, notifications, friend_requests,
//   relationships, power_bot_interactions
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const { createClient } = require('@supabase/supabase-js');

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// Map an in-memory db Map key to a Supabase table + primary key column / id field
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

class SupabaseStore {
  constructor() {
    this.enabled = Boolean(SUPABASE_URL && SUPABASE_KEY);
    this.client = this.enabled ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
    this.db = null;
    this.stats = {
      enabled: this.enabled,
      loads: 0,
      saves: 0,
      errors: 0,
      lastSync: null,
    };
    if (!this.enabled) {
      console.warn('⚠️  Supabase not configured (SUPABASE_URL / SUPABASE_KEY missing). Falling back to data.json.');
    }
  }

  init(db) {
    this.db = db;
    return this;
  }

  // ─── Load all data from Supabase into the in-memory db ───────────────────
  async load() {
    if (!this.enabled || !this.db) return false;
    this.stats.loads++;

    try {
      for (const [dbKey, { table, keyField }] of Object.entries(TABLE_MAP)) {
        const map = this.db[dbKey];
        if (!(map instanceof Map)) continue;

        const { data, error } = await this.client
          .from(table)
          .select('*');

        if (error) throw error;
        if (!data) continue;

        const fresh = new Map();
        for (const row of data) {
          const id = row[keyField];
          if (id !== undefined && id !== null) {
            fresh.set(String(id), row.value);
          }
        }
        // Replace the existing Map with the loaded data
        this.db[dbKey] = fresh;
      }

      this.stats.lastSync = new Date().toISOString();
      console.log(`✅ Supabase data loaded (${this._sumSizes()} entries)`);
      return true;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ Supabase load error:', err.message);
      return false;
    }
  }

  // ─── Save all data from the in-memory db back to Supabase ────────────────
  async save() {
    if (!this.enabled || !this.db) return;
    this.stats.saves++;

    try {
      // For each collection, upsert all rows.
      // We upsert in bulk per table for efficiency.
      for (const [dbKey, { table, keyField }] of Object.entries(TABLE_MAP)) {
        const map = this.db[dbKey];
        if (!(map instanceof Map)) continue;

        const rows = [];
        for (const [id, value] of map.entries()) {
          rows.push({ [keyField]: String(id), value });
        }

        if (rows.length === 0) continue;

        const { error } = await this.client
          .from(table)
          .upsert(rows, { onConflict: keyField });

        if (error) throw error;
      }

      this.stats.lastSync = new Date().toISOString();
    } catch (err) {
      this.stats.errors++;
      console.error('❌ Supabase save error:', err.message);
    }
  }

  // ─── Fast targeted save of a single collection entry ─────────────────────
  async saveEntry(dbKey, id, value) {
    if (!this.enabled || !this.db) return;
    const cfg = TABLE_MAP[dbKey];
    if (!cfg) return;

    try {
      const { table, keyField } = cfg;
      const { error } = await this.client
        .from(table)
        .upsert({ [keyField]: String(id), value }, { onConflict: keyField });
      if (error) throw error;
      this.stats.saves++;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ Supabase saveEntry error:', err.message);
    }
  }

  // ─── Delete a single entry from a collection ─────────────────────────────
  async deleteEntry(dbKey, id) {
    if (!this.enabled || !this.db) return;
    const cfg = TABLE_MAP[dbKey];
    if (!cfg) return;

    try {
      const { table, keyField } = cfg;
      const { error } = await this.client
        .from(table)
        .delete()
        .eq(keyField, String(id));
      if (error) throw error;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ Supabase deleteEntry error:', err.message);
    }
  }

  getStats() {
    return { ...this.stats, lastSync: this.stats.lastSync };
  }

  _sumSizes() {
    let total = 0;
    for (const [dbKey, map] of Object.entries(this.db)) {
      if (map instanceof Map) total += map.size;
    }
    return total;
  }
}

module.exports = { SupabaseStore };
