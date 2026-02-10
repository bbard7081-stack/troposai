const fs = require('fs');
const initSqlJs = require('sql.js');

const targetEmail = 'bbard7081@gmail.com';

(async () => {
    try {
        const SQL = await initSqlJs();
        const dbPath = '/app/data/crm_data.db';
        if (!fs.existsSync(dbPath)) {
            console.error(`Database not found at ${dbPath}`);
            return;
        }
        const data = fs.readFileSync(dbPath);
        const db = new SQL.Database(data);

        const res = db.exec('SELECT email, name, role FROM users WHERE email = ?', [targetEmail]);
        console.log('--- USER CHECK ---');
        if (res.length > 0 && res[0].values.length > 0) {
            const user = res[0].values[0];
            console.log(`FOUND: ${user[0]} (${user[1]}) [Role: ${user[2]}]`);
        } else {
            console.log(`NOT FOUND: ${targetEmail}`);
            const allUsers = db.exec('SELECT email FROM users LIMIT 5');
            console.log('Sample of existing users:');
            if (allUsers.length > 0) {
                allUsers[0].values.forEach(row => console.log(` - ${row[0]}`));
            }
        }
        console.log('------------------');
    } catch (err) {
        console.error('Diagnostic error:', err.message);
    }
})();
