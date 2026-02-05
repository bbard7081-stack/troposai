
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();


        db.run("UPDATE call_logs SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");

        db.run("UPDATE contacts SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");

        db.run("UPDATE users SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");

        saveDatabase();
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
})();
