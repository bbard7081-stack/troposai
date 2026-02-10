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
        console.log('🔐 Authenticating with RingCentral Production...');
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        console.log('📡 Fetching active subscriptions...');
        const response = await platform.get('/restapi/v1.0/subscription');
        const data = await response.json();

        if (data.records && data.records.length > 0) {
            console.log(`✅ Found ${data.records.length} active subscription(s):`);
            data.records.forEach((sub, i) => {
                console.log(`\n--- Subscription #${i + 1} ---`);
                console.log('ID:', sub.id);
                console.log('Status:', sub.status);
                console.log('URL:', sub.deliveryMode.address);
                console.log('Created:', sub.creationTime);
                console.log('Expires:', sub.expirationTime);
                console.log('Events:', sub.eventFilters.join(', '));
            });
        } else {
            console.log('⚠️ No active subscriptions found.');
        }

    } catch (e) {
        console.error('❌ Failed to fetch subscriptions:', e.message);
    }
}

listSubscriptions();
