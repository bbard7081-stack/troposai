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
        if (res.length > 0 && res[0].values.length > 0) {
            const user = res[0].values[0];
        } else {
            const allUsers = db.exec('SELECT email FROM users LIMIT 5');
            if (allUsers.length > 0) {
            }
        }
    } catch (err) {
        console.error('Diagnostic error:', err.message);
    }
})();
