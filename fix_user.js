
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

async function update() {
    await initializeDatabase();
    const db = getDatabase();
    db.run("UPDATE users SET email = 'bbard7081@gmail.com', role = 'ADMIN' WHERE name = 'Baila Bard'");
    await saveDatabase();

    // Check results
    const res = db.exec("SELECT * FROM users WHERE email = 'bbard7081@gmail.com'");
}
update();
