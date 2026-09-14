const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const digest = value => createHash('sha256').update(value).digest('hex');
class PromoStore {
  constructor(filename, hashes) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS claims (code_hash TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, claimed_at TEXT NOT NULL)');
    this.hashes = new Set(hashes);
  }
  redeem(code, claimKey) {
    if (typeof code !== 'string' || !/^[ABCDEFGHIJKLMNOPRSTUVYZabcdefghijklmnoprstuvyz]{10}$/.test(code) || !/^[a-f0-9]{64}$/.test(claimKey || '')) {
      return { ok: false, error: 'INVALID_CODE' };
    }
    const hash = digest(code);
    if (!this.hashes.has(hash)) return { ok: false, error: 'INVALID_CODE' };
    const owner = digest(claimKey);
    this.db.prepare('INSERT OR IGNORE INTO claims(code_hash,owner_hash,claimed_at) VALUES(?,?,?)').run(hash, owner, new Date().toISOString());
    const row = this.db.prepare('SELECT owner_hash FROM claims WHERE code_hash=?').get(hash);
    if (row.owner_hash !== owner) return { ok: false, error: 'CODE_USED' };
    return { ok: true, coins: 25, receiptId: hash };
  }
  close() { this.db.close(); }
}
module.exports = { PromoStore, digest };
