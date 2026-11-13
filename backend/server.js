// DIU Bus Buddy API. Zero dependencies: Node 22+ (node:http, node:sqlite).
const http = require('node:http');
const crypto = require('node:crypto');
const { db, hashPassword, verifyPassword } = require('./db');

const PORT = process.env.PORT || 3000;
const ORIGIN = process.env.CORS_ORIGIN || '*';
const sessions = new Map(); // token -> user

const normMobile = s => {
  let d = String(s).replace(/[\s-]/g, '');
  if (d.startsWith('+880')) d = '0' + d.slice(4); else if (d.startsWith('880')) d = '0' + d.slice(3);
  return /^01[3-9]\d{8}$/.test(d) ? d : '';
};
const publicUser = u => ({ id: u.login_id, name: `${u.first_name} ${u.last_name}`.trim(), role: u.role, route: u.route_id });

function send(res, code, body) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  res.end(JSON.stringify(body));
}
const readBody = req => new Promise((ok, no) => {
  let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } });
});
const authed = req => sessions.get((req.headers.authorization || '').replace('Bearer ', ''));
const need = (res, user, ...roles) => {
  if (!user) { send(res, 401, { error: 'Log in first.' }); return false; }
  if (roles.length && !roles.includes(user.role)) { send(res, 403, { error: 'Not allowed.' }); return false; }
  return true;
};

function routes() {
  return db.prepare('SELECT * FROM routes ORDER BY id').all().map(r => ({
    id: r.id, name: r.name, bus: r.bus, cap: r.capacity, trip: r.trip_min, path: r.map_path, base: r.base_load, util: r.weekly_util,
    stops: db.prepare('SELECT name, position FROM stops WHERE route_id=? ORDER BY seq').all(r.id).map(s => [s.name, s.position]),
    times: db.prepare('SELECT depart FROM departures WHERE route_id=? ORDER BY depart').all(r.id).map(d => d.depart),
    fc: db.prepare('SELECT predicted FROM forecasts WHERE route_id=? ORDER BY slot_id').all(r.id).map(f => f.predicted),
  }));
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  if (m === 'OPTIONS') return send(res, 204, {});
  const user = authed(req);

  if (p === '/api/health') return send(res, 200, { ok: true });
  if (p === '/api/routes' && m === 'GET') return send(res, 200, { routes: routes(), slots: db.prepare('SELECT label FROM time_slots ORDER BY id').all().map(s => s.label) });

  if (p === '/api/signup' && m === 'POST') {
    const b = await readBody(req), mobile = normMobile(b.mobile || '');
    if (!b.first || !b.last) return send(res, 400, { error: 'Enter your first and last name.' });
    if (!mobile) return send(res, 400, { error: 'Enter a valid Bangladesh mobile number, like 01712345678.' });
    if (String(b.password || '').length < 8) return send(res, 400, { error: 'Use a password with at least 8 characters.' });
    if (db.prepare('SELECT 1 FROM users WHERE login_id=?').get(mobile)) return send(res, 409, { error: 'An account with this mobile number already exists.' });
    const { salt, hash } = hashPassword(b.password);
    db.prepare('INSERT INTO users (login_id,first_name,last_name,role,pw_salt,pw_hash) VALUES (?,?,?,?,?,?)').run(mobile, b.first.trim(), b.last.trim(), 'student', salt, hash);
    const u = db.prepare('SELECT * FROM users WHERE login_id=?').get(mobile), token = crypto.randomUUID();
    sessions.set(token, u);
    return send(res, 201, { token, user: publicUser(u) });
  }
  if (p === '/api/login' && m === 'POST') {
    const b = await readBody(req), id = normMobile(b.id || '') || String(b.id || '').toLowerCase();
    const u = db.prepare('SELECT * FROM users WHERE login_id=?').get(id);
    if (!u || !verifyPassword(String(b.password || ''), u.pw_salt, u.pw_hash)) return send(res, 401, { error: 'That mobile number, ID or password is not right.' });
    const token = crypto.randomUUID(); sessions.set(token, u);
    return send(res, 200, { token, user: publicUser(u) });
  }
  if (p === '/api/logout' && m === 'POST') { sessions.delete((req.headers.authorization || '').replace('Bearer ', '')); return send(res, 200, { ok: true }); }

  if (p === '/api/status' && m === 'GET') return send(res, 200, { status: db.prepare('SELECT * FROM trip_status').all() });
  if (p === '/api/status' && m === 'POST') { // driver: start/end trip, delay, cancel, board
    if (!need(res, user, 'driver', 'admin')) return;
    const b = await readBody(req);
    if (b.action === 'start') db.prepare('UPDATE trip_status SET active=1,cancelled=0,progress=0 WHERE route_id=?').run(b.route);
    else if (b.action === 'end') db.prepare('UPDATE trip_status SET active=0,progress=0,boardings=0 WHERE route_id=?').run(b.route);
    else if (b.action === 'delay') db.prepare('UPDATE trip_status SET delay_min=?,cancelled=0 WHERE route_id=?').run(+b.minutes || 0, b.route);
    else if (b.action === 'cancel') db.prepare('UPDATE trip_status SET cancelled=1,active=0 WHERE route_id=?').run(b.route);
    else return send(res, 400, { error: 'Unknown action.' });
    return send(res, 200, { ok: true });
  }
  if (p === '/api/board' && m === 'POST') {
    if (!need(res, user)) return;
    const b = await readBody(req);
    db.prepare('UPDATE trip_status SET boardings=boardings+1 WHERE route_id=?').run(b.route);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/notices' && m === 'GET') {
    const r = url.searchParams.get('route');
    const rows = r ? db.prepare('SELECT * FROM notices WHERE route_id IS NULL OR route_id=? ORDER BY id DESC').all(r) : db.prepare('SELECT * FROM notices ORDER BY id DESC').all();
    return send(res, 200, { notices: rows });
  }
  if (p === '/api/notices' && m === 'POST') {
    if (!need(res, user, 'admin', 'driver')) return;
    const b = await readBody(req);
    if (!String(b.text || '').trim()) return send(res, 400, { error: 'Write the notice first.' });
    db.prepare('INSERT INTO notices (route_id,text,kind) VALUES (?,?,?)').run(b.route === 'ALL' ? null : b.route, b.text.trim(), b.kind || 'delay');
    return send(res, 201, { ok: true });
  }

  if (p === '/api/complaints' && m === 'GET') {
    if (!need(res, user, 'admin')) return;
    return send(res, 200, { complaints: db.prepare('SELECT * FROM complaints ORDER BY id DESC').all() });
  }
  if (p === '/api/complaints' && m === 'POST') {
    if (!need(res, user)) return;
    const b = await readBody(req);
    if (!String(b.text || '').trim()) return send(res, 400, { error: 'Write a short message first.' });
    db.prepare('INSERT INTO complaints (route_id,type,text,user_id) VALUES (?,?,?,?)').run(b.route, b.type || 'Feedback', b.text.trim(), user.id);
    return send(res, 201, { ok: true });
  }
  const mc = p.match(/^\/api\/complaints\/(\d+)\/resolve$/);
  if (mc && m === 'PATCH') {
    if (!need(res, user, 'admin')) return;
    db.prepare("UPDATE complaints SET status='done' WHERE id=?").run(+mc[1]);
    return send(res, 200, { ok: true });
  }

  if (p === '/api/decisions' && m === 'GET') {
    if (!need(res, user, 'admin')) return;
    return send(res, 200, { decisions: db.prepare('SELECT key, decision FROM decisions').all() });
  }
  if (p === '/api/decisions' && m === 'POST') {
    if (!need(res, user, 'admin')) return;
    const b = await readBody(req);
    if (b.decision === null) db.prepare('DELETE FROM decisions WHERE key=?').run(b.key);
    else db.prepare('INSERT OR REPLACE INTO decisions (key,decision) VALUES (?,?)').run(b.key, b.decision);
    return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Not found.' });
}

http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); send(res, 500, { error: 'Server error.' }); }))
  .listen(PORT, () => console.log(`DIU Bus Buddy API on http://localhost:${PORT}`));
