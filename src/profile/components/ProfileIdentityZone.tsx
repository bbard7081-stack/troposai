import React from 'react';
import { UniversalEntity } from '@/types';

interface ProfileIdentityZoneProps {
    entity: UniversalEntity;
    mode: string;
}

export const ProfileIdentityZone: React.FC<ProfileIdentityZoneProps> = ({ entity, mode }) => {
    return (
        <header className="space-y-4">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight leading-none">
                        {entity.name}
                    </h1>
                    <p className="text-lg font-medium text-slate-400">
                        {entity.secondaryIdentifier}
                    </p>
                </div>
                <div className="flex flex-col items-end space-y-2">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border-2 ${entity.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                        {entity.status}
                    </span>
                    <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400">
                        <span className="uppercase tracking-widest">Owner:</span>
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{entity.owner}</span>
                    </div>
                </div>
            </div>

            {mode === 'EDIT' && (
                <div className="bg-amber-100/50 border border-amber-200 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
                        Edit Mode Active — Changes will be governed by the Spine
                    </p>
                </div>
            )}
        </header>
    );
};
