import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixQualifiedForColumn() {
    console.log('Fixing Qualified For column to enable multi-select...');
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');

    let db;
    if (fs.existsSync(dbPath)) {
        const data = fs.readFileSync(dbPath);
        db = new SQL.Database(data);
        console.log('✅ Loaded existing database: crm_data.db');
    } else {
        console.error('❌ Database not found!');
        return;
    }

    try {
        // Check if admin_settings table exists and has gridColumns
        const settingsCheck = db.exec('SELECT * FROM admin_settings WHERE key = "gridColumns"');

        if (settingsCheck.length > 0 && settingsCheck[0].values.length > 0) {
            const gridColumnsJson = settingsCheck[0].values[0][1];
            const columns = JSON.parse(gridColumnsJson);

            console.log('Current columns:', columns.map(c => ({ id: c.id, type: c.type })));

            // Find and update the qualifiedFor column
            const qualifiedForIdx = columns.findIndex(c => c.id === 'qualifiedFor');
            if (qualifiedForIdx !== -1) {
                columns[qualifiedForIdx] = {
                    id: 'qualifiedFor',
                    title: 'Qualified For',
                    type: 'MULTI_SELECT',
                    options: ['MTM', 'Cooking Ware x3', 'Transportation', 'Housing', 'Utilities'],
                    width: 250
                };
                console.log('✅ Updated qualifiedFor column to MULTI_SELECT');
            } else {
                console.log('⚠️ qualifiedFor column not found in database, will use default from constants.ts');
            }

            // Save back to database
            db.run(
                'UPDATE admin_settings SET value = ? WHERE key = "gridColumns"',
                [JSON.stringify(columns)]
            );

            console.log('✅ Saved updated columns to database');
        } else {
            console.log('ℹ️ No gridColumns in admin_settings, app will use defaults from constants.ts');
        }

        // Save database
        fs.writeFileSync(dbPath, Buffer.from(db.export()));
        console.log('✅ Database saved successfully');

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

fixQualifiedForColumn().catch(console.error);
