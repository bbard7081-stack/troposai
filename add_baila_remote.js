const initSqlJs = require('sql.js');
const fs = require('fs');
initSqlJs().then(SQL => {
    const data = fs.readFileSync('/app/data/crm_data.db');
    const db = new SQL.Database(data);
    db.run("INSERT OR IGNORE INTO users (id, name, email, role, status) VALUES (?, ?, ?, ?, ?)", ['u_manual_baila', 'Baila Bard', 'bbard7081@gmail.com', 'ADMIN', 'ACTIVE']);
    fs.writeFileSync('/app/data/crm_data.db', Buffer.from(db.export()));
}).catch(e => console.error(e));
