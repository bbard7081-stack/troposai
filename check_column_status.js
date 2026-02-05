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


    // Check table structure
    const tableInfo = db.exec('PRAGMA table_info(contacts)');
    tableInfo[0]?.values.forEach(col => {
    });


    // Check admin_settings
    const settings = db.exec('SELECT * FROM admin_settings WHERE key = "gridColumns"');
    if (settings.length > 0 && settings[0].values.length > 0) {
        const columns = JSON.parse(settings[0].values[0][1]);
        columns.forEach(col => {
            if (col.options) {
            }
        });

        const qualifiedFor = columns.find(c => c.id === 'qualifiedFor');
        if (qualifiedFor) {
        } else {
        }
    } else {
    }

    const sampleData = db.exec('SELECT id, name, qualifiedFor FROM contacts LIMIT 3');
    if (sampleData.length > 0) {
        sampleData[0].values.forEach(row => {
        });
    }
}

checkColumnStatus().catch(console.error);
