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

    try {
        await platform.login({
            jwt: process.env.VITE_RC_JWT
        });


        const info = await platform.get('/restapi/v1.0/account/~');
        const json = await info.json();

    } catch (e) {
        console.error('\n❌ LOGIN FAILED');
        console.error('Error:', e.message);
        if (e.response) {
            const errJson = await e.response.json();
            console.error('Full Error:', JSON.stringify(errJson, null, 2));

            if (errJson.errorCode === 'OAU-251') {
            }
        }
    }
}

diagnose();
