// Creates the SQLite file from database/schema.sql + seed.sql and adds the demo users.
const fs = require('node:fs');
const path = require('node:path');
const { db, DB_FILE, hashPassword } = require('./db');

const dir = path.join(__dirname, '..', 'database');
db.exec(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
const seeded = db.prepare('SELECT COUNT(*) n FROM departures').get().n > 0;
if (!seeded) db.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));

const add = db.prepare(`INSERT OR IGNORE INTO users (login_id,first_name,last_name,role,route_id,pw_salt,pw_hash) VALUES (?,?,?,?,?,?,?)`);
for (const [id, pw, first, last, role, route] of [
  ['student01', 'student123', 'Tasnim', '', 'student', null],
  ['driver07', 'driver123', 'Mr.', 'Karim', 'driver', 'B'],
  ['admin', 'admin123', 'Transport', 'office', 'admin', null],
]) {
  const { salt, hash } = hashPassword(pw);
  add.run(id, first, last, role, route, salt, hash);
}
console.log('Database ready:', DB_FILE);
