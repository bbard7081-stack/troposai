import React from 'react';
import { UniversalEntity } from '@/types';

interface ProfileContextStripProps {
    entity: UniversalEntity;
}

export const ProfileContextStrip: React.FC<ProfileContextStripProps> = ({ entity }) => {
    return (
        <div className="flex flex-wrap gap-2 border-y border-slate-100 py-4">
            {entity.contextChips.map((chip, idx) => (
                <div
                    key={idx}
                    title="Click to explore"
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95 ${chip.type === 'danger' ? 'bg-red-50 border-red-100 text-red-600' :
                        'bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{chip.label}:</span>
                    <span className="text-xs font-black">{chip.value}</span>
                </div>
            ))}
            <button className="ml-auto text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">
                + View All Stats
            </button>
        </div>
    );
};
