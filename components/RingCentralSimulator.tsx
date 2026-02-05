import React, { useState } from 'react';
import { Icon } from './Icon';
import * as api from '../services/api';
import { AppUser } from '../types';

interface RingCentralSimulatorProps {
    users?: AppUser[];
    currentUser?: AppUser | null;
}

const RingCentralSimulator: React.FC<RingCentralSimulatorProps> = ({ users = [], currentUser }) => {
    const [phone, setPhone] = useState('18451112222');
    const [name, setName] = useState('Simulator Caller');
    const [smsText, setSmsText] = useState('Hello! This is a simulated message.');
    const [targetExt, setTargetExt] = useState(currentUser?.extensionNumber || '');
    const [isLoading, setIsLoading] = useState(false);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);

    const handleSimulateCall = async (status: string) => {
        setIsLoading(true);
        try {
            const sid = status === 'Ringing' ? `sim_${Date.now()}` : sessionId;
            if (status === 'Ringing') setSessionId(sid);

            const result = await api.simulateCall(phone, status, name, sid || undefined, targetExt);
            const actualSid = result.sessionId;
            if (status === 'Ringing') setSessionId(actualSid);

            setLastAction(`Simulated ${status} for ${phone} (Target Ext: ${targetExt || 'None'})`);
            if (status === 'Disconnected') setSessionId(null);
        } catch (err: any) {
            alert(`Simulation failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSimulateSMS = async () => {
        setIsLoading(true);
        try {
            await api.simulateSMS(phone, smsText);
            setLastAction(`Simulated SMS from ${phone}`);
        } catch (err: any) {
            alert(`Simulation failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                <div className="mb-8">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">RingCentral Simulator</h3>
                    <p className="text-sm text-slate-500 font-medium">Test CRM telephony and messaging features without real activity.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Telephony Simulation */}
                    <div className="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-blue-600 rounded-lg text-white">
                                <Icon name="phone" size={20} />
                            </div>
                            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Telephony Simulation</h4>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Caller Phone</label>
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Caller Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Target Extension (Staff)</label>
                                <select
                                    value={targetExt}
                                    onChange={(e) => setTargetExt(e.target.value)}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                                >
                                    <option value="">None</option>
                                    {users.filter(u => u.extensionNumber).map(u => (
                                        <option key={u.id} value={u.extensionNumber}>
                                            {u.name} ({u.extensionNumber})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <button
                                    onClick={() => handleSimulateCall('Ringing')}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    Step 1: Simulate Ringing
                                </button>
                                <button
                                    onClick={() => handleSimulateCall('Answered')}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    Step 2: Simulate Answered
                                </button>
                                <button
                                    onClick={() => handleSimulateCall('Disconnected')}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-slate-600 text-white font-bold rounded-xl hover:bg-slate-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                                >
                                    Step 3: Simulate Disconnected
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messaging Simulation */}
                    <div className="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 bg-pink-600 rounded-lg text-white">
                                <Icon name="send" size={20} />
                            </div>
                            <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">Messaging Simulation</h4>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Message Content</label>
                                <textarea
                                    value={smsText}
                                    onChange={(e) => setSmsText(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm resize-none"
                                />
                            </div>

                            <button
                                onClick={handleSimulateSMS}
                                disabled={isLoading}
                                className="w-full py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                Simulate Incoming SMS
                            </button>
                        </div>
                    </div>
                </div>

                {lastAction && (
                    <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between animate-in slide-in-from-bottom-2">
                        <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                            <span className="text-sm font-bold text-blue-800">{lastAction}</span>
                        </div>
                        <button onClick={() => setLastAction(null)} className="text-blue-400 hover:text-blue-600 transition-colors">
                            <Icon name="logout" size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h4 className="text-lg font-black mb-2 flex items-center space-x-2">
                        <Icon name="zap" size={20} className="text-orange-400" />
                        <span>Simulator Instructions</span>
                    </h4>
                    <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                        Simulating a call will trigger the exactly same backend logic as a real RingCentral webhook.
                        It will create new contacts, update existing ones, and generate call logs.
                        Simulating an SMS will inject a message into the database for the current tenant.
                    </p>
                </div>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Icon name="grid" size={120} />
                </div>
            </div>
        </div>
    );
};

export default RingCentralSimulator;
