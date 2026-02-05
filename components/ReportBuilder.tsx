
import React, { useState, useMemo } from 'react';
import { Column, ClientData, FilterRule, AppUser, ColumnType, SavedReport } from '../types';
import { Icon } from './Icon';

interface ReportBuilderProps {
  data: ClientData[];
  columns: Column[];
  users: AppUser[];
  savedReports: SavedReport[];
  currentUser: AppUser;
  onBulkAssign: (clientIds: string[], userEmail: string) => void;
  onSaveReport: (report: SavedReport) => void;
  onDeleteReport: (id: string) => void;
}

const ReportBuilder: React.FC<ReportBuilderProps> = ({
  data,
  columns,
  users,
  savedReports,
  currentUser,
  onBulkAssign,
  onSaveReport,
  onDeleteReport
}) => {
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([
    { columnId: 'approved', operator: 'equals', value: 'yes', logic: 'AND' }
  ]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [reportName, setReportName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [viewMode, setViewMode] = useState<'builder' | 'results'>('builder');

  const getUniqueValues = (columnId: string) => {
    const col = columns.find(c => c.id === columnId);
    if (col?.type === ColumnType.DROPDOWN && col.options) {
      return col.options;
    }
    const values = data.map(item => item[columnId]).filter(v => v !== undefined && v !== null && v !== '');
    return Array.from(new Set(values)).sort();
  };

  const filteredClients = useMemo(() => {
    return data.filter(client => {
      if (activeFilters.length === 0) return true;
      return activeFilters.every(filter => {
        const cellValue = client[filter.columnId];
        const filterVal = filter.value;
        if (filter.operator === 'equals') return String(cellValue) === String(filterVal);
        if (filter.operator === 'contains') return String(cellValue).toLowerCase().includes(String(filterVal).toLowerCase());
        if (filter.operator === 'greater') return Number(cellValue) > Number(filterVal);
        if (filter.operator === 'less') return Number(cellValue) < Number(filterVal);
        return true;
      });
    });
  }, [data, activeFilters]);

  // Derived columns for the report results to ensure "Name" is always first
  const reportDisplayColumns = useMemo(() => {
    const nameCol = columns.find(c => c.id === 'name');
    const otherCols = columns.filter(c => c.id !== 'name').slice(0, 5);
    return nameCol ? [nameCol, ...otherCols] : otherCols;
  }, [columns]);

  const addFilter = () => {
    setActiveFilters([...activeFilters, { columnId: columns[0].id, operator: 'equals', value: '', logic: 'AND' }]);
  };

  const removeFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, updates: Partial<FilterRule>) => {
    setActiveFilters(activeFilters.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const handleRunAssign = () => {
    if (!selectedAssignee) { alert('Please select a user to assign to.'); return; }
    const ids = filteredClients.map(c => c.id);
    if (ids.length === 0) { alert('No clients match the current filters.'); return; }
    if (confirm(`Assign ${ids.length} clients to ${selectedAssignee}?`)) {
      onBulkAssign(ids, selectedAssignee);
    }
  };

  const handleSaveReportConfig = () => {
    if (!reportName.trim()) return;
    const newReport: SavedReport = {
      id: `rep_${Date.now()}`,
      name: reportName,
      filters: [...activeFilters],
      columnOrder: columns.map(c => c.id),
      createdBy: currentUser.email,
      sharedWith: []
    };
    onSaveReport(newReport);
    setReportName('');
    setShowSaveModal(false);
  };

  const loadReport = (report: SavedReport) => {
    setActiveFilters(report.filters);
    setViewMode('results');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Sidebar - Saved Reports */}
      <div className="w-full lg:w-72 shrink-0 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm sticky top-8 space-y-6">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Icon name="zap" size={18} className="text-blue-500" />
              <h3 className="font-bold text-slate-800">Quick Presets</h3>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Today', type: 'today' },
                { label: 'This Week', type: 'week' },
                { label: 'This Month', type: 'month' },
                { label: 'This Year', type: 'year' }
              ].map(preset => (
                <button
                  key={preset.type}
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    setActiveFilters([{ columnId: 'date_outreached', operator: 'contains', value: today, logic: 'AND' }]);
                    setViewMode('results');
                  }}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between group"
                >
                  {preset.label}
                  <Icon name="chevron-down" size={10} className="-rotate-90 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center space-x-2 mb-4">
              <Icon name="star" size={18} className="text-yellow-500 fill-yellow-500" />
              <h3 className="font-bold text-slate-800">Saved Reports</h3>
            </div>
            <div className="space-y-1">
              {savedReports.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No saved reports yet.</p>
              ) : (
                savedReports.map(report => (
                  <div key={report.id} className="group flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <button
                      onClick={() => loadReport(report)}
                      className="flex-1 text-left text-sm font-semibold text-slate-600 truncate group-hover:text-blue-600"
                    >
                      {report.name}
                    </button>
                    <button
                      onClick={() => onDeleteReport(report.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Icon name="plus" size={14} className="rotate-45" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => { setViewMode('builder'); setActiveFilters([]); }}
            className="w-full mt-2 py-3 border-2 border-dashed border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all rounded-xl text-xs font-black uppercase tracking-widest"
          >
            New Custom Query
          </button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 space-y-8 min-w-0">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <Icon name={viewMode === 'builder' ? 'settings' : 'reports'} size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                  {viewMode === 'builder' ? 'Query Engine' : 'Report Results'}
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  {viewMode === 'builder' ? 'Build complex filters to create your report.' : 'Viewing filtered data matching your report criteria.'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'builder' ? 'results' : 'builder')}
                className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-bold text-sm transition-all"
              >
                <Icon name={viewMode === 'builder' ? 'reports' : 'settings'} size={16} />
                <span>{viewMode === 'builder' ? 'Preview Results' : 'Edit Filters'}</span>
              </button>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Icon name="save" size={16} />
                <span>Save Report</span>
              </button>
            </div>
          </div>

          {viewMode === 'builder' ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              {activeFilters.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/30">
                  <p className="text-sm text-slate-400 font-medium italic">No filters active. Showing all {data.length} records.</p>
                </div>
              )}
              {activeFilters.map((filter, idx) => {
                const uniqueOptions = getUniqueValues(filter.columnId);
                return (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 animate-in slide-in-from-left-2 duration-300 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-16 flex justify-center shrink-0">
                      {idx === 0 ? (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Where</span>
                      ) : (
                        <div className="px-2 py-1 bg-white rounded-md border border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">AND</div>
                      )}
                    </div>
                    <select
                      value={filter.columnId}
                      onChange={(e) => updateFilter(idx, { columnId: e.target.value, value: '' })}
                      className="flex-1 min-w-[140px] bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm"
                    >
                      {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <select
                      value={filter.operator}
                      onChange={(e) => updateFilter(idx, { operator: e.target.value as any })}
                      className="w-32 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm"
                    >
                      <option value="equals">is</option>
                      <option value="contains">contains</option>
                      <option value="greater">is &gt;</option>
                      <option value="less">is &lt;</option>
                    </select>
                    <div className="flex-1 min-w-[200px] relative">
                      <select
                        value={filter.value}
                        onChange={(e) => updateFilter(idx, { value: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold appearance-none shadow-sm"
                      >
                        <option value="">Select value...</option>
                        {uniqueOptions.map((opt, oIdx) => <option key={oIdx} value={String(opt)}>{String(opt)}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <Icon name="chevron-down" size={12} />
                      </div>
                    </div>
                    <button onClick={() => removeFilter(idx)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Icon name="plus" size={16} className="rotate-45" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addFilter}
                className="w-full py-4 mt-2 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center space-x-2 font-black text-xs uppercase tracking-widest"
              >
                <Icon name="plus" size={14} />
                <span>Add Condition</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl animate-in fade-in zoom-in-95 duration-300 bg-white">
              <table className="min-w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {reportDisplayColumns.map(col => (
                      <th key={col.id} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{col.title}</th>
                    ))}
                    <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClients.slice(0, 50).map(client => (
                    <tr key={client.id} className="hover:bg-slate-50/50 transition-colors">
                      {reportDisplayColumns.map(col => (
                        <td key={col.id} className="px-6 py-4 text-xs font-semibold text-slate-700 truncate max-w-[150px]">
                          {Array.isArray(client[col.id]) ? client[col.id].join(', ') : client[col.id]}
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <button className="text-blue-600 hover:text-blue-800 text-[10px] font-black uppercase tracking-widest">Details</button>
                      </td>
                    </tr>
                  ))}
                  {filteredClients.length === 0 && (
                    <tr>
                      <td colSpan={reportDisplayColumns.length + 1} className="px-6 py-10 text-center text-slate-400 italic text-sm">No records found matching criteria.</td>
                    </tr>
                  )}
                  {filteredClients.length > 50 && (
                    <tr>
                      <td colSpan={reportDisplayColumns.length + 1} className="px-6 py-3 text-center text-slate-400 bg-slate-50/50 text-[10px] font-bold">Showing first 50 of {filteredClients.length} results</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center group hover:border-blue-200 transition-all">
            <h3 className="text-5xl font-black text-slate-800 tracking-tighter group-hover:text-blue-600 transition-colors">{filteredClients.length}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Matching Records</p>
          </div>
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col space-y-6">
            <div className="flex items-center space-x-2">
              <Icon name="users" size={18} className="text-slate-400" />
              <h3 className="font-bold text-slate-800">Bulk Assignment</h3>
            </div>
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 text-sm font-bold shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
            >
              <option value="">Choose team member...</option>
              {users.map(u => <option key={u.id} value={u.email}>{u.name}</option>)}
            </select>
            <button
              onClick={handleRunAssign}
              disabled={filteredClients.length === 0}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase transition-all shadow-xl ${filteredClients.length === 0 ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white hover:bg-black active:scale-95'}`}
            >
              Run Batch Assignment
            </button>
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                <Icon name="save" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Create New Report</h3>
                <p className="text-sm text-slate-500 font-medium">Save these filters as a permanent report.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Report Title</label>
                <input
                  type="text"
                  autoFocus
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g. Q4 High Value Leads"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm shadow-sm"
                />
              </div>
              <div className="flex space-x-3 mt-8">
                <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-bold text-sm transition-all">Cancel</button>
                <button
                  onClick={handleSaveReportConfig}
                  disabled={!reportName.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportBuilder;
