
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

const NEW_DEFAULT_ASSIGNEE = 'bbard7081@gmail.com';

async function updateAssignees() {
    console.log('🔄 Starting bulk update of unassigned contacts...');

    if (!fs.existsSync(dbPath)) {
        console.error('❌ Database file not found at:', dbPath);
        process.exit(1);
    }

    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    try {
        // Find contacts that are "Unassigned"
        const checkRes = db.exec("SELECT count(*) as count FROM contacts WHERE assigned_to = 'Unassigned'");
        const count = checkRes[0]?.values[0]?.[0] || 0;

        if (count === 0) {
            console.log('✅ No "Unassigned" contacts found. Nothing to update.');
        } else {
            console.log(`📦 Found ${count} "Unassigned" contacts. Updating to ${NEW_DEFAULT_ASSIGNEE}...`);

            db.run("UPDATE contacts SET assigned_to = ? WHERE assigned_to = 'Unassigned'", [NEW_DEFAULT_ASSIGNEE]);

            console.log('✅ Bulk update complete.');

            // Save the database
            const binaryArray = db.export();
            fs.writeFileSync(dbPath, Buffer.from(binaryArray));
            console.log('💾 Database saved successfully.');
        }
    } catch (e) {
        console.error('❌ Error during update:', e.message);
    }
}

updateAssignees().catch(console.error);
