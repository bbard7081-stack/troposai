import dotenv from 'dotenv';
dotenv.config();

const jwt = process.env.VITE_RC_JWT;
if (!jwt) {
    console.error('No JWT found in .env');
    process.exit(1);
}

try {
    const parts = jwt.split('.');
    if (parts.length < 2) throw new Error('Invalid JWT format');

    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    console.log('--- JWT Header ---');
    console.log(JSON.stringify(header, null, 2));
    console.log('--- JWT Payload ---');
    console.log(JSON.stringify(payload, null, 2));

    const now = Math.floor(Date.now() / 1000);
    console.log('--- Expiration Check ---');
    console.log('Current Time:', now);
    console.log('Expiration (exp):', payload.exp);
    console.log('Valid:', payload.exp > now ? '✅ YES' : '❌ EXPIRED');

} catch (e) {
    console.error('Failed to decode JWT:', e.message);
}
