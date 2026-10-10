import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Send, Sparkles, User, Bot, Plus, History } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import AICoachHistory from './AICoachHistory';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AICoach() {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'history'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello Manager! I am **Coach Jarvis**, your strategic advisor powered by OpenRouter LLMs. Configure your API key in **Jarvis Settings** (More menu), then ask me anything about your squad, finances, or tactics."
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [teamContext, setTeamContext] = useState<string>('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Model/key live in Jarvis Settings — read from localStorage
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('bt_llm_model') || 'anthropic/claude-3.5-sonnet';
  });
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => {
    return localStorage.getItem('bt_openrouter_api_key') || '';
  });

  useEffect(() => {
    const sync = () => {
      setSelectedModel(localStorage.getItem('bt_llm_model') || 'anthropic/claude-3.5-sonnet');
      setOpenRouterKey(localStorage.getItem('bt_openrouter_api_key') || '');
    };
    window.addEventListener('storage', sync);
    window.addEventListener('bt_jarvis_settings_changed', sync);
    const onVis = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('bt_jarvis_settings_changed', sync);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const currentUser = getCustomUser();

  useEffect(() => {
    const loadActiveSession = async () => {
      const activeId = localStorage.getItem('bt_current_chat_id');
      if (!activeId) {
        setCurrentChatId(null);
        setMessages([
          {
            role: 'assistant',
            content: "Hello Manager! I am **Coach Jarvis**. Configure your OpenRouter key in **Jarvis Settings**, then ask me anything about your squad or tactics."
          }
        ]);
        return;
      }

      if (activeId === currentChatId) return;
      if (!currentUser) return;

      setLoadingChat(true);
      const chatDocRef = doc(db, 'users', currentUser.uid, 'chats', activeId);
      try {
        const docSnap = await getDoc(chatDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.messages && Array.isArray(data.messages)) {
            setMessages(data.messages);
            setCurrentChatId(activeId);
          }
        } else {
          localStorage.removeItem('bt_current_chat_id');
          setCurrentChatId(null);
        }
      } catch (err) {
        console.error("Error loading chat session:", err);
      } finally {
        setLoadingChat(false);
      }
    };

    loadActiveSession();
  }, [currentUser, activeSubTab]);

  const saveChatToFirestore = async (chatId: string, updatedMessages: Message[], titleForNewChat?: string) => {
    if (!currentUser) return;
    const chatDocRef = doc(db, 'users', currentUser.uid, 'chats', chatId);
    const chatsPath = `users/${currentUser.uid}/chats/${chatId}`;
    try {
      let title = titleForNewChat || 'Strategic Consultation';
      let createdAt = new Date().toISOString();
      if (!titleForNewChat) {
        const docSnap = await getDoc(chatDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          title = data.title || title;
          createdAt = data.createdAt || createdAt;
        }
      }
      await setDoc(chatDocRef, {
        id: chatId,
        userId: currentUser.uid,
        title,
        messages: updatedMessages,
        createdAt,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to save chat to Firestore:", err);
      try { handleFirestoreError(err, OperationType.WRITE, chatsPath); } catch (e) {}
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('bt_current_chat_id');
    setCurrentChatId(null);
    setMessages([
      {
        role: 'assistant',
        content: "Hello Manager! I am **Coach Jarvis**. Configure your OpenRouter key in **Jarvis Settings**, then ask me anything about your squad or tactics."
      }
    ]);
  };

  useEffect(() => {
    const loadContext = () => {
      const squadStr = localStorage.getItem('bt_squad');
      const financesStr = localStorage.getItem('bt_finances');
      const stadiumStr = localStorage.getItem('bt_stadium');
      const pavilionStr = localStorage.getItem('bt_pavilion');
      const teamName = localStorage.getItem('bt_team_name') || 'Unnamed Club';
      const contextParts: string[] = [];
      contextParts.push(`Team Name: ${teamName}`);

      if (squadStr) {
        try {
          const squad = JSON.parse(squadStr);
          contextParts.push(`Squad Size: ${squad.length} active players`);
          const playersBrief = squad.map((p: any) =>
            `- ${p.name}: ${p.age}yo, Role: ${p.role}, BTR: ${p.btRating}, Wage: £${p.wage}, BowlingType: ${p.bowlingType || 'None'}, Batting: ${p.skills?.batting}, Bowling: ${p.skills?.bowling}, Keeping: ${p.skills?.keeping}, Stamina: ${p.skills?.stamina}`
          ).join('\n');
          contextParts.push(`\n[Roster Detail]:\n${playersBrief}`);
        } catch (e) { console.error(e); }
      } else {
        contextParts.push('Roster: No players parsed yet.');
      }

      if (financesStr) {
        try {
          const fin = JSON.parse(financesStr);
          contextParts.push(`\n[Finances Detail]:\n- Cash in Bank: £${fin.cash?.toLocaleString?.() ?? fin.cash}\n- PR Officers: ${fin.prOfficers}\n- Financial Advisors: ${fin.finAdvisors}\n- Sponsors Income: £${fin.sponsorsIncome}/wk\n- Gate Receipts: £${fin.gateReceipts}/wk\n- Player Wages: £${fin.playerWages}/wk\n- Staff Wages: £${fin.staffWages}/wk\n- Members: ${fin.members}`);
        } catch (e) { console.error(e); }
      }

      if (stadiumStr) {
        try {
          const std = JSON.parse(stadiumStr);
          contextParts.push(`\n[Stadium]: Terracing ${std.terracing}, Grass ${std.grass}, Seats ${std.seats}, Boxes ${std.boxes}, Capacity ${std.capacity}`);
        } catch (e) { console.error(e); }
      }

      if (pavilionStr) {
        try {
          const pav = JSON.parse(pavilionStr);
          contextParts.push(`\n[Ground]: ${pav.groundName}, Pitch: ${pav.pitchType}, Weather: ${pav.weather}`);
        } catch (e) { console.error(e); }
      }

      setTeamContext(contextParts.join('\n'));
    };
    loadContext();
    window.addEventListener('storage', loadContext);
    return () => window.removeEventListener('storage', loadContext);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    let chatId = currentChatId;
    let isNew = false;
    if (!chatId) {
      chatId = 'chat_' + Date.now();
      setCurrentChatId(chatId);
      localStorage.setItem('bt_current_chat_id', chatId);
      isNew = true;
    }

    const userMsg: Message = { role: 'user', content: textToSend };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    if (chatId) {
      const title = isNew
        ? (textToSend.length > 45 ? textToSend.substring(0, 45) + '...' : textToSend)
        : undefined;
      await saveChatToFirestore(chatId, newMessages, title);
    }

    try {
      let replyText = '';
      let success = false;
      let errorMsg = '';
      let useClientFallback = false;

      const activeOpenRouterKey = openRouterKey || localStorage.getItem('bt_openrouter_api_key') || '';
      const model = selectedModel || localStorage.getItem('bt_llm_model') || 'anthropic/claude-3.5-sonnet';

      if (!activeOpenRouterKey) {
        setLoading(false);
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ **OpenRouter API Key Required**: Open **Jarvis Settings** (More → Jarvis Settings) and paste your OpenRouter API key. Get a free key at [openrouter.ai/keys](https://openrouter.ai/keys).'
          }
        ]);
        return;
      }

      try {
        const response = await fetch('/api/coach-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            context: teamContext,
            model,
            openRouterApiKey: activeOpenRouterKey
          })
        });
        const contentType = response.headers.get('content-type') || '';
        if (response.status === 404 || contentType.includes('text/html')) {
          useClientFallback = true;
        } else {
          const data = await response.json();
          if (data.success) {
            replyText = data.reply;
            success = true;
          } else {
            errorMsg = data.error || 'Request failed.';
          }
        }
      } catch {
        useClientFallback = true;
      }

      if (useClientFallback) {
        try {
          const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${activeOpenRouterKey}`,
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Battrick Tactical Assistant',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'system',
                  content: "You are 'Coach Jarvis', the premier AI Strategic Coach for Battrick cricket management. You are an expert at match ratings, Batstats, batting orders, and net planning."
                },
                {
                  role: 'user',
                  content: `[TEAM & MATCH CONTEXT]:\n${teamContext || 'No context yet.'}\n\n[USER INQUIRY]:\n${textToSend}`
                }
              ]
            })
          });
          if (!orRes.ok) {
            const errData = await orRes.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP ${orRes.status}`);
          }
          const orData = await orRes.json();
          const reply = orData.choices?.[0]?.message?.content;
          if (reply) {
            replyText = reply;
            success = true;
          } else {
            throw new Error('Empty response from OpenRouter.');
          }
        } catch (orErr: any) {
          errorMsg = `OpenRouter call failed: ${orErr.message}`;
        }
      }

      const finalMessages = [
        ...newMessages,
        {
          role: 'assistant' as const,
          content: success ? replyText : `⚠️ Error from Coach Jarvis: ${errorMsg}`
        }
      ];
      setMessages(finalMessages);
      if (chatId) await saveChatToFirestore(chatId, finalMessages);
    } catch (error: any) {
      const finalMessages = [
        ...newMessages,
        { role: 'assistant' as const, content: `⚠️ Network failed: ${error.message || 'Server timeout.'}` }
      ];
      setMessages(finalMessages);
      if (chatId) await saveChatToFirestore(chatId, finalMessages);
    } finally {
      setLoading(false);
    }
  };

  const templates = [
    { label: 'Starting XI', text: 'Recommend the best tactical starting XI from my squad based on skills and form.' },
    { label: 'Wage review', text: 'Review my wage bill and suggest where I can trim or invest.' },
    { label: 'Next opponent', text: 'How should I approach my next match based on my squad and recent form?' },
  ];

  return (
    <div className="flex flex-col h-[min(70dvh,720px)] min-h-[420px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-indigo-950 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-5 h-5 shrink-0 text-indigo-200" />
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Coach Jarvis</div>
            <div className="text-[10px] text-indigo-200/90 truncate font-mono">
              {openRouterKey
                ? (selectedModel.split('/').pop() || selectedModel)
                : 'Key needed → Jarvis Settings'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab(activeSubTab === 'chat' ? 'history' : 'chat')}
            className="text-[10px] font-bold bg-indigo-800 hover:bg-indigo-700 border border-indigo-700 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            {activeSubTab === 'chat' ? 'History' : 'Chat'}
          </button>
          {currentChatId && activeSubTab === 'chat' && (
            <button
              type="button"
              onClick={handleNewChat}
              className="text-[10px] font-bold bg-indigo-800 hover:bg-indigo-700 border border-indigo-700 text-white px-2.5 py-1.5 rounded-lg flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'history' ? (
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <AICoachHistory onResumeChat={() => setActiveSubTab('chat')} />
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {loadingChat ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Restoring chat...</span>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center border ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white border-slate-200 text-indigo-700'
                  }`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-800'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                Jarvis is thinking...
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3 space-y-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {templates.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => handleSendMessage(t.text)}
                  disabled={loading}
                  className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-800 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />
                  {t.label}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Jarvis about lineup, wages, opponents..."
                className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold disabled:opacity-40 hover:bg-indigo-700"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
