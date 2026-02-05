import React, { useState, useEffect } from 'react';
import { AppUser } from '../types';
import { Icon } from './Icon';
import * as api from '../services/api';
import RingCentralSimulator from './RingCentralSimulator';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AdminPanelProps {
  users: AppUser[];
  onUpdateUser: (userId: string, updates: Partial<AppUser>) => void;
  onAddUser: (user: AppUser) => void;
  onDeleteUser?: (userId: string) => void;
  onImpersonate: (user: AppUser) => void;
  currentUser: AppUser | null;
  data?: any[];
}

interface UsageStats {
  contacts: { total: number; activeLeads: number; closedDeals: number };
  users: { total: number; active: number };
  calls: { total: number; today: number };
  messages: { total: number };
  storage: { databaseBytes: number; databaseMB: string };
  uptime: string;
}

interface Backup {
  filename: string;
  size: number;
  sizeMB: string;
  createdAt: string;
}

interface AdminSettings {
  backupEnabled: boolean;
  backupSchedule: string;
  backupRetentionDays: number;
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
}

type AdminTab = 'overview' | 'users' | 'backups' | 'settings' | 'simulator' | 'logs';

const AdminPanel: React.FC<AdminPanelProps> = ({ users, data = [], onUpdateUser, onAddUser, onDeleteUser, onImpersonate, currentUser }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    ringCentralEmail: '',
    role: 'USER' as 'ADMIN' | 'USER',
    team: '',
    extensionNumber: ''
  });

  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  // Fetch usage stats on mount and tab change
  useEffect(() => {
    if (activeTab === 'overview') {
      loadUsageStats();
    } else if (activeTab === 'backups') {
      loadBackups();
    } else if (activeTab === 'settings') {
      loadSettings();
    } else if (activeTab === 'logs') {
      loadCallLogs();
    }
  }, [activeTab]);

  const loadUsageStats = async () => {
    setIsLoading(true);
    try {
      const stats = await api.fetchUsageStats();
      setUsageStats(stats);
    } catch (err) {
      console.error('Failed to fetch usage stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const result = await api.fetchBackups();
      setBackups(result.backups || []);
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const result = await api.fetchAdminSettings();
      setSettings(result);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCallLogs = async () => {
    setIsLoading(true);
    try {
      const logs = await api.fetchCallLogs();
      setCallLogs(logs || []);
    } catch (err) {
      console.error('Failed to fetch call logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      await api.createBackup(currentUser?.email);
      await loadBackups();
      alert('Backup created successfully!');
    } catch (err: any) {
      alert(`Failed to create backup: ${err.message}`);
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
    try {
      await api.deleteBackup(filename);
      await loadBackups();
    } catch (err: any) {
      alert(`Failed to delete backup: ${err.message}`);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await api.updateAdminSettings(settings);
      alert('Settings saved successfully!');
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  const getLeadStats = (email: string) => {
    if (!data) return { active: 0, closed: 0, total: 0 };
    const userLeads = data.filter(d => d.assignedTo === email);
    const closed = userLeads.filter(d => d.crm_status === 'Closed' || d.crm_status === 'Won').length;
    const active = userLeads.length - closed;
    return { active, closed, total: userLeads.length };
  };

  const filteredUsers = users.filter(u =>
    (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setSelectedUser(null);
    setFormData({ name: '', email: '', ringCentralEmail: '', role: 'USER', team: '', extensionNumber: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (user: AppUser) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      ringCentralEmail: user.ringCentralEmail || '',
      role: user.role,
      team: user.team || '',
      extensionNumber: user.extensionNumber || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      alert("Name and Email are required");
      return;
    }

    if (selectedUser) {
      onUpdateUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        ringCentralEmail: formData.ringCentralEmail,
        role: formData.role,
        team: formData.team,
        extensionNumber: formData.extensionNumber
      });
      setIsModalOpen(false);
    } else {
      setIsSending(true);
      const newUser: AppUser = {
        id: `u_${Date.now()}`,
        name: formData.name || 'Invited User',
        email: formData.email,
        role: formData.role,
        team: formData.team,
        extensionNumber: formData.extensionNumber,
        status: 'INVITED'
      };

      try {
        await onAddUser(newUser);
        const inviteLink = `${window.location.host}/simchatalent/setup-password?email=${encodeURIComponent(formData.email)}`;
        const emailSubject = `Welcome to Tropos - Invitation from Admin`;
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">Welcome to Tropos</h1>
                <p>Hello ${formData.name},</p>
                <p>You have been invited to join the <strong>Shimcha Talent</strong> workspace on Tropos CRM.</p>
                <p>Click the button below to set your password and get started:</p>
                <a href="${inviteLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Your Password</a>
                <p style="color: #64748b; font-size: 12px; margin-top: 24px;">If the button doesn't work, copy this link: ${inviteLink}</p>
            </div>
          `;

        const resp = await api.sendEmail(formData.email, emailSubject, emailHtml);
        alert(resp.message || `Invitation sent to ${formData.email}`);
        setIsModalOpen(false);
      } catch (err: any) {
        alert(`Failed to send invite: ${err.message}`);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleReinvite = async (user: AppUser) => {
    setIsSending(true);
    try {
      const inviteLink = `${window.location.host}/simchatalent/setup-password?email=${encodeURIComponent(user.email)}`;
      const emailSubject = `Reminder: Welcome to Tropos - Your Invitation`;
      const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2563eb;">Workspace Invitation Reminder</h1>
                <p>Hello ${user.name},</p>
                <p>We're sending you a quick reminder that you've been invited to join the <strong>Shimcha Talent</strong> workspace on Tropos CRM.</p>
                <p>Click the button below to set your password and get started:</p>
                <a href="${inviteLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Set Your Password</a>
                <p style="color: #64748b; font-size: 12px; margin-top: 24px;">If the button doesn't work, copy this link: ${inviteLink}</p>
            </div>
          `;

      const resp = await api.sendEmail(user.email, emailSubject, emailHtml);
      const now = new Date().toLocaleString();
      onUpdateUser(user.id, { lastInvited: now });
      alert(resp.message || `Reminder sent to ${user.email}`);
    } catch (err: any) {
      alert(`Failed to resend invite: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Stat Card Component
  const StatCard = ({ icon, label, value, subValue, color }: { icon: string; label: string; value: string | number; subValue?: string; color: string }) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center mb-4`}>
        <Icon name={icon as any} size={24} className="text-white" />
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
      {subValue && <p className="text-xs text-slate-500 mt-1">{subValue}</p>}
    </div>
  );

  // Tab Navigation
  const TabButton = ({ tab, label, icon }: { tab: AdminTab; label: string; icon: string }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === tab
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
        }`}
    >
      <Icon name={icon as any} size={18} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3">
        <TabButton tab="overview" label="Overview" icon="dashboard" />
        <TabButton tab="users" label="Users" icon="users" />
        <TabButton tab="backups" label="Backups" icon="database" />
        <TabButton tab="settings" label="Settings" icon="settings" />
        <TabButton tab="simulator" label="Simulator" icon="zap" />
        <TabButton tab="logs" label="Call Logs" icon="phone" />
      </div>

      {/* Overview Tab - Usage Analytics Cards */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Admin Dashboard</h2>
              <p className="text-sm text-slate-500">Real-time usage analytics and system overview</p>
            </div>
            <button
              onClick={loadUsageStats}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-bold text-sm transition-all"
            >
              <Icon name="history" size={16} />
              <span>{isLoading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>

          {usageStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon="users"
                label="Total Contacts"
                value={usageStats.contacts.total}
                subValue={`${usageStats.contacts.activeLeads} active leads`}
                color="bg-blue-600"
              />
              <StatCard
                icon="star"
                label="Closed Deals"
                value={usageStats.contacts.closedDeals}
                subValue="Completed successfully"
                color="bg-green-600"
              />
              <StatCard
                icon="phone"
                label="Call Activity"
                value={usageStats.calls.total}
                subValue={`${usageStats.calls.today} calls today`}
                color="bg-purple-600"
              />
              <StatCard
                icon="users"
                label="Active Users"
                value={usageStats.users.active}
                subValue={`${usageStats.users.total} total registered`}
                color="bg-orange-600"
              />
              <StatCard
                icon="send"
                label="Messages"
                value={usageStats.messages.total}
                subValue="Total sent"
                color="bg-pink-600"
              />
              <StatCard
                icon="database"
                label="Database Size"
                value={`${usageStats.storage.databaseMB} MB`}
                subValue="Storage used"
                color="bg-slate-600"
              />
              <StatCard
                icon="zap"
                label="System Uptime"
                value={usageStats.uptime}
                subValue="Server running"
                color="bg-cyan-600"
              />
              <StatCard
                icon="grid"
                label="CRM Status"
                value="Online"
                subValue="All systems operational"
                color="bg-emerald-600"
              />
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-12 text-center">
              <div className="animate-pulse text-slate-400">Loading usage statistics...</div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/30">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">User Management</h3>
              <p className="text-sm text-slate-500 font-medium">Configure team access and profile details.</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={async () => {
                  try {
                    await api.fetchRingCentralUsers();
                    window.location.reload();
                  } catch (e) {
                    alert('Sync failed. Check server logs.');
                  }
                }}
                className="flex items-center space-x-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-black font-bold text-sm transition-all active:scale-95"
              >
                <Icon name="history" size={16} />
                <span>Sync RingCentral Team</span>
              </button>

              <button
                onClick={openAddModal}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Icon name="plus" size={16} />
                <span>Invite Member</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Profile</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status / Performance</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Role</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length > 0 ? filteredUsers.map(user => {
                  const stats = getLeadStats(user.email);
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-4">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-600 border border-slate-200 shadow-sm">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">{user.name}</p>
                            <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-col items-start space-y-1">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${(user.status === 'ACTIVE' || user.status === 'Enabled') ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700 animate-pulse'}`}>
                            {user.status}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {stats.active} Active / {stats.closed} Closed
                          </span>
                          {user.lastInvited && (
                            <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md mt-1 border border-blue-100 italic">
                              Re-invited: {user.lastInvited}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <select
                          value={user.role?.toUpperCase()}
                          onChange={(e) => onUpdateUser(user.id, { role: e.target.value as 'ADMIN' | 'USER' })}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider outline-none cursor-pointer border-transparent hover:border-slate-300 border transition-all ${user.role?.toUpperCase() === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="USER">USER</option>
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <select
                          value={user.team || ''}
                          onChange={(e) => onUpdateUser(user.id, { team: e.target.value })}
                          className="text-sm text-slate-600 font-semibold italic bg-transparent outline-none cursor-pointer hover:underline border-b border-transparent hover:border-slate-300 pb-0.5 transition-all w-32"
                        >
                          <option value="">General Staff</option>
                          <option value="Sales">Sales</option>
                          <option value="Support">Support</option>
                          <option value="Management">Management</option>
                          <option value="IT">IT</option>
                        </select>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onImpersonate(user)}
                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                            title="View As User"
                          >
                            <Icon name="eye" size={18} />
                          </button>
                          {(user.status === 'INVITED' || user.status === 'ACTIVE' || user.status === 'Enabled') && (
                            <button
                              onClick={() => handleReinvite(user)}
                              disabled={isSending}
                              className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-all disabled:opacity-50"
                              title="Resend Invitation"
                            >
                              <Icon name="send" size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Edit User"
                          >
                            <Icon name="settings" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-10 text-center text-slate-400 font-medium">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Database Backups</h2>
              <p className="text-sm text-slate-500">Manage and restore your CRM data backups</p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={isCreatingBackup}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Icon name="plus" size={16} />
              <span>{isCreatingBackup ? 'Creating...' : 'Create Backup Now'}</span>
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start space-x-3">
            <Icon name="zap" size={20} className="text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Automatic Daily Backups</p>
              <p className="text-xs text-blue-600">The system automatically creates backups daily and keeps the last 7 days.</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Filename</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups.length > 0 ? backups.map((backup) => (
                    <tr key={backup.filename} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Icon name="database" size={18} className="text-slate-500" />
                          </div>
                          <span className="font-mono text-sm text-slate-700">{backup.filename}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{backup.sizeMB} MB</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(backup.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <a
                            href={`/api/admin/backups/${encodeURIComponent(backup.filename)}`}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Download"
                          >
                            <Icon name="download" size={18} />
                          </a>
                          <button
                            onClick={() => handleDeleteBackup(backup.filename)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete"
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        {isLoading ? 'Loading backups...' : 'No backups found. Create one to get started.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Admin Settings</h2>
              <p className="text-sm text-slate-500">Configure system-wide preferences</p>
            </div>
            <button
              onClick={handleSaveSettings}
              className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Icon name="check" size={16} />
              <span>Save Settings</span>
            </button>
          </div>

          {settings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Backup Settings */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center space-x-2">
                  <Icon name="database" size={20} className="text-blue-600" />
                  <span>Backup Configuration</span>
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-700">Enable Auto Backup</p>
                      <p className="text-xs text-slate-500">Automatically backup database daily</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.backupEnabled}
                      onChange={(e) => setSettings({ ...settings, backupEnabled: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <label className="block">
                      <p className="font-bold text-slate-700 mb-2">Retention Period (Days)</p>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={settings.backupRetentionDays}
                        onChange={(e) => setSettings({ ...settings, backupRetentionDays: parseInt(e.target.value) || 7 })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Access Settings */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center space-x-2">
                  <Icon name="users" size={20} className="text-purple-600" />
                  <span>Access Control</span>
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-700">Allow New Registrations</p>
                      <p className="text-xs text-slate-500">Let new users sign up via invite</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.allowNewRegistrations}
                      onChange={(e) => setSettings({ ...settings, allowNewRegistrations: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100">
                    <div>
                      <p className="font-bold text-red-700">Maintenance Mode</p>
                      <p className="text-xs text-red-500">Block all user access except admins</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                      className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                  </label>
                </div>
              </div>

              {/* CRM Info Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-black mb-4 flex items-center space-x-2">
                  <Icon name="grid" size={20} />
                  <span>Tropos CRM</span>
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Version</span>
                    <span className="font-mono">2.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CRM Path</span>
                    <span className="font-mono">/simchatalent</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Environment</span>
                    <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-bold">Production</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center space-x-2">
                  <Icon name="zap" size={20} className="text-orange-600" />
                  <span>Quick Actions</span>
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <span className="font-bold text-slate-700">Refresh Application</span>
                    <Icon name="history" size={18} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => window.open('/api/debug/logs', '_blank')}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <span className="font-bold text-slate-700">View Server Logs</span>
                    <Icon name="reports" size={18} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => window.open('/api/health', '_blank')}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    <span className="font-bold text-slate-700">Health Check</span>
                    <Icon name="check" size={18} className="text-slate-400" />
                  </button>
                  <button
                    onClick={() => {
                      const name = prompt("Enter Name for new CRM Workspace:");
                      if (name) alert(`Provisioning new CRM workspace: ${name}\n\nThis feature is being initialized in the backend cloud controller.`);
                    }}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all border border-blue-100"
                  >
                    <span className="font-bold text-blue-800">Provision New CRM Workspace</span>
                    <Icon name="plus" size={18} className="text-blue-600" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-12 text-center">
              <div className="animate-pulse text-slate-400">Loading settings...</div>
            </div>
          )}
        </div>
      )}

      {/* Call Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Call Performance Logs</h2>
              <p className="text-sm text-slate-500">History of calls with user attribution and timestamps</p>
            </div>
            <button
              onClick={loadCallLogs}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-bold text-sm transition-all"
            >
              <Icon name="history" size={16} />
              <span>{isLoading ? 'Loading...' : 'Refresh Logs'}</span>
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User / Extension</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Info</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time & Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {callLogs.length > 0 ? callLogs.map((log) => {
                    const user = users.find(u => u.email === log.user_id || u.id === log.user_id);
                    const timestamp = new Date(log.created_at);
                    const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const formattedDate = timestamp.toLocaleDateString();

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                              {user ? user.name.charAt(0) : '?'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800">
                                {user ? user.name : (log.user_id && log.user_id !== 'System' ? `Extension: ${log.user_id}` : 'Unknown System')}
                              </p>
                              <p className="text-[10px] text-slate-500 font-bold">EXT: {user?.extensionNumber || (log.user_id !== 'System' ? log.user_id : 'N/A')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className={`p-1.5 rounded-lg ${log.direction === 'Inbound' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                              <Icon name={log.direction === 'Inbound' ? 'arrow-down' : 'arrow-up'} size={12} />
                            </div>
                            <span className="text-sm font-medium text-slate-700">{log.direction}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <p className="text-xs text-slate-600">Duration: <span className="font-bold">{log.duration}s</span></p>
                            {log.disposition && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black uppercase tracking-widest">{log.disposition}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs">
                            <p className="font-bold text-slate-700">{formattedTime}</p>
                            <p className="text-slate-400 font-medium">{formattedDate}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${log.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        {isLoading ? 'Loading call logs...' : 'No call activity recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Simulator Tab */}
      {activeTab === 'simulator' && <RingCentralSimulator users={users} currentUser={currentUser} />}

      {/* User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <Icon name="users" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">{selectedUser ? 'Edit User Details' : 'Invite New Member'}</h3>
                <p className="text-sm text-slate-500 font-medium">Invitation links will be sent to the email provided.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Display Name (Optional)</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Michael Scott"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. michael@company.com"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Access Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Department</label>
                  <select
                    className="w-full px-5 py-4 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold"
                    value={formData.team || ''}
                    onChange={e => setFormData({ ...formData, team: e.target.value })}
                  >
                    <option value="">Select Department</option>
                    <option value="Intake">Intake</option>
                    <option value="Coordination">Coordination</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">RingCentral Extension ID</label>
                <input
                  type="text"
                  value={formData.extensionNumber}
                  onChange={(e) => setFormData({ ...formData, extensionNumber: e.target.value })}
                  placeholder="e.g. 101 or 6386..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-8">
              {currentUser?.role === 'ADMIN' && selectedUser ? (
                <button
                  onClick={() => {
                    if (onDeleteUser && confirm('Are you sure you want to delete this user?')) {
                      onDeleteUser(selectedUser.id);
                      setIsModalOpen(false);
                    }
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all font-bold text-xs"
                >
                  <Icon name="trash" size={14} />
                  <span>Delete Account</span>
                </button>
              ) : <div />}
              <div className="flex space-x-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 font-bold transition-all text-sm"
                  disabled={isSending}
                >
                  Cancel
                </button>
                {selectedUser && (
                  <button
                    onClick={() => handleReinvite(selectedUser)}
                    disabled={isSending}
                    className="px-4 py-3 bg-orange-100 text-orange-600 rounded-2xl hover:bg-orange-200 font-bold transition-all text-sm disabled:opacity-50"
                  >
                    Resend Invite
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSending}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-bold transition-all shadow-lg shadow-blue-500/20 text-sm active:scale-95 disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : (selectedUser ? 'Update Profile' : 'Send Invitation')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
