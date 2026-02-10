import fs from 'fs';
import initSqlJs from 'sql.js';

async function verify() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync('crm_data.db');
    const db = new SQL.Database(data);

    console.log('--- Checking Contacts ---');
    const contacts = db.exec('SELECT id, name, phone, tenant_id FROM contacts WHERE phone LIKE "%18451112222%"');
    console.log(JSON.stringify(contacts, null, 2));

    console.log('\n--- Checking Call Logs ---');
    const logs = db.exec('SELECT * FROM call_logs WHERE contact_id IN (SELECT id FROM contacts WHERE phone LIKE "%18451112222%") ORDER BY created_at DESC');
    console.log(JSON.stringify(logs, null, 2));

    console.log('\n--- Checking Messages ---');
    const msgs = db.exec('SELECT * FROM messages WHERE sender_email = "18451112222" ORDER BY created_at DESC');
    console.log(JSON.stringify(msgs, null, 2));
}

verify().catch(console.error);
