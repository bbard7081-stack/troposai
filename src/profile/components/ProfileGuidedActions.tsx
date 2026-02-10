import React from 'react';
import { Icon } from '@/components/Icon';
import { UniversalEntity } from '@/types';

interface ProfileGuidedActionsProps {
    entity: UniversalEntity;
    mode: string;
}

export const ProfileGuidedActions: React.FC<ProfileGuidedActionsProps> = ({ entity, mode }) => {
    return (
        <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Guided Actions</h3>
            <div className="grid grid-cols-1 gap-3">
                {/* ACTION 1: Communication */}
                <button className="group flex items-center space-x-4 p-4 bg-white border border-slate-100 rounded-3xl hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all text-left">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Icon name="phone" size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800">Initiate Contact</p>
                        <p className="text-xs font-bold text-slate-400">Reach out via Phone or SMS</p>
                    </div>
                    <Icon name="plus" size={16} className="ml-auto text-slate-200 group-hover:text-blue-600" />
                </button>

                {/* ACTION 2: Assignment */}
                <button className="group flex items-center space-x-4 p-4 bg-white border border-slate-100 rounded-3xl hover:border-purple-200 hover:shadow-xl hover:shadow-purple-50 transition-all text-left">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                        <Icon name="users" size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-800">Transfer Ownership</p>
                        <p className="text-xs font-bold text-slate-400">Assign to another team member</p>
                    </div>
                    <Icon name="plus" size={16} className="ml-auto text-slate-200 group-hover:text-purple-600" />
                </button>

                {/* ACTION 3: Closure (Conditional) */}
                <button className="group flex items-center justify-center p-4 border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all uppercase text-[10px] font-black tracking-widest">
                    Close Record & Lock Timeline
                </button>
            </div>
        </section>
    );
};
