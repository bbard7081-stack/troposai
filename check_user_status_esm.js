import { initializeDatabase, getDatabase } from './database.js';

async function check() {
    await initializeDatabase();
    const db = getDatabase();
    const targetEmail = 'bbard7081@gmail.com';
    const res = db.exec('SELECT email, name, role, status FROM users WHERE email = ?', [targetEmail]);

    if (res.length > 0 && res[0].values.length > 0) {
        const user = res[0].values[0];
    } else {
        const all = db.exec('SELECT email, status FROM users LIMIT 10');
        if (all.length > 0) {
        }
    }
}

check();
