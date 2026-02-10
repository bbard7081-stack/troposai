import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

async function checkUser() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);
    const res = db.exec("SELECT * FROM users WHERE email = 'bbard7081@gmail.com'");
    console.log(JSON.stringify(res, null, 2));
}

checkUser().catch(console.error);
