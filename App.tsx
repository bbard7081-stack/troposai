import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from './components/Icon';
import Dashboard from './components/Dashboard';
import Messaging from './components/Messaging';
import SidebarMessaging from './components/SidebarMessaging';
import AdminPanel from './components/AdminPanel';
import ReportBuilder from './components/ReportBuilder';
import { RingCentralService } from './services/ringcentral';
import Automations from './components/Automations';
import { CallDispositionModal } from './components/CallDispositionModal';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import * as api from './services/api';
import { GridEngineProvider } from './src/grid-engine/GridEngineProvider';
import { OperationalGrid } from './src/grid-engine/OperationalGrid';
import { UniversalProfile } from './src/profile/UniversalProfile';
import RingCentralModule from './components/RingCentralModule';
import { ClientData, Column, Automation, AppUser, ChatMessage, SystemHistoryPoint, AppCallLog, SavedReport } from './types';
import { INITIAL_COLUMNS } from './constants';

const App: React.FC = () => {
  console.log("🔥 ENGINE BUILD ACTIVE 🔥");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [originalUser, setOriginalUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'dashboard' | 'admin' | 'messages' | 'reports' | 'automations' | 'super-admin'>('grid');
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'profile' | 'messages' | 'calls'>('profile');
  const [notifications, setNotifications] = useState<string[]>([]);
  const [activeCall, setActiveCall] = useState<{ phoneNumber: string, status: 'ringing' | 'connected' | 'disconnected' } | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  // --- MULTI-TENANT STATE ---
  const [currentTenant, setCurrentTenant] = useState<{ id: string, name: string, slug: string } | null>(null);

  useEffect(() => {
    // Public data (Users for login screen)
    const loadPublicData = async () => {
      try {
        const usersData = await api.fetchUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadPublicData();
  }, []);

  useEffect(() => {
    // Protected data
    const loadProtectedData = async () => {
      try {
        const [automationsData, reportsData] = await Promise.all([
          api.fetchAutomations(),
          api.fetchReports()
        ]);
        setAutomations(automationsData);
        setSavedReports(reportsData);
      } catch (error) {
        console.error('Failed to load protected data:', error);
      }
    };

    if (isLoggedIn) {
      loadProtectedData();
    }
  }, [isLoggedIn]);

  // Data-derived values like visibleData and activeClientName 
  // will now be calculated inside components using useGridEngine()

  const columnsWithUserOptions = useMemo(() => {
    return INITIAL_COLUMNS.map(col => {
      if (col.id === 'assignedTo') {
        return {
          ...col,
          options: users.map(u => ({ label: u.name, value: u.email }))
        };
      }
      return col;
    });
  }, [users]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const user = await api.login({ email: loginEmail, password: loginPassword });
      setCurrentUser(user);
      setIsLoggedIn(true);
      localStorage.setItem('tropos_user', JSON.stringify(user));
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="bg-white p-10 rounded-[32px] shadow-2xl w-full max-w-md border border-slate-100 z-10">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Icon name="grid" size={20} color="white" />
            </div>
            <h1 className="text-3xl font-black text-slate-800">Tropos</h1>
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">Sign in to your account</h2>
          <p className="text-slate-500 mb-8 font-medium">Enter your credentials to access the platform.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center space-x-3">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <p className="text-sm font-bold text-red-600">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-5 bg-slate-900 text-white rounded-2xl font-black transition-all shadow-lg active:scale-[0.98] ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800 hover:shadow-blue-500/10'}`}
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 font-medium">
            Contact your administrator if you've lost your access credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0">
        <div className="p-8 pb-4">
          <div className="flex items-center space-x-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <Icon name="grid" size={20} color="white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">Tropos</h1>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
              { id: 'grid', label: 'Contacts', icon: 'grid' },
              { id: 'messages', label: 'Messages', icon: 'message' },
              { id: 'reports', label: 'Reports', icon: 'chart' },
              { id: 'automations', label: 'Automations', icon: 'zap' },
              { id: 'admin', label: 'Users', icon: 'users', adminOnly: true },
              { id: 'super-admin', label: 'Infrastructure', icon: 'settings', adminOnly: true }
            ].map(item => {
              if (item.adminOnly && currentUser?.role !== 'ADMIN') return null;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200 group ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                    }`}
                >
                  <Icon name={item.icon as any} size={20} color={active ? '#1d4ed8' : '#64748b'} />
                  <span className={`font-bold text-sm ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{item.label}</span>
                  {active && <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full"></div>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-8 pt-4">
          <div className="bg-slate-50 rounded-3xl p-6 flex items-center space-x-4 border border-slate-100/50">
            <div className="relative">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-200 font-black text-blue-600 shadow-sm">
                {currentUser?.name.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-800 truncate">{currentUser?.name}</p>
              <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-wider">{currentUser?.role}</p>
            </div>
            <button
              onClick={() => setIsLoggedIn(false)}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Sign Out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
          {originalUser && (
            <button
              onClick={() => {
                setCurrentUser(originalUser);
                setOriginalUser(null);
                setActiveTab('admin');
                setNotifications(prev => ['Welcome back, Admin', ...prev]);
              }}
              className="mt-3 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white font-bold text-xs transition-all border border-red-500/20"
            >
              <Icon name="logout" size={14} /><span>Stop Impersonating</span>
            </button>
          )}
        </div>
      </aside>

      <GridEngineProvider initialRows={[]} columns={columnsWithUserOptions as any}>
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <header className="h-16 border-b bg-white/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
            <div className="flex items-center space-x-6">
              <h2 className="text-xl font-bold text-slate-800 capitalize">{activeTab}</h2>
              {notifications.length > 0 && <span className="flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold animate-in fade-in slide-in-from-left-4">{notifications[0]}</span>}
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => setIsLoggedIn(false)} className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-xl hover:text-red-600 font-bold text-sm border border-slate-200">
                <Icon name="logout" size={16} /><span>Log Out</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto bg-slate-50/50 p-8">
            <div className="max-w-[1600px] mx-auto h-full">
              {activeTab === 'grid' && (
                <div className="space-y-4">
                  <OperationalGrid
                    selectedRowId={activeRowId}
                    onRowSelected={(id) => {
                      setActiveRowId(id);
                      setShowRightSidebar(true);
                    }}
                  />
                </div>
              )}
              {activeTab === 'dashboard' && <Dashboard currentUser={currentUser!} />}
              {activeTab === 'admin' && (
                <AdminPanel
                  users={users}
                  currentUser={currentUser!}
                  onUpdateUser={async (id, user) => {
                    await api.updateUser(id, user);
                    const updated = await api.fetchUsers();
                    setUsers(updated);
                  }}
                  onAddUser={async (user) => {
                    await api.createUser(user);
                    const updated = await api.fetchUsers();
                    setUsers(updated);
                  }}
                  onDeleteUser={async (id) => {
                    // api.deleteUser(id) missing in api.ts
                  }}
                  onImpersonate={(user) => {
                    setOriginalUser(currentUser);
                    setCurrentUser(user);
                    setActiveTab('grid');
                    setNotifications(prev => [`Impersonating ${user.name}`, ...prev]);
                  }}
                />
              )}
              {activeTab === 'messages' && <Messaging currentUser={currentUser!} allUsers={users} />}
              {activeTab === 'automations' && (
                <Automations
                  columns={columnsWithUserOptions}
                  users={users}
                  automations={automations}
                  onSaveAutomations={async (up) => {
                    try {
                      await api.saveAutomations(up);
                      setAutomations(up);
                      setNotifications(prev => ['Automations saved', ...prev]);
                    } catch (error) {
                      console.error('Failed to save automations:', error);
                      setNotifications(prev => ['Failed to save automations', ...prev]);
                    }
                  }}
                />
              )}
              {activeTab === 'super-admin' && <SuperAdminDashboard />}
              {activeTab === 'reports' && (
                <ReportBuilder
                  columns={columnsWithUserOptions}
                  users={users}
                  savedReports={savedReports}
                  currentUser={currentUser!}
                  onSaveReport={async (r) => {
                    try {
                      await api.createReport(r);
                      setSavedReports(prev => [...prev, r]);
                      setNotifications(prev => ['Report saved', ...prev]);
                    } catch (error) {
                      console.error('Failed to save report:', error);
                      setNotifications(prev => ['Failed to save report', ...prev]);
                    }
                  }}
                  onDeleteReport={async (id) => {
                    try {
                      await api.deleteReport(id);
                      setSavedReports(prev => prev.filter(r => r.id !== id));
                      setNotifications(prev => ['Report deleted', ...prev]);
                    } catch (error) {
                      console.error('Failed to delete report:', error);
                      setNotifications(prev => ['Failed to delete report', ...prev]);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </main >

        {showRightSidebar && currentUser && (
          <aside className="w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
              {[
                { id: 'profile', label: 'Profile', icon: 'users' },
                { id: 'messages', label: 'Chat', icon: 'message' },
                { id: 'calls', label: 'Dialer', icon: 'phone' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sidebarTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  <Icon name={tab.icon as any} size={14} />
                  <span>{tab.label}</span>
                </button>
              ))}
              <button
                onClick={() => setShowRightSidebar(false)}
                className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Icon name="plus" size={16} className="rotate-45" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {sidebarTab === 'profile' && activeRowId && (
                <UniversalProfile
                  entityId={activeRowId}
                  onClose={() => setShowRightSidebar(false)}
                />
              )}
              {sidebarTab === 'messages' && (
                <SidebarMessaging
                  currentUser={currentUser}
                  allUsers={users}
                  onClose={() => setShowRightSidebar(false)}
                  activeRowId={activeRowId}
                />
              )}
              {sidebarTab === 'calls' && (
                <div className="p-4 bg-slate-900 h-full">
                  <RingCentralModule
                    currentUser={currentUser}
                    onIncomingCall={(num) => setActiveCall({ phoneNumber: num, status: 'ringing' })}
                    onTakeCall={(num) => setActiveCall({ phoneNumber: num, status: 'connected' })}
                    activeCall={activeCall}
                    onHangUp={() => setActiveCall(null)}
                  />
                </div>
              )}
              {!activeRowId && sidebarTab !== 'calls' && (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                    <Icon name="users" size={32} />
                  </div>
                  <p className="text-sm font-bold text-slate-400">Select a contact to view details or chat.</p>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Hidden container for RC widget if needed */}
        <div id="rc-widget-container" style={{ display: 'none' }} />
      </GridEngineProvider >
    </div >
  );
};

export default App;
