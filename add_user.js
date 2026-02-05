import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function addUser() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');

    let db;
    if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath);
        db = new SQL.Database(data);
    } else {
        db = new SQL.Database();
    }

    // Ensure table exists with correct schema
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT,
      team TEXT,
      status TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      extensionNumber TEXT,
      ringCentralEmail TEXT,
      lastSynced TEXT
    )
  `);

    // Add the user as admin
    const id = 'user_' + Date.now();
    try {
        // Check if exists first
        const existing = db.exec('SELECT * FROM users WHERE email = "bbard7081@gmail.com"');
        if (existing.length > 0 && existing[0].values.length > 0) {
            db.run(
                'UPDATE users SET role = "admin", status = "ACTIVE" WHERE email = "bbard7081@gmail.com"'
            );
        } else {
            db.run(
                'INSERT INTO users (id, name, email, role, status) VALUES (?, ?, ?, ?, ?)',
                [id, 'Bryan Bard', 'bbard7081@gmail.com', 'admin', 'ACTIVE']
            );
        }
    } catch (e) {
        console.error('❌ Error updating user:', e.message);
    }

    // Save
    fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

addUser().catch(console.error);
