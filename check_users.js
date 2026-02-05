
import { initializeDatabase, getDatabase } from './database.js';

async function check() {
    await initializeDatabase();
    const db = getDatabase();
    const res = db.exec("SELECT id, name, email, ringCentralEmail, role FROM users");
}
check();
