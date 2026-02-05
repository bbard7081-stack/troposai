import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkColumnStatus() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    console.log('=== DATABASE STRUCTURE ===\n');

    // Check table structure
    const tableInfo = db.exec('PRAGMA table_info(contacts)');
    console.log('Contacts table columns:');
    tableInfo[0]?.values.forEach(col => {
        console.log(`  - ${col[1]} (${col[2]})`);
    });

    console.log('\n=== COLUMN CONFIGURATION ===\n');

    // Check admin_settings
    const settings = db.exec('SELECT * FROM admin_settings WHERE key = "gridColumns"');
    if (settings.length > 0 && settings[0].values.length > 0) {
        const columns = JSON.parse(settings[0].values[0][1]);
        console.log('Configured columns:');
        columns.forEach(col => {
            console.log(`  - ${col.id}: ${col.title} (${col.type})`);
            if (col.options) {
                console.log(`    Options: ${col.options.join(', ')}`);
            }
        });

        const qualifiedFor = columns.find(c => c.id === 'qualifiedFor');
        if (qualifiedFor) {
            console.log('\n✅ qualifiedFor column found in config:');
            console.log(JSON.stringify(qualifiedFor, null, 2));
        } else {
            console.log('\n❌ qualifiedFor column NOT found in config');
        }
    } else {
        console.log('⚠️ No gridColumns in admin_settings');
    }

    console.log('\n=== SAMPLE DATA ===\n');
    const sampleData = db.exec('SELECT id, name, qualifiedFor FROM contacts LIMIT 3');
    if (sampleData.length > 0) {
        console.log('Sample rows:');
        sampleData[0].values.forEach(row => {
            console.log(`  ${row[0]}: ${row[1]} - qualifiedFor: ${row[2]}`);
        });
    }
}

checkColumnStatus().catch(console.error);
