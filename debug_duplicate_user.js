
import { initializeDatabase, getDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();

        console.log('--- Checking for existing user ---');
        // Get an existing email to test duplicate constraint
        const existing = db.exec('SELECT email FROM users LIMIT 1');
        if (!existing.length || !existing[0].values.length) {
            console.log('No users found to test duplicate.');
            return;
        }
        const existingEmail = existing[0].values[0][0];
        console.log(`Found existing email: ${existingEmail}`);

        console.log('--- Attempting Duplicate Insert ---');
        try {
            db.run(
                'INSERT INTO users (id, tenant_id, name, email, role, team, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [`test_dup_${Date.now()}`, 'simchatalent', 'Duplicate User', existingEmail, 'USER', 'Test Team', 'INVITED', null]
            );
            console.log('❌ Insert unexpectedly successful (duplicate should fail)');
        } catch (err) {
            console.log('✅ Correctly failed (expected):', err.message);
        }

    } catch (e) {
        console.error('Script failed:', e);
    }
})();
