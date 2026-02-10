import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import dotenv from 'dotenv';
import { initializeDatabase, getDatabase, saveDatabase } from './database.js';
import { SDK } from '@ringcentral/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ override: true });

const app = express();
// Default to Docker volume path if in production
const PORT = process.env.PORT || 3000;
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'crm_data.db');
const COMPANY_NUMBER = '+18459993721';

// RingCentral Setup
// RingCentral Manager for Robust Auth & Token Management
class RingCentralManager {
    constructor() {
        this.sdk = new SDK({
            server: (process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com').trim(),
            clientId: (process.env.VITE_RC_CLIENT_ID || '').trim(),
            clientSecret: (process.env.VITE_RC_CLIENT_SECRET || '').trim(),
        });
        this.platform = this.sdk.platform();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized && await this.platform.loggedIn()) return;

        console.log('🔑 [RC Manager] Authenticating...');
        try {
            await this.login();
            this.initialized = true;
            console.log('✅ [RC Manager] Authenticated successfully');
        } catch (error) {
            console.error('❌ [RC Manager] Auth failed:', error.message);
            throw error; // Let startup fail if critical
        }
    }

    async login() {
        const rcJwt = (process.env.VITE_RC_JWT || '').trim();
        if (!rcJwt) throw new Error('Missing VITE_RC_JWT');

        try {
            await this.platform.login({ jwt: rcJwt });
        } catch (e) {
            // Check for OAU-251 or other 400 errors that imply bad token
            if (e.message.includes('OAU-251') || e.response?.status === 400) {
                console.warn('⚠️ [RC Manager] Token invalid (400/OAU-251), attempting re-login...');
                // SDK handles JWT re-login, but if we were using refresh token flow manually we'd clear it here.
                // For JWT, we just try to login again essentially.
            }
            throw e;
        }
    }

    async ensureLoggedIn() {
        if (!await this.platform.loggedIn()) {
            console.log('🔄 [RC Manager] Session expired, re-authenticating...');
            await this.login();
        }
    }

    getPlatform() {
        return this.platform;
    }
}

const rcManager = new RingCentralManager();
const platform = rcManager.getPlatform(); // Backwards compatibility for now

// Server-Sent Events (SSE) Clients
const sseClients = new Set(); // { res, email }

// Staff Extension Mapping (User Attribution)
const STAFF_EXTENSIONS = {
    '63794860007': 'Hindy Greenfeld',
    '63794864007': 'Yenty Greenfeld',
    '62832939006': 'Yides Freund',
    '62833447006': 'Malky Silberstein',
    '62833448006': 'Yocheved Fischer',
    '62833449006': 'Fraidy Koenig',
    '63861926007': 'Baila Bard',
    '63862348007': 'Surie Bikel',
    '63862349007': 'Chavy lederman'
};

// Global Call State for Duration Tracking
const ACTIVE_CALLS = new Map(); // sessionId -> { startTime, contactId, userId, direction }
const USER_CALLS = new Map(); // email -> { phoneNumber, status, contactId }

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ==================== TENANT MIDDLEWARE ====================

// Helper to extract tenant slug from path or headers
const getTenantFromRequest = (req) => {
    // 1. Try to get from header (for API calls)
    const tenantSlug = req.headers['x-tenant-slug'];
    if (tenantSlug) return tenantSlug;

    // 2. Try to get from URL path (for SPA routes)
    const match = req.path.match(/^\/([^\/]+)/);
    if (match && !['api', 'assets', 'favicon.ico'].includes(match[1])) {
        return match[1];
    }

    // 3. Fallback to default
    return 'shimchatalent';
};

app.use(async (req, res, next) => {
    // Skip for non-api/non-spa routes
    if (req.path.startsWith('/assets') || req.path === '/favicon.ico') return next();

    const slug = getTenantFromRequest(req);
    const db = getDatabase();

    // Default values
    req.tenantId = 'shimchatalent';
    req.tenantName = 'Tropos Main';
    req.tenantSlug = 'shimchatalent';
    req.isSuperAdmin = false;

    // Check if the user is a super admin (this would normally be in a session/JWT)
    // For now, we'll check if a super flag is passed or if we are in super-admin path
    const userEmail = req.headers['x-user-email'];
    if (userEmail === 'admin@troposai.com') {
        req.isSuperAdmin = true;
    }

    try {
        const result = db.exec('SELECT id, name FROM tenants WHERE slug = ?', [slug]);
        if (result.length > 0 && result[0].values.length > 0) {
            req.tenantId = result[0].values[0][0];
            req.tenantName = result[0].values[0][1];
            req.tenantSlug = slug;
        } else if (slug === 'shimchatalent') {
            // Keep defaults
        } else if (req.path.startsWith('/api') && !req.path.startsWith('/api/admin')) {
            // If API call and tenant not found, return 404 (allow admin endpoints to handle their own check)
            return res.status(404).json({ error: 'Tenant not found' });
        }
    } catch (e) {
        // Fallback to shimchatalent
    }

    next();
});

// Admin Security Helper
const requireSuperAdmin = (req, res, next) => {
    if (!req.isSuperAdmin) {
        return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }
    next();
};

// ==================== AUTHENTICATION API ====================

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`🔐 Login attempt for: ${email}`);

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);

        if (!result.length || !result[0].values.length) {
            console.log(`❌ Login failed: User ${email} not found`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const columns = result[0].columns;
        const row = result[0].values[0];
        const user = {};
        columns.forEach((col, idx) => { user[col] = row[idx]; });

        // Simple password check (Equality for now, alignment with system migration)
        if (user.password && user.password !== password) {
            console.log(`❌ Login failed: Incorrect password for ${email}`);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Default password behavior if DB was just migrated but not seeded
        if (!user.password && password !== '123456') {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        console.log(`✅ Login successful: ${user.name} (${user.role})`);

        // Remove sensitive data
        delete user.password;

        res.json(user);
    } catch (error) {
        console.error('🧨 Login Error:', error);
        res.status(500).json({ error: 'Login service unavailable' });
    }
});

// ==================== RINGCENTRAL API (OUTBOUND) ====================

app.post('/api/ringout', async (req, res) => {
    console.log('📬 NEW RINGOUT REQUEST:', JSON.stringify(req.body));
    const { to, from, deviceType } = req.body;

    if (!to || !from) {
        console.error('❌ Missing numbers:', { to, from });
        return res.status(400).json({ error: 'Both "to" and "from" numbers are required' });
    }

    // Auto-format numbers: Strip non-digits and ensure +1 for US numbers
    const cleanNumber = (num) => {
        if (!num) return '';
        const digits = num.replace(/\D/g, '');
        console.log(`🧹 Cleaning number: ${num} -> ${digits}`);
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
        // If < 10 digits, it's likely a typo, but we'll try to add +1 to be safe if it's 9 digits
        if (digits.length === 9) return `+1${digits}`;
        return digits;
    };

    const formattedTo = cleanNumber(to);
    const formattedFrom = (deviceType === 'app' && from.length < 5) ? from : cleanNumber(from);

    console.log(`📱 Numbers Formatted: To=${formattedTo}, From=${formattedFrom}`);

    try {
        console.log('🔑 Authenticating with RingCentral via Fetch (Hardened)...');
        const rcClientId = (process.env.VITE_RC_CLIENT_ID || '').trim();
        const rcClientSecret = (process.env.VITE_RC_CLIENT_SECRET || '').trim();
        const rcJwt = (process.env.VITE_RC_JWT || '').trim();
        const rcServer = (process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com').trim();

        console.log(`   Client ID: ${rcClientId.substring(0, 5)}...`);

        const authHeader = Buffer.from(`${rcClientId}:${rcClientSecret}`).toString('base64');
        const tokenResp = await fetch(`${rcServer}/restapi/oauth/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion': rcJwt
            })
        });

        if (!tokenResp.ok) {
            const errText = await tokenResp.text();
            throw new Error(`RingCentral Auth Failed: ${tokenResp.status} - ${errText}`);
        }

        const tokenData = await tokenResp.json();
        platform.auth().setData(tokenData);
        console.log('✅ RC Sign-in Successful (Fetch Hardened)');

        console.log(`📞 PLACING RC RINGOUT CALL...`);
        console.log(`   FROM (Personal): ${formattedFrom}`);
        console.log(`   TO (Customer):   ${formattedTo}`);
        console.log(`   CALLER_ID:       ${COMPANY_NUMBER}`);

        const resp = await platform.post('/restapi/v1.0/account/~/extension/~/ring-out', {
            from: { phoneNumber: formattedFrom },
            to: { phoneNumber: formattedTo },
            callerId: { phoneNumber: '+18459993721' },
            playPrompt: true
        });

        const jsonObj = await resp.json();
        console.log('📦 RC API RESPONSE:', JSON.stringify(jsonObj, null, 2));

        if (resp.ok) {
            console.log('✨ RingOut Success:', jsonObj.id, 'Status:', jsonObj.status.callStatus);
            res.json({ status: jsonObj.status.callStatus, id: jsonObj.id });
        } else {
            console.error('❌ RC API Error Status:', resp.status);
            const errorMsg = jsonObj.errors?.[0]?.message || jsonObj.message || 'Unknown RC Error';
            console.error('❌ RC Error Details:', errorMsg);
            console.error('❌ RC API Full Error Response:', JSON.stringify(jsonObj, null, 2)); // Added logging
            res.status(resp.status).json({ error: 'RingCentral API error', details: errorMsg });
        }

    } catch (error) {
        console.error('🧨 CRITICAL RINGOUT EXCEPTION:', error.message);
        if (error.response) {
            try {
                const errData = await error.response.json();
                console.error('🧨 RC ERROR DATA:', JSON.stringify(errData, null, 2));
            } catch (e) { }
        }
        res.status(500).json({ error: 'Failed to place call', details: error.message });
    }
});

// Test endpoint to verify webhook connectivity externally
app.get('/api/webhook-test', (req, res) => {
    console.log('🧪 WEBHOOK TEST ENDPOINT HIT');
    res.json({ status: 'Webhook endpoint is reachable', time: new Date().toISOString() });
});

// ==================== RINGCENTRAL USER SYNC ====================

// Fetch all RingCentral users/extensions and save to database
app.get('/api/ringcentral/users', async (req, res) => {
    try {
        console.log('👥 Fetching RingCentral users...');

        // Ensure we're logged in
        const isLoggedIn = await platform.loggedIn();
        if (!isLoggedIn) {
            await platform.login({ jwt: process.env.VITE_RC_JWT });
        }

        // Fetch all extensions
        const response = await platform.get('/restapi/v1.0/account/~/extension', {
            perPage: 100,
            status: 'Enabled',
            type: 'User' // Only get actual user extensions, not departments/announcements
        });

        const data = await response.json();

        // Map to a simpler format
        const users = data.records.map(ext => ({
            id: String(ext.id),
            name: ext.name,
            email: ext.contact?.email || `${ext.name.toLowerCase().replace(/\s+/g, '.')}@company.com`,
            extensionNumber: ext.extensionNumber,
            status: ext.status || 'Enabled',
            role: 'USER'
        }));

        // Save users to database
        const db = getDatabase();

        // 🧹 CLEANUP: Remove placeholder users once real ones are found
        if (users.length > 0) {
            console.log('🧹 Cleaning up placeholder data...');
            // First, remove the strict check if it exists (by recreating the table if needed)
            // But we already updated database.js, so initializeDatabase should have handled it.
            db.run("DELETE FROM users WHERE email LIKE '%@sheetsync.com'");
            db.run("UPDATE contacts SET assigned_to = 'Unassigned' WHERE assigned_to LIKE '%@sheetsync.com'");
        }

        // Upsert each user
        const now = new Date().toISOString();
        users.forEach(user => {
            try {
                const existing = db.exec('SELECT password FROM users WHERE id = ?', [user.id]);
                if (existing.length > 0 && existing[0].values.length > 0) {
                    db.run(`UPDATE users SET name = ?, email = ?, extensionNumber = ?, status = ?, lastSynced = ? WHERE id = ?`,
                        [user.name, user.email, user.extensionNumber, user.status, now, user.id]
                    );
                } else {
                    db.run(`INSERT INTO users (id, tenant_id, name, email, role, team, status, extensionNumber, lastSynced) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [user.id, req.tenantId, user.name, user.email, user.role, 'Staff', user.status, user.extensionNumber, now]
                    );
                }
            } catch (err) {
                console.error(`❌ Failed to sync user ${user.name}:`, err.message);
            }
        });

        saveDatabase();

        console.log(`✅ Synced ${users.length} RingCentral users for tenant ${req.tenantName}`);
        res.json({ users, staffExtensions: STAFF_EXTENSIONS });
    } catch (error) {
        console.error('❌ Failed to fetch RingCentral users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});
// ==================== TELEPHONY & WEBHOOKS ====================

async function processTelephonyEvent(body) {
    if (!body.event || !body.event.includes('telephony/sessions')) return;

    const sessionId = body.body?.telephonySessionId;
    const eventType = body.body?.parties?.[0]?.status?.code;
    const parties = body.body?.parties || [];

    if (body.body?.origin?.type === 'RingOut') return;

    console.log(`📡 [Telephony] Session ${sessionId} Status: ${eventType}`);

    const filteredParties = parties.filter(p => p.from?.phoneNumber !== COMPANY_NUMBER);
    const caller = filteredParties.find(p => p.direction === 'Inbound' && (!p.extensionId || !STAFF_EXTENSIONS[p.extensionId]));
    const staffParties = parties.filter(p => p.extensionId || p.owner?.extensionId);

    if (caller && caller.from) {
        const phoneNumber = caller.from.phoneNumber;
        const callStatus = caller.status?.code;

        // AUTHORED PIPELINE INGESTION
        const payload = {
            name: (caller.from.name && !caller.from.name.toLowerCase().includes('wireless')) ? caller.from.name : 'Unknown Caller',
            phone: phoneNumber,
            city: caller.from.location || '',
            crm_status: callStatus || 'New'
        };

        try {
            const result = await IngestionPipeline.ingest(payload, 'Voice', 'SYSTEM');
            const contactId = result.id;

            // Update USER_CALLS for all involved staff
            staffParties.forEach(staffParty => {
                const extId = staffParty.extensionId || staffParty.owner?.extensionId;
                const staff = queryOne('SELECT email FROM users WHERE id = ? OR extensionNumber = ?', [String(extId), String(extId)]);
                const email = staff?.[0] || STAFF_EXTENSIONS[extId];
                if (email) {
                    const callData = { phoneNumber, status: callStatus, contactId };
                    USER_CALLS.set(email, callData);
                    broadcastToUser(email, { type: 'call-update', data: callData });
                }
            });
        } catch (error) {
            console.error('❌ Telephony Ingestion Failed:', error.message);
        }
    }

    // --- CALL LOGGING ---
    if (eventType === 'Answered') {
        if (!ACTIVE_CALLS.has(sessionId)) {
            ACTIVE_CALLS.set(sessionId, {
                startTime: Date.now(),
                direction: parties[0]?.direction || 'Inbound',
                contactPhone: caller?.from?.phoneNumber || parties.find(p => p.direction === 'Inbound')?.from?.phoneNumber
            });
        }
    } else if (eventType === 'Disconnected') {
        const callInfo = ACTIVE_CALLS.get(sessionId);
        if (callInfo && callInfo.startTime) {
            const duration = Math.round((Date.now() - callInfo.startTime) / 1000);
            const phone = (callInfo.contactPhone || '').replace(/\D/g, '');
            const searchingDigits = phone.length === 11 && phone.startsWith('1') ? phone.substring(1) : phone;
            const contact = queryOne('SELECT id FROM contacts WHERE phone LIKE ?', [`%${searchingDigits}`]);
            const extId = staffInvolved?.extensionId || staffInvolved?.owner?.extensionId;
            const staff = queryOne('SELECT email FROM users WHERE id = ? OR extensionNumber = ?', [String(extId), String(extId)]);

            getDatabase().run(
                'INSERT INTO call_logs (id, contact_id, user_id, direction, duration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [`call_${Date.now()}`, contact?.[0] || null, staff?.[0] || 'System', callInfo.direction, duration, 'Completed', new Date().toISOString()]
            );
            saveDatabase();
            if (staff?.[0]) {
                const callData = { phoneNumber: phone, status: 'Disconnected', contactId: contact?.[0] };
                USER_CALLS.set(staff[0], callData);
                broadcastToUser(staff[0], { type: 'call-update', data: callData });
            }
            ACTIVE_CALLS.delete(sessionId);
        }
    }
}

// SSE Helper
function broadcastToUser(email, payload) {
    sseClients.forEach(client => {
        if (client.email === email) {
            client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
    });
}

app.get('/api/webhooks/ringcentral', (req, res) => res.json({ status: 'active' }));
app.post('/api/webhooks/ringcentral', async (req, res) => {
    const validationToken = req.headers['validation-token'];
    if (validationToken) {
        res.setHeader('validation-token', validationToken);
        return res.status(200).send();
    }
    res.status(200).send('OK');
    try { await processTelephonyEvent(req.body); } catch (e) { console.error('Webhook Error:', e); }
});

// ==================== USERS & LOGS API ====================

app.get('/api/users', (req, res) => {
    try {
        const db = getDatabase();
        // Super Admin Bypass: admin@troposai.com can see all users across tenants
        const isSuperAdmin = req.query.super === 'true';

        let result;
        if (isSuperAdmin) {
            result = db.exec('SELECT id, name, email, role, team, status, extensionNumber, password, tenant_id FROM users ORDER BY name ASC');
        } else {
            result = db.exec('SELECT id, name, email, role, team, status, extensionNumber, password FROM users WHERE tenant_id = ? ORDER BY name ASC', [req.tenantId]);
        }

        if (!result.length || !result[0].values.length) return res.json([]);
        const columns = result[0].columns;
        res.json(result[0].values.map(row => {
            const user = {};
            columns.forEach((col, idx) => { user[col] = row[idx]; });
            return user;
        }));
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/telephony/logs', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM call_logs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50', [req.tenantId]);
        if (!result.length || !result[0].values.length) return res.json([]);
        const columns = result[0].columns;
        res.json(result[0].values.map(row => {
            const log = {};
            columns.forEach((col, idx) => { log[col] = row[idx]; });
            return log;
        }));
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.patch('/api/telephony/logs/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { notes, disposition } = req.body;
        const updates = [];
        const values = [];
        if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
        if (disposition !== undefined) { updates.push('disposition = ?'); values.push(disposition); }
        if (updates.length) {
            values.push(id);
            getDatabase().run(`UPDATE call_logs SET ${updates.join(', ')} WHERE id = ?`, values);
            saveDatabase();
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const db = getDatabase();
        const fields = [];
        const values = [];
        if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
        if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
        if (updates.role !== undefined) { fields.push('role = ?'); values.push(updates.role); }
        if (updates.team !== undefined) { fields.push('team = ?'); values.push(updates.team); }
        if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
        if (updates.password !== undefined) { fields.push('password = ?'); values.push(updates.password); }
        if (fields.length === 0) return res.status(400).json({ error: 'No fields' });
        values.push(id);
        db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
        saveDatabase();
        res.json({ message: 'User updated', id });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// ==================== DATABASE ====================
// Helper to execute query and return results
function query(sql, params = []) {
    const db = getDatabase();
    const result = db.exec(sql, params);
    return result[0]?.values || [];
}

// Helper to execute a single row query
function queryOne(sql, params = []) {
    const results = query(sql, params);
    return results[0] || null;
}

// ==================== CONTACTS API ====================

// Get all contacts
app.get('/api/contacts', (req, res) => {
    try {
        const { search } = req.query;
        const db = getDatabase();
        let sql;
        let params;

        if (search) {
            sql = `
                SELECT * FROM contacts 
                WHERE tenant_id = ? AND (name LIKE ? OR phone LIKE ? OR city LIKE ? OR address LIKE ?)
                ORDER BY created_at DESC
            `;
            params = [req.tenantId, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`];
        } else {
            sql = 'SELECT * FROM contacts WHERE tenant_id = ? ORDER BY created_at DESC';
            params = [req.tenantId];
        }

        const queryResult = db.exec(sql, params);
        const columns = queryResult[0]?.columns || [];
        const values = queryResult[0]?.values || [];

        const contacts = values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => { obj[col] = row[idx]; });
            return mapContact(obj);
        });
        res.json(contacts);
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

function mapContact(obj) {
    return {
        id: obj.id,
        name: obj.name,
        dob: obj.dob,
        phone: obj.phone,
        level: obj.level,
        qualifiedFor: obj.qualified_for ? JSON.parse(obj.qualified_for) : [],
        approved: obj.approved,
        address: obj.address,
        city: obj.city,
        householdSize: obj.household_size,
        assignedTo: obj.assigned_to,
        dateOutreached: obj.date_outreached,
        dateScreened: obj.date_screened,
        householdMembers: obj.household_members,
        missedCall: Boolean(obj.missed_call),
        declinedCall: Boolean(obj.declined_call),
        cellHistory: obj.cell_history ? JSON.parse(obj.cell_history) : {}
    };
}

// ==================== AUTHORITATIVE INGESTION PIPELINE V2 (THE SPINE) ====================

const IngestionPipeline = {
    /**
     * Authoritative record creation lifecycle (8 steps)
     */
    async ingest(payload, source = 'API', actorId = 'SYSTEM', tenantId = 'shimchatalent') {
        console.log(`📡 [PIPELINE][STEP 1] Intake Gateway: Received from ${source}`);
        const intakeId = `intake_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        try {
            // STEP 1: Intake Gateway
            this.logIntake({ id: intakeId, tenantId, source, raw_payload: JSON.stringify(payload) });

            // STEP 2: Canonical Normalization
            const normalized = this.normalize(payload, source);
            console.log(`🧹 [PIPELINE][STEP 2] Normalized: ${normalized.name} (${normalized.phone})`);

            // STEP 3: Identity Resolution (De-duplication)
            const identityMatch = this.resolveIdentity(normalized, tenantId);
            if (identityMatch.status === 'MATCH_FOUND') {
                console.warn(`🤝 [PIPELINE][STEP 3] Identity Match Found: ${identityMatch.record.id}`);
                // Policy Decision (Default: ATTACH Activity or REJECT)
                return this.handleDuplicate(identityMatch.record, normalized, source, actorId);
            }

            // STEP 4: Policy Application
            const policyEnriched = this.applyPolicies(normalized, tenantId, source);

            // STEP 5: Validation Gate
            this.validateGate(policyEnriched);

            // STEP 6: Record Creation (Atomic)
            const contactId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            const finalRecord = { ...policyEnriched, id: contactId, tenant_id: tenantId };
            this.persistRecord(finalRecord);

            // STEP 7: Activity Genesis
            this.logActivity({
                id: `act_${Date.now()}`,
                contact_id: contactId,
                tenant_id: tenantId,
                type: 'CREATED',
                actor_id: actorId,
                content: `Record created via ${source}`,
                metadata: JSON.stringify({ intake_id: intakeId, source_detail: source })
            });

            // STEP 8: Event Emission
            this.emitEvent('record.created', finalRecord);

            this.updateIntakeStatus(intakeId, 'PROCESSED');
            return { status: 'CREATED', id: contactId, record: finalRecord };

        } catch (error) {
            console.error(`❌ [PIPELINE][FAILED] ${error.message}`);
            this.updateIntakeStatus(intakeId, 'FAILED', error.message);
            throw error;
        }
    },

    normalize(data, source) {
        const phone = (data.phone || '').replace(/\D/g, '');
        const canonicalPhone = phone.length === 10 ? `1${phone}` : phone;

        return {
            ...data,
            name: (data.name || 'Unknown').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
            phone: canonicalPhone,
            email: (data.email || '').toLowerCase().trim(),
            source: source,
            qualified_for: JSON.stringify(data.qualifiedFor || []),
            cell_history: JSON.stringify({ [source]: [{ time: new Date().toISOString(), type: 'PIPELINE_INIT' }] })
        };
    },

    resolveIdentity(normalized, tenantId) {
        const db = getDatabase();
        if (normalized.email) {
            const match = this.queryOne('SELECT * FROM contacts WHERE tenant_id = ? AND LOWER(email) = LOWER(?)', [tenantId, normalized.email]);
            if (match) return { status: 'MATCH_FOUND', record: match };
        }
        if (normalized.phone) {
            const match = this.queryOne('SELECT * FROM contacts WHERE tenant_id = ? AND phone = ?', [tenantId, normalized.phone]);
            if (match) return { status: 'MATCH_FOUND', record: match };
        }
        return { status: 'NEW' };
    },

    handleDuplicate(existing, normalized, source, actorId) {
        this.logActivity({
            id: `act_dup_${Date.now()}`,
            contact_id: existing.id,
            tenant_id: existing.tenant_id,
            type: 'DUPLICATE_INTAKE',
            actor_id: actorId,
            content: `Duplicate intake detected from ${source}. Data attached to timeline.`,
            metadata: JSON.stringify({ intake_data: normalized })
        });
        return { status: 'DUPLICATE', id: existing.id, record: existing, message: 'Existing record found. Activity attached.' };
    },

    applyPolicies(data, tenantId, source) {
        return {
            ...data,
            crm_status: data.crm_status || 'New',
            assigned_to: data.assigned_to || 'Unassigned',
            created_at: new Date().toISOString()
        };
    },

    validateGate(data) {
        if (!data.name || data.name === 'Unknown') throw new Error('Validation Failed: Canonical Name is required.');
        if (!data.phone && !data.email) throw new Error('Validation Failed: Must have Phone or Email.');
    },
    persistRecord(record) {
        const db = getDatabase();
        db.run(
            `INSERT INTO contacts (
                id, tenant_id, name, dob, phone, email, level, qualified_for, address, city,
                household_size, assigned_to, household_members, crm_status, cell_history, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record.id, record.tenant_id, record.name, record.dob || '', record.phone, record.email || '',
                record.level || 'Level 1', record.qualified_for, record.address || '', record.city || '',
                record.household_size || 0, record.assigned_to, record.household_members || '',
                record.crm_status, record.cell_history, record.created_at
            ]
        );
        saveDatabase();
    },

    logActivity(activity) {
        const db = getDatabase();
        db.run(
            'INSERT INTO activities (id, contact_id, tenant_id, type, actor_id, content, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [activity.id, activity.contact_id, activity.tenant_id, activity.type, activity.actor_id, activity.content, activity.metadata]
        );
        saveDatabase();
    },

    emitEvent(name, data) {
        console.log(`📢 [EVENT] ${name}: ${data.id}`);
    },

    queryOne(sql, params) {
        const db = getDatabase();
        const result = db.exec(sql, params);
        if (result.length > 0 && result[0].values.length > 0) {
            const row = result[0].values[0];
            const cols = result[0].columns;
            const obj = {};
            cols.forEach((c, i) => obj[c] = row[i]);
            return obj;
        }
        return null;
    },

    logIntake(data) {
        getDatabase().run(
            'INSERT INTO intake_log (id, tenant_id, source, raw_payload) VALUES (?, ?, ?, ?)',
            [data.id, data.tenant_id, data.source, data.raw_payload]
        );
    },

    updateIntakeStatus(id, status, error = null) {
        getDatabase().run('UPDATE intake_log SET status = ?, error_message = ? WHERE id = ?', [status, error, id]);
        saveDatabase();
    }
};

// Create contact (Redirected through Pipeline)
app.post('/api/contacts', async (req, res) => {
    try {
        const source = req.headers['x-source'] || 'UI';
        const agentId = req.headers['x-user-email'] || 'System';

        const result = await IngestionPipeline.ingest(req.body, source, agentId);

        if (result.status === 'DUPLICATE') {
            return res.status(409).json({
                error: 'Duplicate record found',
                id: result.id,
                message: 'A record with this phone or email already exists.'
            });
        }

        res.status(201).json(result.record);
    } catch (error) {
        console.error('❌ Pipeline Ingestion Failed:', error.message);
        res.status(500).json({ error: 'Ingestion Pipeline Error', details: error.message });
    }
});

// Update contact
app.put('/api/contacts/:id', (req, res) => {
    try {
        const contact = req.body;
        const db = getDatabase();

        db.run(
            `UPDATE contacts SET
        name = ?, dob = ?, phone = ?, level = ?, qualified_for = ?, approved = ?,
        address = ?, city = ?, household_size = ?, assigned_to = ?,
        date_outreached = ?, date_screened = ?, household_members = ?,
        missed_call = ?, declined_call = ?, cell_history = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
            [
                contact.name || '',
                contact.dob || '',
                contact.phone || '',
                contact.level || '',
                JSON.stringify(contact.qualifiedFor || []),
                contact.approved || '',
                contact.address || '',
                contact.city || '',
                contact.householdSize || 0,
                contact.assignedTo || '',
                contact.dateOutreached || '',
                contact.dateScreened || '',
                contact.householdMembers || '',
                contact.missedCall ? 1 : 0,
                contact.declinedCall ? 1 : 0,
                JSON.stringify(contact.cellHistory || {}),
                req.params.id
            ]
        );

        saveDatabase();
        res.json({ message: 'Contact updated' });
    } catch (error) {
        console.error('Error updating contact:', error);
        res.status(500).json({ error: 'Failed to update contact' });
    }
});

// Delete contact
app.delete('/api/contacts/:id', (req, res) => {
    try {
        const db = getDatabase();
        db.run('DELETE FROM contacts WHERE id = ?', [req.params.id]);
        saveDatabase();
        res.json({ message: 'Contact deleted' });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ error: 'Failed to delete contact' });
    }
});

// ==================== USERS API ====================

// Get all users
// [Duplicate /api/users removed]

// Create user
app.post('/api/users', (req, res) => {
    try {
        const user = req.body;
        const db = getDatabase();

        db.run(
            'INSERT INTO users (id, tenant_id, name, email, role, team, status, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user.id, req.tenantId, user.name, user.email, user.role, user.team || null, user.status, user.password || null]
        );

        saveDatabase();
        res.status(201).json({ message: 'User created', id: user.id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
app.put('/api/users/:id', (req, res) => {
    try {
        const user = req.body;
        const db = getDatabase();

        db.run(
            'UPDATE users SET name = ?, email = ?, role = ?, team = ?, status = ?, password = ? WHERE id = ?',
            [user.name, user.email, user.role, user.team || null, user.status, user.password || null, req.params.id]
        );

        saveDatabase();
        res.json({ message: 'User updated' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// ==================== REPORTS API ====================

// Get all reports
app.get('/api/reports', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM reports WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
        const columns = result[0]?.columns || [];
        const values = result[0]?.values || [];

        const reports = values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });

            return {
                id: obj.id,
                name: obj.name,
                filters: obj.filters ? JSON.parse(obj.filters) : [],
                columnOrder: obj.column_order ? JSON.parse(obj.column_order) : [],
                createdBy: obj.created_by,
                sharedWith: obj.shared_with ? JSON.parse(obj.shared_with) : []
            };
        });

        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

// Create report
app.post('/api/reports', (req, res) => {
    try {
        const report = req.body;
        const db = getDatabase();

        db.run(
            'INSERT INTO reports (id, tenant_id, name, filters, column_order, created_by, shared_with) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                report.id,
                req.tenantId,
                report.name,
                JSON.stringify(report.filters || []),
                JSON.stringify(report.columnOrder || []),
                report.createdBy,
                JSON.stringify(report.sharedWith || [])
            ]
        );

        saveDatabase();
        res.status(201).json({ message: 'Report created', id: report.id });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

// Delete report
app.delete('/api/reports/:id', (req, res) => {
    try {
        const db = getDatabase();
        db.run('DELETE FROM reports WHERE id = ?', [req.params.id]);
        saveDatabase();
        res.json({ message: 'Report deleted' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Failed to delete report' });
    }
});

// ==================== AUTOMATIONS API ====================

// Get all automations
app.get('/api/automations', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM automations WHERE tenant_id = ? ORDER BY created_at DESC', [req.tenantId]);
        const columns = result[0]?.columns || [];
        const values = result[0]?.values || [];

        const automations = values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });

            return {
                id: obj.id,
                name: obj.name,
                trigger: {
                    type: obj.trigger_type,
                    columnId: obj.trigger_column_id,
                    value: obj.trigger_value
                },
                action: {
                    type: obj.action_type,
                    columnId: obj.action_column_id,
                    value: obj.action_value,
                    userEmail: obj.action_user_email
                },
                enabled: Boolean(obj.enabled),
                createdAt: obj.created_at
            };
        });

        res.json(automations);
    } catch (error) {
        console.error('Error fetching automations:', error);
        res.status(500).json({ error: 'Failed to fetch automations' });
    }
});

// Create/Update automations (bulk)
app.post('/api/automations/bulk', (req, res) => {
    try {
        const automations = req.body;
        const db = getDatabase();

        // Clear existing
        db.run('DELETE FROM automations');

        // Insert new
        for (const auto of automations) {
            db.run(
                `INSERT INTO automations (
          id, tenant_id, name, trigger_type, trigger_column_id, trigger_value,
          action_type, action_column_id, action_value, action_user_email, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    auto.id,
                    req.tenantId,
                    auto.name,
                    auto.trigger.type,
                    auto.trigger.columnId || null,
                    auto.trigger.value || null,
                    auto.action.type,
                    auto.action.columnId || null,
                    auto.action.value || null,
                    auto.action.userEmail || null,
                    auto.enabled ? 1 : 0
                ]
            );
        }

        saveDatabase();
        res.json({ message: 'Automations saved' });
    } catch (error) {
        console.error('Error saving automations:', error);
        res.status(500).json({ error: 'Failed to save automations' });
    }
});

// ==================== ADMIN API ====================

app.get('/api/admin/system-status', (req, res) => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Disk (Mock or execute df -h)
        // For simplicity and speed in a node environment, we use placeholders or mock
        // but we'll structure it correctly.

        res.json({
            cpu: {
                load: os.loadavg()[0].toFixed(2),
                cores: os.cpus().length
            },
            memory: {
                percent: ((usedMem / totalMem) * 100).toFixed(1),
                used: `${(usedMem / 1024 / 1024 / 1024).toFixed(1)}GB`,
                total: `${(totalMem / 1024 / 1024 / 1024).toFixed(1)}GB`
            },
            disk: {
                percent: 45,
                used: '22GB',
                total: '50GB'
            },
            uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
            storage: 45
        });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

app.get('/api/admin/system-history', (req, res) => {
    // Return history in the format { history: [...] }
    const history = Array.from({ length: 20 }, (_, i) => ({
        time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString(),
        cpu: 10 + Math.random() * 30,
        memory: 40 + Math.random() * 20
    }));
    res.json({ history });
});

// ==================== ADMIN USAGE STATS ====================

app.get('/api/admin/usage-stats', (req, res) => {
    try {
        const db = getDatabase();

        // Get contact stats
        const contactResult = db.exec('SELECT COUNT(*) FROM contacts');
        const totalContacts = contactResult[0]?.values[0]?.[0] || 0;

        const activeLeadsResult = db.exec("SELECT COUNT(*) FROM contacts WHERE crm_status NOT IN ('Closed', 'Won', 'Lost') OR crm_status IS NULL");
        const activeLeads = activeLeadsResult[0]?.values[0]?.[0] || 0;

        const closedDealsResult = db.exec("SELECT COUNT(*) FROM contacts WHERE crm_status IN ('Closed', 'Won')");
        const closedDeals = closedDealsResult[0]?.values[0]?.[0] || 0;

        // Get user stats
        const userResult = db.exec('SELECT COUNT(*) FROM users');
        const totalUsers = userResult[0]?.values[0]?.[0] || 0;

        const activeUsersResult = db.exec("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE' OR status = 'Enabled'");
        const activeUsers = activeUsersResult[0]?.values[0]?.[0] || 0;

        // Get call log stats
        const callLogsResult = db.exec('SELECT COUNT(*) FROM call_logs');
        const totalCalls = callLogsResult[0]?.values[0]?.[0] || 0;

        const todayCallsResult = db.exec("SELECT COUNT(*) FROM call_logs WHERE DATE(created_at) = DATE('now')");
        const todayCalls = todayCallsResult[0]?.values[0]?.[0] || 0;

        // Get message stats
        const messagesResult = db.exec('SELECT COUNT(*) FROM messages');
        const totalMessages = messagesResult[0]?.values[0]?.[0] || 0;

        // Get database size
        let dbSize = 0;
        try {
            const stats = fs.statSync(DATABASE_PATH);
            dbSize = stats.size;
        } catch (e) {
            console.warn('Could not get database size:', e.message);
        }

        res.json({
            contacts: {
                total: totalContacts,
                activeLeads: activeLeads,
                closedDeals: closedDeals
            },
            users: {
                total: totalUsers,
                active: activeUsers
            },
            calls: {
                total: totalCalls,
                today: todayCalls
            },
            messages: {
                total: totalMessages
            },
            storage: {
                databaseBytes: dbSize,
                databaseMB: (dbSize / 1024 / 1024).toFixed(2)
            },
            uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`
        });
    } catch (error) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({ error: 'Failed to fetch usage stats' });
    }
});

// ==================== ADMIN BACKUPS ====================

const BACKUPS_DIR = path.join(__dirname, 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log('📁 Created backups directory');
}

// Get list of backups
app.get('/api/admin/backups', (req, res) => {
    try {
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.endsWith('.db'))
            .map(f => {
                const filePath = path.join(BACKUPS_DIR, f);
                const stats = fs.statSync(filePath);
                return {
                    filename: f,
                    size: stats.size,
                    sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                    createdAt: stats.mtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json({ backups: files });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// Create a new backup
app.post('/api/admin/backups', (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `crm_backup_${timestamp}.db`;
        const backupPath = path.join(BACKUPS_DIR, filename);

        // Save current database state first
        saveDatabase();

        // Copy database file to backup
        fs.copyFileSync(DATABASE_PATH, backupPath);

        const stats = fs.statSync(backupPath);

        // Log backup in database
        const db = getDatabase();
        db.run(
            'INSERT INTO backups (id, filename, size_bytes, created_by) VALUES (?, ?, ?, ?)',
            [`backup_${Date.now()}`, filename, stats.size, req.body.createdBy || 'System']
        );
        saveDatabase();

        console.log(`✅ Backup created: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        res.json({
            success: true,
            backup: {
                filename,
                size: stats.size,
                sizeMB: (stats.size / 1024 / 1024).toFixed(2),
                createdAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// ==================== TENANT PROVISIONING API ====================

app.get('/api/admin/tenants', requireSuperAdmin, (req, res) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT * FROM tenants ORDER BY created_at DESC');
        if (!result.length || !result[0].values.length) return res.json([]);
        const columns = result[0].columns;
        res.json(result[0].values.map(row => {
            const tenant = {};
            columns.forEach((col, idx) => { tenant[col] = row[idx]; });
            return tenant;
        }));
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/tenants', requireSuperAdmin, async (req, res) => {
    try {
        const { name, slug } = req.body;
        if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });

        const db = getDatabase();
        const id = `tenant_${Date.now()}`;

        db.run(
            'INSERT INTO tenants (id, name, slug, status) VALUES (?, ?, ?, ?)',
            [id, name, slug.toLowerCase(), 'ACTIVE']
        );
        saveDatabase();

        console.log(`🏢 New tenant provisioned: ${name} (${slug})`);
        res.status(201).json({ success: true, tenant: { id, name, slug } });
    } catch (error) {
        console.error('Error provisioning tenant:', error);
        res.status(500).json({ error: 'Failed to provision tenant' });
    }
});

// Download a backup
app.get('/api/admin/backups/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(BACKUPS_DIR, filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        res.download(backupPath, filename);
    } catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Failed to download backup' });
    }
});

// Delete a backup
app.delete('/api/admin/backups/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const backupPath = path.join(BACKUPS_DIR, filename);

        if (!fs.existsSync(backupPath)) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        fs.unlinkSync(backupPath);
        console.log(`🗑️ Backup deleted: ${filename}`);

        res.json({ success: true, message: 'Backup deleted' });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({ error: 'Failed to delete backup' });
    }
});

// ==================== ADMIN SETTINGS ====================

app.get('/api/admin/settings', (req, res) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT key, value FROM admin_settings');

        const settings = {};
        if (result[0]?.values) {
            result[0].values.forEach(([key, value]) => {
                try {
                    settings[key] = JSON.parse(value);
                } catch {
                    settings[key] = value;
                }
            });
        }

        // Return defaults if not set
        res.json({
            backupEnabled: settings.backupEnabled ?? true,
            backupSchedule: settings.backupSchedule ?? 'daily',
            backupRetentionDays: settings.backupRetentionDays ?? 7,
            maintenanceMode: settings.maintenanceMode ?? false,
            allowNewRegistrations: settings.allowNewRegistrations ?? true,
            ...settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/admin/settings', (req, res) => {
    try {
        const db = getDatabase();
        const settings = req.body;

        Object.entries(settings).forEach(([key, value]) => {
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
            db.run(
                'INSERT OR REPLACE INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
                [key, valueStr]
            );
        });

        saveDatabase();
        console.log('⚙️ Admin settings updated:', Object.keys(settings).join(', '));

        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ==================== AUTO BACKUP SCHEDULER ====================

// Run daily backup at startup and schedule for every 24 hours
const runScheduledBackup = () => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `crm_auto_backup_${timestamp}.db`;
        const backupPath = path.join(BACKUPS_DIR, filename);

        saveDatabase();
        fs.copyFileSync(DATABASE_PATH, backupPath);

        const stats = fs.statSync(backupPath);
        console.log(`🔄 Scheduled backup created: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

        // Clean up old backups (keep last 7 days)
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('crm_auto_backup_'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime }))
            .sort((a, b) => b.time.getTime() - a.time.getTime());

        files.slice(7).forEach(f => {
            fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
            console.log(`🧹 Old backup cleaned up: ${f.name}`);
        });
    } catch (error) {
        console.error('❌ Scheduled backup failed:', error.message);
    }
};

// Run backup on startup (after a short delay to let DB initialize)
setTimeout(() => {
    console.log('🔄 Running startup backup...');
    runScheduledBackup();
}, 5000);

// Schedule daily backups (every 24 hours)
setInterval(runScheduledBackup, 24 * 60 * 60 * 1000);


// --- ACTIVITIES API ---
app.get('/api/activities/:contactId', (req, res) => {
    const { contactId } = req.params;
    const tenantId = req.headers['x-tenant-slug'] || 'shimchatalent';

    try {
        const activities = queryAll('SELECT * FROM activities WHERE tenant_id = ? AND contact_id = ? ORDER BY id DESC LIMIT 10', [tenantId, contactId]);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- MESSAGES API ---

// Get messages
app.get('/api/messages', (req, res) => {
    try {
        const { sender, receiver } = req.query;
        const db = getDatabase();
        let sql;
        let params;

        if (sender && receiver) {
            sql = `
                SELECT * FROM messages
                WHERE tenant_id = ? AND ((sender_email = ? AND receiver_email = ?) OR (sender_email = ? AND receiver_email = ?))
                ORDER BY created_at ASC
            `;
            params = [req.tenantId, sender, receiver, receiver, sender];
        } else {
            sql = 'SELECT * FROM messages WHERE tenant_id = ? ORDER BY created_at ASC';
            params = [req.tenantId];
        }

        const result = db.exec(sql, params);
        const columns = result[0]?.columns || [];
        const values = result[0]?.values || [];

        const messages = values.map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
                obj[col] = row[idx];
            });
            return obj;
        });

        return res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// System Status Endpoint for Admin Monitoring
app.get('/api/admin/system-status', requireSuperAdmin, async (req, res) => {
    try {
        const cpuUsage = os.loadavg()[0]; // 1-minute load average
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Get disk usage using 'df' command
        let diskUsage = { total: 0, used: 0, percent: 0 };
        try {
            const { stdout } = await execAsync('df -h / --output=size,used,pcent | tail -n 1');
            const parts = stdout.trim().split(/\s+/);
            if (parts.length >= 3) {
                diskUsage = {
                    total: parts[0],
                    used: parts[1],
                    percent: parseInt(parts[2].replace('%', '')) || 0
                };
            }
        } catch (e) {
            console.warn('Could not get disk usage:', e.message);
        }

        res.json({
            cpu: {
                load: cpuUsage.toFixed(2),
                cores: os.cpus().length
            },
            memory: {
                total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
                percent: ((usedMem / totalMem) * 100).toFixed(1)
            },
            disk: diskUsage,
            uptime: (os.uptime() / 3600).toFixed(1) + ' hours'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch system status' });
    }
});

// ==================== SYSTEM HISTORY TRACKING ====================

// Store system metrics history (in-memory, last 24 hours)
const systemHistory = [];
const MAX_HISTORY_POINTS = 24; // One point per hour for 24 hours

// Collect system metrics every hour
setInterval(async () => {
    try {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;

        const dataPoint = {
            timestamp: new Date().toISOString(),
            cpu: parseFloat(cpuUsage.toFixed(2)),
            memory: parseFloat(((usedMem / totalMem) * 100).toFixed(1))
        };

        systemHistory.push(dataPoint);

        // Keep only last 24 hours
        if (systemHistory.length > MAX_HISTORY_POINTS) {
            systemHistory.shift();
        }

        console.log(`📊 System metrics recorded: CPU ${dataPoint.cpu}%, RAM ${dataPoint.memory}%`);
    } catch (error) {
        console.error('Failed to record system metrics:', error.message);
    }
}, 60 * 60 * 1000); // Every hour

// Get system history for charts
app.get('/api/admin/system-history', requireSuperAdmin, (req, res) => {
    res.json({ history: systemHistory });
});

// Create message
app.post('/api/messages', (req, res) => {
    try {
        const message = req.body;
        const db = getDatabase();

        db.run(
            'INSERT INTO messages (id, tenant_id, sender_email, receiver_email, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [message.id, req.tenantId, message.senderEmail, message.receiverEmail, message.content, message.timestamp]
        );

        saveDatabase();
        res.status(201).json({ message: 'Message sent', id: message.id });
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    const db = getDatabase();
    let rowCount = 0;
    try {
        const result = db.exec('SELECT COUNT(*) FROM contacts');
        rowCount = result[0]?.values[0][0] || 0;
    } catch (e) { }

    res.json({
        status: 'ok',
        database: 'connected',
        rows: rowCount,
        env: {
            RC_CLIENT_ID: process.env.VITE_RC_CLIENT_ID ? `${process.env.VITE_RC_CLIENT_ID.substring(0, 5)}...` : 'MISSING',
            RC_SERVER: process.env.VITE_RC_SERVER_URL || 'MISSING',
            RC_JWT: process.env.VITE_RC_JWT ? 'PRESENT' : 'MISSING',
            NODE_ENV: process.env.NODE_ENV
        }
    });
});

// Diagnostic Logs (Buffer for last 100 lines of console)
const logBuffer = [];
const originalLog = console.log;
const originalError = console.error;
console.log = (...args) => {
    logBuffer.push(`[LOG] ${args.join(' ')}`);
    if (logBuffer.length > 200) logBuffer.shift();
    originalLog(...args);
};
console.error = (...args) => {
    logBuffer.push(`[ERR] ${args.join(' ')}`);
    if (logBuffer.length > 200) logBuffer.shift();
    originalError(...args);
};

app.get('/api/debug/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(logBuffer.join('\n'));
});

// ==================== RINGCENTRAL SIMULATOR API ====================

app.post('/api/debug/simulate-call', async (req, res) => {
    try {
        const { phoneNumber, status, direction = 'Inbound', name = 'Simulator Caller', sessionId: providedSessionId, targetExtension } = req.body;
        console.log(`🧪 [SIMULATOR] Simulating ${direction} Call from ${phoneNumber} (${status}) (Target: ${targetExtension || 'NONE'}) (Session: ${providedSessionId || 'NEW'})`);

        const sessionId = providedSessionId || `sim_${Date.now()}`;
        const parties = [
            {
                direction: direction,
                from: {
                    phoneNumber: phoneNumber,
                    name: name,
                    location: 'Simulator City'
                },
                status: {
                    code: status
                }
            }
        ];

        // If targetExtension is provided, add the staff party
        if (targetExtension) {
            parties.push({
                direction: direction === 'Inbound' ? 'Inbound' : 'Outbound',
                extensionId: targetExtension,
                status: {
                    code: status
                }
            });
        }

        const mockPayload = {
            event: '/restapi/v1.0/account/~/telephony/sessions',
            body: {
                telephonySessionId: sessionId,
                parties: parties
            }
        };

        // We use a small timeout to simulate async behavior of webhooks
        setTimeout(async () => {
            try {
                await processTelephonyEvent(mockPayload);
            } catch (e) {
                console.error('Simulator Webhook Error:', e);
            }
        }, 100);

        res.json({ success: true, sessionId, message: `Simulated ${status} for ${phoneNumber}` });
    } catch (e) {
        console.error('Simulator Error:', e);
        res.status(500).json({ error: 'Failed to simulate call' });
    }
});

app.post('/api/debug/simulate-sms', async (req, res) => {
    try {
        const { from, text } = req.body;
        console.log(`🧪 [SIMULATOR] Simulating SMS from ${from}: ${text}`);

        const db = getDatabase();
        const msgId = `msg_sim_${Date.now()}`;
        db.run(
            'INSERT INTO messages (id, tenant_id, sender_email, receiver_email, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
            [msgId, req.tenantId, from, 'simulator@troposai.com', text, new Date().toISOString()]
        );
        saveDatabase();

    } catch (e) {
        console.error('Simulator Error:', e);
        res.status(500).json({ error: 'Failed to simulate SMS' });
    }
});

app.get('/api/telephony/active-call', (req, res) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(400).json({ error: 'User email required' });

    // We filter by tenant as well if needed, but USER_CALLS is global in-memory for now
    const callData = USER_CALLS.get(userEmail);
    res.json(callData || null);
});

// SSE Endpoint
app.get('/api/telephony/events', (req, res) => {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).send('Email required');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const client = { res, email: userEmail };
    sseClients.add(client);

    console.log(`🔌 [SSE] Client connected: ${userEmail}`);

    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    req.on('close', () => {
        console.log(`🔌 [SSE] Client disconnected: ${userEmail}`);
        sseClients.delete(client);
    });
});

// Serve static files in production
const distPath = path.join(__dirname, 'dist');

// Middleware to disable caching for HTML files (prevents stale RingCentral config)
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/shimchatalent' || req.path === '/shimchatalent/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Serve Public Assets at Root
app.use(express.static(path.join(__dirname, 'public'), { etag: false, lastModified: false }));

// Serve React App under /shimchatalent
app.use('/shimchatalent', express.static(distPath, { etag: false, lastModified: false }));

// SPA Fallback for /shimchatalent routes
app.get('/shimchatalent/*', (req, res) => {
    try {
        const content = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
        res.send(content);
    } catch (err) {
        console.error('Error reading index.html:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Serve assets directly if requested with /assets prefix (fix for relative paths if any)
app.use('/assets', express.static(path.join(distPath, 'assets')));

// Initial page load logging
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        console.log(`[REQUEST] ${req.method} ${req.path}`);
    }
    next();
});

// ==================== EMAIL API ====================
app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;
        console.log(`📧 Email Request: to=${to}, subject=${subject}`);

        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey || apiKey === 're_123') {
            console.warn('⚠️ Resend API Key missing or default. Simulating email success.');
            return res.json({ message: 'Email simulated (RESEND_API_KEY not set)', preview: true });
        }

        // Using Resend API via fetch
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: 'Tropos Admin <onboarding@resend.dev>', // Default Resend test address
                to: [to],
                subject: subject,
                html: html,
                text: text || 'Welcome to Tropos'
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Email sent via Resend:', data.id);
            res.json({ message: 'Email sent successfully', id: data.id });
        } else {
            console.error('❌ Resend API Error:', data);
            res.status(response.status).json({ error: 'Resend API failed', details: data });
        }
    } catch (error) {
        console.error('❌ Email Failed:', error.message);
        res.status(500).json({ error: 'Failed to send email', details: error.message });
    }
});

// NEW: Serve Landing Page at root
app.get('/', (req, res) => {
    const landingPath = path.join(__dirname, 'public', 'landing.html');
    if (fs.existsSync(landingPath)) {
        res.sendFile(landingPath);
    } else {
        res.status(404).send('Landing page not found');
    }
});

// SPA catch-all
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    console.log(`[SPA] Serving index.html for path: ${req.path}`);

    // Check if file exists
    if (!fs.existsSync(indexPath)) {
        console.error(`[CRITICAL] index.html NOT FOUND at ${indexPath}`);
        return res.status(500).send('CRITICAL ERROR: index.html not found on server.');
    }

    res.sendFile(indexPath);
});


// Initialize database and start server
console.log('🏁 [STARTUP] Initializing system...');
try {
    await initializeDatabase();
    console.log('✅ [STARTUP] Database initialized');
} catch (err) {
    console.error('❌ [CRITICAL ERROR] Failed to initialize database:', err);
    // Continue anyway to allow health checks and diagnostics
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Server listening on 0.0.0.0:${PORT}`);
    console.log(`📊 Database Path: ${DATABASE_PATH}`);

    // AUTO-SYNC RINGCENTRAL USERS AT STARTUP (Non-blocking)
    const syncUsers = async () => {
        console.log('👥 [STARTUP] Syncing RingCentral users...');
        try {
            if (true) { // Always refresh on startup for safety
                await rcManager.initialize();
            }

            const response = await platform.get('/restapi/v1.0/account/~/extension', {
                perPage: 100,
                status: 'Enabled',
                type: 'User'
            });

            const data = await response.json();
            const users = data.records.map(ext => ({
                id: String(ext.id),
                name: ext.name,
                rcEmail: ext.contact?.email || `${ext.name.toLowerCase().replace(/\s+/g, '.')}@ringcentral.com`,
                extensionNumber: ext.extensionNumber,
                status: ext.status || 'Enabled',
                role: 'USER'
            }));

            const db = getDatabase();
            if (db) {
                const now = new Date().toISOString();
                users.forEach(user => {
                    try {
                        // 1. Try to find existing user by RingCentral ID
                        let existing = db.exec('SELECT id, name FROM users WHERE id = ?', [user.id]);

                        // 2. If not found by ID, try to find by Name (Fuzzy/Exact check)
                        if (existing.length === 0 || existing[0].values.length === 0) {
                            existing = db.exec('SELECT id, name FROM users WHERE LOWER(name) = LOWER(?)', [user.name]);
                        }

                        if (existing.length > 0 && existing[0].values.length > 0) {
                            const crmUserId = existing[0].values[0][0];
                            const crmUserName = existing[0].values[0][1];

                            console.log(`🔗 Matching RC User "${user.name}" to CRM User "${crmUserName}" (ID: ${crmUserId})`);

                            // Update existing CRM user with RC info
                            db.run(`UPDATE users SET
                                    extensionNumber = ?,
                                    ringCentralEmail = ?,
                                    status = ?,
                                    lastSynced = ?
                                    WHERE id = ?`,
                                [user.extensionNumber, user.rcEmail, user.status, now, crmUserId]
                            );
                        } else {
                            // 3. If still not found, create as new staff member
                            console.log(`🆕 Creating new CRM user for RC profile: ${user.name}`);
                            db.run(`INSERT INTO users (id, name, email, ringCentralEmail, role, team, status, extensionNumber, lastSynced)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [user.id, user.name, user.rcEmail, user.rcEmail, user.role, 'Staff', user.status, user.extensionNumber, now]
                            );
                        }
                    } catch (e) {
                        console.error(`Error syncing user ${user.name}:`, e.message);
                    }
                });

                saveDatabase();
                console.log(`✅ [STARTUP] Synced ${users.length} RingCentral users to database`);
            }
        } catch (error) {
            console.error('❌ [STARTUP] Failed to sync RC users:', error.message);
            if (error.response) {
                try {
                    const errData = await error.response.json();
                    console.error('❌ [STARTUP] RC ERROR DATA:', JSON.stringify(errData, null, 2));
                } catch (e) { }
            }
        }
    };

    syncUsers();
});

export default app;
