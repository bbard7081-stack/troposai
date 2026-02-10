import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

async function purgeDatabase() {
    console.log('🧹 Starting Database Purge...');
    const SQL = await initSqlJs();

    if (!fs.existsSync(dbPath)) {
        console.log('ℹ️ No database found to purge.');
        return;
    }

    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    // 1. Clear Contacts (The "Fake Info")
    console.log('🗑️ Purging contacts table...');
    db.run("DELETE FROM contacts");

    // 2. Clear placeholder users (sheetsync.com ones)
    console.log('🗑️ Purging placeholder staff users...');
    db.run("DELETE FROM users WHERE email LIKE '%@sheetsync.com'");

    // Save
    const binaryArray = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryArray));
    console.log('✅ Database Purge Complete.');
}

purgeDatabase().catch(console.error);
