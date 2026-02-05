import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';
dotenv.config();

async function testRC() {

    // Check if client secret is present (don't log it all)

    const rcsdk = new SDK({
        server: process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com',
        clientId: process.env.VITE_RC_CLIENT_ID,
        clientSecret: process.env.VITE_RC_CLIENT_SECRET,
    });

    const platform = rcsdk.platform();

    try {
        const resp = await platform.login({
            jwt: process.env.VITE_RC_JWT
        });
        const data = await resp.json();

        const accountResp = await platform.get('/restapi/v1.0/account/~');
        const accountData = await accountResp.json();

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
