import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

async function seed() {
    console.log('🌱 Seeding default passwords...');
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    // Update all users who don't have a password set
    db.run("UPDATE users SET password = '123456' WHERE password IS NULL OR password = ''");

    // Explicitly set admin password if it's different or just to be sure
    db.run("UPDATE users SET password = 'admin-password' WHERE role = 'ADMIN' AND email = 'admin@troposai.com'");

    const binaryArray = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryArray));
    console.log('✅ Passwords seeded successfully.');
}

seed().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});
