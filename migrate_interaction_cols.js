
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();

        console.log('🔄 Migrating contacts table schema...');

        try {
            db.run("ALTER TABLE contacts ADD COLUMN interaction_logs TEXT DEFAULT ''");
            console.log('✅ Added interaction_logs column');
        } catch (e) {
            console.log('ℹ️ interaction_logs column likely exists');
        }

        try {
            db.run("ALTER TABLE contacts ADD COLUMN last_call_at TEXT");
            console.log('✅ Added last_call_at column');
        } catch (e) {
            console.log('ℹ️ last_call_at column likely exists');
        }

        saveDatabase();
        console.log('🎉 Contact schema migration complete.');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
})();
