import React from 'react';
import { useGridEngine } from '../src/grid-engine/GridEngineProvider';
import { Icon } from './Icon';

interface ClientProfileProps {
    rowId: string;
    onClose: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ rowId, onClose }) => {
    const { getRowById, engine } = useGridEngine();
    const row = getRowById(rowId);

    if (!row) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-400">
                Contact not found.
            </div>
        );
    }

    const handleUpdate = (columnId: string, value: string) => {
        engine?.updateContact(rowId, { [columnId]: value }, 'profile');
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
                        {row.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <h3 className="text-xl font-black tracking-tight">{row.name || 'Unnamed Contact'}</h3>
                        <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{row.crm_status || 'Member'}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <Icon name="plus" size={20} className="rotate-45" />
                </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Primary Information</h4>

                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Full Name</label>
                            <input
                                type="text"
                                value={row.name || ''}
                                onChange={(e) => handleUpdate('name', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Phone Number</label>
                            <input
                                type="text"
                                value={row.phone || ''}
                                onChange={(e) => handleUpdate('phone', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Email Address</label>
                            <input
                                type="email"
                                value={row.email || ''}
                                onChange={(e) => handleUpdate('email', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Status & Assignment</h4>

                    <div className="space-y-4">
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">CRM Status</label>
                            <select
                                value={row.crm_status || ''}
                                onChange={(e) => handleUpdate('crm_status', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none"
                            >
                                <option value="Lead">Lead</option>
                                <option value="Ringing">Ringing</option>
                                <option value="Connected">Connected</option>
                                <option value="Disconnected">Disconnected</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Assigned Specialist</label>
                            <input
                                type="text"
                                value={row.assigned_to || ''}
                                onChange={(e) => handleUpdate('assigned_to', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start space-x-3">
                        <Icon name="zap" size={16} className="text-blue-500 mt-0.5" />
                        <div>
                            <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1">Engine Synced</p>
                            <p className="text-[10px] text-blue-700 font-medium leading-relaxed">Changes made here are instantly pushed to the Grid Engine and synced with the backend.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
