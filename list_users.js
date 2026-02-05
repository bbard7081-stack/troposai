import fs from 'fs';
import initSqlJs from 'sql.js';

async function listUsers() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync('crm_data.db');
    const db = new SQL.Database(data);

    const users = db.exec('SELECT id, name, email, extensionNumber FROM users');
}

listUsers().catch(console.error);
