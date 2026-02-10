import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const rcsdk = new SDK({
    server: 'https://platform.ringcentral.com',
    clientId: process.env.VITE_RC_CLIENT_ID,
    clientSecret: process.env.VITE_RC_CLIENT_SECRET
});

const platform = rcsdk.platform();

async function diagnose() {
    console.log('🔍 RingCentral Production Diagnostic');
    console.log('-----------------------------------');
    console.log('Client ID:', process.env.VITE_RC_CLIENT_ID);
    console.log('Server:', 'https://platform.ringcentral.com (Production)');

    try {
        console.log('\n🔐 Attempting Login with JWT...');
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });

        console.log('✅ LOGIN SUCCESS!');

        const info = await platform.get('/restapi/v1.0/account/~');
        const json = await info.json();
        console.log('Account Name:', json.serviceInfo?.brandName);
        console.log('Main Number:', json.mainNumber);

    } catch (e) {
        console.error('\n❌ LOGIN FAILED');
        console.error('Error:', e.message);
        if (e.response) {
            const errJson = await e.response.json();
            console.error('Full Error:', JSON.stringify(errJson, null, 2));

            if (errJson.errorCode === 'OAU-251') {
                console.log('\n🚨 CRITICAL ISSUE: The "JWT-Bearer" grant type is NOT ENABLED for this Client ID.');
                console.log('Please ensure you are on the "PRODUCTION" tab in the RingCentral Portal, not "Sandbox".');
            }
        }
    }
}

diagnose();
