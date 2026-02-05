import React, { useState, useEffect } from 'react';
import { Unit } from '../types';
import { Icon } from './Icon';

interface UnitsPanelProps {
    contactId: string;
    currentUser: string;
}

export const UnitsPanel: React.FC<UnitsPanelProps> = ({ contactId, currentUser }) => {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    // Form State
    const [formType, setFormType] = useState('Billable');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formNote, setFormNote] = useState('');
    const [correctionTarget, setCorrectionTarget] = useState<Unit | null>(null);

    const fetchUnits = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/units?contact_id=${contactId}`);
            if (res.ok) {
                const data = await res.json();
                setUnits(data);
            }
        } catch (e) {
            console.error('Failed to fetch units', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (contactId) fetchUnits();
    }, [contactId]);

    const handleSubmit = async () => {
        if (!formDate || !formType) return;

        const payload = {
            contact_id: contactId,
            type: formType,
            date: formDate,
            data: { note: formNote },
            correction_of_id: correctionTarget?.id,
            metadata: { user: currentUser }
        };

        try {
            const res = await fetch('/api/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowAddModal(false);
                setCorrectionTarget(null);
                setFormNote('');
                fetchUnits();
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleVoid = async (id: string) => {
        if (!confirm('Are you sure you want to void this unit? This action is traceable.')) return;
        try {
            const res = await fetch(`/api/units/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'VOIDED' })
            });
            if (res.ok) fetchUnits();
        } catch (e) {
            console.error(e);
        }
    };

    const openCorrect = (unit: Unit) => {
        setCorrectionTarget(unit);
        setFormType(unit.type);
        setFormDate(unit.date);
        setFormNote(unit.data?.note || '');
        setShowAddModal(true);
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-sm h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center space-x-3">
                    <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                    <span>Units</span>
                </h3>
                <button
                    onClick={() => {
                        setCorrectionTarget(null);
                        setFormType('Billable');
                        setFormDate(new Date().toISOString().split('T')[0]);
                        setFormNote('');
                        setShowAddModal(true);
                    }}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors"
                >
                    <Icon name="plus" size={16} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {units.filter(u => u.status === 'ACTIVE').length === 0 && !loading && (
                    <div className="text-center py-8 text-slate-400 text-sm font-medium">
                        No active units found.
                    </div>
                )}

                {units.map((unit) => (
                    <div key={unit.id} className={`p-4 rounded-xl border ${unit.status === 'VOIDED' ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-md'} transition-all group relative`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider mb-2 ${unit.status === 'VOIDED' ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                                    {unit.type}
                                </span>
                                {unit.status === 'VOIDED' && <span className="ml-2 text-[10px] font-bold text-red-400">VOIDED</span>}
                                {unit.correctionOfId && <span className="ml-2 text-[10px] font-bold text-amber-500 flex items-center inline-flex space-x-1"><Icon name="edit-2" size={10} /> <span>CORRECTION</span></span>}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                                {unit.date}
                            </div>
                        </div>
                        <p className="text-sm font-medium text-slate-700 mb-3">{unit.data?.note || <span className="italic text-slate-300">No details</span>}</p>

                        <div className="flex justify-between items-center border-t border-slate-50 pt-3 mt-3">
                            <span className="text-[10px] text-slate-400 font-medium">By: {unit.createdBy}</span>

                            {unit.status === 'ACTIVE' && (
                                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openCorrect(unit)}
                                        className="text-[10px] font-bold text-blue-500 hover:text-blue-700 hover:underline"
                                    >
                                        Correct
                                    </button>
                                    <button
                                        onClick={() => handleVoid(unit.id)}
                                        className="text-[10px] font-bold text-red-400 hover:text-red-600 hover:underline"
                                    >
                                        Void
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="absolute inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800">{correctionTarget ? 'Correct Unit' : 'Add Unit'}</h3>
                            <button onClick={() => setShowAddModal(false)}><Icon name="x" size={18} className="text-slate-400" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {correctionTarget && (
                                <div className="p-3 bg-amber-50 rounded-lg text-amber-800 text-xs mb-4">
                                    Currently correcting unit from {correctionTarget.date}. The original will be voided.
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Type</label>
                                <select
                                    className="w-full font-bold bg-slate-50 border-none rounded-lg p-3 text-slate-700 focus:ring-2 ring-blue-500 outline-none"
                                    value={formType}
                                    onChange={e => setFormType(e.target.value)}
                                >
                                    <option value="Billable">Billable</option>
                                    <option value="Assessment">Assessment</option>
                                    <option value="Service">Service</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Date</label>
                                <input
                                    type="date"
                                    className="w-full font-bold bg-slate-50 border-none rounded-lg p-3 text-slate-700 focus:ring-2 ring-blue-500 outline-none"
                                    value={formDate}
                                    onChange={e => setFormDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Details</label>
                                <textarea
                                    className="w-full font-medium bg-slate-50 border-none rounded-lg p-3 text-slate-700 focus:ring-2 ring-blue-500 outline-none resize-none h-24"
                                    value={formNote}
                                    onChange={e => setFormNote(e.target.value)}
                                    placeholder="Enter unit details..."
                                />
                            </div>
                            <button
                                onClick={handleSubmit}
                                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                {correctionTarget ? 'Save Correction' : 'Save Unit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
