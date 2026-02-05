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

async function resetWebhooks() {
    try {
        console.log('🔐 Authenticating with RingCentral Production...');
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        // Step 1: Delete all existing subscriptions
        console.log('\n📡 Fetching existing subscriptions...');
        const listResp = await platform.get('/restapi/v1.0/subscription');
        const data = await listResp.json();

        if (data.records && data.records.length > 0) {
            console.log(`🗑️  Found ${data.records.length} subscriptions to delete...`);
            for (const sub of data.records) {
                try {
                    await platform.delete(`/restapi/v1.0/subscription/${sub.id}`);
                    console.log(`   ✅ Deleted: ${sub.id} (${sub.status})`);
                } catch (delErr) {
                    console.log(`   ⚠️ Could not delete ${sub.id}: ${delErr.message}`);
                }
            }
        } else {
            console.log('ℹ️  No existing subscriptions found.');
        }

        // Step 2: Register fresh webhook
        const webhookUrl = 'https://troposai.com/api/webhooks/ringcentral';
        console.log(`\n📡 Registering NEW Webhook: ${webhookUrl}`);

        const response = await platform.post('/restapi/v1.0/subscription', {
            eventFilters: [
                '/restapi/v1.0/account/~/telephony/sessions'
            ],
            deliveryMode: {
                transportType: 'WebHook',
                address: webhookUrl
            },
            expiresIn: 315360000 // 10 years
        });

        const subscription = await response.json();
        console.log('\n✅ NEW Webhook Registered Successfully!');
        console.log('   Subscription ID:', subscription.id);
        console.log('   Status:', subscription.status);
        console.log('   URL:', subscription.deliveryMode.address);
        console.log('\n🎉 Incoming calls should now trigger webhooks!');

    } catch (e) {
        console.error('❌ Failed:', e.message);
        if (e.response) {
            try {
                const errJson = await e.response.json();
                console.error('Details:', JSON.stringify(errJson, null, 2));
            } catch (parseErr) { }
        }
    }
}

resetWebhooks();
