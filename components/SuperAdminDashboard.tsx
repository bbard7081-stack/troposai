import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import * as api from '../services/api';

interface SystemStatus {
    cpu: { load: string; cores: number };
    memory: { total: string; used: string; percent: string };
    disk: { total: string; used: string; percent: number };
    uptime: string;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
}

const SuperAdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'health'>('overview');
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isCreatingTenant, setIsCreatingTenant] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, [activeTab]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'overview' || activeTab === 'health') {
                const status = await api.fetchSystemStatus(); // Need to ensure this exists in api.ts
                setSystemStatus(status);
            }
            if (activeTab === 'overview' || activeTab === 'tenants') {
                const tenantList = await api.fetchTenants();
                setTenants(tenantList);
            }
        } catch (err) {
            console.error('Failed to fetch super admin data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTenant = async () => {
        const name = prompt("Enter CRM Name (e.g. West Coast Sales):");
        if (!name) return;
        const slug = prompt("Enter URL Slug (e.g. west-coast):")?.toLowerCase().replace(/\s+/g, '-');
        if (!slug) return;

        setIsCreatingTenant(true);
        try {
            await api.createTenant(name, slug);
            await loadData();
            alert(`Tenant "${name}" provisioned successfully.`);
        } catch (err: any) {
            alert(`Provisioning failed: ${err.message}`);
        } finally {
            setIsCreatingTenant(false);
        }
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center">
                            <span className="bg-indigo-600 p-2 rounded-xl mr-3 shadow-lg shadow-indigo-500/20">
                                <Icon name="grid" size={24} className="text-white" />
                            </span>
                            Infrastructure Master
                        </h1>
                        <p className="text-slate-500 mt-1 font-medium">Tropos Global Command & Control</p>
                    </div>

                    <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab('tenants')}
                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'tenants' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Tenants
                        </button>
                        <button
                            onClick={() => setActiveTab('health')}
                            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'health' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            System Health
                        </button>
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatCard
                            label="Active Tenants"
                            value={tenants.length.toString()}
                            icon="grid"
                            color="blue"
                        />
                        <StatCard
                            label="CPU Load"
                            value={systemStatus ? `${systemStatus.cpu.load}%` : '---'}
                            icon="dashboard"
                            color="indigo"
                        />
                        <StatCard
                            label="Memory Usage"
                            value={systemStatus ? `${systemStatus.memory.percent}%` : '---'}
                            icon="database"
                            color="purple"
                        />
                    </div>
                )}

                {activeTab === 'tenants' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800">Provisioned CRM Instances</h2>
                            <button
                                onClick={handleCreateTenant}
                                disabled={isCreatingTenant}
                                className="flex items-center space-x-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold text-sm shadow-xl shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <Icon name="plus" size={16} />
                                <span>{isCreatingTenant ? 'Provisioning...' : 'Provision New CRM'}</span>
                            </button>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Endpoint</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {tenants.map(tenant => (
                                        <tr key={tenant.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                        {tenant.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-800 text-lg leading-tight">{tenant.name}</p>
                                                        <p className="text-[10px] text-slate-400 font-black tracking-widest mt-1 uppercase">{tenant.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-mono font-bold">
                                                    /{tenant.slug}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="flex items-center space-x-2">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="text-xs font-black text-green-600 uppercase tracking-wider">Active</span>
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <button
                                                    onClick={() => window.open(`/${tenant.slug}`, '_blank')}
                                                    className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"
                                                >
                                                    <Icon name="eye" size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'health' && systemStatus && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center italic">
                                <Icon name="dashboard" size={20} className="mr-2 text-indigo-600" />
                                Compute Performance
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-500">CPU Usage</span>
                                        <span className="text-sm font-black text-indigo-600">{systemStatus.cpu.load}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-600 rounded-full transition-all duration-1000"
                                            style={{ width: `${systemStatus.cpu.load}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{systemStatus.cpu.cores} Physical Cores Online</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center italic">
                                <Icon name="database" size={20} className="mr-2 text-indigo-600" />
                                Primary Memory state
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-bold text-slate-500">RAM (Heap + System)</span>
                                        <span className="text-sm font-black text-purple-600">{systemStatus.memory.percent}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-600 rounded-full transition-all duration-1000"
                                            style={{ width: `${systemStatus.memory.percent}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{systemStatus.memory.used} of {systemStatus.memory.total} utilized</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

interface StatCardProps {
    label: string;
    value: string;
    icon: string;
    color: 'blue' | 'indigo' | 'purple';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
    };

    return (
        <div className={`p-8 rounded-3xl border ${colorMap[color]} shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
                <Icon name={icon} size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">System Metric</span>
            </div>
            <p className="text-sm font-bold opacity-60 mb-1">{label}</p>
            <p className="text-3xl font-black">{value}</p>
        </div>
    );
};

export default SuperAdminDashboard;
