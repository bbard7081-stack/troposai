// API client for backend communication

// API client for backend communication
const getApiUrl = () => {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'troposai.com' || hostname === 'www.troposai.com') {
            return 'https://troposai.com/api';
        }
        // Local handling
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return '/api';
        }
    }
    return import.meta.env.VITE_API_URL || '/api';
};

const API_URL = getApiUrl();

// Helper function to extract tenant slug from URL
const getTenantSlug = () => {
    if (typeof window === 'undefined') return 'simchatalent';
    const path = window.location.pathname; // e.g. /simchatalent/dashboard
    const match = path.match(/^\/([^\/]+)/);
    if (match && !['api', 'assets', 'favicon.ico'].includes(match[1])) {
        return match[1];
    }
    return 'simchatalent';
};

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
    const slug = getTenantSlug();

    // Get current user from localStorage if exists
    let userEmail = '';
    try {
        const storedUser = localStorage.getItem('tropos_user');
        if (storedUser) {
            userEmail = JSON.parse(storedUser).email;
        }
    } catch (e) { }

    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Slug': slug,
            'X-User-Email': userEmail,
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

// ==================== CONTACTS API ====================

export async function fetchContacts(search?: string) {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiCall(`/contacts${query}`);
}

export async function fetchContact(id: string) {
    return apiCall(`/contacts/${id}`);
}

export async function createContact(contact: any) {
    return apiCall('/contacts', {
        method: 'POST',
        body: JSON.stringify(contact),
    });
}

export async function updateContact(id: string, contact: any) {
    return apiCall(`/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(contact),
    });
}

export async function deleteContact(id: string) {
    return apiCall(`/contacts/${id}`, {
        method: 'DELETE',
    });
}

// ==================== USERS API ====================

export async function fetchUsers() {
    return apiCall('/users');
}

export async function createUser(user: any) {
    return apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(user),
    });
}

export async function updateUser(id: string, user: any) {
    return apiCall(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(user),
    });
}

export async function setPassword(email: string, password: string) {
    return apiCall('/users/set-password', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}


// ==================== REPORTS API ====================

export async function fetchReports() {
    return apiCall('/reports');
}

export async function createReport(report: any) {
    return apiCall('/reports', {
        method: 'POST',
        body: JSON.stringify(report),
    });
}

export async function deleteReport(id: string) {
    return apiCall(`/reports/${id}`, {
        method: 'DELETE',
    });
}

// ==================== AUTOMATIONS API ====================

export async function fetchAutomations() {
    return apiCall('/automations');
}

export async function saveAutomations(automations: any[]) {
    return apiCall('/automations/bulk', {
        method: 'POST',
        body: JSON.stringify(automations),
    });
}

// ==================== MESSAGES API ====================

export async function fetchMessages(sender?: string, receiver?: string) {
    const query = sender && receiver ? `?sender=${sender}&receiver=${receiver}` : '';
    return apiCall(`/messages${query}`);
}

export async function createMessage(message: any) {
    return apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify(message),
    });
}

// ==================== HEALTH CHECK ====================

export async function checkHealth() {
    return apiCall('/health');
}

// ==================== ADMIN API ====================

export async function fetchSystemStatus() {
    return apiCall('/admin/system-status');
}

export async function fetchSystemHistory() {
    return apiCall('/admin/system-history');
}

export async function fetchUsageStats() {
    return apiCall('/admin/usage-stats');
}

export async function fetchBackups() {
    return apiCall('/admin/backups');
}

export async function createBackup(createdBy?: string) {
    return apiCall('/admin/backups', {
        method: 'POST',
        body: JSON.stringify({ createdBy }),
    });
}

export async function deleteBackup(filename: string) {
    return apiCall(`/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
    });
}

export async function fetchAdminSettings() {
    return apiCall('/admin/settings');
}

export async function updateAdminSettings(settings: Record<string, any>) {
    return apiCall('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

// ==================== MULTI-TENANT API ====================

export async function fetchTenants() {
    return apiCall('/admin/tenants');
}

export async function createTenant(name: string, slug: string) {
    return apiCall('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
    });
}

export async function fetchAllUsersGlobal() {
    return apiCall('/users?super=true');
}

// ==================== TELEPHONY LOGS API ====================

export async function fetchCallLogs() {
    return apiCall('/telephony/logs');
}

export async function updateCallLog(id: string, updates: { disposition?: string, notes?: string }) {
    return apiCall(`/telephony/logs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
    });
}

// ==================== RINGCENTRAL API ====================

export async function fetchRingCentralUsers() {
    return apiCall('/ringcentral/users');
}

// ==================== EMAIL API ====================

export async function sendEmail(to: string, subject: string, html: string) {
    return apiCall('/email/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, html }),
    });
}

// ==================== SIMULATOR API ====================

export async function simulateCall(phoneNumber: string, status: string, name: string = 'Simulator', sessionId?: string, targetExtension?: string) {
    return apiCall('/debug/simulate-call', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, status, name, sessionId, targetExtension }),
    });
}

export async function simulateSMS(from: string, text: string) {
    return apiCall('/debug/simulate-sms', {
        method: 'POST',
        body: JSON.stringify({ from, text }),
    });
}
