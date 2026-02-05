import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const rcsdk = new SDK({
    server: process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com',
    clientId: process.env.VITE_RC_CLIENT_ID,
    clientSecret: process.env.VITE_RC_CLIENT_SECRET
});

const platform = rcsdk.platform();

async function syncUsers() {
    try {
        console.log('🔐 Authenticating with RingCentral...');
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        console.log('📡 Fetching extensions...');
        const response = await platform.get('/restapi/v1.0/account/~/extension', {
            perPage: 100,
            status: 'Enabled',
            type: 'User'
        });

        const data = await response.json();
        console.log(`✅ Found ${data.records.length} users.`);

        console.log('\n--- Staff List ---');
        data.records.forEach(ext => {
            console.log(`[${ext.extensionNumber}] ${ext.name} - ${ext.contact?.email || 'No Email'}`);
        });

        console.log('\n💡 These users will be auto-synced by the server on next startup.');
        console.log('   You can also trigger a sync by visiting: https://troposai.com/api/ringcentral/users');

    } catch (e) {
        console.error('❌ Sync Failed:', e.message);
    }
}

syncUsers();
