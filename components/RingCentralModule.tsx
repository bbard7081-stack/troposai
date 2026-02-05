import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import { AppUser } from '../types';

interface RingCentralModuleProps {
  currentUser: AppUser;
  onIncomingCall: (phoneNumber: string) => void;
  onTakeCall: (phoneNumber: string) => void;
  activeCall: { phoneNumber: string, status: 'ringing' | 'connected' } | null;
  onHangUp: (reason?: 'declined' | 'missed') => void;
  onRefreshData?: () => void;
}

type VoIPView = 'idle' | 'calling' | 'dialpad' | 'settings' | 'recent';

const RingCentralModule: React.FC<RingCentralModuleProps> = ({
  currentUser,
  onIncomingCall,
  onTakeCall,
  activeCall,
  onHangUp,
  onRefreshData
}) => {
  const [view, setView] = useState<VoIPView>('idle');
  const [dialString, setDialString] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [callingMode, setCallingMode] = useState<'app' | 'cell'>(
    (localStorage.getItem('devicePreference') as 'app' | 'cell') || 'cell'
  );

  // Settings State
  const [config, setConfig] = useState({
    autoAnswer: false,
    autoRecord: true,
    callerId: '+1 (845) 999-3721',
    status: 'online'
  });

  // Effect to automatically switch view to 'calling' if an external call comes in
  useEffect(() => {
    if (activeCall) {
      setView('calling');
      setIsMinimized(false);
      setIsVisible(true);
    }
  }, [activeCall]);

  const handleDialClick = (digit: string) => {
    setDialString(prev => prev + digit);
  };

  const handleBackspace = () => {
    setDialString(prev => prev.slice(0, -1));
  };

  const startCall = async () => {
    if (!dialString) return;

    try {
      setView('calling');
      const fromNumber = callingMode === 'cell' ? (localStorage.getItem('user_mobile') || '') : '';

      if (callingMode === 'cell' && !fromNumber) {
        const num = prompt("Enter your Mobile Number to ring first:", "") || '';
        if (!num) {
          setView('dialpad');
          return;
        }
        localStorage.setItem('user_mobile', num);
      }

      if (callingMode === 'app') {
        console.log('📡 Triggering RingCentral Widget call...');
        window.postMessage({
          type: 'rc-adapter-new-call',
          phoneNumber: dialString,
          to: dialString,
          autoDial: true,
        }, '*');
        return;
      }

      const res = await fetch('/api/ringout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: dialString,
          from: fromNumber || config.callerId,
          deviceType: callingMode
        })
      });

      if (!res.ok) {
        const error = await res.json();
        alert(`Call failed: ${error.details || error.error}`);
        setView('dialpad');
      }
    } catch (err) {
      console.error('Call failed', err);
      setView('dialpad');
    }
  };

  const toggleMode = () => {
    const next = callingMode === 'app' ? 'cell' : 'app';
    setCallingMode(next);
    localStorage.setItem('devicePreference', next);
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-6 right-6 z-[120] bg-blue-600 text-white p-4 rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:scale-110 active:scale-95 transition-all duration-300 border border-blue-400/30 group"
      >
        <Icon name="phone" size={24} className="group-hover:rotate-12 transition-transform" />
      </button>
    );
  }

  const GlassCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 animate-in zoom-in-95 fill-mode-both ${className}`}>
      {children}
    </div>
  );

  const StatusIndicator = () => (
    <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      <span className="text-[9px] font-black text-green-400 uppercase tracking-tight">Active</span>
    </div>
  );

  if (isMinimized && !activeCall) {
    return (
      <div className="fixed bottom-6 right-6 z-[120] animate-in slide-in-from-bottom-4">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:scale-110 transition-all group relative border border-blue-400/30"
        >
          <Icon name="phone" size={24} />
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[120] w-80 animate-in slide-in-from-bottom-6 transition-all duration-500 ease-out">
      <GlassCard className={view === 'calling' ? 'border-blue-500/30' : ''}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center space-x-2.5">
            <div className="bg-blue-600 p-1.5 rounded-xl shadow-lg shadow-blue-600/20">
              <Icon name="phone" size={14} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">Phone System</p>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">RingCentral Enterprise</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={() => setIsMinimized(true)} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-500 hover:text-white">
              <Icon name="minus" size={16} />
            </button>
            <button onClick={() => setIsVisible(false)} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all text-slate-500">
              <Icon name="plus" size={16} className="rotate-45" />
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="p-6">
          {view === 'idle' && !activeCall && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold">Hello, {currentUser.name.split(' ')[0]}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Ready to assist donors</p>
                </div>
                <StatusIndicator />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setView('dialpad')}
                  className="p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group text-center"
                >
                  <div className="bg-blue-500/10 p-2 rounded-xl w-fit mx-auto mb-2 text-blue-400 group-hover:scale-110 transition-transform">
                    <Icon name="hash" size={20} />
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Dialer</span>
                </button>
                <button
                  onClick={() => {
                    const num = `+1 (845) ${Math.floor(100 + Math.random() * 899)}-${Math.floor(1000 + Math.random() * 8999)}`;
                    onIncomingCall(num);
                  }}
                  className="p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group text-center"
                >
                  <div className="bg-purple-500/10 p-2 rounded-xl w-fit mx-auto mb-2 text-purple-400 group-hover:scale-110 transition-transform">
                    <Icon name="star" size={20} />
                  </div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Favorites</span>
                </button>
              </div>

              <div className="p-4 bg-white/5 rounded-3xl border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Calling Mode</span>
                  <span className="text-[9px] font-bold text-blue-400">{callingMode === 'app' ? 'Browser' : 'Mobile/Desk'}</span>
                </div>
                <button
                  onClick={toggleMode}
                  className="w-full h-8 bg-slate-800 rounded-2xl relative flex items-center p-1 group overflow-hidden"
                >
                  <div className={`absolute top-1 bottom-1 w-1/2 bg-blue-600 rounded-xl transition-all duration-300 ${callingMode === 'app' ? 'left-1' : 'left-[calc(50%-1px)]'}`} />
                  <div className="relative z-10 w-1/2 text-center text-[8px] font-black uppercase text-white">Browser</div>
                  <div className="relative z-10 w-1/2 text-center text-[8px] font-black uppercase text-white">Mobile</div>
                </button>
              </div>
            </div>
          )}

          {view === 'dialpad' && (
            <div className="animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => setView('idle')} className="text-slate-500 hover:text-white transition-colors">
                  <Icon name="chevron-down" size={20} className="rotate-90" />
                </button>
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-white tracking-tighter truncate max-w-[200px] h-10">
                    {dialString || <span className="text-white/10 italic">000-000-0000</span>}
                  </span>
                </div>
                <button
                  onClick={handleBackspace}
                  disabled={!dialString}
                  className="text-slate-500 hover:text-red-400 disabled:opacity-0 transition-all"
                >
                  <Icon name="delete" size={20} />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-8 px-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(key => (
                  <button
                    key={key}
                    onClick={() => handleDialClick(key)}
                    className="aspect-square rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-xl font-bold text-white flex items-center justify-center active:scale-90 transition-all duration-200"
                  >
                    {key}
                  </button>
                ))}
              </div>

              <button
                disabled={!dialString}
                onClick={startCall}
                className="w-16 h-16 mx-auto rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/30 hover:scale-110 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
              >
                <Icon name="phone" size={28} />
              </button>
            </div>
          )}

          {view === 'calling' && activeCall && (
            <div className="py-4 animate-in zoom-in-95 duration-500">
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center animate-pulse">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 animate-ping opacity-20" />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
                      <Icon name="users" size={28} className="text-white" />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 bg-green-500 w-6 h-6 rounded-full border-4 border-slate-900 flex items-center justify-center">
                    <Icon name="phone" size={10} className="text-white" />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-2xl font-black text-white tracking-tight">{activeCall.phoneNumber}</p>
                  <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">
                    {activeCall.status === 'ringing' ? 'Inbound Call...' : 'Connected'}
                  </p>
                </div>

                <div className="w-full space-y-4">
                  {activeCall.status === 'ringing' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => onHangUp('declined')}
                        className="py-4 bg-red-500/10 text-red-400 rounded-3xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => onTakeCall(activeCall.phoneNumber)}
                        className="py-4 bg-green-500 text-white rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all"
                      >
                        Accept
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center space-x-6">
                      <button className="w-14 h-14 rounded-full bg-white/5 border border-white/5 flex flex-col items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                        <Icon name="mic" size={18} />
                      </button>
                      <button
                        onClick={() => onHangUp()}
                        className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-500/40 hover:scale-110 active:scale-90 transition-all"
                      >
                        <Icon name="phone" size={32} className="rotate-[135deg]" />
                      </button>
                      <button className="w-14 h-14 rounded-full bg-white/5 border border-white/5 flex flex-col items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                        <Icon name="message-square" size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-1 h-1 bg-blue-500 rounded-full" />
            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Secured Line</span>
          </div>
          <p className="text-[8px] font-bold text-slate-600">ID: TROPOS-CRM-882</p>
        </div>
      </GlassCard>
    </div>
  );
};

export default RingCentralModule;
