import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Send, Sparkles, HelpCircle, User, Bot, AlertCircle, Plus, History } from 'lucide-react';
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
      content: "Hello Manager! I am **Coach Jarvis**, your strategic advisor. I have loaded your team's live squad roster, weekly finances, and stadium capacities to provide bespoke assessments. Ask me anything, or choose a shortcut template below."
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [teamContext, setTeamContext] = useState<string>('');
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentUser = getCustomUser();

  // Load saved session on mount or if active chat ID changes
  useEffect(() => {
    const loadActiveSession = async () => {
      const activeId = localStorage.getItem('bt_current_chat_id');
      if (!activeId) {
        setCurrentChatId(null);
        setMessages([
          {
            role: 'assistant',
            content: "Hello Manager! I am **Coach Jarvis**, your strategic advisor. I have loaded your team's live squad roster, weekly finances, and stadium capacities to provide bespoke assessments. Ask me anything, or choose a shortcut template below."
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
        title: title,
        messages: updatedMessages,
        createdAt: createdAt,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to save chat to Firestore:", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, chatsPath);
      } catch (e) {}
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('bt_current_chat_id');
    setCurrentChatId(null);
    setMessages([
      {
        role: 'assistant',
        content: "Hello Manager! I am **Coach Jarvis**, your strategic advisor. I have loaded your team's live squad roster, weekly finances, and stadium capacities to provide bespoke assessments. Ask me anything, or choose a shortcut template below."
      }
    ]);
  };

  // Load team details to build prompt context
  useEffect(() => {
    const loadContext = () => {
      const squadStr = localStorage.getItem('bt_squad');
      const financesStr = localStorage.getItem('bt_finances');
      const stadiumStr = localStorage.getItem('bt_stadium');
      const pavilionStr = localStorage.getItem('bt_pavilion');
      const teamName = localStorage.getItem('bt_team_name') || 'Unnamed Club';

      let contextParts = [];
      contextParts.push(`Team Name: ${teamName}`);

      if (squadStr) {
        try {
          const squad = JSON.parse(squadStr);
          contextParts.push(`Squad Size: ${squad.length} active players`);
          const playersBrief = squad.map((p: any) => 
            `- ${p.name}: ${p.age}yo, Role: ${p.role}, BTR: ${p.btRating}, Wage: £${p.wage}, BowlingType: ${p.bowlingType || 'None'}, Batting: ${p.skills.batting}, Bowling: ${p.skills.bowling}, Keeping: ${p.skills.keeping}, Stamina: ${p.skills.stamina}`
          ).join('\n');
          contextParts.push(`\n[Roster Detail]:\n${playersBrief}`);
        } catch (e) {
          console.error(e);
        }
      } else {
        contextParts.push("Roster: No players parsed yet.");
      }

      if (financesStr) {
        try {
          const fin = JSON.parse(financesStr);
          contextParts.push(`\n[Finances Detail]:\n- Cash in Bank: £${fin.cash.toLocaleString()}\n- PR Officers count: ${fin.prOfficers}\n- Financial Advisors count: ${fin.finAdvisors}\n- Sponsors Income: £${fin.sponsorsIncome}/wk\n- Gate Receipts: £${fin.gateReceipts}/wk\n- Player Wages: £${fin.playerWages}/wk\n- Staff Wages: £${fin.staffWages}/wk\n- Supporters Morale: ${fin.morale}\n- Sponsors Mood: ${fin.sponsorsMood}\n- Club Members count: ${fin.members}`);
        } catch (e) {
          console.error(e);
        }
      } else {
        contextParts.push("Finances: No club budgets synced.");
      }

      if (stadiumStr) {
        try {
          const std = JSON.parse(stadiumStr);
          contextParts.push(`\n[Stadium Detail]:\n- Terracing capacity: ${std.terracing}\n- Grass Banks capacity: ${std.grass}\n- Seats capacity: ${std.seats}\n- Executive Boxes capacity: ${std.boxes}\n- Total Capacity: ${std.capacity}`);
        } catch (e) {
          console.error(e);
        }
      } else {
        contextParts.push("Stadium: Default 10,000 seating assumed.");
      }

      if (pavilionStr) {
        try {
          const pav = JSON.parse(pavilionStr);
          contextParts.push(`\n[Current Ground & Pitch Condition]:\n- Ground Name: ${pav.groundName}\n- Pitch Type: ${pav.pitchType}\n- Active Weather: ${pav.weather}`);
        } catch (e) {
          console.error(e);
        }
      } else {
        contextParts.push("\n[Current Ground & Pitch Condition]:\nNo custom pitch or ground page synced yet. Defaulting to a Flat pitch.");
      }

      setTeamContext(contextParts.join('\n'));
    };

    loadContext();
    // Re-load context on storage update
    window.addEventListener('storage', loadContext);
    return () => window.removeEventListener('storage', loadContext);
  }, []);

  // Scroll to bottom of chat
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
      let title = "Strategic Consultation";
      if (isNew) {
        title = textToSend.length > 45 ? textToSend.substring(0, 45) + '...' : textToSend;
      }
      await saveChatToFirestore(chatId, newMessages, isNew ? title : undefined);
    }

    try {
      let replyText = "";
      let success = false;
      let errorMsg = "";
      let useClientFallback = false;

      // 1. Attempt server-side proxy route first
      try {
        const customKey = localStorage.getItem('bt_custom_api_key') || '';
        const response = await fetch('/api/coach-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: textToSend,
            context: teamContext,
            customApiKey: customKey
          })
        });

        const contentType = response.headers.get('content-type') || '';
        if (response.status === 404 || contentType.includes('text/html')) {
          // If we receive a 404 or HTML response, it indicates server-side API endpoints are not hosted/active (static environment)
          useClientFallback = true;
        } else {
          const data = await response.json();
          if (data.success) {
            replyText = data.reply;
            success = true;
          } else {
            errorMsg = data.error || 'Syntax parsing failure.';
          }
        }
      } catch (err) {
        // Fetch/network failures on the local API endpoint mean we should try the client-side fallback
        useClientFallback = true;
      }

      // 2. Client-side direct fallback if server-side proxy is unavailable
      if (useClientFallback) {
        const customKey = localStorage.getItem('bt_custom_api_key') || '';
        const clientKey = customKey || (import.meta as any).env?.VITE_GEMINI_API_KEY;
        if (clientKey) {
          console.log("[AICoach] Server-side API is unavailable. Falling back to direct client-side Gemini API call...");
          
          const systemInstruction = `You are 'Coach Jarvis', the premier AI Strategic Coach for Battrick, an online multiplayer cricket management game.
Your task is to analyze the user's questions or requests, evaluate their team context (if provided), and deliver highly professional, precise, and strategically sound advice.

Your expertise includes:
1. Trade Selections & Transfer Evaluation: Advise on whether a player should be kept (HOLD), sold (TRADE), trained (DEVELOP), or retired. Estimate their transfer values based on age premiums, skills, and wages.
2. Weekly Training Plans: Suggest the optimal distribution of coaching nets (Max 3 nets per player, up to 10 nets total across the squad). Primary nets (Batting, Bowling, Keeping) should match the player's core role, and secondary nets (Stamina, Fielding) should support overall rating.
3. Financial & Stadium Planning: Advise on weekly budget balances, staff salaries, optimal Financial Advisor (FA) and PR Officer counts, and stadium size expansion.
   - PR Staff ratio: Approx 1 PR Officer per 250 club members (up to 10 max).
   - FA Staff ratio: Approx 1 FA per £1,000,000 in bank balance (up to 10 max) to maximize compound interest. Since each FA costs £1,250/week, FAs are only profitable when your reserves exceed £2,500,000. Hold 0 FAs under £2.5M, and 10 FAs immediately upon crossing £2.5M.
   - Ideal Seating Distribution Ratios: Terracing (60%), Grass Banks (30%), Seats (8%), Executive Boxes (2%).
   - Expansion Capacity Recommendation: Weak/rebuilding (Members * 13), Mid-table (Members * 15), Top-3 (Members * 17), Championship (Members * 20).
4. Home Pitch Recommendation: Analyze their squad players (bowling types/styles and batting skills) and compare them with the current home ground pitch type (found under Current Ground & Pitch Condition). Recommend what the optimal pitch type should be (Flat, Hard, Green, Dusty, Cracked, Uneven) to maximize their home match ratings.
   - If they have strong spin bowlers (bowling styles like OS, SLA, LBG), recommend Dusty or Cracked pitches.
   - If they have strong fast/seam bowlers (bowling styles like RF, LF, RFM, LFM), recommend Green or Hard pitches.
   - If their batting ratings/skills are vastly superior to their weak bowling ratings, suggest Flat to pile on high batting totals.
   - If they have mostly medium-pace bowlers and moderate batsmen, suggest Uneven or Cracked to introduce low/high bounce variance.

Respond with supportive, highly specialized, yet easy-to-read formatting. Use Markdown lists, bold highlights, and clean spacing.`;

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${clientKey}`;
          try {
            const geminiRes = await fetch(geminiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `[TEAM CONTEXT]:\n${teamContext || "No context provided yet."}\n\n[USER INQUIRY]:\n${textToSend}`
                      }
                    ]
                  }
                ],
                systemInstruction: {
                  parts: [
                    {
                      text: systemInstruction
                    }
                  ]
                }
              })
            });

            if (!geminiRes.ok) {
              const errData = await geminiRes.json().catch(() => ({}));
              throw new Error(errData.error?.message || `HTTP status ${geminiRes.status}`);
            }

            const geminiData = await geminiRes.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              replyText = text;
              success = true;
            } else {
              throw new Error("No response text found in Gemini payload.");
            }
          } catch (directErr: any) {
            console.error("[AICoach] Direct client fallback failed:", directErr);
            errorMsg = `Direct Gemini API call failed: ${directErr.message || "Network blocked"}. This usually occurs when direct requests are blocked by CORS policies, browser adblockers, or secure iframe sandboxing constraints in AI Studio. To resolve this, configure the GEMINI_API_KEY environment variable in your platform Settings > Secrets panel to use the recommended server-side proxy instead.`;
          }
        } else {
          errorMsg = "Direct API proxy is not available on this static hosting environment. To enable Coach Jarvis on static hosts like Firebase, build your application with the 'VITE_GEMINI_API_KEY' environment variable set, or switch your hosting to a full-stack container platform like Cloud Run.";
        }
      }

      if (success) {
        const finalMessages = [...newMessages, { role: 'assistant', content: replyText } as Message];
        setMessages(finalMessages);
        if (chatId) {
          await saveChatToFirestore(chatId, finalMessages);
        }
      } else {
        const finalMessages = [...newMessages, { role: 'assistant', content: `⚠️ Error from Coach Jarvis: ${errorMsg}` } as Message];
        setMessages(finalMessages);
        if (chatId) {
          await saveChatToFirestore(chatId, finalMessages);
        }
      }
    } catch (error: any) {
      const finalMessages = [...newMessages, { role: 'assistant', content: `⚠️ Network failed: ${error.message || 'Server timeout.'}` } as Message];
      setMessages(finalMessages);
      if (chatId) {
        await saveChatToFirestore(chatId, finalMessages);
      }
    } finally {
      setLoading(false);
    }
  };

  // Check for initial query from dashboard drill-down
  useEffect(() => {
    if (teamContext) {
      const initialQuery = localStorage.getItem('bt_coach_initial_query');
      if (initialQuery) {
        localStorage.removeItem('bt_coach_initial_query');
        const timer = setTimeout(() => {
          handleSendMessage(initialQuery);
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [teamContext]);

  const templates = [
    { label: 'Roster Trade Advice', text: 'Evaluate my current squad player list, estimate which prospects are worthy of long-term development, and give recommendations on which high-wage players I should consider listing for trade.' },
    { label: 'Stadium & Financial audit', text: 'Analyze my active club members, weekly sponsors payouts, and current stadium seating capacities. Should I invest in expansion, and do I have the right staff ratios?' },
    { label: 'Coaching Nets Plan', text: 'Please construct a custom coaching net plan (maximum 10 total nets across my players, up to 4 nets maximum per individual) to optimize my team growth and prevent efficiency penalties.' },
    { label: 'Pitch Preparation Advice', text: 'Recommend the optimal home pitch preparation type (Flat, Hard, Green, Dusty, Cracked, Uneven) based on my current squad players, bowlers and batters. How does this compare to my current pitch?' },
  ];

  const formatMarkdown = (text: string) => {
    // Simple custom markdown parser for robust React rendering
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      let elementClass = "text-slate-700 leading-relaxed text-xs my-1";

      // Bold tag replacement
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

      // Check header types
      if (trimmed.startsWith('###')) {
        return <h5 key={idx} className="font-display font-bold text-slate-800 text-sm mt-3 mb-1">{line.replace('###', '').trim()}</h5>;
      }
      if (trimmed.startsWith('##')) {
        return <h4 key={idx} className="font-display font-extrabold text-indigo-950 text-base mt-4 mb-1.5 border-b border-slate-100 pb-1">{line.replace('##', '').trim()}</h4>;
      }
      if (trimmed.startsWith('#')) {
        return <h3 key={idx} className="font-display font-extrabold text-indigo-950 text-lg mt-5 mb-2">{line.replace('#', '').trim()}</h3>;
      }

      // Check list items
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

      // Check numerical item list
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

  return (
    <div className="flex flex-col h-[600px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-fadeIn" id="ai-coach-chat-container">
      {/* Header */}
      <div className="bg-indigo-950 p-4 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-900/80 rounded-lg border border-indigo-700/50 relative">
            <Bot className="w-5 h-5 text-indigo-300" />
            <span className="absolute bottom-1 right-1 w-2 h-2 bg-emerald-400 rounded-full border border-indigo-950"></span>
          </div>
          <div>
            <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1.5">
              Coach Jarvis
              <span className="text-[9px] font-mono font-bold bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded">AI COACH</span>
            </h3>
            <p className="text-[10px] text-indigo-200 mt-0.5">Tactical Cricket IQ & Club Business Advisor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {currentChatId && activeSubTab === 'chat' && (
            <button
              type="button"
              onClick={handleNewChat}
              className="text-[10px] font-bold bg-indigo-800 hover:bg-indigo-700 border border-indigo-700 text-white px-2.5 py-1.5 rounded flex items-center gap-1 transition shrink-0 cursor-pointer shadow-sm"
              title="Start a new conversation"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}
          
          {/* Sync Status Badge */}
          <div className="hidden sm:block text-[10px] font-mono bg-indigo-900/60 border border-indigo-800 text-indigo-200 px-3 py-1.5 rounded-full shrink-0">
            Roster loaded
          </div>
        </div>
      </div>

      {/* Sub-tabs switcher */}
      <div className="bg-indigo-950 border-t border-indigo-900/60 px-4 flex gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => setActiveSubTab('chat')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'chat'
              ? 'border-indigo-400 text-white font-black'
              : 'border-transparent text-indigo-300 hover:text-indigo-100'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          Active Consultation
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('history')}
          className={`py-2 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-indigo-400 text-white font-black'
              : 'border-transparent text-indigo-300 hover:text-indigo-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Jarvis History
        </button>
      </div>

      {activeSubTab === 'history' ? (
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <AICoachHistory onResumeChat={() => setActiveSubTab('chat')} />
        </div>
      ) : (
        <>
          {/* Message Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {loadingChat ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Restoring chat transcripts...</span>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                  >
                    {/* Avatar */}
                    <div className={`p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center border ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 border-indigo-500 text-white' 
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    {/* Bubble */}
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

                {loading && (
                  <div className="flex gap-3 max-w-[80%] mr-auto">
                    <div className="p-1.5 rounded-lg shrink-0 h-8 w-8 flex items-center justify-center bg-white border border-slate-200 text-indigo-600 animate-pulse">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-2xl rounded-tl-none text-xs text-slate-500 font-mono shadow-sm flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>Coach Jarvis is analyzing squad parameters...</span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Templates Row */}
          <div className="p-2 border-t border-slate-100 bg-white flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 pl-2 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              Tactical prompts:
            </span>
            {templates.map((t, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(t.text)}
                className="text-[10.5px] bg-slate-50 border border-slate-200/80 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40 px-2.5 py-1 rounded-full shrink-0 font-medium transition duration-150"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="p-3 border-t border-slate-200 bg-white flex gap-2 shrink-0"
          >
            <input
              id="coach-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              placeholder="Ask Coach Jarvis about training pops, staff, or budget plans..."
              className="flex-1 p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
            />
            <button
              id="btn-coach-chat-send"
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white p-2.5 rounded-lg font-bold transition duration-150 flex items-center justify-center shrink-0 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
