const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'database', 'busbuddy.db');
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON');

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
function verifyPassword(pw, salt, hash) {
  const a = Buffer.from(crypto.scryptSync(pw, salt, 64).toString('hex'));
  const b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = { db, DB_FILE, hashPassword, verifyPassword };
