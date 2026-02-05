import React, { useState } from 'react';
import { Icon } from './Icon';
import { AppCallLog } from '../types';

interface CallDispositionModalProps {
    callLog: AppCallLog;
    contactName?: string;
    onSave: (id: string, updates: { disposition: string, notes: string }) => Promise<void>;
    onClose: () => void;
}

const DISPOSITIONS = [
    'Interested',
    'Not Interested',
    'Call Back Later',
    'Wrong Number',
    'No Answer',
    'Meeting Scheduled',
    'Voicemail',
    'Disconnected'
];

export const CallDispositionModal: React.FC<CallDispositionModalProps> = ({
    callLog,
    contactName,
    onSave,
    onClose
}) => {
    const [disposition, setDisposition] = useState(callLog.disposition || '');
    const [notes, setNotes] = useState(callLog.notes || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(callLog.id, { disposition, notes });
            onClose();
        } catch (error) {
            console.error('Failed to save disposition:', error);
            alert('Failed to save call outcome. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Icon name="phone" size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-wider">Call Summary</h3>
                            <p className="text-[10px] opacity-80 font-bold">{contactName || 'Unknown Contact'} • {callLog.duration}s</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <Icon name="delete" size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Outcome</label>
                        <div className="grid grid-cols-2 gap-2">
                            {DISPOSITIONS.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setDisposition(opt)}
                                    className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all text-left ${disposition === opt
                                            ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm ring-1 ring-blue-600'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Call Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Enter details about the conversation..."
                            className="w-full h-24 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-black text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                    >
                        DISCARD
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!disposition || isSaving}
                        className="px-6 py-2 bg-blue-600 text-white text-xs font-black rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                        {isSaving && <Icon name="save" size={12} className="animate-spin" />}
                        <span>SAVE OUTCOME</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
