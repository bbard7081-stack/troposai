import { initializeDatabase, getDatabase } from './database.js';

async function check() {
    await initializeDatabase();
    const db = getDatabase();
    const targetEmail = 'bbard7081@gmail.com';
    const res = db.exec('SELECT email, name, role, status FROM users WHERE email = ?', [targetEmail]);

    console.log('--- USER STATUS CHECK ---');
    if (res.length > 0 && res[0].values.length > 0) {
        const user = res[0].values[0];
        console.log(`Email: ${user[0]}`);
        console.log(`Name: ${user[1]}`);
        console.log(`Role: ${user[2]}`);
        console.log(`Status: ${user[3]}`);
    } else {
        console.log(`User ${targetEmail} not found.`);
        const all = db.exec('SELECT email, status FROM users LIMIT 10');
        if (all.length > 0) {
            console.log('Sample users:');
            all[0].values.forEach(r => console.log(` - ${r[0]}: ${r[1]}`));
        }
    }
    console.log('-------------------------');
}

check();
