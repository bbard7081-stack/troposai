import React, { useState, useEffect, useRef } from 'react';
import { useGridEngine } from './GridEngineProvider';
import { Icon } from '../../components/Icon';
import { ActivityPeek } from './components/ActivityPeek';
import { ConflictResolver } from './components/ConflictResolver';
import { useGridShortcuts } from './hooks/useGridShortcuts';

interface ReadOnlyGridProps {
    onRowSelected?: (id: string) => void;
    selectedRowId?: string | null;
}

interface OperationalColumn {
    id: string;
    title: string;
    type: string;
    options?: string[];
    locked?: boolean;
}

export const OperationalGrid: React.FC<ReadOnlyGridProps> = ({ onRowSelected, selectedRowId: externalSelectedId }) => {
    const {
        snapshot,
        engine,
        canUndo,
        canRedo,
        isSyncing,
        lastAction,
        undo,
        redo,
        createRecord,
        layer,
        setLayer,
        conflict
    } = useGridEngine();

    const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
    const selectedId = externalSelectedId || localSelectedId;

    const [peekState, setPeekState] = useState<{ id: string; active: boolean; pos: { x: number; y: number } }>({ id: '', active: false, pos: { x: 0, y: 0 } });
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef<HTMLInputElement>(null);
    const [showViewMenu, setShowViewMenu] = useState(false);

    const rowIds = snapshot.map(r => r.id);

    // Keyboard Shortcuts
    useGridShortcuts({
        rowIds,
        onSelectRow: (id) => {
            setLocalSelectedId(id);
            if (id) onRowSelected?.(id);
        },
        onOpenProfile: (id) => onRowSelected?.(id),
        onTogglePeek: (id, active) => setPeekState({ id, active, pos: { x: 400, y: 300 } }),
        onFocusSearch: () => searchRef.current?.focus(),
        onToggleViews: () => setShowViewMenu(prev => !prev),
        onToggleFilters: () => { } // TODO: Implement filter sidebar
    });

    if (snapshot.length === 0) {
        return (
            <div className="p-12 text-center bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-200/50 my-8">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center border border-slate-200 shadow-sm mx-auto mb-6">
                    <Icon name="plus" size={32} className="text-blue-500" />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">No Records in Engine</h3>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto text-sm font-medium">Capture your first record via the authoritative ingestion pipeline.</p>
                <button
                    onClick={async () => {
                        const name = prompt('Enter contact name:');
                        if (name) await createRecord({ name }, 'grid');
                    }}
                    className="inline-flex items-center space-x-3 px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                >
                    <Icon name="plus" size={18} />
                    <span className="uppercase tracking-widest text-xs">Initialize First Record</span>
                </button>
                <ConflictResolver />
            </div>
        );
    }

    const baseColumns: OperationalColumn[] = [
        { id: 'name', title: 'Name', type: 'text', locked: true },
        { id: 'phone', title: 'Phone', type: 'text' },
        { id: 'crm_status', title: 'Status', type: 'dropdown', options: ['New', 'Lead', 'Ringing', 'Connected', 'Disconnected', 'Closed'] },
        { id: 'assigned_to', title: 'Owner', type: 'text' },
    ];

    // Power Columns (Layer 2+)
    const powerColumns: OperationalColumn[] = layer >= 2 ? [
        { id: 'email', title: 'Email', type: 'text' },
        { id: 'city', title: 'City', type: 'text' },
    ] : [];

    const columns: OperationalColumn[] = [...baseColumns, ...powerColumns];

    return (
        <div className="relative mt-4 group/grid">
            {/* TOOLBAR: Capability Layer 1 (Always Visible) */}
            <div className="flex items-center justify-between mb-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-200/50 sticky top-0 z-40 shadow-xl shadow-slate-200/20">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                        <button
                            onClick={undo}
                            disabled={!canUndo}
                            className={`p-2 rounded-lg transition-all ${canUndo ? 'text-slate-700 hover:bg-white hover:shadow-sm' : 'text-slate-300 cursor-not-allowed'}`}
                            title="Undo (Ctrl+Z)"
                        >
                            <Icon name="undo" size={16} />
                        </button>
                        <button
                            onClick={redo}
                            disabled={!canRedo}
                            className={`p-2 rounded-lg transition-all ${canRedo ? 'text-slate-700 hover:bg-white hover:shadow-sm' : 'text-slate-300 cursor-not-allowed'}`}
                            title="Redo (Ctrl+Y)"
                        >
                            <Icon name="redo" size={16} />
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                            <Icon name="search" size={14} />
                        </div>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Search records... (/)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-11 pr-6 py-2.5 bg-slate-100 border-none rounded-2xl w-64 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none text-slate-800 placeholder:text-slate-400 placeholder:font-black placeholder:uppercase placeholder:text-[9px] placeholder:tracking-widest"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Layer Switcher */}
                    <div className="flex items-center bg-slate-900 rounded-2xl p-1 shadow-lg shadow-slate-900/10">
                        {[1, 2, 3].map(l => (
                            <button
                                key={l}
                                onClick={() => setLayer(l)}
                                className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${layer === l ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-white'}`}
                            >
                                L{l}
                            </button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1" />

                    <button
                        onClick={async () => {
                            const name = prompt('Enter contact name:');
                            if (name) await createRecord({ name }, 'grid');
                        }}
                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 font-black transition-all shadow-xl shadow-blue-600/20 active:scale-95 group"
                    >
                        <Icon name="plus" size={14} className="group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-[10px] uppercase tracking-[0.2em]">Add Record</span>
                    </button>
                </div>
            </div>

            {/* MAIN GRID SURFACE */}
            <div className="bg-white rounded-[40px] border border-slate-200/80 shadow-2xl shadow-slate-200/40 overflow-hidden ring-1 ring-slate-900/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="w-12 px-4 py-6 border-r border-slate-100" />
                                {columns.map(col => (
                                    <th
                                        key={col.id}
                                        className={`px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 last:border-r-0 ${col.locked ? 'sticky left-12 bg-slate-50/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span>{col.title}</span>
                                            {layer >= 2 && <Icon name="chevron-down" size={10} className="text-slate-300 cursor-pointer hover:text-blue-500" />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {snapshot.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map((row) => (
                                <tr
                                    key={row.id}
                                    onClick={() => onRowSelected?.(row.id)}
                                    onMouseEnter={(e) => setPeekState({ id: row.id, active: true, pos: { x: e.clientX, y: e.clientY } })}
                                    className={`group transition-all cursor-pointer ${selectedId === row.id ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}
                                >
                                    <td className="px-4 py-4 text-center border-r border-slate-50">
                                        <div className={`w-2 h-2 rounded-full mx-auto transition-all ${selectedId === row.id ? 'bg-blue-600 scale-125 shadow-lg shadow-blue-600/40' : 'bg-slate-200 group-hover:bg-slate-300'}`} />
                                    </td>

                                    {columns.map(col => (
                                        <td
                                            key={col.id}
                                            className={`px-4 py-4 text-sm border-r border-slate-50 last:border-r-0 ${col.locked ? 'sticky left-12 bg-white/80 backdrop-blur-sm z-10 group-hover:bg-slate-50/10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]' : ''}`}
                                        >
                                            {col.type === 'dropdown' ? (
                                                <select
                                                    value={row[col.id] || ''}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => engine?.updateContact(row.id, { [col.id]: e.target.value }, 'grid')}
                                                    className="w-full bg-transparent border-none focus:ring-4 focus:ring-blue-500/10 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 appearance-none transition-all cursor-pointer"
                                                >
                                                    {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={row[col.id] || ''}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => engine?.updateContact(row.id, { [col.id]: e.target.value }, 'grid')}
                                                    className="w-full bg-transparent border-none focus:ring-4 focus:ring-blue-500/10 rounded-xl px-3 py-2 outline-none font-bold text-slate-800 transition-all"
                                                />
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Status Bar (Layer 1) */}
                <div className="bg-slate-50 p-4 flex items-center justify-between border-t border-slate-100">
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline V2 Active</span>
                        </div>
                        {isSyncing && (
                            <div className="flex items-center space-x-2 text-blue-600">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Hardening Diffs...</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-4">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Layer {layer} Mode</span>
                        <div className="h-3 w-px bg-slate-200" />
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{snapshot.length} Authoritative Records</span>
                    </div>
                </div>
            </div>

            {/* Overlays */}
            {peekState.active && peekState.id && (
                <ActivityPeek
                    contactId={peekState.id}
                    onClose={() => setPeekState(prev => ({ ...prev, active: false }))}
                    position={peekState.pos}
                />
            )}

            <ConflictResolver />

            {/* Global Toasts */}
            {lastAction && (
                <div className="fixed bottom-10 right-10 z-[200] animate-in slide-in-from-right-10 duration-500">
                    <div className="bg-slate-900 shadow-2xl rounded-3xl p-5 border border-white/10 flex items-center space-x-4 min-w-[320px]">
                        <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40">
                            <Icon name="check" size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Pipeline Action</p>
                            <p className="text-sm font-bold text-white tracking-tight">{lastAction.message}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
