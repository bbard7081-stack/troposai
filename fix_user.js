
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

async function update() {
    await initializeDatabase();
    const db = getDatabase();
    db.run("UPDATE users SET email = 'bbard7081@gmail.com', role = 'ADMIN' WHERE name = 'Baila Bard'");
    await saveDatabase();
    console.log('✅ Updated Baila Bard to bbard7081@gmail.com and role ADMIN');

    // Check results
    const res = db.exec("SELECT * FROM users WHERE email = 'bbard7081@gmail.com'");
    console.log(JSON.stringify(res[0]?.values || [], null, 2));
}
update();
