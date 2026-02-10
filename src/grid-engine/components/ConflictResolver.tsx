import React from 'react';
import { useGridEngine } from '../GridEngineProvider';
import { Icon } from '../../../components/Icon';

export const ConflictResolver: React.FC = () => {
    const { conflict, clearConflict, onRowSelected } = useGridEngine() as any; // onRowSelected needs to be exposed or passed

    if (!conflict) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                <div className="p-10 text-center">
                    <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-white shadow-sm">
                        <Icon name="alert-triangle" size={40} className="text-amber-500" />
                    </div>

                    <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Identity Match Found</h2>
                    <p className="text-slate-500 font-medium mb-10 leading-relaxed">
                        The Ingestion Pipeline detected that this record already exists in the system. <br />
                        <span className="text-slate-400 text-sm">Conflict: {conflict.message}</span>
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                onRowSelected?.(conflict.record.id);
                                clearConflict();
                            }}
                            className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center space-x-3"
                        >
                            <Icon name="external-link" size={16} />
                            <span>Open Existing Record</span>
                        </button>

                        <button
                            onClick={clearConflict}
                            className="w-full py-5 bg-slate-50 text-slate-500 rounded-3xl font-black uppercase tracking-widest text-xs hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                            <Icon name="database" size={18} className="text-slate-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pipeline ID</p>
                            <p className="text-xs font-bold text-slate-700">{conflict.record.id}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-black bg-white text-slate-400 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200">
                        Spine Protected
                    </span>
                </div>
            </div>
        </div>
    );
};
