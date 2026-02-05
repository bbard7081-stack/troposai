import { SDK } from '@ringcentral/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

async function diagnose() {

    const sdk = new SDK({
        server: 'https://platform.ringcentral.com',
        clientId: process.env.VITE_RC_CLIENT_ID,
        clientSecret: process.env.VITE_RC_CLIENT_SECRET
    });

    try {
        // We can't fetch app details without login normally, 
        // but we can try to login and see the full error response.
        await sdk.platform().login({
            jwt: process.env.VITE_RC_JWT
        });
    } catch (e) {
        if (e.response) {
            const data = await e.response.json();

            if (data.error === 'unauthorized_client') {
            }
        } else {
        }
    }
}

diagnose();
