import React, { useState, useEffect } from 'react';
import * as api from '../../../services/api';
import { Icon } from '../../../components/Icon';

interface ActivityPeekProps {
    contactId: string;
    onClose: () => void;
    position: { x: number; y: number };
}

export const ActivityPeek: React.FC<ActivityPeekProps> = ({ contactId, onClose, position }) => {
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        api.fetchActivities(contactId)
            .then(data => {
                if (isMounted) {
                    setActivities(data);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Peek fetch failed:', err);
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [contactId]);

    return (
        <div
            className="fixed z-[250] animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: position.x + 20,
                top: Math.min(position.y, window.innerHeight - 300)
            }}
            onMouseLeave={onClose}
        >
            <div className="bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl shadow-2xl border border-white/10 w-80 overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Icon name="history" size={14} className="text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Recent Activity</span>
                    </div>
                    {loading && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                </div>

                <div className="max-h-64 overflow-y-auto p-2">
                    {activities.length === 0 && !loading ? (
                        <div className="p-8 text-center text-slate-500 text-xs font-medium italic">
                            No recent activity found.
                        </div>
                    ) : (
                        activities.map((act, i) => (
                            <div key={act.id} className="p-3 hover:bg-white/5 rounded-2xl transition-colors group">
                                <div className="flex items-start space-x-3">
                                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${act.type === 'CREATED' ? 'bg-green-500' :
                                            act.type === 'DUPLICATE_INTAKE' ? 'bg-amber-500' :
                                                'bg-blue-500'
                                        }`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-bold text-slate-200 leading-tight mb-1">{act.content}</p>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{act.type}</span>
                                            <span className="text-[9px] text-slate-600">•</span>
                                            <span className="text-[9px] text-slate-500">{new Date(act.id.includes('_') ? parseInt(act.id.split('_')[1]) : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-white/5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Press <span className="text-blue-400">ENTER</span> for Full Profile
                </div>
            </div>
        </div>
    );
};
