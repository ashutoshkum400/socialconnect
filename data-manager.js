const fs = require('fs');
const path = require('path');

class DataManager {
  constructor(options = {}) {
    this.dataFile = options.dataFile || path.join(__dirname, 'data.json');
    this.backupDir = options.backupDir || path.join(path.dirname(this.dataFile), 'backups');
    this.maxBackups = options.maxBackups || 10;
    this.saveIntervalMs = options.saveIntervalMs || 30000;
    this.compactionIntervalMs = options.compactionIntervalMs || 3600000;
    this.db = null;
    this.powerBotManager = null;
    this._saveTimer = null;
    this._compactTimer = null;
    this._saveQueue = 0;
    this._lastSaveTime = 0;
    this._saveCooldown = 1000;
    this.stats = { saves: 0, loads: 0, backups: 0, recoveries: 0, compactions: 0, errors: 0 };
  }

  init(db, powerBotManager) {
    this.db = db;
    this.powerBotManager = powerBotManager;

    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this._startPeriodicSave();
    this._startPeriodicCompaction();
    this._setupGracefulShutdown();

    console.log(`💾 DataManager active — backups: ${this.backupDir}, interval: ${this.saveIntervalMs / 1000}s`);
    return this;
  }

  // ─── Load ────────────────────────────────────────────────────────────────────

  load() {
    this.stats.loads++;

    if (!fs.existsSync(this.dataFile)) {
      console.log('📂 No data file found, starting fresh');
      return false;
    }

    const raw = this._readFileSafe(this.dataFile);
    if (!raw) {
      console.warn('⚠️  data.json is empty or unreadable');
      return this._tryRecover();
    }

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error('❌ data.json corrupted:', e.message);
      return this._tryRecover();
    }

    if (!this._validateSchema(json)) {
      console.warn('⚠️  data.json schema validation failed');
      return this._tryRecover();
    }

    this._restoreMaps(json);
    console.log(`✅ Data restored from disk (${this._humanSize(raw.length)})`);
    return true;
  }

  // ─── Save ────────────────────────────────────────────────────────────────────

  save() {
    this._saveQueue++;
    const now = Date.now();
    if (now - this._lastSaveTime < this._saveCooldown) return;
    this._lastSaveTime = now;

    try {
      const json = this._serialize();
      const raw = JSON.stringify(json);

      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const tmpFile = this.dataFile + '.tmp';
      fs.writeFileSync(tmpFile, raw, 'utf-8');
      fs.renameSync(tmpFile, this.dataFile);

      if (this.powerBotManager && typeof this.powerBotManager.flushAll === 'function') {
        this.powerBotManager.flushAll();
      }

      this.stats.saves++;
      this._saveQueue = 0;
    } catch (err) {
      this.stats.errors++;
      console.error('❌ Save failed:', err.message);
    }
  }

  // ─── Backup ──────────────────────────────────────────────────────────────────

  createBackup() {
    try {
      if (!fs.existsSync(this.dataFile)) return false;

      const now = new Date();
      const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
      const backupFile = path.join(this.backupDir, `data_${ts}.json.bak`);

      fs.copyFileSync(this.dataFile, backupFile);
      this.stats.backups++;

      this._rotateBackups();
      return true;
    } catch (err) {
      console.error('❌ Backup failed:', err.message);
      return false;
    }
  }

  restoreFromBackup() {
    const backups = this._listBackups();
    if (backups.length === 0) {
      console.warn('⚠️  No backups available to restore');
      return false;
    }

    const latest = backups[backups.length - 1];
    console.log(`🔄 Restoring from backup: ${path.basename(latest)}`);

    try {
      const raw = fs.readFileSync(latest, 'utf-8');
      const json = JSON.parse(raw);
      if (!this._validateSchema(json)) {
        console.error('❌ Backup is also corrupted');
        return false;
      }
      this._restoreMaps(json);
      fs.copyFileSync(latest, this.dataFile);
      this.stats.recoveries++;
      console.log('✅ Successfully restored from backup');
      return true;
    } catch (e) {
      console.error('❌ Backup restoration failed:', e.message);
      return false;
    }
  }

  // ─── Compaction ──────────────────────────────────────────────────────────────

  compact() {
    if (!this.db) return;

    const kept = { notifications: 0, removed: 0 };
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const [userId, notifs] of this.db.notifications) {
      if (!Array.isArray(notifs)) continue;
      const filtered = notifs.filter(n => {
        const t = new Date(n.time || n.timestamp).getTime();
        return !isNaN(t) && t > cutoff;
      });
      kept.removed += notifs.length - filtered.length;
      this.db.notifications.set(userId, filtered);
      kept.notifications += filtered.length;
    }

    for (const [userId, reqs] of this.db.friendRequests) {
      if (!Array.isArray(reqs)) continue;
      const filtered = reqs.filter(r => {
        const t = new Date(r.time).getTime();
        return !isNaN(t) && t > cutoff;
      });
      this.db.friendRequests.set(userId, filtered);
    }

    this.stats.compactions++;
    this.save();
    console.log(`🧹 Data compacted: removed ${kept.removed} old notifications, ${this.db.notifications.size} users' notifs kept`);
  }

  // ─── Shutdown ────────────────────────────────────────────────────────────────

  shutdown() {
    console.log('🛑 Shutting down, saving data...');
    this._stopTimers();
    this.save();
    if (this.powerBotManager && typeof this.powerBotManager.flushAll === 'function') {
      this.powerBotManager.flushAll();
    }
    this.createBackup();
    console.log('✅ Data saved safely. Goodbye!');
  }

  getStats() {
    return { ...this.stats, backupCount: this._listBackups().length, uptime: process.uptime() };
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _serialize() {
    const obj = {};
    for (const [key, map] of Object.entries(this.db)) {
      obj[key] = map instanceof Map ? Object.fromEntries(map) : map;
    }
    return obj;
  }

  _restoreMaps(json) {
    for (const [key, obj] of Object.entries(json)) {
      if (!this.db[key] || !(this.db[key] instanceof Map)) continue;
      this.db[key] = new Map(Object.entries(obj || {}));
    }
  }

  _validateSchema(json) {
    if (!json || typeof json !== 'object') return false;
    const required = ['users', 'posts', 'chats'];
    for (const key of required) {
      if (!(key in json)) return false;
      if (typeof json[key] !== 'object') return false;
    }
    return true;
  }

  _tryRecover() {
    console.log('🔄 Attempting recovery from backup...');
    if (this.restoreFromBackup()) {
      this.stats.recoveries++;
      return true;
    }
    console.log('📂 No valid backup, starting fresh');
    return false;
  }

  _readFileSafe(filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size === 0) return null;
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  _listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) return [];
      return fs.readdirSync(this.backupDir)
        .filter(f => f.endsWith('.json.bak'))
        .map(f => path.join(this.backupDir, f))
        .sort();
    } catch {
      return [];
    }
  }

  _rotateBackups() {
    const backups = this._listBackups();
    while (backups.length > this.maxBackups) {
      try {
        fs.unlinkSync(backups.shift());
      } catch {}
    }
  }

  _startPeriodicSave() {
    this._stopTimers();
    this._saveTimer = setInterval(() => {
      if (this._saveQueue > 0 || Date.now() - this._lastSaveTime > this.saveIntervalMs) {
        this.save();
      }
    }, this.saveIntervalMs);
    this._saveTimer.unref();
  }

  _startPeriodicCompaction() {
    this._compactTimer = setInterval(() => {
      this.compact();
    }, this.compactionIntervalMs);
    this._compactTimer.unref();
  }

  _stopTimers() {
    if (this._saveTimer) { clearInterval(this._saveTimer); this._saveTimer = null; }
    if (this._compactTimer) { clearInterval(this._compactTimer); this._compactTimer = null; }
  }

  _setupGracefulShutdown() {
    const handler = () => this.shutdown();
    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);
    process.on('uncaughtException', (err) => {
      console.error('💥 Uncaught exception:', err.message);
      this.save();
      process.exit(1);
    });
  }

  _humanSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}

module.exports = { DataManager };
