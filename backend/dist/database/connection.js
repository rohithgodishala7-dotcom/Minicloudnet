import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
const dataDirectory = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, { recursive: true });
}
const dbPath = path.join(dataDirectory, 'minicloudnet.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    speed INTEGER NOT NULL,
    metrics TEXT NOT NULL,
    topology TEXT NOT NULL,
    dns_records TEXT NOT NULL,
    events TEXT NOT NULL
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    destination TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL
  );
`);
export function saveSimulationSnapshot(payload) {
    db.prepare(`INSERT INTO simulations (status, speed, metrics, topology, dns_records, events)
     VALUES (?, ?, ?, ?, ?, ?)`).run(payload.status, payload.speed, payload.metrics, payload.topology, payload.dnsRecords, payload.events);
}
export function getRecentHistory() {
    return db.prepare(`
    SELECT * FROM simulations
    ORDER BY created_at DESC
    LIMIT 20
  `).all();
}
