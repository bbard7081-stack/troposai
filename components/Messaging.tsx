
import React, { useState } from 'react';
import { AppUser, ChatMessage } from '../types';
import { Icon } from './Icon';

interface MessagingProps {
  currentUser: AppUser;
  allUsers: AppUser[];
  messages: ChatMessage[];
  onSendMessage: (msg: ChatMessage) => void;
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, allUsers, messages, onSendMessage }) => {
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(allUsers.find(u => u.id !== currentUser.id) || null);
  const [input, setInput] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [taggedRowId, setTaggedRowId] = useState<string | null>(null);

  const handleSend = () => {
    if (!input || !selectedUser) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderEmail: currentUser.email,
      receiverEmail: selectedUser.email,
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      taggedRowId: taggedRowId || undefined
    };
    onSendMessage(newMessage);
    setInput('');
    setTaggedRowId(null);
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt !== -1 && lastAt === val.length - 1) {
      setShowMentions(true);
      setMentionIndex(0);
    } else if (showMentions && !val.includes('@')) {
      setShowMentions(false);
    }
  };

  const insertMention = (user: AppUser) => {
    const lastAt = input.lastIndexOf('@');
    const newInput = input.substring(0, lastAt) + `@${user.name} `;
    setInput(newInput);
    setShowMentions(false);
  };

  const currentChat = messages.filter(m =>
    (m.senderEmail === currentUser.email && m.receiverEmail === selectedUser?.email) ||
    (m.senderEmail === selectedUser?.email && m.receiverEmail === currentUser.email)
  );

  return (
    <div className="h-full flex bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* User List */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Team Directory</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {allUsers.filter(u => u.id !== currentUser.id).map(user => (
            <button
              key={user.id}
              onClick={() => setSelectedUser(user)}
              className={`w-full p-4 flex items-center space-x-3 text-left transition hover:bg-slate-50 ${selectedUser?.id === user.id ? 'bg-blue-50/50 border-r-4 border-blue-600' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.team || 'Member'}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {selectedUser ? (
          <>
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  {selectedUser.name.charAt(0)}
                </div>
                <h3 className="font-bold text-slate-800">{selectedUser.name}</h3>
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-slate-400 hover:text-blue-600 transition"><Icon name="settings" size={18} /></button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {currentChat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic">
                  <Icon name="message" size={48} className="mb-4 opacity-20" />
                  <p>Start a conversation with {selectedUser.name}</p>
                </div>
              ) : (
                currentChat.map(msg => (
                  <div key={msg.id} className={`flex ${msg.senderEmail === currentUser.email ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs p-3 rounded-2xl text-sm shadow-sm ${msg.senderEmail === currentUser.email ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                      <p className="whitespace-pre-wrap">
                        {msg.content.split(/(@\w+\s\w+)/).map((part, i) =>
                          part.startsWith('@') ? <span key={i} className="font-black underline decoration-2 underline-offset-2">@{part.substring(1)}</span> : part
                        )}
                      </p>
                      {msg.taggedRowId && (
                        <div className={`mt-2 p-2 rounded-xl text-[10px] flex items-center space-x-2 ${msg.senderEmail === currentUser.email ? 'bg-white/10' : 'bg-slate-50'}`}>
                          <Icon name="grid" size={12} />
                          <span className="font-bold">Linked Item: {msg.taggedRowId}</span>
                        </div>
                      )}
                      <p className={`text-[10px] mt-1 ${msg.senderEmail === currentUser.email ? 'text-blue-100' : 'text-slate-400'}`}>
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 space-y-3">
              {showMentions && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-xl p-2 animate-in slide-in-from-bottom-2 duration-200">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Mention Team Member</p>
                  {allUsers.map(user => (
                    <button
                      key={user.id}
                      onClick={() => insertMention(user)}
                      className="w-full flex items-center space-x-2 p-2 hover:bg-blue-50 rounded-lg text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{user.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={`Message ${selectedUser.name}...`}
                    className="w-full px-4 py-2 bg-slate-100 border-none rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSend}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Icon name="plus" className="rotate-45" size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Icon name="message" size={64} className="mb-4 opacity-10" />
            <p>Select a team member to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messaging;
