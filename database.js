import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'crm_data.db');
let db = null;

// Initialize database
export async function initializeDatabase() {
  /* Fix for WASM path in both Prod (Docker) and Local Dev */
  const SQL = await initSqlJs({
    locateFile: file => {
      // 1. Try Production Path (Docker/Build)
      const distPath = path.join(__dirname, 'dist', file);
      if (fs.existsSync(distPath)) return distPath;

      // 2. Try Local Development Path (node_modules)
      const devPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', file);
      if (fs.existsSync(devPath)) return devPath;

      console.warn(`⚠️ Could not find ${file} in dist or node_modules. Using default path.`);
      return file;
    }
  });

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // --- FORCE MIGRATION: Ensure users table has correct columns without dropping data ---
  // The users table columns are handled by the CREATE TABLE IF NOT EXISTS below.

  // --- MULTI-TENANT ARCHITECTURE: Tenants Table ---
  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      rc_config TEXT, -- JSON configuration for tenant-specific RC settings
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // --- CORE TABLES WITH TENANT ISOLATION ---
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT,
      team TEXT,
      status TEXT,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      extensionNumber TEXT,
      ringCentralEmail TEXT,
      lastSynced TEXT,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      name TEXT,
      dob TEXT,
      phone TEXT,
      level TEXT,
      qualified_for TEXT,
      approved TEXT,
      address TEXT,
      city TEXT,
      household_size INTEGER,
      assigned_to TEXT,
      crm_status TEXT,
      date_outreached TEXT,
      date_screened TEXT,
      household_members TEXT,
      missed_call INTEGER DEFAULT 0,
      declined_call INTEGER DEFAULT 0,
      answered_by TEXT,
      cell_history TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  // --- MIGRATION: Add tenant_id to existing tables if missing ---
  const tables = ['users', 'contacts', 'reports', 'automations', 'messages', 'call_logs'];
  tables.forEach(table => {
    try { db.run(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT DEFAULT 'shimchatalent'`); } catch (e) { }
  });

  // --- MIGRATION: Add answered_by column to contacts if missing ---
  try { db.run(`ALTER TABLE contacts ADD COLUMN answered_by TEXT`); } catch (e) { }

  // --- MIGRATION: Add new strict columns if missing ---
  try { db.run(`ALTER TABLE contacts ADD COLUMN household_size INTEGER DEFAULT 1`); } catch (e) { }
  try { db.run(`ALTER TABLE contacts ADD COLUMN household_members TEXT`); } catch (e) { }
  try { db.run(`ALTER TABLE contacts ADD COLUMN date_outreached TEXT`); } catch (e) { }
  try { db.run(`ALTER TABLE contacts ADD COLUMN date_screened TEXT`); } catch (e) { }
  try { db.run(`ALTER TABLE contacts ADD COLUMN approved TEXT DEFAULT 'Pending'`); } catch (e) { }

  // Ensure default tenant exists
  db.run(`
    INSERT OR IGNORE INTO tenants (id, name, slug, status)
    VALUES ('simchatalent', 'Tropos Main', 'simchatalent', 'ACTIVE')
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      name TEXT NOT NULL,
      filters TEXT,
      column_order TEXT,
      created_by TEXT NOT NULL,
      shared_with TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      trigger_column_id TEXT,
      trigger_value TEXT,
      action_type TEXT NOT NULL,
      action_column_id TEXT,
      action_value TEXT,
      action_user_email TEXT,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      sender_email TEXT NOT NULL,
      receiver_email TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      type TEXT DEFAULT 'SMS',
      media_url TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS call_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      contact_id TEXT,
      user_id TEXT,
      direction TEXT,
      duration INTEGER,
      status TEXT,
      disposition TEXT,
      recording_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      contact_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'Billable', 'Assessment', 'Service'
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'VOIDED'
      date TEXT NOT NULL,
      data TEXT, -- JSON payload for flexibility
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      correction_of_id TEXT, -- ID of the unit this replaces
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sms_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      contact_id TEXT,
      user_id TEXT,
      direction TEXT, -- 'INBOUND', 'OUTBOUND'
      body TEXT,
      status TEXT, -- 'sent', 'delivered', 'failed'
      from_number TEXT,
      to_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS voicemail_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'shimchatalent',
      contact_id TEXT,
      user_id TEXT,
      duration INTEGER, -- seconds
      audio_url TEXT,
      transcript TEXT,
      from_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(tenant_id) REFERENCES tenants(id),
      FOREIGN KEY(contact_id) REFERENCES contacts(id)
    )
  `);

  // Admin Settings table for global system configuration
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Backups table for backup history tracking (Global)
  db.run(`
    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      size_bytes INTEGER,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);




  // Seed initial data if database is new
  await seedInitialData();

  // Save database to file
  saveDatabase();
}

// Save database to file
export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Seed initial data
async function seedInitialData() {
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const userCount = result[0]?.values[0]?.[0] || 0;

  if (userCount === 0) {

    // Insert users
    const users = [
      { id: '1', name: 'Admin User', email: 'admin@sheetsync.com', role: 'ADMIN', team: null, status: 'ACTIVE' },
      { id: '2', name: 'John Sales', email: 'john@sheetsync.com', role: 'USER', team: 'Sales', status: 'ACTIVE' },
      { id: '3', name: 'Sarah Account', email: 'sarah@sheetsync.com', role: 'USER', team: 'Customer Success', status: 'ACTIVE' },
      { id: '4', name: 'Mike Tech', email: 'mike@sheetsync.com', role: 'USER', team: 'Sales', status: 'ACTIVE' },
    ];

    // Add additional team members
    for (let i = 0; i < 26; i++) {
      users.push({
        id: String(i + 5),
        name: `Team Member ${i + 1}`,
        email: `user${i + 1}@sheetsync.com`,
        role: 'USER',
        team: i % 2 === 0 ? 'Sales' : 'Operations',
        status: 'ACTIVE'
      });
    }

    for (const user of users) {
      db.run(
        'INSERT INTO users (id, name, email, role, team, status) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, user.name, user.email, user.role, user.team, user.status]
      );
    }

    // Insert initial contacts
    const contacts = [];

    saveDatabase();
  } else {
  }
}

// Get database instance
export function getDatabase() {
  return db;
}

