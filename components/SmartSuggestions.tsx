import React, { useMemo } from 'react';
import { ClientData } from '../types';
import { Icon } from './Icon';

interface SmartSuggestionsProps {
    client: ClientData;
    onApply: (updates: Partial<ClientData>) => void;
}

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({ client, onApply }) => {
    const suggestions = useMemo(() => {
        const list: { title: string, reason: string, updates: Partial<ClientData>, icon: string }[] = [];

        // 1. Missing Phone
        if (!client.phone) {
            list.push({
                title: 'Add Phone Number',
                reason: 'Missing contact info prevents communication logs.',
                updates: {}, // User must enter it manually, this is just a nudge
                icon: 'phone'
            });
        }

        // 2. Household Size Mismatch
        const calculatedSize = client.householdMembers ? client.householdMembers.split(',').length : 0;
        if (client.householdSize && client.householdSize !== calculatedSize) {
            list.push({
                title: 'Fix Household Size',
                reason: `Declared size (${client.householdSize}) matches declared members (${calculatedSize}).`,
                updates: { householdSize: calculatedSize },
                icon: 'users'
            });
        }

        // 3. Stale Status
        if (client.crmStatus === 'New' && client.interactionLogs) {
            list.push({
                title: 'Update Status to "Screening"',
                reason: 'Interaction history detected for "New" lead.',
                updates: { crmStatus: 'Screening' },
                icon: 'activity'
            });
        }

        // 4. Missing Location
        if (!client.city) {
            list.push({
                title: 'Add City',
                reason: 'Location data helps with reporting.',
                updates: {},
                icon: 'map-pin'
            });
        }

        return list;
    }, [client]);

    if (suggestions.length === 0) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-[20px] p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center space-x-2">
                <Icon name="sparkles" size={14} className="text-indigo-500" />
                <span>Smart Suggestions</span>
            </h3>
            <div className="space-y-3">
                {suggestions.map((s, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-indigo-100/50 hover:bg-white hover:shadow-sm transition-all group">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Icon name={s.icon as any} size={16} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">{s.title}</p>
                                <p className="text-[10px] font-medium text-slate-500">{s.reason}</p>
                            </div>
                        </div>
                        {Object.keys(s.updates).length > 0 && (
                            <button
                                onClick={() => onApply(s.updates)}
                                className="px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-colors opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                            >
                                Apply
                            </button>
                        )}
                        {Object.keys(s.updates).length === 0 && (
                            <span className="text-[10px] font-bold text-slate-300 italic pr-2">Manual Action</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
