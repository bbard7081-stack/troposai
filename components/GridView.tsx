
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Column, ClientData, ColumnType } from '../types';
import { Icon } from './Icon';
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from '../services/utils';

interface GridViewProps {
  columns: Column[];
  data: ClientData[];
  isAdmin: boolean;
  onCellUpdate: (rowId: string, colId: string, value: any) => void;
  onBulkCellUpdate: (rowIds: string[], colId: string, value: any) => void;
  onAddColumn: (col: Column) => void;
  onAddRow: () => void;
  onUpdateColumn: (columnId: string, updates: Partial<Column>) => void;
  onReorderColumns: (sourceIdx: number, targetIdx: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRowFocus?: (rowId: string) => void;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  callingPhoneNumber?: string;
  onSave?: () => void;
  onCall?: (phoneNumber: string, devicePreference: 'app' | 'cell') => void;
  activeRowId?: string | null;
}

type SortConfig = { key: string; direction: 'asc' | 'desc' } | null;

// Multi-Select Cell Component
const MultiSelectCell: React.FC<{
  values: string[];
  options: string[];
  onChange: (newValues: string[]) => void;
  isFocused: boolean;
}> = ({ values = [], options = [], onChange, isFocused }) => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { if (!isFocused) setIsOpen(false); }, [isFocused]);

  const toggleOption = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };

  return (
    <div className="relative w-full h-full flex items-center px-2 group/ms">
      <div onClick={() => setIsOpen(!isOpen)} className="flex flex-wrap gap-1 items-center w-full min-h-[24px] cursor-pointer whitespace-nowrap overflow-hidden">
        {values.length === 0 ? (
          <span className="text-slate-400 text-[10px] font-bold uppercase">Select...</span>
        ) : (
          values.map(v => (
            <span key={v} className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase flex items-center">
              {v}
              <button onClick={(e) => { e.stopPropagation(); toggleOption(v); }} className="ml-1 hover:text-blue-900">×</button>
            </span>
          ))
        )}
      </div>
      {isOpen && isFocused && (
        <div className="absolute top-full left-0 mt-1 w-max min-w-full bg-white/95 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {options.map(opt => (
            <label key={opt} className="flex items-center px-4 py-1.5 hover:bg-blue-50 cursor-pointer space-x-3 transition-colors">
              <input type="checkbox" checked={values.includes(opt)} onChange={() => toggleOption(opt)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-bold text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const GridView: React.FC<GridViewProps> = ({
  columns, data, isAdmin, onCellUpdate, onBulkCellUpdate, onAddColumn, onAddRow,
  onUpdateColumn, onReorderColumns, onUndo, onRedo, canUndo, canRedo, onRowFocus,
  isChatOpen, onToggleChat, callingPhoneNumber, onSave, onCall, activeRowId
}) => {
  // State
  const [filterText, setFilterText] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [focusedCell, setFocusedCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [showColModal, setShowColModal] = useState(false);
  const [editingColumn, setEditingColumn] = useState<Column | null>(null);
  const [colFormData, setColFormData] = useState({ title: '', type: ColumnType.TEXT, optionsString: '' });
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [historyModal, setHistoryModal] = useState<{ rowId: string; colId: string } | null>(null);
  const [devicePreference, setDevicePreference] = useState<'app' | 'cell'>(() => (localStorage.getItem('user_device_preference') as 'app' | 'cell') || 'app');

  // Virtualization State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 36;
  const BUFFER_ROWS = 5;

  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Computed Values
  const totalWidth = useMemo(() => columns.reduce((acc, col) => acc + (col.width || 150), 48), [columns]);

  const processedData = useMemo(() => {
    let filtered = data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(filterText.toLowerCase())));
    if (sortConfig) {
      filtered.sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key];
        if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
        if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [data, filterText, sortConfig]);

  // Virtualization
  const containerHeight = containerRef.current?.clientHeight || 600;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
  const endRow = Math.min(processedData.length, startRow + Math.ceil(containerHeight / ROW_HEIGHT) + BUFFER_ROWS * 2);
  const visibleData = processedData.slice(startRow, endRow);

  // Effects
  useEffect(() => { localStorage.setItem('user_device_preference', devicePreference); }, [devicePreference]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowExportDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (focusedCell) {
      const el = document.getElementById(`grid-cell-${focusedCell.rowIdx}-${focusedCell.colIdx}`);
      if (el) { el.focus(); if (el instanceof HTMLInputElement) el.select(); }
    }
  }, [focusedCell]);

  useEffect(() => {
    if (activeRowId) {
      const rowIdx = processedData.findIndex(r => r.id === activeRowId);
      if (rowIdx !== -1) {
        setFocusedCell({ rowIdx, colIdx: 0 });
        containerRef.current?.scrollTo({ top: rowIdx * ROW_HEIGHT - containerHeight / 2, behavior: 'smooth' });
      }
    }
  }, [activeRowId, processedData, containerHeight]);

  // Handlers
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);

  const handleSort = (columnId: string) => {
    setSortConfig(prev => prev?.key === columnId && prev.direction === 'asc' ? { key: columnId, direction: 'desc' } : { key: columnId, direction: 'asc' });
  };

  const handleSave = () => {
    setSaveStatus('saving');
    onSave?.();
    setTimeout(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2000); }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    const rowCount = processedData.length, colCount = columns.length;
    if (e.key === 'Tab') {
      e.preventDefault();
      let nc = e.shiftKey ? colIdx - 1 : colIdx + 1, nr = rowIdx;
      if (nc >= colCount) { nc = 0; nr = (rowIdx + 1) % rowCount; }
      else if (nc < 0) { nc = colCount - 1; nr = (rowIdx - 1 + rowCount) % rowCount; }
      setFocusedCell({ rowIdx: nr, colIdx: nc });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      let nr = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
      if (nr >= rowCount) nr = 0; else if (nr < 0) nr = rowCount - 1;
      setFocusedCell({ rowIdx: nr, colIdx });
    }
  };

  const handleCellFocus = (rowIdx: number, colIdx: number) => {
    setFocusedCell({ rowIdx, colIdx });
    if (onRowFocus && processedData[rowIdx]) onRowFocus(processedData[rowIdx].id);
  };

  const openAddCol = () => { setEditingColumn(null); setColFormData({ title: '', type: ColumnType.TEXT, optionsString: '' }); setShowColModal(true); };
  const openEditCol = (col: Column) => { setEditingColumn(col); setColFormData({ title: col.title, type: col.type, optionsString: col.options?.join(', ') || '' }); setShowColModal(true); };

  const handleSaveColumn = () => {
    if (!colFormData.title) return;
    const options = (colFormData.type === ColumnType.DROPDOWN || colFormData.type === ColumnType.MULTI_SELECT)
      ? colFormData.optionsString.split(',').map(s => s.trim()).filter(s => s) : undefined;
    if (editingColumn) {
      onUpdateColumn(editingColumn.id, { title: colFormData.title, type: colFormData.type, options: options || (colFormData.type === ColumnType.DROPDOWN || colFormData.type === ColumnType.MULTI_SELECT ? ['Choice 1', 'Choice 2'] : undefined) });
    } else {
      onAddColumn({ id: `col_${Date.now()}`, title: colFormData.title, type: colFormData.type, options: options || (colFormData.type === ColumnType.DROPDOWN || colFormData.type === ColumnType.MULTI_SELECT ? ['Choice 1', 'Choice 2'] : undefined), width: 150 });
    }
    setShowColModal(false);
  };

  // Render Cell
  const renderCell = (row: ClientData, col: Column, rIdx: number, cIdx: number) => {
    const val = row[col.id];
    const isFocused = focusedCell?.rowIdx === rIdx && focusedCell?.colIdx === cIdx;
    const isPrimary = cIdx === 0;
    const hasHistory = row.cellHistory?.[col.id]?.length > 0;

    const baseClass = `w-full h-full bg-transparent border-none outline-none px-3 text-[13px] font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-150 ${isFocused ? 'ring-[1.5px] ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] z-50 bg-white scale-[1.01] rounded-sm' : ''
      } ${isPrimary ? 'font-bold text-slate-800' : 'text-slate-600'}`;

    let content;
    if (col.type === ColumnType.DROPDOWN) {
      content = (
        <div className="w-full h-full relative flex items-center group/dd">
          <select
            id={`grid-cell-${rIdx}-${cIdx}`}
            value={val || ''}
            onChange={(e) => onCellUpdate(row.id, col.id, e.target.value)}
            onFocus={() => handleCellFocus(rIdx, cIdx)}
            onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
            className={`${baseClass} cursor-pointer appearance-none pr-8`}
          >
            <option value="" disabled>{col.id === 'assignedTo' ? 'Unassigned' : 'Select...'}</option>
            {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/dd:text-blue-500 transition-colors"><Icon name="chevron-down" size={12} /></div>
        </div>
      );
    } else if (col.type === ColumnType.MULTI_SELECT) {
      content = (
        <div id={`grid-cell-${rIdx}-${cIdx}`} tabIndex={0} onFocus={() => handleCellFocus(rIdx, cIdx)} onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)} className={`${baseClass} flex items-center`}>
          <MultiSelectCell values={Array.isArray(val) ? val : []} options={col.options || []} isFocused={isFocused} onChange={(v) => onCellUpdate(row.id, col.id, v)} />
        </div>
      );
    } else if (col.type === ColumnType.DATE) {
      content = <input id={`grid-cell-${rIdx}-${cIdx}`} type="date" value={val || ''} onChange={(e) => onCellUpdate(row.id, col.id, e.target.value)} onFocus={() => handleCellFocus(rIdx, cIdx)} onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)} className={baseClass} />;
    } else if (col.id === 'phone') {
      content = (
        <div className="w-full h-full flex items-center group/phone">
          <button onClick={() => onCall?.(val, devicePreference)} className={`flex-1 flex items-center space-x-2 text-left px-2 py-1 text-[13px] font-medium hover:text-blue-600 hover:bg-blue-50/50 rounded transition-all truncate ${isPrimary ? 'font-bold' : ''}`} title={`Dial ${val}`}>
            <Icon name="phone" size={14} className="flex-shrink-0 text-blue-500 opacity-50 group-hover/phone:opacity-100" />
            <span className="truncate">{val || ''}</span>
          </button>
          {callingPhoneNumber === row.phone && <span className="text-[8px] font-black text-green-600 uppercase animate-pulse">Incoming</span>}
        </div>
      );
    } else {
      content = <input id={`grid-cell-${rIdx}-${cIdx}`} type={col.type === ColumnType.NUMBER ? 'number' : 'text'} value={val || ''} placeholder={isFocused ? '' : '...'} onChange={(e) => onCellUpdate(row.id, col.id, e.target.value)} onFocus={() => handleCellFocus(rIdx, cIdx)} onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)} className={baseClass} />;
    }

    return (
      <td key={col.id} className={`p-0 border-r border-slate-200/50 relative ${isPrimary ? 'sticky left-12 z-20 bg-white/70 backdrop-blur-sm' : ''}`} style={{ width: col.width || 150, maxWidth: col.width || 150 }}>
        {content}
        {hasHistory && <div className="absolute top-0 right-0 w-0 h-0 border-t-[5px] border-t-amber-500 border-l-[5px] border-l-transparent" title="Has History" />}
      </td>
    );
  };

  // Main Render
  return (
    <div className="h-full flex flex-col font-sans">
      {/* Header Toolbar - Glass Effect */}
      <div className="flex items-center justify-between mb-4 space-x-3 px-1">
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl p-1 shadow-sm">
            <button onClick={onUndo} disabled={!canUndo} className={`p-2.5 rounded-xl transition-all ${canUndo ? 'text-slate-600 hover:bg-white/80 hover:text-blue-600' : 'text-slate-300'}`}><Icon name="undo" size={14} /></button>
            <button onClick={onRedo} disabled={!canRedo} className={`p-2.5 rounded-xl transition-all ${canRedo ? 'text-slate-600 hover:bg-white/80 hover:text-blue-600' : 'text-slate-300'}`}><Icon name="redo" size={14} /></button>
          </div>
          <div className="relative group">
            <Icon name="filter" size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input type="text" placeholder="GLOBAL SEARCH..." value={filterText} onChange={(e) => setFilterText(e.target.value)} className="pl-10 pr-4 py-2.5 bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl text-[10px] font-black tracking-[0.15em] focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all w-64 uppercase placeholder:text-slate-400" />
          </div>
          <button onClick={handleSave} className={`w-11 h-11 flex items-center justify-center rounded-2xl border shadow-sm transition-all ${saveStatus === 'saved' ? 'bg-green-500/10 border-green-500/30 text-green-600' : 'bg-white/50 backdrop-blur-xl border-white/30 text-slate-600 hover:bg-white/80'}`}>
            <Icon name="save" size={18} className={saveStatus === 'saving' ? 'animate-spin' : ''} />
          </button>
          <button onClick={onAddRow} className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95">
            <Icon name="plus" size={12} /><span>Add Record</span>
          </button>
          {isAdmin && <button onClick={openAddCol} className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"><Icon name="plus" size={12} /><span>Column</span></button>}
          <button onClick={onToggleChat} className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border ${isChatOpen ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20' : 'bg-white/50 backdrop-blur-xl border-white/30 text-slate-600'}`}>
            <Icon name="message" size={14} className="inline mr-2" /><span>Live Chat</span>
          </button>
        </div>
        <div className="flex items-center space-x-2" ref={dropdownRef}>
          <button onClick={() => setShowExportDropdown(!showExportDropdown)} className="flex items-center space-x-2 px-5 py-2.5 bg-white/50 backdrop-blur-xl border border-white/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white/80 transition-all">
            <Icon name="download" size={12} /><span>Export</span><Icon name="chevron-down" size={10} className={`transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
          </button>
          {showExportDropdown && (
            <div className="absolute top-full right-0 mt-2 w-52 bg-white/95 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95">
              {[{ label: 'PDF', fn: () => exportToPDF(processedData, 'export') }, { label: 'Excel', fn: () => exportToExcel(processedData, 'export') }, { label: 'CSV', fn: () => exportToCSV(processedData, 'export') }, { label: 'JSON', fn: () => exportToJSON(processedData, 'export') }].map(item => (
                <button key={item.label} onClick={() => { item.fn(); setShowExportDropdown(false); }} className="w-full text-left px-5 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">Export as {item.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Virtualized Grid Container - Glass Effect */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-auto bg-white/40 backdrop-blur-[20px] border border-white/30 rounded-[28px] shadow-[0_20px_60px_rgba(0,0,0,0.06)] custom-scrollbar">
        <div style={{ height: processedData.length * ROW_HEIGHT, width: totalWidth, position: 'relative' }}>
          <table className="border-collapse absolute top-0 left-0" style={{ width: totalWidth }}>
            <thead className="sticky top-0 z-40">
              <tr className="bg-slate-50/80 backdrop-blur-2xl h-10 shadow-sm">
                <th className="w-12 border-r border-b border-slate-200/50 bg-slate-100/50 sticky left-0 z-50 text-[10px] font-black text-slate-400">#</th>
                {columns.map((col, idx) => (
                  <th key={col.id} onClick={() => handleSort(col.id)} style={{ width: col.width || 150 }} className={`border-r border-b border-slate-200/50 text-left px-3 cursor-pointer group ${idx === 0 ? 'sticky left-12 z-40 bg-slate-100/50' : ''}`}>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 truncate">{col.title}</span>
                      {sortConfig?.key === col.id && <Icon name="chevron-down" size={10} className={`text-blue-500 transition-transform ${sortConfig.direction === 'asc' ? 'rotate-180' : ''}`} />}
                      {isAdmin && <button onClick={(e) => { e.stopPropagation(); openEditCol(col); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded transition-opacity"><Icon name="settings" size={10} className="text-slate-400" /></button>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ transform: `translateY(${startRow * ROW_HEIGHT}px)` }}>
              {visibleData.map((row, i) => {
                const rIdx = startRow + i;
                const active = activeRowId === row.id;
                const calling = callingPhoneNumber === row.phone;
                return (
                  <tr key={row.id} className={`h-9 group transition-all duration-200 hover:bg-blue-500/[0.03] ${active ? 'bg-blue-600/[0.05] ring-1 ring-blue-400/50' : calling ? 'bg-green-50 animate-pulse' : ''}`}>
                    <td className="border-r border-b border-slate-200/40 text-center text-[10px] font-black text-slate-400 bg-slate-50/30 sticky left-0 z-10 group-hover:bg-blue-50/50 transition-colors">{rIdx + 1}</td>
                    {columns.map((col, cIdx) => renderCell(row, col, rIdx, cIdx))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between px-3">
        <div className="flex items-center space-x-5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loaded: {data.length} records</span>
          <div className="flex items-center space-x-2"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" /><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Enterprise Engine Active</span></div>
        </div>
        <p className="text-[9px] font-bold text-slate-300 tracking-widest uppercase">Tab = Next Cell • Enter = Next Row • Shift = Reverse</p>
      </div>

      {/* Column Config Modal */}
      {showColModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 backdrop-blur-xl p-8">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/30 p-10 rounded-[36px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-8 text-slate-800">{editingColumn ? 'Edit Column' : 'Add Column'}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Column Title</label>
                <input className="w-full px-5 py-4 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold" value={colFormData.title} onChange={e => setColFormData({ ...colFormData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Column Type</label>
                <select className="w-full px-5 py-4 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold" value={colFormData.type} onChange={e => setColFormData({ ...colFormData, type: e.target.value as ColumnType })}>
                  <option value={ColumnType.TEXT}>Text</option><option value={ColumnType.NUMBER}>Number</option><option value={ColumnType.DATE}>Date</option><option value={ColumnType.DROPDOWN}>Dropdown</option><option value={ColumnType.MULTI_SELECT}>Multi-Select</option>
                </select>
              </div>
              {(colFormData.type === ColumnType.DROPDOWN || colFormData.type === ColumnType.MULTI_SELECT) && (
                <div>
                  <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Options (comma separated)</label>
                  <input className="w-full px-5 py-4 bg-white/70 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold" placeholder="Option 1, Option 2" value={colFormData.optionsString} onChange={e => setColFormData({ ...colFormData, optionsString: e.target.value })} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-6 mt-10">
                <button onClick={() => setShowColModal(false)} className="py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancel</button>
                <button onClick={handleSaveColumn} className="py-4 bg-slate-950 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/50 backdrop-blur-xl p-8">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/30 p-10 rounded-[36px] w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            <h2 className="text-xl font-black uppercase tracking-tight mb-6 text-slate-800">Cell History</h2>
            <div className="flex-1 overflow-auto space-y-3">
              {data.find(r => r.id === historyModal.rowId)?.cellHistory?.[historyModal.colId]?.length ? (
                data.find(r => r.id === historyModal.rowId)!.cellHistory![historyModal.colId].map((entry, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start space-x-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{entry.user?.[0] || '?'}</div>
                    <div className="flex-1"><div className="text-xs font-bold text-slate-900">{entry.user}</div><div className="text-[10px] text-slate-500">"{entry.from}" → "{entry.to}"</div></div>
                    <span className="text-[9px] font-black text-slate-400">{entry.time}</span>
                  </div>
                ))
              ) : <p className="text-center text-slate-400 py-8">No history for this cell.</p>}
            </div>
            <button onClick={() => setHistoryModal(null)} className="mt-6 w-full py-4 bg-slate-950 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridView;
