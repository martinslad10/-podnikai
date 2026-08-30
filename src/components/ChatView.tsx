import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  Copy, 
  Check, 
  Trash2, 
  RotateCcw, 
  Briefcase, 
  HelpCircle,
  TrendingUp,
  Target,
  ArrowRight
} from 'lucide-react';
import Markdown from 'react-markdown';
import { ChatMessage, UserProfile } from '../types';
import { sendChatMessage } from '../services/api';

interface ChatViewProps {
  userProfile: UserProfile;
  currentProject: string;
  onNavigateToIdeas: () => void;
  onNavigateToPlan: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  userProfile,
  currentProject,
  onNavigateToIdeas,
  onNavigateToPlan
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        content: `Ahoj ${userProfile.name || 'podnikateli'}! Jsem tvůj AI byznys parťák **PODNIKAI**. 

Mám před sebou tvůj profil:
- **Cíl:** ${userProfile.goal}
- **Rozpočet:** ${userProfile.startingBudget} | **Čas:** ${userProfile.availableTime}
- **Silné stránky:** ${userProfile.skills.slice(0, 3).join(', ')}
${currentProject ? `- **Aktuální projekt:** ${currentProject}` : ''}

S čím se dnes pohneme dopředu? Můžeme zvalidovat nápad, nastavit cenotvorbu, připravit prodejní skript pro první klienty nebo vyřešit konkrétní zádrhel.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Chci začít podnikat, ale nevím s čím',
          currentProject ? `Jak získat prvních 5 zákazníků pro ${currentProject}?` : 'Chci podnikat v auto-detailingu / mobilních službách',
          'Jak přesně nastavit ceny a marže pro mé služby?',
          'Jak ověřit poptávku na trhu ještě před spuštěním?'
        ]
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        userProfile,
        currentProject
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: response.suggestions
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Omlouvám se, došlo k chybě při generování odpovědi. Zkus to prosím znovu.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Chat byl vyčištěn. Jak ti mohu v byznysu ${currentProject || ''} dnes pomoci?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [
          'Chci začít podnikat, ale nevím s čím',
          'Jak sestavit nabídku s vysokou hodnotou?',
          'Vytvořit prodejní skript na LinkedIn/Instagram'
        ]
      }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col p-2 sm:p-4">
      
      {/* Top Chat Info Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 mb-3 flex items-center justify-between gap-2 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100">PODNIKAI Asistent</span>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-[10px] text-blue-400 font-medium hidden sm:inline">Aktivní kontext profilu</span>
            </div>
            <span className="text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-md block">
              {currentProject ? `Projekt: ${currentProject}` : `Uživatel: ${userProfile.name} (${userProfile.targetIncome})`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-chat-clear"
            onClick={handleClear}
            title="Vyčistit konverzaci"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors text-xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 pb-4">
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
            >
              {isAssistant && (
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[88%] sm:max-w-[80%] space-y-2`}>
                <div
                  className={`rounded-2xl p-4 sm:p-5 text-sm shadow-md backdrop-blur-md ${
                    isAssistant
                      ? 'bg-white/5 border border-white/10 text-slate-200'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-blue-500/20'
                  }`}
                >
                  {isAssistant ? (
                    <div className="prose-dark space-y-2">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>

                {/* Message footer info & copy */}
                <div className={`flex items-center gap-2 text-[10px] text-slate-500 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                  <span>{msg.timestamp}</span>
                  {isAssistant && (
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                      title="Kopírovat"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-blue-400" />
                          <span className="text-blue-400">Zkopírováno</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopírovat</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Quick suggestions chips from this assistant turn */}
                {isAssistant && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {msg.suggestions.map((sug, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(sug)}
                        className="text-left text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 backdrop-blur-md"
                      >
                        <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                        <span>{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!isAssistant && (
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 text-slate-300 flex items-center justify-center shrink-0 mt-1 font-bold text-xs">
                  {userProfile.name ? userProfile.name[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-xs text-slate-400 flex items-center gap-2 shadow-md backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>PodnikAI analyzuje tvůj požadavek v českém kontextu...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="pt-2 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl shadow-xl focus-within:border-blue-500/50 transition-colors p-1.5 backdrop-blur-xl"
        >
          <textarea
            id="input-chat-message"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Napiš svou otázku nebo co v byznysu řešíš (např. 'Chci začít podnikat v detailingu')..."
            className="w-full pl-4 pr-12 py-2.5 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none resize-none max-h-32"
          />

          <button
            id="btn-chat-send"
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-3 p-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-500 text-white transition-all font-bold shadow-md shadow-blue-500/25"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

    </div>
  );
};
