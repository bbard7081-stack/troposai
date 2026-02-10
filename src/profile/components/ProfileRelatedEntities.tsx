import React, { useState } from 'react';
import { Icon } from '@/components/Icon';

interface Related {
    id: string;
    type: string;
    label: string;
    count?: number;
}

interface ProfileRelatedEntitiesProps {
    related: Related[];
}

export const ProfileRelatedEntities: React.FC<ProfileRelatedEntitiesProps> = ({ related }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <section className="border rounded-2xl border-slate-100 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <Icon name="grid" size={16} className="text-slate-400" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Related Entities</h3>
                </div>
                <Icon name="plus" size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
            </button>

            {isOpen && (
                <div className="p-2 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-300">
                    {related.map((item) => (
                        <button
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left"
                        >
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.type}</p>
                                <p className="text-xs font-bold text-slate-700">{item.label}</p>
                            </div>
                            {item.count && (
                                <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-black">
                                    {item.count}
                                </span>
                            )}
                        </button>
                    ))}
                    <button className="col-span-2 p-3 rounded-xl border border-dashed border-slate-200 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-colors">
                        + Connect New Entity
                    </button>
                </div>
            )}
        </section>
    );
};
