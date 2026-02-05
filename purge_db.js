import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

async function purgeDatabase() {
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
        return;
    }

    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    // 1. Clear Contacts (The "Fake Info")
    db.run("DELETE FROM contacts");

    // 2. Clear placeholder users (sheetsync.com ones)
    db.run("DELETE FROM users WHERE email LIKE '%@sheetsync.com'");

    // Save
    const binaryArray = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryArray));
}

purgeDatabase().catch(console.error);
