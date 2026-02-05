
import React, { useState, useRef, useEffect } from 'react';
import { AppUser, ChatMessage } from '../types';
import { Icon } from './Icon';

interface SidebarMessagingProps {
  currentUser: AppUser;
  allUsers: AppUser[];
  onClose: () => void;
  activeClientName?: string | null;
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
}

const SidebarMessaging: React.FC<SidebarMessagingProps> = ({ currentUser, allUsers, onClose, activeClientName, messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [emailToasts, setEmailToasts] = useState<{ id: string, name: string }[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Mock function to simulate email trigger
  const triggerEmailNotification = (user: AppUser, content: string) => {
    const toastId = Math.random().toString(36).substr(2, 9);
    setEmailToasts(prev => [...prev, { id: toastId, name: user.name }]);
    setTimeout(() => {
      setEmailToasts(prev => prev.filter(t => t.id !== toastId));
    }, 4000);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    // Create message
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderEmail: currentUser.email,
      receiverEmail: 'TEAM',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Check for mentions and trigger "emails"
    // Regex matches @ followed by name until end of name or start of next special char
    allUsers.forEach(user => {
      if (input.includes(`@${user.name}`)) {
        triggerEmailNotification(user, input);
      }
    });

    onSendMessage(newMessage);
    setInput('');
    setMentionSearch(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setInput(value);
    setCursorPos(pos);

    const textBeforeCursor = value.slice(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const searchStr = textBeforeCursor.slice(lastAtIndex + 1);
      if (!searchStr.includes(' ')) {
        setMentionSearch(searchStr);
      } else {
        setMentionSearch(null);
      }
    } else {
      setMentionSearch(null);
    }
  };

  const insertMention = (user: AppUser) => {
    const textBeforeCursor = input.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = input.slice(cursorPos);

    const newText = input.slice(0, lastAtIndex) + `@${user.name} ` + textAfterCursor;
    setInput(newText);
    setMentionSearch(null);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = lastAtIndex + user.name.length + 2;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const filteredUsers = allUsers.filter(u =>
    u.id !== currentUser.id &&
    (mentionSearch === null || (u.name || '').toLowerCase().includes(mentionSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 shadow-2xl w-80 animate-in slide-in-from-right duration-300 relative">
      {/* Email Notifications Toast Overlay */}
      <div className="absolute top-16 left-4 right-4 z-[60] space-y-2 pointer-events-none">
        {emailToasts.map(toast => (
          <div key={toast.id} className="bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Email notification sent to {toast.name}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center space-x-2 overflow-hidden">
          <Icon name="message" size={18} className="text-blue-600 shrink-0" />
          <div className="overflow-hidden">
            <h3 className="font-bold text-slate-800 text-sm truncate">
              {activeClientName ? `Row: ${activeClientName}` : 'Collaboration'}
            </h3>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 shrink-0">
          <Icon name="plus" size={16} className="rotate-45" />
        </button>
      </div>

      <div className="bg-blue-50/50 px-4 py-2 border-b border-blue-100 flex items-center space-x-2">
        <Icon name="star" size={12} className="text-blue-500" />
        <p className="text-[10px] text-blue-700 font-medium">Use <b>@Name</b> to trigger email alerts</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-center px-4">
            <Icon name="message" size={32} className="mb-2 opacity-10" />
            <p className="text-xs">No activity for {activeClientName || 'this view'} yet. Start a discussion!</p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderEmail === currentUser.email;
            const sender = allUsers.find(u => u.email === msg.senderEmail);
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center space-x-1 mb-1">
                  <span className="text-[10px] font-bold text-slate-500">{sender?.name || 'User'}</span>
                  <span className="text-[9px] text-slate-300">{msg.timestamp}</span>
                </div>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}>
                  {msg.content.split(/(@\w+(?:\s\w+)?)/g).map((part, i) => (
                    part.startsWith('@') ? <span key={i} className={`font-black ${isMe ? 'text-blue-100 underline' : 'text-blue-600'}`}>{part}</span> : part
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white relative">
        {mentionSearch !== null && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-bottom-2 duration-200 max-h-48 overflow-y-auto">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => insertMention(u)}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center space-x-2"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black">{u.name.charAt(0)}</div>
                  <div className="flex flex-col">
                    <span>{u.name}</span>
                    <span className="text-[8px] text-slate-400 font-medium">Sends email to {u.email}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-[10px] text-slate-400 italic">No matches found</div>
            )}
          </div>
        )}

        <div className="relative group">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type @name to notify teammates..."
            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium"
          />
          <button
            onClick={handleSend}
            className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            disabled={!input.trim()}
          >
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SidebarMessaging;
