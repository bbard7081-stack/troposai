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

        try {
            await this.login();
            this.initialized = true;
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
            if (e.message.includes('OAU-251') || e.response?.status === 400) {
                console.error('\n💡 [RC Manager] AUTH TIP: Go to https://developer.ringcentral.com/');
                console.error('👉 Select your app, go to "Settings" -> "Credential Types"');
                console.error('👉 CHECK the box for "JWT Grant" and Save.\n');
            }
            throw e;
        }
    }

    async ensureLoggedIn() {
        if (!await this.platform.loggedIn()) {
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
const getStaffEmailByExtension = (extId) => {
    try {
        const db = getDatabase();
        const result = db.exec('SELECT email FROM users WHERE extensionNumber = ? OR id = ?', [extId, extId]);
        if (result.length > 0 && result[0].values.length > 0) {
            return result[0].values[0][0];
        }
    } catch (e) {
        console.error('Error looking up staff extension:', e.message);
    }
    return null;
};

// Removed hardcoded STAFF_EXTENSIONS mapping
const STAFF_EXTENSIONS = {}; // This object is now effectively deprecated and will be removed in future iterations

// Global Call State for Duration Tracking
const ACTIVE_CALLS = new Map(); // sessionId -> { startTime, contactId, userId, direction }
const USER_CALLS = new Map(); // email -> { phoneNumber, status, contactId }

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    const mem = process.memoryUsage();
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
    return 'simchatalent';
};

app.use(async (req, res, next) => {
    // Skip for non-api/non-spa routes
    if (req.path.startsWith('/assets') || req.path === '/favicon.ico') return next();

    const slug = getTenantFromRequest(req);
    const db = getDatabase();

    // Default values
    req.tenantId = 'simchatalent';
    req.tenantName = 'Tropos Main';
    req.tenantSlug = 'simchatalent';
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
        } else if (slug === 'simchatalent') {
            // Keep defaults
        } else if (req.path.startsWith('/api') && !req.path.startsWith('/api/admin')) {
            // If API call and tenant not found, return 404 (allow admin endpoints to handle their own check)
            return res.status(404).json({ error: 'Tenant not found' });
        }
    } catch (e) {
        // Fallback to simchatalent
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

// ==================== RINGCENTRAL API (OUTBOUND) ====================

app.post('/api/ringout', async (req, res) => {
    const { to, from, deviceType } = req.body;

    if (!to || !from) {
        console.error('❌ Missing numbers:', { to, from });
        return res.status(400).json({ error: 'Both "to" and "from" numbers are required' });
    }

    // Auto-format numbers: Strip non-digits and ensure +1 for US numbers
    const cleanNumber = (num) => {
        if (!num) return '';
        const digits = num.replace(/\D/g, '');
        if (digits.length === 10) return `+1${digits}`;
        if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
        // If < 10 digits, it's likely a typo, but we'll try to add +1 to be safe if it's 9 digits
        if (digits.length === 9) return `+1${digits}`;
        return digits;
    };

    const formattedTo = cleanNumber(to);
    const formattedFrom = (deviceType === 'app' && from.length < 5) ? from : cleanNumber(from);


    try {
        const rcClientId = (process.env.VITE_RC_CLIENT_ID || '').trim();
        const rcClientSecret = (process.env.VITE_RC_CLIENT_SECRET || '').trim();
        const rcJwt = (process.env.VITE_RC_JWT || '').trim();
        const rcServer = (process.env.VITE_RC_SERVER_URL || 'https://platform.ringcentral.com').trim();


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


        const resp = await platform.post('/restapi/v1.0/account/~/extension/~/ring-out', {
            from: { phoneNumber: formattedFrom },
            to: { phoneNumber: formattedTo },
            callerId: { phoneNumber: '+18459993721' },
            playPrompt: true
        });

        const jsonObj = await resp.json();

        if (resp.ok) {
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
    res.json({ status: 'Webhook endpoint is reachable', time: new Date().toISOString() });
});

// ==================== RINGCENTRAL USER SYNC ====================

// Fetch all RingCentral users/extensions and save to database
app.get('/api/ringcentral/users', async (req, res) => {
    try {

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

        res.json({ users, staffExtensions: STAFF_EXTENSIONS });
    } catch (error) {
        console.error('❌ Failed to fetch RingCentral users:', error.message);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});
// ==================== TELEPHONY & WEBHOOKS ====================

async function processTelephonyEvent(body, tenantId = 'simchatalent') {
    if (!body.event || !body.event.includes('telephony/sessions')) return;

    const sessionId = body.body?.telephonySessionId;
    const eventType = body.body?.parties?.[0]?.status?.code;
    const parties = body.body?.parties || [];

    if (body.body?.origin?.type === 'RingOut') return;


    const filteredParties = parties.filter(p => p.from?.phoneNumber !== COMPANY_NUMBER);
    const targetExtension = parties.find(p => p.extensionId)?.extensionId;
    const staffParties = parties.filter(p => p.extensionId || p.owner?.extensionId);

    // Extract caller from parties - this is the inbound caller
    const caller = filteredParties.find(p => p.direction === 'Inbound') || filteredParties[0];

    // Timestamp for logs
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateString = now.toLocaleDateString();
    const fullTimestamp = `${dateString} ${timeString}`;

    if (caller && caller.from) {
        const phoneNumber = caller.from.phoneNumber;
        const callStatus = caller.status?.code;

        const db = getDatabase();
        const rawDigits = phoneNumber.replace(/\D/g, '');
        const searchingDigits = rawDigits.length === 11 && rawDigits.startsWith('1') ? rawDigits.substring(1) : rawDigits;
        const existing = queryOne('SELECT id, interaction_logs, assigned_to FROM contacts WHERE phone LIKE ?', [`%${searchingDigits}`]);

        let contactId;

        // --- 1. DUPLICATE PREVENTION & CREATION ---
        if (!existing) {
            // Only create if we are 100% sure it's new
            contactId = `row_${Date.now()}`;
            db.run(
                'INSERT INTO contacts (id, tenant_id, name, phone, qualified_for, approved, assigned_to, level, city, crm_status, date_outreached, interaction_logs, last_call_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [contactId, tenantId, (caller.from.name && !caller.from.name.toLowerCase().includes('wireless')) ? caller.from.name : '', rawDigits, '[]', 'no', '', 'Level 1', caller.from.location || '', callStatus || 'New', new Date().toISOString().split('T')[0], '', new Date().toISOString()]
            );
        } else {
            contactId = existing[0];
            db.run('UPDATE contacts SET crm_status = ?, city = COALESCE(NULLIF(city, ""), ?), last_call_at = ? WHERE id = ?', [callStatus || 'Answered', caller.from.location || '', new Date().toISOString(), contactId]);
        }

        // --- 2. LOGGING & AUTO-ASSIGNMENT ---
        // Log event to interaction_logs
        if (eventType === 'Answered' || eventType === 'Disconnected' || eventType === 'Setup') {
            const statusLog = eventType === 'Answered' ? 'Answered' : (eventType === 'Disconnected' ? 'Call Ended' : 'Calling');
            const logEntry = `[${fullTimestamp}] ${statusLog} (${caller.direction || 'Inbound'})`;

            // Append to existing logs
            db.run('UPDATE contacts SET interaction_logs = COALESCE(interaction_logs, "") || ? || CHAR(10) WHERE id = ?', [logEntry, contactId]);
        }


        // Update USER_CALLS for all involved staff
        staffParties.forEach(staffParty => {
            const extId = staffParty.extensionId || staffParty.owner?.extensionId;
            const staff = queryOne('SELECT email, name FROM users WHERE id = ? OR extensionNumber = ?', [String(extId), String(extId)]);
            const email = staff?.[0] || getStaffEmailByExtension(extId);

            if (email) {
                // Determine who answered (if known)
                let answeredBy = null;
                if (callStatus === 'Answered') {
                    answeredBy = staff ? `${staff[1]} (Ext: ${extId})` : `Extension ${extId}`;

                    // --- AUTO ASSIGNMENT ---
                    // If contact is unassigned, assign to the person who answered
                    // Check if currently unassigned (or we can just overwrite, but usually we respect existing owner. User said "assign new call to user who pickt up... if that number is not yet assignt")
                    const currentAssigned = existing ? existing[2] : '';
                    if (!currentAssigned) {
                        db.run('UPDATE contacts SET assigned_to = ? WHERE id = ?', [email, contactId]);
                    }

                    // Log the answer specifically
                    const answerLog = `[${fullTimestamp}] Answered by ${staff ? staff[1] : 'Ext ' + extId}`;
                    db.run('UPDATE contacts SET interaction_logs = COALESCE(interaction_logs, "") || ? || CHAR(10) WHERE id = ?', [answerLog, contactId]);
                }

                const callData = {
                    phoneNumber,
                    status: callStatus,
                    contactId,
                    answeredBy: answeredBy
                };
                USER_CALLS.set(email, callData);

                // Broadcast to SSE clients for this user
                broadcastToUser(email, { type: 'call-update', data: callData });
            }
        });
        saveDatabase();
    }

    // --- CALL LOGGING (Admin Panel) ---
    // (Existing logic remains)
    if (eventType === 'Answered') {
        if (!ACTIVE_CALLS.has(sessionId)) {
            ACTIVE_CALLS.set(sessionId, {
                startTime: Date.now(),
                direction: parties[0]?.direction || 'Inbound',
                contactPhone: caller?.from?.phoneNumber || parties.find(p => p.direction === 'Inbound')?.from?.phoneNumber
            });
        }

        // Save which extension answered the call
        const staffInvolved = staffParties[0];
        const extId = staffInvolved?.extensionId || staffInvolved?.owner?.extensionId;
        if (extId && caller?.from?.phoneNumber) {
            const staff = queryOne('SELECT email, name FROM users WHERE id = ? OR extensionNumber = ?', [String(extId), String(extId)]);
            const answeredBy = staff ? `${staff[1]} (Ext: ${extId})` : `Extension ${extId}`;
            const phone = caller.from.phoneNumber.replace(/\D/g, '');
            const searchDigits = phone.length === 11 && phone.startsWith('1') ? phone.substring(1) : phone;
            getDatabase().run('UPDATE contacts SET answered_by = ? WHERE phone LIKE ?', [answeredBy, `%${searchDigits}`]);
            saveDatabase();
        }
    } else if (eventType === 'Disconnected') {
        const callInfo = ACTIVE_CALLS.get(sessionId);
        // Fallback info if we missed session start (server restart)
        const direction = callInfo?.direction || parties[0]?.direction || 'Inbound';
        const duration = callInfo?.startTime ? Math.round((Date.now() - callInfo.startTime) / 1000) : 0;

        const phone = (callInfo?.contactPhone || caller?.from?.phoneNumber || '').replace(/\D/g, '');
        const searchingDigits = phone.length === 11 && phone.startsWith('1') ? phone.substring(1) : phone;
        const contact = queryOne('SELECT id FROM contacts WHERE phone LIKE ?', [`%${searchingDigits}`]);
        const staffInvolved = staffParties[0];
        const extId = staffInvolved?.extensionId || staffInvolved?.owner?.extensionId;
        const staff = queryOne('SELECT email FROM users WHERE id = ? OR extensionNumber = ?', [String(extId), String(extId)]);

        // Log Missed call to interaction log if short duration/no answer event
        // (Simplified: just log 'Disconnected')
        if (contact && contact[0]) {
            const disconLog = `[${fullTimestamp}] Call Ended (${duration}s)`;
            getDatabase().run('UPDATE contacts SET interaction_logs = COALESCE(interaction_logs, "") || ? || CHAR(10) WHERE id = ?', [disconLog, contact[0]]);
        }

        getDatabase().run(
            'INSERT INTO call_logs (id, tenant_id, contact_id, user_id, direction, duration, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [`call_${Date.now()}`, tenantId, contact?.[0] || null, staff?.[0] || String(extId) || 'System', direction, duration, 'Completed', new Date().toISOString()]
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
        res.setHeader('Validation-Token', validationToken);
        return res.send('ok');
    }

    try {
        await processTelephonyEvent(req.body, req.tenantId);
    } catch (e) {
        console.error('Webhook Error:', e);
    }
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

// Get a single contact by ID
app.get('/api/contacts/:id', (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        const result = db.exec('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);

        if (result.length > 0 && result[0].values.length > 0) {
            const columns = result[0].columns;
            const contact = {};
            columns.forEach((col, idx) => { contact[col] = result[0].values[0][idx]; });
            res.json(mapContact(contact)); // Use mapContact for consistency
        } else {
            res.status(404).json({ error: 'Contact not found' });
        }
    } catch (error) {
        console.error('Error fetching contact:', error);
        res.status(500).json({ error: 'Failed to fetch contact' });
    }
});

// ==================== UNITS API ====================

// Get units for a specific contact
app.get('/api/units', (req, res) => {
    try {
        const { contact_id } = req.query;
        if (!contact_id) return res.status(400).json({ error: 'Contact ID required' });

        const db = getDatabase();
        const result = db.exec(`SELECT * FROM units WHERE contact_id = '${contact_id}' ORDER BY date DESC, created_at DESC`);

        if (!result.length || !result[0].values.length) return res.json([]);

        const columns = result[0].columns;
        const units = result[0].values.map(row => {
            const unit = {};
            columns.forEach((col, idx) => { unit[col] = row[idx]; });
            try { unit.data = JSON.parse(unit.data); } catch (e) { }
            return unit;
        });

        res.json(units);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
});

// Create a new unit (or correction)
app.post('/api/units', (req, res) => {
    try {
        const { contact_id, type, date, data, correction_of_id } = req.body;
        const id = `unit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const user = req.body.metadata?.user || 'system';

        const db = getDatabase();

        // If this is a correction, we must VOID the original unit first
        if (correction_of_id) {
            db.run(`UPDATE units SET status = 'VOIDED' WHERE id = ?`, [correction_of_id]);
        }

        db.run(
            `INSERT INTO units (id, contact_id, type, date, data, created_by, correction_of_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
            [id, contact_id, type, date, JSON.stringify(data), user, correction_of_id]
        );

        saveDatabase();
        res.json({ success: true, id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create unit' });
    }
});

// Update unit status (e.g. manual void)
app.put('/api/units/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'ACTIVE' or 'VOIDED'

        const db = getDatabase();
        db.run(`UPDATE units SET status = ? WHERE id = ?`, [status, id]);
        saveDatabase();

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update unit status' });
    }
});

// ==================== COMMUNICATIONS API ====================

// Get all communications (calls, SMS, voicemail) for a contact
app.get('/api/communications/:contactId', (req, res) => {
    try {
        const { contactId } = req.params;
        const db = getDatabase();
        const events = [];

        // Fetch call logs
        const callsResult = db.exec(`SELECT * FROM call_logs WHERE contact_id = '${contactId}' ORDER BY created_at DESC`);
        if (callsResult.length && callsResult[0].values.length) {
            const columns = callsResult[0].columns;
            callsResult[0].values.forEach(row => {
                const call = {};
                columns.forEach((col, idx) => { call[col] = row[idx]; });
                events.push({
                    id: call.id,
                    type: 'call',
                    contactId: call.contact_id,
                    userId: call.user_id,
                    timestamp: call.created_at,
                    data: {
                        id: call.id,
                        contact_id: call.contact_id,
                        user_id: call.user_id,
                        direction: call.direction,
                        duration: call.duration,
                        status: call.status,
                        disposition: call.disposition,
                        recording_url: call.recording_url,
                        notes: call.notes,
                        created_at: call.created_at
                    }
                });
            });
        }

        // Fetch SMS logs
        const smsResult = db.exec(`SELECT * FROM sms_logs WHERE contact_id = '${contactId}' ORDER BY created_at DESC`);
        if (smsResult.length && smsResult[0].values.length) {
            const columns = smsResult[0].columns;
            smsResult[0].values.forEach(row => {
                const sms = {};
                columns.forEach((col, idx) => { sms[col] = row[idx]; });
                events.push({
                    id: sms.id,
                    type: 'sms',
                    contactId: sms.contact_id,
                    userId: sms.user_id,
                    timestamp: sms.created_at,
                    data: {
                        id: sms.id,
                        contactId: sms.contact_id,
                        userId: sms.user_id,
                        direction: sms.direction,
                        body: sms.body,
                        status: sms.status,
                        fromNumber: sms.from_number,
                        toNumber: sms.to_number,
                        createdAt: sms.created_at
                    }
                });
            });
        }

        // Fetch voicemail logs
        const vmResult = db.exec(`SELECT * FROM voicemail_logs WHERE contact_id = '${contactId}' ORDER BY created_at DESC`);
        if (vmResult.length && vmResult[0].values.length) {
            const columns = vmResult[0].columns;
            vmResult[0].values.forEach(row => {
                const vm = {};
                columns.forEach((col, idx) => { vm[col] = row[idx]; });
                events.push({
                    id: vm.id,
                    type: 'voicemail',
                    contactId: vm.contact_id,
                    userId: vm.user_id,
                    timestamp: vm.created_at,
                    data: {
                        id: vm.id,
                        contactId: vm.contact_id,
                        userId: vm.user_id,
                        duration: vm.duration,
                        audioUrl: vm.audio_url,
                        transcript: vm.transcript,
                        fromNumber: vm.from_number,
                        createdAt: vm.created_at
                    }
                });
            });
        }

        // Sort all events by timestamp descending
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(events);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch communications' });
    }
});

// ==================== CALL LOGS & TELEPHONY ====================

function mapContact(obj) {
    return {
        id: obj.id,
        name: obj.name,
        dob: obj.dob,
        phone: obj.phone,
        level: obj.level,
        qualifiedFor: Array.isArray(obj.qualified_for) ? obj.qualified_for : (typeof obj.qualified_for === 'string' && obj.qualified_for.startsWith('[') ? JSON.parse(obj.qualified_for) : (obj.qualified_for ? [obj.qualified_for] : [])),
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
        crmStatus: obj.crm_status || 'New',
        interactionLogs: obj.interaction_logs || '',
        lastCallAt: obj.last_call_at || '',
        cellHistory: obj.cell_history ? JSON.parse(obj.cell_history) : {}
    };
}

// Create contact
app.post('/api/contacts', (req, res) => {
    try {
        const contact = req.body;
        const db = getDatabase();

        db.run(
            `INSERT INTO contacts (
        id, tenant_id, name, dob, phone, level, qualified_for, approved, address, city,
        household_size, assigned_to, date_outreached, date_screened, household_members,
        missed_call, declined_call, cell_history, crm_status, interaction_logs, last_call_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                contact.id,
                req.tenantId,
                contact.name || '',
                contact.dob || '',
                contact.phone || '',
                contact.level || 'Level 1',
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
                contact.crmStatus || 'New',
                contact.interactionLogs || '',
                contact.lastCallAt || ''
            ]
        );

        saveDatabase();
        res.status(201).json({ message: 'Contact created', id: contact.id });
    } catch (error) {
        console.error('Error creating contact:', error);
        res.status(500).json({ error: 'Failed to create contact' });
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
        missed_call = ?, declined_call = ?, cell_history = ?, crm_status = ?,
        interaction_logs = ?, last_call_at = ?,
        updated_at = CURRENT_TIMESTAMP
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
                contact.crmStatus || contact.crm_status || 'Active',
                contact.interactionLogs || '',
                contact.lastCallAt || '',
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
            'INSERT INTO users (id, tenant_id, name, email, role, team, status, password, extensionNumber, ringCentralEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user.id, req.tenantId, user.name, user.email, user.role, user.team || null, user.status, user.password || null, user.extensionNumber || null, user.ringCentralEmail || null]
        );

        saveDatabase();
        res.status(201).json({ message: 'User created', id: user.id });
    } catch (error) {
        console.error('Error creating user:', error);
        if (error.message.includes('UNIQUE constraint failed: users.email')) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        res.status(500).json({ error: `Failed to create user: ${error.message}` });
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

// Set password for invited user
app.post('/api/users/set-password', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const db = getDatabase();

        // Find user by email
        const users = db.exec('SELECT * FROM users WHERE email = ?', [email]);

        if (!users.length || !users[0].values.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0].values[0];
        const userId = user[0];
        const userStatus = user[6]; // status column

        // Verify user is invited
        if (userStatus !== 'INVITED') {
            return res.status(400).json({ error: 'User is not in invited status' });
        }

        // Simple hash for password (in production, use bcrypt)
        const crypto = require('crypto');
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // Update user with password and change status to ACTIVE
        db.run(
            'UPDATE users SET password = ?, status = ? WHERE id = ?',
            [hashedPassword, 'ACTIVE', userId]
        );

        saveDatabase();
        res.json({ message: 'Password set successfully', userId });
    } catch (error) {
        console.error('Error setting password:', error);
        res.status(500).json({ error: 'Failed to set password' });
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

        // Clean up old backups (keep last 7 days)
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('crm_auto_backup_'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime }))
            .sort((a, b) => b.time.getTime() - a.time.getTime());

        files.slice(7).forEach(f => {
            fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
        });
    } catch (error) {
        console.error('❌ Scheduled backup failed:', error.message);
    }
};

// Run backup on startup (after a short delay to let DB initialize)
setTimeout(() => {
    runScheduledBackup();
}, 5000);

// Schedule daily backups (every 24 hours)
setInterval(runScheduledBackup, 24 * 60 * 60 * 1000);


// ==================== MESSAGES API ====================

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

        let contactId = null;
        let existingContact = null;
        const db = getDatabase();
        const rawDigits = phoneNumber.replace(/\D/g, '');
        const searchingDigits = rawDigits.length === 11 && rawDigits.startsWith('1') ? rawDigits.substring(1) : rawDigits;
        const existing = queryOne('SELECT id, name FROM contacts WHERE phone LIKE ?', [`%${searchingDigits}`]);

        if (!existing) {
            contactId = `row_${Date.now()}`;
            db.run(
                'INSERT INTO contacts (id, name, phone, qualified_for, approved, assigned_to, level, city, crm_status, date_outreached) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [contactId, (name && !name.toLowerCase().includes('wireless')) ? name : '', rawDigits, '[]', 'no', 'bbard7081@gmail.com', 'Level 1', 'Simulator City', status || 'New', new Date().toISOString().split('T')[0]]
            );
        } else {
            contactId = existing[0];
            existingContact = { id: existing[0], name: existing[1] };
            db.run('UPDATE contacts SET crm_status = ?, city = COALESCE(NULLIF(city, ""), ?) WHERE id = ?', [status || 'Answered', 'Simulator City', contactId]);
        }
        saveDatabase();

        const staffEmail = targetExtension ? getStaffEmailByExtension(targetExtension) : null;

        // If targetExtension is provided, add the staff party
        if (staffEmail) {
            broadcastToUser(staffEmail, {
                type: (status === 'Answered' || status === 'connected') ? 'call_connected' : 'incoming_call',
                phoneNumber: rawDigits,
                contactName: existingContact ? existingContact.name : name,
                contactId: contactId, // Crucial for auto-focus
                status: status
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


    // Send initial ping
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    req.on('close', () => {
        sseClients.delete(client);
    });
});

// ==================== PRODUCTION ASSET SERVING ====================
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');

// 1. Disable caching for HTML files to ensure fresh config/auth
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/simchatalent' || req.path === '/simchatalent/') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// 2. Static Assets (Order matters: Prefixed first, then Root)
app.use('/simchatalent', express.static(distPath, { etag: false, lastModified: false, index: false }));
app.use(express.static(distPath, { etag: false, lastModified: false, index: false }));
app.use(express.static(publicPath, { etag: false, lastModified: false, index: false }));

// 3. Explicit Page Routes (After API and Static Assets)
app.get('/', (req, res) => {
    const landingPath = path.join(distPath, 'landing.html');
    const fallbackPath = path.join(publicPath, 'landing.html');

    if (fs.existsSync(landingPath)) {
        res.sendFile(landingPath);
    } else if (fs.existsSync(fallbackPath)) {
        res.sendFile(fallbackPath);
    } else {
        res.status(404).send('Landing page not found. Please run "npm run build".');
    }
});

// SPA Entry point
app.get('/simchatalent*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('CRM application not found. Please run "npm run build".');
    }
});

// Initial page load logging (for debugging production routing)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.includes('.')) {
    }
    next();
});

// ==================== EMAIL API ====================
app.post('/api/email/send', async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

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

// Catch-all for any other unmatched routes (SPA fallback as last resort)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });

    // Default to index.html for unknown SPA routes
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Page not found');
    }
});

// Initialize database and start server
try {
    await initializeDatabase();
} catch (err) {
    console.error('❌ [CRITICAL ERROR] Failed to initialize database:', err);
    // Continue anyway to allow health checks and diagnostics
}

app.listen(PORT, '0.0.0.0', async () => {

    // AUTO-SYNC RINGCENTRAL USERS AT STARTUP (Non-blocking)
    const syncUsers = async () => {
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
