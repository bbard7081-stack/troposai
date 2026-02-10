import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/Icon';
import { UniversalEntity, TimelineEvent } from '@/types';
import { ProfileTimeline } from '@/src/profile/components/ProfileTimeline';
import { ProfileIdentityZone } from '@/src/profile/components/ProfileIdentityZone';
import { ProfileContextStrip } from '@/src/profile/components/ProfileContextStrip';
import { ProfileRelatedEntities } from '@/src/profile/components/ProfileRelatedEntities';
import { ProfileStateControl } from '@/src/profile/components/ProfileStateControl';
import { ProfileGuidedActions } from '@/src/profile/components/ProfileGuidedActions';

export type ProfileMode = 'VIEW' | 'EDIT' | 'REVIEW';

interface UniversalProfileProps {
    entityId: string;
    onClose: () => void;
}

export const UniversalProfile: React.FC<UniversalProfileProps> = ({ entityId, onClose }) => {
    const [mode, setMode] = useState<ProfileMode>('VIEW');
    const [entity, setEntity] = useState<UniversalEntity | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEntity = async () => {
            setIsLoading(true);
            // Simulate API fetch
            setTimeout(() => {
                setEntity({
                    id: entityId,
                    type: 'PERSON',
                    name: 'Sarah Connor',
                    secondaryIdentifier: '+1 (555) 019-2029',
                    status: 'Active',
                    owner: 'k.reese@tropos.ai',
                    contextChips: [
                        { label: 'Last activity', value: '2h ago' },
                        { label: 'Open cases', value: '2' },
                        { label: 'Risk level', value: 'High', type: 'danger' }
                    ],
                    timeline: [
                        { id: '1', title: 'Record Created', description: 'System initialized record via manual intake.', timestamp: '2026-02-10T08:00:00Z', source: 'System', type: 'CREATED' },
                        { id: '2', title: 'Status Changed', description: 'Status moved from New to Active.', timestamp: '2026-02-10T09:30:00Z', source: 'k.reese@tropos.ai', type: 'STATUS_CHANGE' },
                        { id: '3', title: 'Inbound Call Received', description: 'Duration 4:20. Discussion regarding future threats.', timestamp: '2026-02-10T10:15:00Z', source: 'Sarah Connor', direction: 'Inbound', type: 'CALL' }
                    ],
                    related: [
                        { id: 'j-1', type: 'JOB', label: 'Security Audit', count: 1 },
                        { id: 'c-1', type: 'CASE', label: 'Containment Protocols', count: 2 }
                    ],
                    metadata: {}
                });
                setIsLoading(false);
            }, 500);
        };
        fetchEntity();
    }, [entityId]);

    if (isLoading || !entity) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-slate-400 font-bold tracking-widest text-xs uppercase">Loading Timeline...</div>
            </div>
        );
    }

    const bgClass = mode === 'EDIT' ? 'bg-amber-50/30' : mode === 'REVIEW' ? 'bg-blue-50/30' : 'bg-white';

    return (
        <div className={`flex flex-col h-full transition-colors duration-500 overflow-hidden ${bgClass}`}>
            {/* HEADER CONTROLS (Floating) */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0 bg-white/50 backdrop-blur-md z-30">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => setMode('VIEW')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'VIEW' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        View
                    </button>
                    <button
                        onClick={() => setMode('EDIT')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'EDIT' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => setMode('REVIEW')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${mode === 'REVIEW' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Review
                    </button>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                    <Icon name="plus" size={20} className="rotate-45" />
                </button>
            </div>

            {/* CORE NARRATIVE SURFACE */}
            <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
                <div className="max-w-2xl mx-auto px-6 py-8 space-y-12 pb-32">

                    {/* ZONE 1: IDENTITY (Fixed context) */}
                    <ProfileIdentityZone entity={entity} mode={mode} />

                    {/* ZONE 2: CONTEXT STRIP */}
                    <ProfileContextStrip entity={entity} />

                    {/* ZONE 3: TIMELINE (The Story) */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Timeline</h3>
                            <div className="flex items-center space-x-1">
                                <span className="text-[10px] font-bold text-slate-400">Show:</span>
                                <select className="text-[10px] font-black bg-transparent border-none focus:ring-0 cursor-pointer">
                                    <option>Everything</option>
                                    <option>Messages</option>
                                    <option>Calls</option>
                                    <option>System</option>
                                </select>
                            </div>
                        </div>
                        <ProfileTimeline events={entity.timeline} />
                    </section>

                    {/* ZONE 4: RELATED ENTITIES */}
                    <ProfileRelatedEntities related={entity.related} />

                    {/* ZONE 5: STATE & SAFE EDITS */}
                    <ProfileStateControl entity={entity} mode={mode} onSave={() => setMode('VIEW')} />

                    {/* ZONE 6: GUIDED ACTIONS */}
                    <ProfileGuidedActions entity={entity} mode={mode} />

                </div>
            </div>
        </div>
    );
};
