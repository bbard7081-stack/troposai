import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crm_data.db');

const RAW_DATA = `
Avigdor Grunfeld	izzygrunfeld@gmail.com
Barry Perlstein	bp17184198702@gmail.com
Chany Kritzler	chanyk540@gmail.com
Chaya Tziry Einhorn	chaya5611@gmail.com
Devoiry Greenfeld	allyouneed10952@gmail.com
Elimelech Moster	1elimmoster@gmail.com
Esther Taub	taubesther@gmail.com
Eva Friedman	ifriedman5353@gmail.com
Fraidy Silberstein	fraidy@simchatalent.org
Goldy Green	namedinagoldy@gmail.com
Hindy Greenfeld	hindy@simchatalent.org
Joel Greenfeld	joegreen104@gmail.com
Judy Freund	yidesfreund10@gmail.com
Malky Silberstien	malky1734@gmail.com
Markowitz Esther	esty@lilfeatherz.com
Miriam Greenfeld	miriam@simchatalent.org
Moshe Kritzler	mokri6557@gmail.com
Naftule Markowitz	naftule@lifeatherz.com
Sarah Menczer	sarahmendlowitz@gmail.com
Shaindy Biederman	shaindy6752@gmail.com
Shay Lieberman	shaylieberman@gmail.com
sheindel Goldberger	shaindy605@gmail.com
Yehuda Mittelman	yiddyrfk@gmail.com
Yehuda Greenfeld	info@simchatalent.org
Yenty Greenfeld	yentygreen@gmail.com
Yida Leib Einhorn	yle347@gmail.com
Yides Markowitz	accounting@lilfeatherz.com
Yocheved Fisher	yochevedfisher1804@gmail.com
Surie Bikel suriebikel@gmail.com
Baila Bard	bbard7081@gmail.com
`;

// Override rules from user request
const EMAIL_OVERRIDES = {
    'malky1734@gmail.com': 'malky@simchatalent.org'
};

async function importUsers() {
    const SQL = await initSqlJs();
    const data = fs.readFileSync(dbPath);
    const db = new SQL.Database(data);

    const lines = RAW_DATA.trim().split('\n');
    let addedCount = 0;
    let skippedCount = 0;


    db.run("BEGIN TRANSACTION");

    const stmt = db.prepare("INSERT INTO users (id, name, email, role, status) VALUES (?, ?, ?, ?, ?)");
    const checkStmt = db.prepare("SELECT count(*) as count FROM users WHERE email = ?");

    for (const line of lines) {
        let [name, email] = line.split(/\t|\s{2,}/); // Split by tab or multiple spaces

        // Handle last line which might be space separated
        if (!email && line.includes(' ')) {
            const parts = line.trim().split(' ');
            email = parts.pop();
            name = parts.join(' ');
        }

        if (!name || !email) {
            continue;
        }

        name = name.trim();
        email = email.trim();

        // Apply overrides
        if (EMAIL_OVERRIDES[email]) {
            email = EMAIL_OVERRIDES[email];
        }

        // Check if exists
        const result = checkStmt.get([email]);
        if (result.count > 0) {
            skippedCount++;
            continue;
        }

        try {
            const id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            stmt.run([id, name, email, 'USER', 'ACTIVE']);
            addedCount++;
        } catch (e) {
            console.error(`❌ Failed to add ${name} (${email}): ${e.message}`);
        }
    }

    db.run("COMMIT");

    // Save
    const binaryArray = db.export();
    fs.writeFileSync(dbPath, Buffer.from(binaryArray));

}

importUsers().catch(console.error);
