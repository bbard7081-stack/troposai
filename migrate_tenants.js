
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();

        console.log('🔄 Migrating tenant_id defaults...');

        db.run("UPDATE call_logs SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");
        console.log('✅ call_logs updated');

        db.run("UPDATE contacts SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");
        console.log('✅ contacts updated');

        db.run("UPDATE users SET tenant_id = 'simchatalent' WHERE tenant_id = 'shimchatalent'");
        console.log('✅ users updated');

        saveDatabase();
        console.log('🎉 Migration complete. Database saved.');
    } catch (e) {
        console.error('❌ Migration failed:', e);
    }
})();
