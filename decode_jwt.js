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


    const now = Math.floor(Date.now() / 1000);

} catch (e) {
    console.error('Failed to decode JWT:', e.message);
}
