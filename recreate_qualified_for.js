import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recreateQualifiedForColumn() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');

    let db;
    if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath);
        db = new SQL.Database(data);
    } else {
        console.error('❌ Database not found!');
        return;
    }

    try {
        // Step 1: Drop the old qualifiedFor column if it exists
        const tableInfo = db.exec('PRAGMA table_info(contacts)');
        const columns = tableInfo[0]?.values || [];
        const hasQualifiedFor = columns.some(col => col[1] === 'qualifiedFor');

        if (hasQualifiedFor) {

            // Backup existing data
            const existingData = db.exec('SELECT id, qualifiedFor FROM contacts WHERE qualifiedFor IS NOT NULL');
            const backupData = existingData[0]?.values || [];

            // Create new table without qualifiedFor
            db.run(`
                CREATE TABLE contacts_new AS 
                SELECT id, name, dob, phone, level, approved, assignedTo, city, 
                       householdSize, address, dateOutreached, dateScreened, 
                       householdMembers, created_at, updated_at
                FROM contacts
            `);

            // Drop old table
            db.run('DROP TABLE contacts');

            // Rename new table
            db.run('ALTER TABLE contacts_new RENAME TO contacts');

        }

        // Step 2: Add new qualifiedFor column as TEXT (will store JSON array)
        db.run('ALTER TABLE contacts ADD COLUMN qualifiedFor TEXT');

        // Step 3: Update all existing rows to have empty array
        db.run('UPDATE contacts SET qualifiedFor = "[]"');

        // Step 4: Update column configuration in admin_settings
        const settingsCheck = db.exec('SELECT * FROM admin_settings WHERE key = "gridColumns"');

        let columns_config;
        if (settingsCheck.length > 0 && settingsCheck[0].values.length > 0) {
            columns_config = JSON.parse(settingsCheck[0].values[0][1]);
        } else {
            // Use default columns from constants.ts
            columns_config = [
                { id: 'name', title: 'Name', type: 'TEXT', width: 220 },
                { id: 'dob', title: 'DOB', type: 'DATE', width: 130 },
                { id: 'phone', title: 'Phone Number', type: 'TEXT', width: 150 },
                { id: 'level', title: 'Status / Level', type: 'DROPDOWN', options: ['No Contact', 'Screening Completed', 'EA Completed', 'Approval Pending', 'Approved', 'Services Rendered'], width: 180 },
                { id: 'approved', title: 'Approved', type: 'DROPDOWN', options: ['Pending', 'Yes', 'No'], width: 120 },
                { id: 'assignedTo', title: 'Assigned Navigator', type: 'DROPDOWN', width: 180 },
                { id: 'city', title: 'City', type: 'TEXT', width: 150 },
                { id: 'householdSize', title: 'Household Size', type: 'NUMBER', width: 120 },
                { id: 'address', title: 'Address', type: 'TEXT', width: 250 },
                { id: 'dateOutreached', title: 'Date Outreached', type: 'DATE', width: 150 },
                { id: 'dateScreened', title: 'Date Screened', type: 'DATE', width: 150 },
                { id: 'householdMembers', title: 'Household Members', type: 'TEXT', width: 300 }
            ];
        }

        // Remove old qualifiedFor if exists
        columns_config = columns_config.filter(c => c.id !== 'qualifiedFor');

        // Add new qualifiedFor column after level
        const levelIdx = columns_config.findIndex(c => c.id === 'level');
        columns_config.splice(levelIdx + 1, 0, {
            id: 'qualifiedFor',
            title: 'Qualified For',
            type: 'MULTI_SELECT',
            options: ['MTM', 'Cooking Ware x3', 'Transportation', 'Housing', 'Utilities'],
            width: 250
        });

        // Save to database
        db.run('DELETE FROM admin_settings WHERE key = "gridColumns"');
        db.run(
            'INSERT INTO admin_settings (key, value) VALUES (?, ?)',
            ['gridColumns', JSON.stringify(columns_config)]
        );


        // Save database
        fs.writeFileSync(dbPath, Buffer.from(db.export()));

    } catch (e) {
        console.error('❌ Error:', e.message);
        console.error(e.stack);
    }
}

recreateQualifiedForColumn().catch(console.error);
