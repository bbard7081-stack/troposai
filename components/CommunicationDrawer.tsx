import React, { useState, useEffect } from 'react';
import { AppCallLog, SMSLog, VoicemailLog, CommunicationEvent } from '../types';
import { Icon } from './Icon';

interface CommunicationDrawerProps {
    contactId: string;
    contactName: string;
    onClose: () => void;
}

export const CommunicationDrawer: React.FC<CommunicationDrawerProps> = ({ contactId, contactName, onClose }) => {
    const [events, setEvents] = useState<CommunicationEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'calls' | 'sms' | 'voicemail'>('all');

    const fetchCommunications = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/communications/${contactId}`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (e) {
            console.error('Failed to fetch communications', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (contactId) fetchCommunications();
    }, [contactId]);

    const filteredEvents = events.filter(e => activeTab === 'all' || e.type === activeTab.replace('s', ''));

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderEvent = (event: CommunicationEvent) => {
        const timestamp = new Date(event.timestamp).toLocaleString();

        if (event.type === 'call') {
            const call = event.data as AppCallLog;
            return (
                <div key={event.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${call.direction === 'Inbound' ? 'bg-green-100' : 'bg-blue-100'}`}>
                                <Icon name={call.direction === 'Inbound' ? 'phone-incoming' : 'phone-outgoing'} size={14} className={call.direction === 'Inbound' ? 'text-green-600' : 'text-blue-600'} />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-800">{call.direction} Call</p>
                                <p className="text-xs text-slate-400">{timestamp}</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{formatDuration(call.duration)}</span>
                    </div>
                    {call.disposition && <p className="text-xs text-slate-500 mb-1"><span className="font-bold">Disposition:</span> {call.disposition}</p>}
                    {call.notes && <p className="text-sm text-slate-600 italic mt-2">{call.notes}</p>}
                    {call.recording_url && (
                        <audio controls className="w-full mt-3">
                            <source src={call.recording_url} type="audio/mpeg" />
                        </audio>
                    )}
                </div>
            );
        }

        if (event.type === 'sms') {
            const sms = event.data as SMSLog;
            return (
                <div key={event.id} className={`p-4 rounded-xl ${sms.direction === 'INBOUND' ? 'bg-slate-100 border border-slate-200' : 'bg-blue-50 border border-blue-200'}`}>
                    <div className="flex items-center space-x-2 mb-2">
                        <Icon name="message-square" size={14} className={sms.direction === 'INBOUND' ? 'text-slate-600' : 'text-blue-600'} />
                        <p className="text-xs font-bold text-slate-500">{sms.direction === 'INBOUND' ? 'Received' : 'Sent'} • {timestamp}</p>
                    </div>
                    <p className="text-sm text-slate-700">{sms.body}</p>
                    <p className="text-xs text-slate-400 mt-2">Status: {sms.status}</p>
                </div>
            );
        }

        if (event.type === 'voicemail') {
            const vm = event.data as VoicemailLog;
            return (
                <div key={event.id} className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <Icon name="voicemail" size={14} className="text-amber-600" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-800">Voicemail</p>
                                <p className="text-xs text-slate-400">{timestamp}</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{formatDuration(vm.duration)}</span>
                    </div>
                    {vm.audioUrl && (
                        <audio controls className="w-full mt-3">
                            <source src={vm.audioUrl} type="audio/mpeg" />
                        </audio>
                    )}
                    {vm.transcript && (
                        <div className="mt-3 p-3 bg-white rounded-lg">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Transcript</p>
                            <p className="text-sm text-slate-600 italic">{vm.transcript}</p>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-50 shadow-2xl z-[100] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800">Communications</h2>
                    <p className="text-sm text-slate-500">{contactName}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <Icon name="x" size={20} className="text-slate-400" />
                </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-200">
                <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl">
                    {(['all', 'calls', 'sms', 'voicemail'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading && (
                    <div className="text-center py-10">
                        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                )}

                {!loading && filteredEvents.length === 0 && (
                    <div className="text-center py-10 text-slate-400">
                        <Icon name="inbox" size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No communications yet</p>
                    </div>
                )}

                {!loading && filteredEvents.map(renderEvent)}
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2">
                    <Icon name="calendar" size={16} />
                    <span>Schedule Follow-Up</span>
                </button>
            </div>
        </div>
    );
};
