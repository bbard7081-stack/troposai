import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SDK } from '@ringcentral/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'crm_data.db');

async function sync() {
    console.log('🚀 STAFF SYNC DIAGNOSTIC');
    console.log('📊 DB Path:', dbPath);

    const SQL = await initSqlJs();
    if (!fs.existsSync(dbPath)) {
        console.error('❌ Database file not found!');
        return;
    }

    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // 1. Force fix the table schema first
    console.log('🛠️  Fixing table schema...');
    try {
        db.run("DROP TABLE IF EXISTS users_new");
        db.run(`CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      ringCentralEmail TEXT,
      role TEXT,
      team TEXT,
      status TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      extensionNumber TEXT,
      lastSynced TEXT
    )`);

        // Copy existing data if any (ignoring errors)
        try {
            db.run("INSERT INTO users_new (id, name, email, role, status, ringCentralEmail, extensionNumber) SELECT id, name, email, role, status, ringCentralEmail, extensionNumber FROM users");
        } catch (e) {
            console.log('⚠️  Could not migrate existing users (likely due to constraints)');
        }

        db.run("DROP TABLE users");
        db.run("ALTER TABLE users_new RENAME TO users");
        console.log('✅ Users table recreated successfully');
    } catch (e) {
        console.error('❌ Failed to fix table:', e.message);
    }

    // 2. Try RC Sync
    const rcsdk = new SDK({
        server: process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com',
        clientId: process.env.VITE_RC_CLIENT_ID,
        clientSecret: process.env.VITE_RC_CLIENT_SECRET,
    });
    const platform = rcsdk.platform();

    try {
        console.log('🔑 Logging in to RingCentral via Fetch (Hardened)...');
        const rcClientId = (process.env.VITE_RC_CLIENT_ID || '').trim();
        const rcClientSecret = (process.env.VITE_RC_CLIENT_SECRET || '').trim();
        const rcJwt = (process.env.VITE_RC_JWT || '').trim();
        const rcServer = (process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com').trim();

        console.log(`   Client ID: ${rcClientId.substring(0, 5)}...`);

        const authHeader = Buffer.from(`${rcClientId}:${rcClientSecret}`).toString('base64');
        const tokenResp = await fetch(`${rcServer}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': rcJwt
            })
        });

        if (!tokenResp.ok) {
            const errText = await tokenResp.text();
            throw new Error(`RingCentral Auth Failed: ${tokenResp.status} - ${errText}`);
        }

        const tokenData = await tokenResp.json();
        platform.auth().setData(tokenData);
        console.log('✅ Login successful (Fetch Hardened)');

        const resp = await platform.get('/restapi/v1.0/account/~/extension', {
            perPage: 100,
            status: 'Enabled',
            type: 'User'
        });

        const data = await resp.json();
        const users = data.records.map(ext => ({
            id: String(ext.id),
            name: ext.name,
            rcEmail: ext.contact?.email || `${ext.name.toLowerCase().replace(/\s+/g, '.')}@ringcentral.com`,
            extensionNumber: ext.extensionNumber,
            status: ext.status || 'Enabled',
            role: 'USER'
        }));

        console.log(`👥 Found ${users.length} extensions`);

        const now = new Date().toISOString();
        users.forEach(user => {
            try {
                // 1. Try to find existing user by RingCentral ID
                let existing = db.exec('SELECT id, name FROM users WHERE id = ?', [user.id]);

                // 2. If not found by ID, try to find by Name
                if (existing.length === 0 || existing[0].values.length === 0) {
                    existing = db.exec('SELECT id, name FROM users WHERE LOWER(name) = LOWER(?)', [user.name]);
                }

                if (existing.length > 0 && existing[0].values.length > 0) {
                    const crmUserId = existing[0].values[0][0];
                    const crmUserName = existing[0].values[0][1];

                    console.log(`🔗 Matching RC User "${user.name}" to CRM User "${crmUserName}" (ID: ${crmUserId})`);

                    // Update existing CRM user with RC info
                    db.run(`UPDATE users SET 
                            extensionNumber = ?, 
                            ringCentralEmail = ?, 
                            status = ?, 
                            lastSynced = ? 
                            WHERE id = ?`,
                        [user.extensionNumber, user.rcEmail, user.status, now, crmUserId]
                    );
                    console.log(`   + Updated: ${user.name}`);
                } else {
                    // 3. If still not found, create as new staff member
                    console.log(`🆕 Creating new CRM user for RC profile: ${user.name}`);
                    db.run(`INSERT INTO users (id, name, email, ringCentralEmail, role, team, status, extensionNumber, lastSynced) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [user.id, user.name, user.rcEmail, user.rcEmail, user.role, 'Staff', user.status, user.extensionNumber, now]
                    );
                    console.log(`   + Created: ${user.name}`);
                }
            } catch (e) {
                console.error(`Error syncing user ${user.name}:`, e.message);
            }
        });

        // Save
        const exported = db.export();
        fs.writeFileSync(dbPath, Buffer.from(exported));
        console.log('💾 Database saved successfully');

    } catch (e) {
        console.error('❌ RC Sync failed:', e.message);
    }
}

sync().catch(console.error);
