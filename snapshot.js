import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function snapshot() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');
    if (!fs.existsSync(dbPath)) {
        console.log('No database found at ' + dbPath);
        return;
    }
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // a) Total contact count
    const totalContacts = db.exec('SELECT COUNT(*) FROM contacts')[0].values[0][0];

    // b) Count by tenant_id
    const countsByTenant = db.exec('SELECT tenant_id, COUNT(*) FROM contacts GROUP BY tenant_id')[0].values;

    // c) Distinct tenant_id values
    const distinctTenants = db.exec('SELECT id FROM tenants')[0].values.map(v => v[0]);

    // d) Any NULL crm_status or updated_at rows
    const nullCrmStatus = db.exec('SELECT COUNT(*) FROM contacts WHERE crm_status IS NULL')[0].values[0][0];
    const nullUpdatedAt = db.exec('SELECT COUNT(*) FROM contacts WHERE updated_at IS NULL')[0].values[0][0];

    console.log('--- SNAPSHOT RESULTS ---');
    console.log(`Total Contacts: ${totalContacts}`);
    console.log('Counts by Tenant:', JSON.stringify(countsByTenant));
    console.log('Distinct Tenants (Total):', distinctTenants.join(', '));
    console.log(`Contacts with NULL crm_status: ${nullCrmStatus}`);
    console.log(`Contacts with NULL updated_at: ${nullUpdatedAt}`);
    console.log('------------------------');
}

snapshot().catch(console.error);
