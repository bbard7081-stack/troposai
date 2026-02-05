import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = process.env.VITE_RC_CLIENT_ID;
const CLIENT_SECRET = process.env.VITE_RC_CLIENT_SECRET;
const JWT = process.env.VITE_RC_JWT;
const SERVER_URL = 'https://platform.ringcentral.com';

async function testFetch() {
    console.log('🔍 RingCentral HTTP Fetch Diagnostic');
    console.log('-----------------------------------');
    console.log('Client ID:', CLIENT_ID);

    const authHeader = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {
        console.log('\n🔐 Exchanging JWT for Access Token via HTTP...');
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
                console.log('\n🚨 CONFIRMED: RingCentral says "Unauthorized for this grant type".');
                console.log('   This means "JWT Bearer" Flow is NOT toggled ON in the Developer Portal for this Client ID.');
            }
            return;
        }

        const data = await response.json();
        console.log('✅ SUCCESS! Received Access Token.');
        console.log('Access Token (first 20 chars):', data.access_token.substring(0, 20) + '...');

    } catch (e) {
        console.error('\n❌ UNEXPECTED ERROR:', e.message);
    }
}

testFetch();
