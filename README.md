# DIU Bus Buddy – separated project

- `frontend/` – index.html, css/styles.css, js/app.js. Works as-is: open index.html in a browser.
- `backend/`  – REST API (Node 22+, no npm install). `node backend/init-db.js` then `node --no-warnings backend/server.js` (port 3000).
- `database/` – schema.sql and seed.sql (SQLite). init-db.js builds database/busbuddy.db.

Note: the original zip was one index.html; all data and logic lived in the browser. The frontend is unchanged,
and the backend/database were derived from its sample data and logic. The frontend does not call the API yet.
Demo logins: student01/student123, driver07/driver123, admin/admin123.
