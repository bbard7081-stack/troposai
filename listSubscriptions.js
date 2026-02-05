import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.VITE_RC_CLIENT_ID,
    clientSecret: process.env.VITE_RC_CLIENT_SECRET
});

const platform = rcsdk.platform();

async function listSubscriptions() {
    try {
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        const response = await platform.get('/restapi/v1.0/subscription');
        const data = await response.json();

        if (data.records && data.records.length > 0) {
            data.records.forEach((sub, i) => {
            });
        } else {
        }

    } catch (e) {
        console.error('❌ Failed to fetch subscriptions:', e.message);
    }
}

listSubscriptions();
