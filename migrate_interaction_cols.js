
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();


        try {
            db.run("ALTER TABLE contacts ADD COLUMN interaction_logs TEXT DEFAULT ''");
        } catch (e) {
        }

        try {
            db.run("ALTER TABLE contacts ADD COLUMN last_call_at TEXT");
        } catch (e) {
        }

        saveDatabase();
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
})();
