import React, { useState } from 'react';
import { UniversalEntity } from '@/types';

interface ProfileStateControlProps {
    entity: UniversalEntity;
    mode: string;
    onSave: (newData: any) => void;
}

export const ProfileStateControl: React.FC<ProfileStateControlProps> = ({ entity, mode, onSave }) => {
    const [formData, setFormData] = useState({
        status: entity.status,
        owner: entity.owner
    });

    if (mode !== 'EDIT') {
        return (
            <section className="bg-slate-50 rounded-3xl p-6 border border-slate-100 flex items-center justify-between opacity-70 grayscale">
                <div className="space-y-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Governance Lock</h3>
                    <p className="text-[10px] font-bold text-slate-500 italic">Enter Edit Mode to propose mutations to the Spine</p>
                </div>
                <div className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-300">
                    🔒
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-600">Safe Edits</h3>

            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</label>
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 transition-all"
                    >
                        <option>Active</option>
                        <option>Paused</option>
                        <option>Closed</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Owner</label>
                    <input
                        type="text"
                        value={formData.owner}
                        onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                        className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 transition-all"
                    />
                </div>
            </div>

            <div className="pt-4 flex items-center space-x-3">
                <button
                    onClick={() => onSave(formData)}
                    className="flex-1 bg-amber-600 text-white font-black uppercase tracking-widest text-xs py-4 rounded-2xl shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95"
                >
                    Propose Changes
                </button>
                <button
                    onClick={() => onSave(null)}
                    className="px-8 font-black uppercase tracking-widest text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Cancel
                </button>
            </div>

            <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">
                ⚠️ Every proposal creates an immutable timeline event
            </p>
        </section>
    );
};
