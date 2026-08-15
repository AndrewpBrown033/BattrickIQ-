import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { 
  MessageSquare, 
  Calendar, 
  Trash2, 
  ChevronRight, 
  Bot, 
  User, 
  Clock, 
  RefreshCw, 
  MessageCircle, 
  ChevronLeft,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CoachChat {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface AICoachHistoryProps {
  setActiveTab?: (tab: any) => void;
  onResumeChat?: (chatId: string) => void;
}

export default function AICoachHistory({ setActiveTab, onResumeChat }: AICoachHistoryProps) {
  const [chats, setChats] = useState<CoachChat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChat, setSelectedChat] = useState<CoachChat | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentUser = getCustomUser();

  const loadChatHistory = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const chatsPath = `users/${currentUser.uid}/chats`;

    try {
      const chatsRef = collection(db, chatsPath);
      const q = query(chatsRef, orderBy('updatedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const loadedChats: CoachChat[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedChats.push({
          id: docSnap.id,
          userId: data.userId || currentUser.uid,
          title: data.title || 'Untitled Conversation',
          messages: data.messages || [],
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      setChats(loadedChats);
      
      // Keep selected chat updated if it was refreshed
      if (selectedChat) {
        const updated = loadedChats.find(c => c.id === selectedChat.id);
        if (updated) {
          setSelectedChat(updated);
        }
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      setError("Failed to load chat history. Ensure you are connected and try again.");
      try {
        handleFirestoreError(err, OperationType.LIST, chatsPath);
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChatHistory();
  }, [currentUser]);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!currentUser || deletingId) return;

    if (!window.confirm("Are you sure you want to permanently delete this chat history?")) {
      return;
    }

    setDeletingId(chatId);
    const docPath = `users/${currentUser.uid}/chats/${chatId}`;

    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'chats', chatId));
      setChats(prev => prev.filter(c => c.id !== chatId));
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
      alert("Failed to delete chat session.");
      try {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      } catch (e) {}
    } finally {
      setDeletingId(null);
    }
  };

  const handleResumeChat = (chat: CoachChat) => {
    localStorage.setItem('bt_current_chat_id', chat.id);
    if (onResumeChat) {
      onResumeChat(chat.id);
    } else if (setActiveTab) {
      setActiveTab('coach');
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Unknown Date';
    }
  };

  const formatMarkdown = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      let elementClass = "text-slate-700 leading-relaxed text-xs my-1";

      let formattedLine: React.ReactNode = line;
      if (line.includes('**')) {
        const parts = line.split('**');
        formattedLine = parts.map((part, pIdx) => {
          if (pIdx % 2 === 1) {
            return <strong key={pIdx} className="font-bold text-slate-900">{part}</strong>;
          }
          return part;
        });
      }

      if (trimmed.startsWith('###')) {
        return <h5 key={idx} className="font-display font-bold text-slate-800 text-sm mt-3 mb-1">{line.replace('###', '').trim()}</h5>;
      }
      if (trimmed.startsWith('##')) {
        return <h4 key={idx} className="font-display font-extrabold text-indigo-950 text-base mt-4 mb-1.5 border-b border-slate-100 pb-1">{line.replace('##', '').trim()}</h4>;
      }
      if (trimmed.startsWith('#')) {
        return <h3 key={idx} className="font-display font-extrabold text-indigo-950 text-lg mt-5 mb-2">{line.replace('#', '').trim()}</h3>;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleaned = trimmed.substring(2);
        let formattedCleaned: React.ReactNode = cleaned;
        if (cleaned.includes('**')) {
          const parts = cleaned.split('**');
          formattedCleaned = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className="font-bold text-slate-900">{part}</strong>;
            }
            return part;
          });
        }
        return (
          <li key={idx} className="list-disc ml-5 pl-1 text-slate-700 text-xs my-0.5 leading-relaxed">
            {formattedCleaned}
          </li>
        );
      }

      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const cleaned = numMatch[2];
        let formattedCleaned: React.ReactNode = cleaned;
        if (cleaned.includes('**')) {
          const parts = cleaned.split('**');
          formattedCleaned = parts.map((part, pIdx) => {
            if (pIdx % 2 === 1) {
              return <strong key={pIdx} className="font-bold text-slate-900">{part}</strong>;
            }
            return part;
          });
        }
        return (
          <div key={idx} className="flex gap-2 text-xs text-slate-700 my-1 leading-relaxed pl-1">
            <span className="font-bold text-indigo-600 font-mono shrink-0">{numMatch[1]}.</span>
            <span>{formattedCleaned}</span>
          </div>
        );
      }

      return <p key={idx} className={elementClass}>{formattedLine}</p>;
    });
  };

  if (!currentUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto shadow-sm">
        <Bot className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="font-display font-extrabold text-base text-slate-900">Authentication Required</h3>
        <p className="text-xs text-slate-500 mt-2">Please sign in to access your persistent Coach Jarvis chat history.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar List of Chats (Column 1-5 or 1-12 if none selected) */}
      <div className={`${selectedChat ? 'lg:col-span-5' : 'lg:col-span-12'} flex flex-col gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm min-h-[500px]`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-display font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              Past Consultations
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Chronological record of strategical feedback</p>
          </div>
          <button 
            onClick={loadChatHistory}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-red-700 text-xs flex items-center gap-2">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {loading && chats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Retrieving transcripts...</span>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageCircle className="w-10 h-10 text-slate-300 mb-3" />
            <h4 className="font-display font-bold text-slate-700 text-xs">No Chat History Found</h4>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
              When you consult Coach Jarvis and ask strategic club advice, those chats will be persistently archived here.
            </p>
            <button
              onClick={() => setActiveTab('coach')}
              className="mt-4 inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] px-3.5 py-1.5 rounded-lg transition duration-150 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Start New Consult
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[550px] pr-1">
            {chats.map((chat) => {
              const isSelected = selectedChat?.id === chat.id;
              return (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`group relative p-3 rounded-lg border transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/45 border-indigo-200 ring-1 ring-indigo-100'
                      : 'bg-slate-50/50 border-slate-200/70 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-semibold text-xs leading-snug truncate ${isSelected ? 'text-indigo-950 font-black' : 'text-slate-800'}`}>
                        {chat.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDateTime(chat.createdAt)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-slate-400" />
                          {chat.messages.length} messages
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={(e) => handleDeleteChat(e, chat.id)}
                        disabled={deletingId === chat.id}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete chat session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Content Panel - Conversation View (Column 6-12) */}
      {selectedChat && (
        <div className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-[600px] animate-fadeIn">
          {/* Header */}
          <div className="bg-indigo-950 p-4 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button 
                onClick={() => setSelectedChat(null)}
                className="lg:hidden p-1 text-indigo-300 hover:text-white hover:bg-indigo-900 rounded transition shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="p-1.5 bg-indigo-900/80 rounded-lg border border-indigo-700/50 shrink-0">
                <Bot className="w-4 h-4 text-indigo-300" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-black text-xs tracking-tight truncate">
                  {selectedChat.title}
                </h3>
                <p className="text-[9px] text-indigo-200 font-mono mt-0.5">
                  Session started on {formatDateTime(selectedChat.createdAt)}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleResumeChat(selectedChat)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10.5px] px-3.5 py-1.5 rounded-lg transition duration-150 flex items-center gap-1.5 shrink-0 shadow-sm shadow-indigo-500/20 cursor-pointer"
            >
              <span>Resume Chat</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transcript Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {selectedChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center border ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                    : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`p-3.5 rounded-2xl text-xs shadow-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none font-medium'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="space-y-1">
                      {formatMarkdown(msg.content)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
