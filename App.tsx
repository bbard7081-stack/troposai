import React, { useState, useMemo, useEffect } from 'react';
import { Column, ClientData, AppUser, SavedReport, Automation } from './types';
import { INITIAL_COLUMNS } from './constants';
import { Icon } from './components/Icon';
import GridView from './components/GridView';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import Messaging from './components/Messaging';
import ReportBuilder from './components/ReportBuilder';
import SidebarMessaging from './components/SidebarMessaging';
import RingCentralModule from './components/RingCentralModule';
import { RingCentralService } from './services/ringcentral';
import Automations from './components/Automations';
import { CallDispositionModal } from './components/CallDispositionModal';
import { AppCallLog } from './types';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import { ClientProfile } from './components/ClientProfile';
import PasswordSetup from './components/PasswordSetup';
import * as api from './services/api';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [originalUser, setOriginalUser] = useState<AppUser | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'dashboard' | 'admin' | 'messages' | 'reports' | 'automations' | 'super-admin'>('grid');
  const [showRightSidebar, setShowRightSidebar] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // --- MULTI-TENANT STATE ---
  const [currentTenant, setCurrentTenant] = useState<{ id: string, name: string, slug: string } | null>(null);
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGlobalView, setIsGlobalView] = useState(false);

  // Detect tenant and super-admin route
  useEffect(() => {
    const path = window.location.pathname;
    const isSuperPath = path === '/super-admin' || path === '/super-admin/';

    if (isSuperPath) {
      setIsGlobalView(true);
      setActiveTab('super-admin');
    }

    const slug = path.split('/')[1] || 'simchatalent';
    const parts = path.split('/');
    if (parts[2] === 'clients' && parts[3]) {
      setActiveRowId(parts[3]);
    }

    // We update this after login or if we have tenant info
    if (currentTenant?.slug !== slug && slug && !['assets', 'api'].includes(slug)) {
      // Logic to sync tenant name if needed
    }
  }, []);

  // Login State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [loginStep, setLoginStep] = useState<'EMAIL' | 'PASSWORD_SETUP' | 'PASSWORD_VERIFY' | 'FORGOT_PASSWORD'>('EMAIL');
  const [loginError, setLoginError] = useState('');
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);

  // VoIP State
  const [activeCall, setActiveCall] = useState<{ phoneNumber: string, status: 'ringing' | 'connected' } | null>(null);

  // Data state
  const [data, setData] = useState<ClientData[]>([]);
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [pendingCallLog, setPendingCallLog] = useState<AppCallLog | null>(null);
  const [showDispositionModal, setShowDispositionModal] = useState(false);

  // 1. Initial Load: Fetch Users & Tenant Info
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Check for forced login (from landing page)
        const params = new URLSearchParams(window.location.search);
        if (params.get('force_login') === 'true') {
          localStorage.removeItem('tropos_user');
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Restore session from localStorage
        const storedUser = localStorage.getItem('tropos_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          setIsLoggedIn(true);
        }

        const usersData = await api.fetchUsers();
        if (usersData && usersData.length > 0) {
          setUsers(usersData);
        } else {
          const offlineUser: AppUser = { id: 'offline', name: 'System Admin', email: 'admin@troposai.com', role: 'ADMIN', status: 'ACTIVE' };
          setUsers([offlineUser]);
        }

        // Multi-tenant: Detect if super admin
        if (currentUser?.email === 'admin@troposai.com' || (storedUser && JSON.parse(storedUser).email === 'admin@troposai.com')) {
          setIsSuperAdmin(true);
          const tenantList = await api.fetchTenants();
          setAllTenants(tenantList);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    }
    loadInitialData();
  }, [currentUser?.email]);

  // 2. Post-Login Load: Fetch Protected Data
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadProtectedData() {
      setIsLoading(true);
      try {
        const [contactsData, reportsData, automationsData, messagesData, adminSettings] = await Promise.all([
          api.fetchContacts().catch(() => []),
          api.fetchReports().catch(() => []),
          api.fetchAutomations().catch(() => []),
          api.fetchMessages().catch(() => []),
          api.fetchAdminSettings().catch(() => ({}))
        ]);

        if (adminSettings.gridColumns) {
          setColumns(adminSettings.gridColumns);
        }

        setData(contactsData);
        setSavedReports(reportsData);
        setAutomations(automationsData);
        setMessages(messagesData);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load protected data:', error);
        setIsLoading(false);
      }
    }

    loadProtectedData();

    // Auto-refresh contacts every 10 seconds
    const refreshInterval = setInterval(async () => {
      try {
        const contactsData = await api.fetchContacts();
        setData(contactsData);
      } catch (error) {
        console.error('Auto-refresh failed:', error);
      }
    }, 10000);

    // SSE for Telephony Events (Replaces Polling)
    const userEmail = currentUser?.email;
    if (isLoggedIn && userEmail) {
      const eventSource = new EventSource(`/api/telephony/events?email=${encodeURIComponent(userEmail)}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'incoming_call' || payload.type === 'call_connected') {
            setActiveCall({ phoneNumber: payload.phoneNumber, status: payload.type === 'call_connected' ? 'connected' : 'ringing' });
            if (payload.contactId) {
              setActiveRowId(payload.contactId);
              setActiveTab('grid');
            }
            setNotifications(prev => [`${payload.type === 'call_connected' ? 'Call connected' : 'Incoming call'} from ${payload.phoneNumber}`, ...prev]);

            // Refresh data to show new contact if it was just created
            api.fetchContacts().then(setData).catch(console.error);
          } else if (payload.type === 'call-update') {
            const activeCallData = payload.data;
            if (activeCallData) {
              const cleanPhone = activeCallData.phoneNumber?.replace(/\D/g, '').replace(/^1/, '');
              // Existing logic for RC Widget events
              if ((activeCallData.status === 'Ringing' || activeCallData.status === 'New') && activeCall?.phoneNumber !== cleanPhone) {
                setActiveCall({ phoneNumber: cleanPhone, status: 'ringing' });
                setActiveRowId(activeCallData.contactId);
                setActiveTab('grid');
                setNotifications(prev => [`Incoming call from ${activeCallData.phoneNumber}`, ...prev]);
              } else if (activeCallData.status === 'Answered' && activeCallData.answeredBy) {
                setNotifications(prev => [`Call answered by ${activeCallData.answeredBy}`, ...prev]);
                // Refresh data to show persistence in grid
                api.fetchContacts().then(setData).catch(console.error);
              } else if (activeCallData.status === 'Disconnected' && activeCall) {
                setActiveCall(null);
                activeCallData.contactId && setActiveRowId(activeCallData.contactId);
                api.fetchContacts().then(setData);
              }
            }
          }
        } catch (err) {
          console.error('SSE Parse Error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE Connection Error:', err);
        eventSource.close();
      };

      return () => {
        clearInterval(refreshInterval);
        eventSource.close();
      };
    }

    return () => {
      clearInterval(refreshInterval);
    };
  }, [isLoggedIn, currentUser]);

  // Handle RingCentral login redirect (Fixes the window hang)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'rc-adapter-redirect-event') {

        // Find the RingCentral adapter iframe
        const rcIframe = document.querySelector('iframe#rc-widget-adapter-frame') ||
          document.querySelector('iframe[src*="ringcentral"]');

        if (rcIframe && (rcIframe as HTMLIFrameElement).contentWindow) {
          (rcIframe as HTMLIFrameElement).contentWindow!.postMessage(event.data, '*');
        } else {
          console.error('❌ RC Redirect Failure: Could not find the RingCentral adapter iframe to forward the signal!');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);


  // Keep track of current user for event listeners
  const currentUserRef = React.useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // RingCentral Integration Hook
  useEffect(() => {
    const handleRCMessage = async (e: MessageEvent) => {
      // DEBUG: Log all RC events
      if (e.data && e.data.type && e.data.type.startsWith('rc-')) {
      }

      // RingCentral Embeddable emits messages. 
      // We listen for 'rc-call-ring-notify' event from the adapter
      if (e.data && e.data.type === 'rc-call-ring-notify') {
        const phoneNumber = e.data.call?.from || 'Unknown';

        try {
          // Pass the current user's email using the ref!
          const userEmail = currentUserRef.current?.email || '';

          const contactId = await RingCentralService.handleIncomingCall(phoneNumber, userEmail);

          // REFRESH DATA to show the new row!
          const updatedContacts = await api.fetchContacts();
          setData(updatedContacts);

          setActiveRowId(contactId); // "Screen Pop"
          setActiveTab('grid'); // Ensure grid is visible

          // SHOW THE CALL POPUP!
          setActiveCall({ phoneNumber, status: 'ringing' });

          setNotifications(prev => [`Incoming call from ${phoneNumber}. Contact updated.`, ...prev]);
        } catch (err) {
          console.error('Failed to handle incoming RC call', err);
        }
      }

      // Handle Call Answered / Connected
      if (e.data && e.data.type === 'rc-call-start-notify') {
        const phoneNumber = e.data.call?.from || 'Unknown';
        setActiveCall({ phoneNumber, status: 'connected' });
      }

      // Listen for Call End / Missed events
      if (e.data && e.data.type === 'rc-call-end-notify') {
        const { phoneNumber, result } = e.data.call;

        // Handle contact update (legacy logic)
        await RingCentralService.handleCallEnded(phoneNumber, result);

        // Fetch the newest log for this user to show disposition modal
        setTimeout(async () => {
          try {
            const logs = await api.fetchCallLogs();
            const myLatestLog = logs.find(log => log.user_id === currentUserRef.current?.email);
            if (myLatestLog) {
              setPendingCallLog(myLatestLog);
              setShowDispositionModal(true);
            }
          } catch (err) {
            console.error('Failed to fetch logs for disposition:', err);
          }
        }, 1500); // Small delay to ensure DB write finished

        // REFRESH DATA to show missed status
        const updatedContacts = await api.fetchContacts();
        setData(updatedContacts);

        setNotifications(prev => [`Call ended: ${result}`, ...prev]);
        setActiveCall(null);
      }
    };

    window.addEventListener('message', handleRCMessage);
    return () => window.removeEventListener('message', handleRCMessage);
  }, []);

  // Debug environment variables and authentication
  useEffect(() => {
  }, [currentUser]);

  const visibleData = useMemo(() => {
    if (!currentUser) return data;
    if (currentUser.role === 'ADMIN') return data;
    return data.filter(client => client.assignedTo === currentUser.email);
  }, [data, currentUser]);

  const activeClientName = useMemo(() => {
    if (!activeRowId) return null;
    const client = data.find(c => c.id === activeRowId);
    return client ? client.name : null;
  }, [data, activeRowId]);

  const columnsWithUserOptions = useMemo(() => {
    return columns.map(col => {
      if (col.id === 'assignedTo') {
        return {
          ...col,
          options: users.map(u => u.email)
        };
      }
      return col;
    });
  }, [columns, users]);

  // Call handler for GridView
  const handleCall = async (phoneNumber: string, devicePreference: 'app' | 'cell') => {

    if (devicePreference === 'app') {
      // Option A: RingCentral Native App
      window.location.href = `rc://call?number=${phoneNumber}`;
      setNotifications(prev => [`Dialing ${phoneNumber} via RingCentral App...`, ...prev]);
    } else {
      // Option B: Personal Cell Phone (Backend RingOut)

      let fromNumber = localStorage.getItem('user_mobile') || '';
      if (!fromNumber) {
        fromNumber = prompt("Enter your Personal Mobile Number to ring first (e.g. 8455550000):", "") || '';
        if (!fromNumber) {
          alert("Call cancelled. Mobile number required.");
          return;
        }
        localStorage.setItem('user_mobile', fromNumber);
      }

      // DEBUG ALERT
      alert(`Initiating RingOut\nFrom: ${fromNumber}\nTo: ${phoneNumber}\n\nPlease wait for your phone to ring...`);

      try {
        const res = await fetch('/api/ringout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phoneNumber,
            from: fromNumber,
            deviceType: 'cell'
          })
        });

        const data = await res.json();

        if (res.ok) {
          setNotifications(prev => [`Ringing your cell phone to connect to ${phoneNumber}...`, ...prev]);
        } else {
          alert(`Call failed: ${data.details || data.error}`);
        }
      } catch (err: any) {
        console.error('❌ RingOut fetch error:', err);
        alert(`Failed to connect to server: ${err.message}`);
      }
    }
  };


  const handleAddRow = async () => {
    if (!currentUser) return;

    const newRow: ClientData = {
      id: `row_${Date.now()}`,
      name: '',
      assignedTo: currentUser.role === 'ADMIN' ? '' : currentUser.email,
      status: 'Lead',
      cellHistory: {}
    };

    try {
      await api.createContact(newRow);
      setData(prev => [...prev, newRow]);
      setActiveRowId(newRow.id);
      setNotifications(prev => [`New contact added`, ...prev]);
    } catch (error) {
      console.error('Failed to create contact:', error);
      setNotifications(prev => [`Failed to add contact`, ...prev]);
    }
  };

  const handleCellUpdate = async (rowId: string, colId: string, val: any) => {
    const contact = data.find(r => r.id === rowId);
    if (!contact || !currentUser) return;

    // --- DATA VALIDATION ---
    const newErrors = { ...validationErrors };
    let hasError = false;

    if (colId === 'name' && !val) {
      newErrors[`${rowId}-name`] = 'Name cannot be empty';
      hasError = true;
    } else if (colId === 'dob' && val && isNaN(Date.parse(val))) {
      newErrors[`${rowId}-dob`] = 'Invalid Date of Birth';
      hasError = true;
    } else if (colId === 'phone' && val && !/^\+?1?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(val)) {
      newErrors[`${rowId}-phone`] = 'Invalid Phone Number format';
      hasError = true;
    } else {
      delete newErrors[`${rowId}-${colId}`];
    }

    // Logic-based validation (Household / Dates)
    if (colId === 'householdMembers' || colId === 'householdSize') {
      const size = colId === 'householdSize' ? Number(val) : Number(contact.householdSize || 0);
      const members = colId === 'householdMembers' ? (val ? val.split(',').length : 0) : (contact.householdMembers ? contact.householdMembers.split(',').length : 0);
      if (size < members) {
        newErrors[`${rowId}-householdSize`] = 'Size must be >= members';
        hasError = true;
      } else {
        delete newErrors[`${rowId}-householdSize`];
      }
    }

    if (colId === 'dateScreened' || colId === 'dateOutreached') {
      const screened = colId === 'dateScreened' ? val : contact.dateScreened;
      const reached = colId === 'dateOutreached' ? val : contact.dateOutreached;
      if (screened && reached && new Date(screened) < new Date(reached)) {
        newErrors[`${rowId}-dateScreened`] = 'Screened date cannot be before Outreach';
        hasError = true;
      } else {
        delete newErrors[`${rowId}-dateScreened`];
      }
    }

    setValidationErrors(newErrors);
    if (hasError) {
      setNotifications(prev => ['Invalid Entry Blocked', ...prev]);
      return;
    }

    const oldVal = contact[colId];
    const currentCellHistory = contact.cellHistory || {};
    const log = currentCellHistory[colId] || [];

    const historyEntry = {
      from: oldVal,
      to: val,
      time: new Date().toLocaleTimeString(),
      user: currentUser.name
    };

    let updatedContact = {
      ...contact,
      [colId]: val,
      cellHistory: {
        ...currentCellHistory,
        [colId]: [historyEntry, ...log].slice(0, 15)
      }
    };

    // --- DERIVED FIELDS ---
    if (colId === 'householdMembers') {
      const members = typeof val === 'string' ? val.split(',').map(s => s.trim()).filter(s => s) : [];
      updatedContact.householdSize = members.length;
    }

    // Check automations
    automations.filter(a => a.enabled && a.trigger.type === 'CELL_CHANGE' && a.trigger.columnId === colId).forEach(auto => {
      if (auto.trigger.value === undefined || auto.trigger.value === val) {
        if (auto.action.type === 'UPDATE_CELL' && auto.action.columnId) {
          updatedContact[auto.action.columnId] = auto.action.value;
        } else if (auto.action.type === 'ASSIGN_USER' && auto.action.userEmail) {
          updatedContact.assignedTo = auto.action.userEmail;
        }
      }
    });

    try {
      await api.updateContact(rowId, updatedContact);
      setData(prev => prev.map(r => r.id === rowId ? updatedContact : r));
    } catch (error) {
      console.error('Failed to update contact:', error);
      setNotifications(prev => [`Failed to update contact`, ...prev]);
    }
  };

  const handleBulkCellUpdate = async (rowIds: string[], colId: string, val: any) => {
    if (!currentUser) return;

    const updates = data.map(r => {
      if (rowIds.includes(r.id)) {
        const oldVal = r[colId];
        const currentCellHistory = r.cellHistory || {};
        const log = currentCellHistory[colId] || [];

        const historyEntry = {
          from: oldVal,
          to: val,
          time: new Date().toLocaleTimeString(),
          user: currentUser.name
        };

        return {
          ...r,
          [colId]: val,
          cellHistory: {
            ...currentCellHistory,
            [colId]: [historyEntry, ...log].slice(0, 15)
          }
        };
      }
      return r;
    });

    try {
      // Update all contacts
      await Promise.all(
        updates.filter(u => rowIds.includes(u.id)).map(u => api.updateContact(u.id, u))
      );
      setData(updates);
    } catch (error) {
      console.error('Failed to bulk update:', error);
      setNotifications(prev => [`Failed to update contacts`, ...prev]);
    }
  };

  const handleBulkUpdate = async (clientIds: string[], updates: Partial<ClientData>) => {
    const newData = data.map(client => clientIds.includes(client.id) ? { ...client, ...updates } : client);

    try {
      await Promise.all(
        newData.filter(c => clientIds.includes(c.id)).map(c => api.updateContact(c.id, c))
      );
      setData(newData);
      setNotifications(prev => [`Updated ${clientIds.length} records`, ...prev]);
    } catch (error) {
      console.error('Failed to bulk update:', error);
      setNotifications(prev => [`Failed to update records`, ...prev]);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!currentUser) return;

    if (!confirm('Are you sure you want to delete this record? This cannot be undone.')) {
      return;
    }

    try {
      await api.deleteContact(rowId);
      setData(prev => prev.filter(r => r.id !== rowId));
      if (activeRowId === rowId) setActiveRowId(null);
    } catch (error) {
      console.error('Failed to delete contact:', error);
      setNotifications(prev => [`Failed to delete contact`, ...prev]);
    }
  };

  const handleUpdateUser = async (userId: string, updates: Partial<AppUser>) => {
    const updatedUser = users.find(u => u.id === userId);
    if (!updatedUser) return;

    const newUser = { ...updatedUser, ...updates };
    try {
      await api.updateUser(userId, newUser);
      setUsers(prev => prev.map(u => u.id === userId ? newUser : u));
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleAddUser = async (user: AppUser) => {
    const userWithTime = { ...user, lastInvited: new Date().toLocaleString() };
    try {
      await api.createUser(userWithTime);
      setUsers(prev => [...prev, userWithTime]);
      setNotifications(prev => [`Invitation sent to ${userWithTime.email}`, ...prev]);
    } catch (error) {
      console.error('Failed to add user:', error);
      setNotifications(prev => [`Failed to add user`, ...prev]);
    }
  };

  const handleAddColumn = (c: Column) => {
    const newCols = [...columns, c];
    setColumns(newCols);
    api.updateAdminSettings({ gridColumns: newCols }).catch(e => console.error('Failed to save columns:', e));
  };

  const handleUpdateColumn = (id: string, up: Partial<Column>) => {
    const newCols = columns.map(c => c.id === id ? { ...c, ...up } : c);
    setColumns(newCols);
    api.updateAdminSettings({ gridColumns: newCols }).catch(e => console.error('Failed to save columns:', e));
  };

  const handleReorderColumns = (sourceIdx: number, targetIdx: number) => {
    const newCols = [...columns];
    const [removed] = newCols.splice(sourceIdx, 1);
    newCols.splice(targetIdx, 0, removed);
    setColumns(newCols);
    api.updateAdminSettings({ gridColumns: newCols }).catch(e => console.error('Failed to save columns:', e));
  };

  const handleReorderRows = (sourceIdx: number, targetIdx: number) => {
    const newData = [...data];
    const [removed] = newData.splice(sourceIdx, 1);
    newData.splice(targetIdx, 0, removed);
    setData(newData);
    // Persist to server if needed, for now it stays in local session state
  };

  // Handle Impersonation from Admin Panel
  const handleImpersonate = (targetUser: AppUser) => {
    setOriginalUser(currentUser);
    setCurrentUser(targetUser);
    setActiveTab('grid'); // Redirect to grid to see their view
    setNotifications(prev => [`Viewing as ${targetUser.name}`, ...prev]);
  };

  const handleSendMessage = async (msg: any) => {
    try {
      await api.createMessage(msg);
      setMessages(prev => [...prev, msg]);

      // Generate notifications for mentions or DMs
      if (msg.receiverEmail === currentUser?.email) {
        setNotifications(prev => [`New message from ${msg.senderEmail}`, ...prev]);
      }

      users.forEach(user => {
        if (msg.content.includes(`@${user.name}`)) {
          setNotifications(prev => [`@${msg.senderEmail} mentioned ${user.name}`, ...prev]);
        }
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // --- GLOBAL KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }

      if ((e.key || '').toLowerCase() === 'n' && !isInput) {
        e.preventDefault();
        handleAddRow();
      }

      const key = (e.key || '').toLowerCase();
      if ((key === 's' && !isInput) || (key === 's' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setNotifications(prev => ['Manual save triggered...', ...prev]);
        api.updateAdminSettings({ lastManualSave: new Date().toISOString() }).catch(console.error);
      }

      if (key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const tabs: any[] = ['grid', 'dashboard', 'admin', 'messages', 'reports', 'automations'];
        const nextIdx = (tabs.indexOf(activeTab) + 1) % tabs.length;
        setActiveTab(tabs[nextIdx]);
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [activeTab, handleAddRow]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-200 animate-pulse">
            <Icon name="grid" className="text-white" size={32} />
          </div>
          <p className="text-slate-600 font-semibold">Loading CRM data...</p>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // Validate email input
    if (!emailInput || !emailInput.trim()) {
      setLoginError('Please enter your email address');
      return;
    }

    // 1. Master Admin Bypass
    if (emailInput.toLowerCase() === 'admin@troposai.com') {
      const masterAdmin = {
        id: 'master',
        name: 'Master Admin',
        email: 'admin@troposai.com',
        role: 'ADMIN' as any,
        status: 'ACTIVE'
      };
      setUsers(prev => {
        if (!prev.find(u => u.email === masterAdmin.email)) return [...prev, masterAdmin];
        return prev;
      });
      setCurrentUser(masterAdmin);
      setIsLoggedIn(true);
      return;
    }

    const user = users.find(u => (u.email || '').toLowerCase() === emailInput.toLowerCase());

    if (user) {
      setPendingUser(user);
      if (!user.password) {
        setLoginStep('PASSWORD_SETUP');
      } else {
        setLoginStep('PASSWORD_VERIFY');
      }
    } else {
      setLoginError('User not found. Please ask an admin for an invite.');
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput !== confirmPasswordInput) {
      setLoginError('Passwords do not match');
      return;
    }
    if (passwordInput.length < 6) {
      setLoginError('Password must be at least 6 characters');
      return;
    }

    if (pendingUser) {
      try {
        await api.updateUser(pendingUser.id, { ...pendingUser, password: passwordInput, status: 'ACTIVE' });

        // Send Confirmation Email
        const baseUrl = window.location.origin;
        const emailSubject = `Account Successful - Your Tropos Workspace is Ready`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h1 style="color: #2563eb; margin-bottom: 16px;">Setup Complete!</h1>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Hello ${pendingUser.name},</p>
            <p style="color: #475569; font-size: 16px; line-height: 1.5;">Your account for **Tropos** is now fully active. You can sign in using the button below:</p>
            
            <div style="margin: 32px 0;">
              <a href="${baseUrl}/simchatalent" style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Sign In to Tropos</a>
            </div>

            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 24px;">
              <p style="margin: 0; color: #64748b; font-size: 14px;"><strong>Account Email:</strong> ${pendingUser.email}</p>
            </div>
            
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              Please keep your password secure. If you did not perform this action, contact your administrator immediately.
            </p>
          </div>
        `;
        await api.sendEmail(pendingUser.email, emailSubject, emailHtml).catch(e => console.error('Failed to send confirmation email', e));

        const user = { ...pendingUser, status: 'ACTIVE' };
        setCurrentUser(user);
        setIsLoggedIn(true);
        localStorage.setItem('tropos_user', JSON.stringify(user));
        setLoginError('');
      } catch (err) {
        setLoginError('Failed to save password. Please try again.');
      }
    }
  };

  const handlePasswordVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingUser && pendingUser.password === passwordInput) {
      setCurrentUser(pendingUser);
      setIsLoggedIn(true);
      localStorage.setItem('tropos_user', JSON.stringify(pendingUser));
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.trim()) {
      setLoginError('Please enter your email address first');
      setLoginStep('EMAIL');
      return;
    }

    const user = users.find(u => (u.email || '').toLowerCase() === emailInput.toLowerCase());
    if (user) {
      try {
        const emailSubject = `Password Reset Request - Tropos`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Password Reset</h1>
            <p>Hello ${user.name},</p>
            <p>We received a request to reset your password for **Tropos**.</p>
            <p>For your security, please contact your administrator to reset your password manually, or wait for an automated reset link in a future update.</p>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px;">If you did not request this, please ignore this email.</p>
          </div>
        `;
        await api.sendEmail(user.email, emailSubject, emailHtml);
        setLoginError('Reset instructions have been sent to your email.');
      } catch (err) {
        setLoginError('Failed to send reset email. Contact Admin.');
      }
    } else {
      setLoginError('Email not found.');
    }
  };

  // Check if we're on the password setup page
  if (window.location.pathname.includes('/setup-password')) {
    return <PasswordSetup />;
  }

  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="bg-white/10 backdrop-blur-xl p-8 rounded-3xl w-full max-w-md shadow-2xl border border-white/10 animate-in zoom-in-95 duration-500">
          <div className="text-center mb-8">
            <div className="bg-blue-600/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-1 ring-blue-500/50">
              <Icon name="grid" className="text-blue-400" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Welcome to Tropos</h1>
            <p className="text-slate-400 text-sm mt-2">Sign in to access your workspace</p>
          </div>

          {loginStep === 'EMAIL' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Work Email</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                  autoFocus
                />
              </div>
              {loginError && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                Continue
              </button>
              <button type="button" onClick={() => { setLoginError(''); setLoginStep('FORGOT_PASSWORD'); }} className="w-full py-2 text-blue-400 hover:text-blue-300 text-sm font-bold mt-2 hover:bg-white/5 rounded-lg transition-all">
                Forgot Password?
              </button>
            </form>
          )}

          {loginStep === 'PASSWORD_SETUP' && (
            <form onSubmit={handlePasswordSetup} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20 mb-4">
                <p className="text-blue-300 text-sm">Welcome, {pendingUser?.name}! <br /> Please set a secure password for your account.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">New Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                />
              </div>
              {loginError && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                Set Password & Login
              </button>
              <button type="button" onClick={() => { setLoginError(''); setLoginStep('EMAIL'); }} className="w-full py-2 text-slate-400 hover:text-white text-sm">
                Back
              </button>
            </form>
          )}

          {loginStep === 'PASSWORD_VERIFY' && (
            <form onSubmit={handlePasswordVerify} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-4">
                <p className="text-white font-medium">{pendingUser?.name}</p>
                <p className="text-slate-500 text-sm">{pendingUser?.email}</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Password</label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600"
                  autoFocus
                />
              </div>
              {loginError && <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{loginError}</p>}
              <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95">
                Sign In
              </button>
              <div className="flex flex-col space-y-2">
                <button type="button" onClick={() => { setLoginError(''); setLoginStep('EMAIL'); setPasswordInput(''); }} className="w-full py-2 text-slate-400 hover:text-white text-sm">
                  Switch User
                </button>
                <button type="button" onClick={() => { setLoginError(''); setLoginStep('FORGOT_PASSWORD'); }} className="w-full py-2 text-blue-400 hover:text-blue-300 text-sm font-bold hover:bg-white/5 rounded-lg transition-all">
                  Forgot Password?
                </button>
              </div>
            </form>
          )}

          {loginStep === 'FORGOT_PASSWORD' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-800/80 p-6 rounded-2xl border border-white/5 text-center">
                <p className="text-slate-300 text-sm mb-4">Need a password reset? <br /> Enter your email and we'll send instructions.</p>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-white placeholder-slate-600 mb-4"
                />
                {loginError && <p className="text-red-400 text-sm mb-4">{loginError}</p>}
                <button onClick={handleForgotPassword} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 mb-3">
                  Send Reset Link
                </button>
                <button onClick={() => { setLoginError(''); setLoginStep('EMAIL'); }} className="text-slate-500 hover:text-white text-xs">
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          <p className="mt-8 text-xs text-center text-slate-600">Secure access for authorized personnel only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-slate-900 animate-in fade-in duration-500">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl z-20">
        <div className="p-6 flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20"><Icon name="grid" className="text-white" size={24} /></div>
          <span className="text-xl font-black tracking-tight text-white uppercase">Tropos</span>
        </div>

        {/* --- MULTI-TENANT: Workspace Identity --- */}
        <div className="px-5 mb-4">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-white/5">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center font-black text-blue-400 border border-blue-500/20">
                <Icon name="grid" size={14} />
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Active CRM</p>
                <p className="text-xs font-bold text-slate-200 truncate">
                  {currentTenant?.name || window.location.pathname.split('/')[1] || 'Tropos Main'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* --- SUPER ADMIN: Organization Switcher --- */}
        {isSuperAdmin && allTenants.length > 0 && (
          <div className="px-5 mb-6">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Switch Workspace</label>
            <select
              onChange={(e) => window.location.href = `/${e.target.value}`}
              className="w-full bg-slate-800 text-slate-300 text-[11px] font-bold px-3 py-2.5 rounded-xl border border-white/5 outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
              value={window.location.pathname.split('/')[1] || 'shimchatalent'}
            >
              <option value="" disabled>Select Client CRM</option>
              {allTenants.map(t => (
                <option key={t.id} value={t.slug}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* --- SUPER ADMIN: View Toggle --- */}
        {isSuperAdmin && (
          <div className="px-5 mb-6">
            <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => { setIsGlobalView(false); setActiveTab('grid'); }}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${!isGlobalView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Tenant View
              </button>
              <button
                onClick={() => { setIsGlobalView(true); setActiveTab('super-admin'); }}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${isGlobalView ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Global View
              </button>
            </div>
          </div>
        )}

        <nav className="flex-1 px-4 py-4 space-y-1">
          {isGlobalView ? (
            <button onClick={() => setActiveTab('super-admin')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'super-admin' ? 'bg-indigo-600' : 'hover:bg-slate-800 text-slate-400'}`}>
              <Icon name="dashboard" size={18} /><span className="font-medium text-sm">Global Master</span>
            </button>
          ) : (
            <>
              <button onClick={() => setActiveTab('grid')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'grid' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                <Icon name="grid" size={18} /><span className="font-medium text-sm">Grid View</span>
              </button>
              <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                <Icon name="dashboard" size={18} /><span className="font-medium text-sm">Dashboard</span>
              </button>
              {(currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
                <>
                  <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'reports' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                    <Icon name="reports" size={18} /><span className="font-medium text-sm">Reports</span>
                  </button>
                  <button onClick={() => setActiveTab('automations')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'automations' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                    <Icon name="zap" size={18} /><span className="font-medium text-sm">Automations</span>
                  </button>
                  <button onClick={() => setActiveTab('admin')} className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${activeTab === 'admin' ? 'bg-blue-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                    <Icon name="users" size={18} /><span className="font-medium text-sm">Admin Center</span>
                  </button>
                </>
              )}
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center space-x-3 p-2 bg-slate-800/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold">{currentUser.name.charAt(0)}</div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{currentUser.name}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('tropos_user');
                setIsLoggedIn(false);
                setCurrentUser(null);
                setIsSuperAdmin(false);
                setIsGlobalView(false);
                window.location.href = '/';
              }}
              className="ml-auto p-2 text-slate-500 hover:text-white transition-colors"
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

        {/* Prevent crash if currentUser is missing */}
        {!currentUser ? (
          <div className="flex flex-col items-center justify-center flex-1 bg-red-50 p-8">
            {/* ... (Existing Error) */}
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-50/50 p-8">
            <div className="max-w-[1600px] mx-auto h-full">
              {activeTab === 'grid' && !window.location.pathname.includes('/clients/') && (
                <GridView
                  columns={columnsWithUserOptions}
                  data={visibleData}
                  isAdmin={currentUser.role === 'ADMIN'}
                  onCellUpdate={handleCellUpdate}
                  onBulkCellUpdate={handleBulkCellUpdate}
                  onAddColumn={handleAddColumn}
                  onAddRow={handleAddRow}
                  onDeleteRow={handleDeleteRow}
                  onUpdateColumn={handleUpdateColumn}
                  onReorderColumns={handleReorderColumns}
                  onUndo={() => { }} // Disabled for now
                  onRedo={() => { }} // Disabled for now
                  canUndo={false}
                  canRedo={false}
                  onRowFocus={(id) => {
                    setActiveRowId(id);
                    // Automatic navigation removed to prevent breaking grid workflow
                  }}
                  isChatOpen={showRightSidebar}
                  onToggleChat={() => setShowRightSidebar(!showRightSidebar)}
                  callingPhoneNumber={activeCall?.phoneNumber}
                  filterText={filterText}
                  setFilterText={setFilterText}
                  onOpenProfile={(id) => {
                    setActiveRowId(id);
                    window.history.pushState({}, '', `/${currentTenant?.slug || 'simchatalent'}/clients/${id}`);
                  }}
                  validationErrors={validationErrors}
                  onSave={async () => {
                    setNotifications(prev4 => ['Data saved to database', ...prev4]);
                  }}
                />
              )}

              {window.location.pathname.includes('/clients/') && activeRowId && data.find(r => r.id === activeRowId) && (
                <ClientProfile
                  client={data.find(r => r.id === activeRowId)!}
                  columns={columnsWithUserOptions}
                  users={users}
                  currentUser={currentUser!}
                  onUpdate={(updates) => {
                    // Handle single or multiple field updates
                    Object.entries(updates).forEach(([colId, val]) => {
                      handleCellUpdate(activeRowId!, colId, val);
                    });
                  }}
                  onClose={(fromBack) => {
                    setActiveRowId(null);
                    if (fromBack !== true) {
                      window.history.pushState({}, '', `/${currentTenant?.slug || 'simchatalent'}/`);
                    }
                  }}
                  validationErrors={validationErrors}
                />
              )}
              {activeTab === 'dashboard' && <Dashboard data={visibleData} />}
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
              {activeTab === 'messages' && (
                <Messaging
                  currentUser={currentUser!}
                  allUsers={users}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                />
              )}
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
                  data={data}
                  columns={columnsWithUserOptions}
                  users={users}
                  savedReports={savedReports}
                  currentUser={currentUser}
                  onBulkAssign={(ids, email) => handleBulkUpdate(ids, { assignedTo: email })}
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
        )}
      </main>

      {showRightSidebar && currentUser && (
        <SidebarMessaging
          currentUser={currentUser}
          allUsers={users}
          messages={messages}
          onSendMessage={handleSendMessage}
          onClose={() => setShowRightSidebar(false)}
          activeClientName={activeClientName}
        />
      )}

      {/* Hidden container if using iframe approach directly, but widget handles itself */}
      <div id="rc-widget-container" style={{ display: 'none' }} />
    </div>
  );
};

export default App;
