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

async function registerWebhook() {
    try {
        console.log('🔐 Authenticating with RingCentral Production...');
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        const webhookUrl = process.argv[2];
        if (!webhookUrl) {
            console.error('❌ Error: Please provide your public Webhook URL.');
            console.log('Usage: node registerWebhook.js https://your-crm-domain.com/api/webhooks/ringcentral');
            process.exit(1);
        }

        console.log(`📡 Registering Webhook: ${webhookUrl}`);

        const response = await platform.post('/restapi/v1.0/subscription', {
            eventFilters: [
                '/restapi/v1.0/account/~/telephony/sessions'
            ],
            deliveryMode: {
                transportType: 'WebHook',
                address: webhookUrl
            },
            expiresIn: 315360000 // 10 years (effectively permanent for this use case)
        });

        const subscription = await response.json();
        console.log('✅ Webhook Registered Successfully!');
        console.log('Subscription ID:', subscription.id);
        console.log('Status:', subscription.status);

    } catch (e) {
        console.error('❌ Registration Failed:', e.message);
        if (e.response) {
            const errJson = await e.response.json();
            console.error('Reason:', JSON.stringify(errJson, null, 2));
            if (errJson.errorCode === 'OAU-251') {
                console.log('\n💡 TIP: Log into https://developer.ringcentral.com, go to your app "careQ", then "Settings", and check the box for "JWT-Bearer" in the Grant Types section.');
            }
        }
    }
}

registerWebhook();
