-- DIU Bus Buddy database schema (SQLite)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id   TEXT NOT NULL UNIQUE,          -- mobile number, or ID like 'admin'
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL CHECK (role IN ('student','driver','admin')),
  route_id   TEXT REFERENCES routes(id),    -- drivers only
  pw_salt    TEXT NOT NULL,
  pw_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routes (
  id          TEXT PRIMARY KEY,             -- A, B, C, D
  name        TEXT NOT NULL,
  bus         TEXT NOT NULL,
  capacity    INTEGER NOT NULL,
  trip_min    INTEGER NOT NULL,             -- trip length in minutes
  map_path    TEXT NOT NULL,                -- SVG path used by the map
  base_load   INTEGER NOT NULL,
  weekly_util INTEGER NOT NULL              -- weekly average occupancy %
);

CREATE TABLE IF NOT EXISTS stops (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL REFERENCES routes(id),
  seq      INTEGER NOT NULL,
  name     TEXT NOT NULL,
  position REAL NOT NULL,                   -- 0..1 along the route
  UNIQUE (route_id, seq)
);

CREATE TABLE IF NOT EXISTS departures (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id TEXT NOT NULL REFERENCES routes(id),
  depart   TEXT NOT NULL                    -- 24h 'HH:MM'
);

CREATE TABLE IF NOT EXISTS time_slots (
  id    INTEGER PRIMARY KEY,                -- index used by the forecast
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forecasts (
  route_id  TEXT NOT NULL REFERENCES routes(id),
  slot_id   INTEGER NOT NULL REFERENCES time_slots(id),
  predicted INTEGER NOT NULL,               -- expected passengers
  PRIMARY KEY (route_id, slot_id)
);

CREATE TABLE IF NOT EXISTS trip_status (    -- live state, one row per route
  route_id  TEXT PRIMARY KEY REFERENCES routes(id),
  active    INTEGER NOT NULL DEFAULT 0,
  cancelled INTEGER NOT NULL DEFAULT 0,
  delay_min INTEGER NOT NULL DEFAULT 0,
  progress  REAL    NOT NULL DEFAULT 0,
  boardings INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id   TEXT,                          -- NULL = all routes
  text       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'ok' CHECK (kind IN ('ok','delay','cancel')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id   TEXT NOT NULL REFERENCES routes(id),
  type       TEXT NOT NULL,
  text       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  user_id    INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS decisions (      -- admin accept/reject of AI suggestions
  key        TEXT PRIMARY KEY,              -- 'A|1|false' (route|slot|exam)
  decision   TEXT NOT NULL CHECK (decision IN ('accepted','rejected')),
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
