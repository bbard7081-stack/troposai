import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function diagnose() {
    console.log('🔍 RingCentral App Diagnosis');
    console.log('---------------------------');
    console.log('Client ID:', process.env.VITE_RC_CLIENT_ID);

    const sdk = new SDK({
        server: 'https://platform.ringcentral.com',
        clientId: process.env.VITE_RC_CLIENT_ID,
        clientSecret: process.env.VITE_RC_CLIENT_SECRET
    });

    try {
        console.log('🔄 Attempting to fetch App Details (without login)...');
        // We can't fetch app details without login normally, 
        // but we can try to login and see the full error response.
        await sdk.platform().login({
            jwt: process.env.VITE_RC_JWT
        });
        console.log('✅ Login SUCCESS! (This shouldn\'t happen if you see OAU-251)');
    } catch (e) {
        console.log('❌ Login FAILED as expected.');
        if (e.response) {
            const data = await e.response.json();
            console.log('--- ERROR DATA ---');
            console.log(JSON.stringify(data, null, 2));
            console.log('------------------');

            if (data.error === 'unauthorized_client') {
                console.log('\n🚨 DIAGNOSIS: App is unauthorized for this grant type.');
                console.log('This usually means "JWT Grant" is not enabled in the Developer Portal,');
                console.log('OR you are mixing up "Sandbox" vs "Production" credentials.');
                console.log('\nCHECKLIST:');
                console.log('1. Go to https://developer.ringcentral.com/');
                console.log('2. Open app "Tropos"');
                console.log('3. "Settings" -> "Credential Types" -> MUST check "JWT Grant"');
                console.log('4. Ensure your JWT was created in PRODUCTION (not sandbox)');
            }
        } else {
            console.log('Error Message:', e.message);
        }
    }
}

diagnose();
