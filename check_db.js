
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function check() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');
    if (!fs.existsSync(dbPath)) {
        return;
    }
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    const contacts = db.exec('SELECT COUNT(*) as count FROM contacts');
    const users = db.exec('SELECT COUNT(*) as count FROM users');


    if (contacts[0].values[0][0] > 0) {
        const sample = db.exec('SELECT name FROM contacts LIMIT 5');
    }
}

check().catch(console.error);
