
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { ClientData } from '../types';
import { Icon } from './Icon';

interface DashboardProps {
  data: ClientData[];
}

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  // Logic for new metrics
  const totalCount = data.length;
  
  const screenedCount = React.useMemo(() => {
    return data.filter(c => c.dateScreened && String(c.dateScreened).trim() !== '').length;
  }, [data]);

  const approvedCount = React.useMemo(() => {
    return data.filter(c => String(c.approved).toLowerCase() === 'yes').length;
  }, [data]);

  const screeningRatio = totalCount > 0 ? Math.round((screenedCount / totalCount) * 100) : 0;
  const approvalRate = screenedCount > 0 ? Math.round((approvedCount / screenedCount) * 100) : 0;

  // Pie chart data for screening status
  const screeningData = React.useMemo(() => [
    { name: 'Screened', value: screenedCount },
    { name: 'Not Screened', value: totalCount - screenedCount }
  ], [totalCount, screenedCount]);

  // Approval status data
  const approvalStatusData = React.useMemo(() => [
    { name: 'Approved', value: approvedCount },
    { name: 'Declined/Pending', value: totalCount - approvedCount }
  ], [totalCount, approvedCount]);

  const COLORS = ['#3b82f6', '#e2e8f0']; // Blue and Slate
  const APPROVED_COLORS = ['#10b981', '#f1f5f9']; // Green and Slate

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4 group hover:shadow-xl hover:shadow-slate-500/5 transition-all">
          <div className="p-4 bg-slate-50 text-slate-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Icon name="grid" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Cases</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4 group hover:shadow-xl hover:shadow-blue-500/5 transition-all">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Icon name="search" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cases Screened</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{screenedCount}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4 group hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Icon name="reports" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Screening Ratio</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{screeningRatio}%</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center space-x-4 group hover:shadow-xl hover:shadow-green-500/5 transition-all">
          <div className="p-4 bg-green-50 text-green-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Icon name="star" size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Cases Approved</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{approvedCount}</p>
          </div>
        </div>
      </div>

      {/* Visual Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Screening Progress */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Screening Completion</h3>
            <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-widest">{screeningRatio}% Complete</span>
          </div>
          <div className="h-64 flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={screeningData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {screeningData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-800">{screenedCount}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Screened</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
              <p className="text-xl font-black text-slate-800">{totalCount}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ratio</p>
              <p className="text-xl font-black text-slate-800">{screeningRatio}%</p>
            </div>
          </div>
        </div>

        {/* Approval Success Rate */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Approval Conversion</h3>
            <span className="text-[10px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full uppercase tracking-widest">{approvalRate}% Approved</span>
          </div>
          <div className="h-64 flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={approvalStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {approvalStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={APPROVED_COLORS[index % APPROVED_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-green-600">{approvalRate}%</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Approved</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Approved</p>
              <p className="text-xl font-black text-slate-800">{approvedCount}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
              <p className="text-xl font-black text-slate-800">{totalCount}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
