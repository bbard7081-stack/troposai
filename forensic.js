import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function forensicAudit() {
    const SQL = await initSqlJs();
    const dbPath = path.join(__dirname, 'crm_data.db');
    if (!fs.existsSync(dbPath)) {
        console.log('No database found at ' + dbPath);
        return;
    }
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    console.log('--- FORENSIC AUDIT RESULTS ---');

    // 1. Enumerate ALL tenants in contacts
    try {
        const tenantCounts = db.exec('SELECT tenant_id, COUNT(*) AS contact_count FROM contacts GROUP BY tenant_id');
        console.log('Contacts by Tenant:', JSON.stringify(tenantCounts[0]?.values || []));
    } catch (e) { console.error('Error 1:', e.message); }

    // 2. Check call / telemetry data by tenant
    try {
        const callCounts = db.exec('SELECT tenant_id, COUNT(*) AS call_count FROM call_logs GROUP BY tenant_id');
        console.log('Call Logs by Tenant:', JSON.stringify(callCounts[0]?.values || []));
    } catch (e) { console.error('Error 2:', e.message); }

    // 3. Check recent activity (last 48h)
    try {
        const recentActivity = db.exec("SELECT tenant_id, COUNT(*) AS updates_last_48h FROM contacts WHERE updated_at >= datetime('now', '-48 hours') GROUP BY tenant_id");
        console.log('Recent Activity (48h) by Tenant:', JSON.stringify(recentActivity[0]?.values || []));
    } catch (e) { console.error('Error 3:', e.message); }

    // 4. Sample records (max 3 per tenant)
    try {
        const tenants = db.exec('SELECT DISTINCT tenant_id FROM contacts')[0]?.values.map(v => v[0]) || [];
        for (const tid of tenants) {
            const samples = db.exec('SELECT id, name, phone, updated_at FROM contacts WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT 3', [tid]);
            console.log(`Samples for Tenant [${tid}]:`, JSON.stringify(samples[0]?.values || []));
        }
    } catch (e) { console.error('Error 4:', e.message); }

    console.log('------------------------------');
}

forensicAudit().catch(console.error);
