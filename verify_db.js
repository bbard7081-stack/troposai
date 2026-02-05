import fs from 'fs';
import initSqlJs from 'sql.js';

async function verify() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync('crm_data.db');
    const db = new SQL.Database(data);

    const contacts = db.exec('SELECT id, name, phone, tenant_id FROM contacts WHERE phone LIKE "%18451112222%"');

    const logs = db.exec('SELECT * FROM call_logs WHERE contact_id IN (SELECT id FROM contacts WHERE phone LIKE "%18451112222%") ORDER BY created_at DESC');

    const msgs = db.exec('SELECT * FROM messages WHERE sender_email = "18451112222" ORDER BY created_at DESC');
}

verify().catch(console.error);
