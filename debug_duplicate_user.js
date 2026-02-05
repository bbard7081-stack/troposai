
import { initializeDatabase, getDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();

        // Get an existing email to test duplicate constraint
        const existing = db.exec('SELECT email FROM users LIMIT 1');
        if (!existing.length || !existing[0].values.length) {
            return;
        }
        const existingEmail = existing[0].values[0][0];

        try {
            db.run(
                'INSERT INTO users (id, tenant_id, name, email, role, team, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [`test_dup_${Date.now()}`, 'simchatalent', 'Duplicate User', existingEmail, 'USER', 'Test Team', 'INVITED', null]
            );
        } catch (err) {
        }

    } catch (e) {
        console.error('Script failed:', e);
    }
})();
