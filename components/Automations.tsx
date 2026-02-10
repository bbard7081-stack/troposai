
import React, { useState } from 'react';
import { Column, AppUser, Automation } from '../types';
import { Icon } from './Icon';

interface AutomationsProps {
  columns: Column[];
  users: AppUser[];
  automations: Automation[];
  onSaveAutomations: (automations: Automation[]) => void;
}

const Automations: React.FC<AutomationsProps> = ({ columns, users, automations, onSaveAutomations }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Automation>>({
    name: '',
    trigger: { type: 'CELL_CHANGE', columnId: columns[0]?.id, value: '' },
    action: { type: 'UPDATE_CELL', columnId: columns[0]?.id, value: '' },
    enabled: true
  });

  const handleAdd = () => {
    const newAuto: Automation = {
      id: `auto_${Date.now()}`,
      name: formData.name || 'New Automation',
      trigger: formData.trigger as any,
      action: formData.action as any,
      enabled: true,
      createdAt: new Date().toISOString()
    };
    onSaveAutomations([...automations, newAuto]);
    setIsModalOpen(false);
  };

  const toggleAutomation = (id: string) => {
    onSaveAutomations(automations.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const deleteAutomation = (id: string) => {
    onSaveAutomations(automations.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">CRM Automations</h2>
          <p className="text-sm text-slate-500 font-medium">Create "If-This-Then-That" logic to streamline your workflow.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-bold text-sm shadow-xl shadow-blue-500/20 transition-all active:scale-95"
        >
          <Icon name="plus" size={18} />
          <span>New Automation</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {automations.map(auto => (
          <div key={auto.id} className={`bg-white p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md ${auto.enabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-2xl ${auto.enabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                <Icon name="zap" size={24} />
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => toggleAutomation(auto.id)}
                  className={`w-10 h-6 rounded-full relative transition-all ${auto.enabled ? 'bg-green-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${auto.enabled ? 'right-1' : 'left-1'}`} />
                </button>
                <button 
                  onClick={() => deleteAutomation(auto.id)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Icon name="plus" size={16} className="rotate-45" />
                </button>
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800 mb-2">{auto.name}</h3>
            
            <div className="space-y-3 mt-4">
              <div className="flex items-center space-x-2 text-xs font-medium">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] font-black w-14">Trigger</span>
                <span className="text-slate-700">When <b>{columns.find(c => c.id === auto.trigger.columnId)?.title}</b> changes</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-medium">
                <span className="text-slate-400 uppercase tracking-widest text-[9px] font-black w-14">Action</span>
                <span className="text-blue-600 font-bold">
                  {auto.action.type === 'UPDATE_CELL' && `Update ${columns.find(c => c.id === auto.action.columnId)?.title} to "${auto.action.value}"`}
                  {auto.action.type === 'ASSIGN_USER' && `Assign to ${users.find(u => u.email === auto.action.userEmail)?.name}`}
                </span>
              </div>
            </div>
          </div>
        ))}

        {automations.length === 0 && (
          <div className="col-span-full py-20 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center text-center">
            <div className="p-6 bg-white rounded-full shadow-lg mb-6">
              <Icon name="zap" size={48} className="text-slate-200" />
            </div>
            <h3 className="text-xl font-bold text-slate-400">No Automations Found</h3>
            <p className="text-sm text-slate-400 mt-2">Boost productivity by automating repetitive tasks.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[40px] w-full max-w-lg shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex items-center space-x-3 mb-8">
              <div className="p-4 bg-blue-600 text-white rounded-3xl shadow-lg shadow-blue-500/20">
                <Icon name="zap" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Create Automation</h3>
                <p className="text-sm text-slate-500 font-medium">Define your trigger and resulting action.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Internal Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Auto-assign New Inquiries"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
                />
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Trigger Conditions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">When Column...</label>
                    <select 
                      value={formData.trigger?.columnId}
                      onChange={(e) => setFormData({ ...formData, trigger: { ...formData.trigger!, columnId: e.target.value } })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    >
                      {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 mb-1">Changes to Value...</label>
                    <input 
                      type="text" 
                      placeholder="Any value"
                      value={formData.trigger?.value}
                      onChange={(e) => setFormData({ ...formData, trigger: { ...formData.trigger!, value: e.target.value } })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-400">Action Result</h4>
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    {['UPDATE_CELL', 'ASSIGN_USER'].map(type => (
                      <button 
                        key={type}
                        onClick={() => setFormData({ ...formData, action: { ...formData.action!, type: type as any } })}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formData.action?.type === type ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}
                      >
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  
                  {formData.action?.type === 'UPDATE_CELL' && (
                    <div className="grid grid-cols-2 gap-4">
                      <select 
                        value={formData.action?.columnId}
                        onChange={(e) => setFormData({ ...formData, action: { ...formData.action!, columnId: e.target.value } })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                      >
                        {columns.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <input 
                        type="text" 
                        placeholder="New value"
                        value={formData.action?.value}
                        onChange={(e) => setFormData({ ...formData, action: { ...formData.action!, value: e.target.value } })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                      />
                    </div>
                  )}

                  {formData.action?.type === 'ASSIGN_USER' && (
                    <select 
                      value={formData.action?.userEmail}
                      onChange={(e) => setFormData({ ...formData, action: { ...formData.action!, userEmail: e.target.value } })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                    >
                      <option value="">Select teammate...</option>
                      {users.map(u => <option key={u.id} value={u.email}>{u.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 flex space-x-4">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleAdd}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-500/20 text-sm active:scale-95"
              >
                Launch Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Automations;
