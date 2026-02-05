import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

const TARGET_EMAILS = [
    'malky@simchatalent.org',
    'info@simchatalent.org',
    'izzygrunfeld@gmail.com' // First one on list, just in case
];

async function promoteAdmins() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    // console.log(`Promoting users to ADMIN: ${TARGET_EMAILS.join(', ')}`);

    for (const email of TARGET_EMAILS) {
        try {
            db.run("UPDATE users SET role = 'ADMIN' WHERE email = ?", [email]);
            // Check if it worked
            const res = db.exec("SELECT role, name FROM users WHERE email = ?", [email]);
            if (res.length > 0 && res[0].values.length > 0) {
                console.log(`✅ Promoted ${res[0].values[0][1]} (${email}) to ADMIN.`);
            } else {
                console.log(`⚠️  User not found: ${email}`);
            }
        } catch (e) {
            console.error(`❌ Failed to promote ${email}: ${e.message}`);
        }
    }

    // Save
    const binaryArray = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryArray));
}

promoteAdmins().catch(console.error);
