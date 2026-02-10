import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';
dotenv.config();

async function testRC() {
    console.log('--- RingCentral Connection Test ---');
    console.log('Server:', process.env.VITE_RC_SERVER_URL);
    console.log('Client ID:', process.env.VITE_RC_CLIENT_ID);

    // Check if client secret is present (don't log it all)
    console.log('Client Secret present:', !!process.env.VITE_RC_CLIENT_SECRET);

    const rcsdk = new SDK({
        server: process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com',
        clientId: process.env.VITE_RC_CLIENT_ID,
        clientSecret: process.env.VITE_RC_CLIENT_SECRET,
    });

    const platform = rcsdk.platform();

    try {
        console.log('🔑 Attempting to login with JWT...');
        const resp = await platform.login({
            jwt: process.env.VITE_RC_JWT
        });
        const data = await resp.json();
        console.log('✅ Login successful!');
        console.log('Token data:', JSON.stringify(data, null, 2));

        console.log('📊 Fetching account info...');
        const accountResp = await platform.get('/restapi/v1.0/account/~');
        const accountData = await accountResp.json();
        console.log('✅ Account Name:', accountData.serviceInfo.brandName);

    } catch (error) {
        console.error('❌ Login failed:', error.message);
        if (error.response) {
            try {
                const errData = await error.response.json();
                console.error('❌ Error details:', JSON.stringify(errData, null, 2));
            } catch (e) {
                console.error('❌ Could not parse error response');
            }
        }
    }
}

testRC();
