import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = process.env.VITE_RC_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_RC_CLIENT_SECRET;
const JWT = process.env.VITE_RC_JWT;
const SERVER_URL = 'https://platform.ringcentral.com';

async function testFetch() {

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        const response = await fetch(`${SERVER_URL}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': JWT
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('\n❌ REQUEST FAILED');
            console.error('Status:', response.status);
            console.error('Body:', errorText);

            if (errorText.includes('OAU-251')) {
            }
            return;
        }

        const data = await response.json();

    } catch (e) {
        console.error('\n❌ UNEXPECTED ERROR:', e.message);
    }
}

testFetch();
