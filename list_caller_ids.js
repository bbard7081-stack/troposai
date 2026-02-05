import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.VITE_RC_CLIENT_ID,
    clientSecret: process.env.VITE_RC_CLIENT_SECRET
});

const platform = rcsdk.platform();

async function listCallerIds() {
    console.log('📡 Fetching Verified Caller IDs...');
    try {
        await platform.login({ jwt: process.env.VITE_RC_JWT });

        const resp = await platform.get('/restapi/v1.0/account/~/extension/~/caller-id');
        const data = await resp.json();

        console.log('\n✅ Verified Phone Numbers for this account:');
        data.byFeature.forEach(feat => {
            if (feat.feature === 'RingOut') {
                console.log('\n--- RingOut Allowed Caller IDs ---');
                feat.callerIds.forEach(id => {
                    console.log(`📞 ${id.phoneNumber} (${id.usageType})`);
                });
            }
        });

    } catch (e) {
        console.error('❌ Error fetching Caller IDs:', e.message);
        if (e.response) {
            console.error('Full Error:', await e.response.json());
        }
    }
}

listCallerIds();
