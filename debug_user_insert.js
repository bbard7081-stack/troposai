import { initializeDatabase, getDatabase } from './database.js';

(async () => {
    try {
        await initializeDatabase();
        const db = getDatabase();

        console.log('--- Checking Users Table Schema ---');
        const schema = db.exec('PRAGMA table_info(users)');
        console.log(JSON.stringify(schema[0].values, null, 2));

        console.log('--- Attempting Insert ---');
        try {
            db.run(
                'INSERT INTO users (id, tenant_id, name, email, role, team, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [`test_${Date.now()}`, 'simchatalent', 'Test User', `test${Date.now()}@example.com`, 'USER', 'Test Team', 'INVITED', null]
            );
            console.log('✅ Insert successful');
        } catch (err) {
            console.error('❌ Insert failed:', err.message);
        }

    } catch (e) {
        console.error('Script failed:', e);
    }
})();
