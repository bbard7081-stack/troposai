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
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        const response = await platform.get('/restapi/v1.0/account/~/extension', {
            perPage: 100,
            status: 'Enabled',
            type: 'User'
        });

        const data = await response.json();

        data.records.forEach(ext => {
        });


    } catch (e) {
        console.error('❌ Sync Failed:', e.message);
    }
}

syncUsers();
