import { useState, useRef, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatApi } from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPanel() {
  const { workspaceId } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi, I'm Voro. Ask me anything about your data lineage, findings, or model quality." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading || !workspaceId) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const history = messages.slice(-6);
      const { data } = await chatApi.send(workspaceId, { message: text, history });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to get a response.';
      const isNoKey = raw.toLowerCase().includes('no llm') || raw.toLowerCase().includes('not configured');
      setError(isNoKey
        ? 'No AI provider configured. Add an API key in Settings to enable chat.'
        : raw);
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    setMessages([{ role: 'assistant', content: 'Chat cleared. What would you like to explore?' }]);
    setError(null);
  }

  const border = isDark ? '#1a1a1a' : '#e5e5e5';
  const panelBg = isDark ? '#0a0a0a' : '#ffffff';
  const headerBg = isDark ? '#111111' : '#fafafa';
  const msgsBg = isDark ? '#0a0a0a' : '#f9fafb';
  const inputBg = isDark ? '#111111' : '#ffffff';
  const textMain = isDark ? '#fafafa' : '#0a0a0a';
  const textMuted = isDark ? '#737373' : '#a3a3a3';
  const btnFg = isDark ? '#0a0a0a' : '#ffffff';
  const btnBg = isDark ? '#ffffff' : '#0a0a0a';

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: btnBg }}
        className="fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-xl"
        aria-label="Open Voro AI"
      >
        {open ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={btnFg} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke={btnFg} strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-[72px] right-5 z-50 w-80 sm:w-[360px] flex flex-col rounded-xl shadow-2xl overflow-hidden"
          style={{ height: '480px', background: panelBg, border: `1px solid ${border}` }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: headerBg, borderColor: border }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: btnBg }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3L8 13L13 3" stroke={btnFg} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: textMain }}>Voro AI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                style={{ background: isDark ? '#1a1a1a' : '#f0f0f0', color: textMuted }}>
                beta
              </span>
            </div>
            <button onClick={clearHistory} className="text-xs transition-colors hover:opacity-100 opacity-60" style={{ color: textMain }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: msgsBg }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'user'
                      ? { background: btnBg, color: btnFg, borderRadius: '12px 12px 2px 12px' }
                      : { background: isDark ? '#1a1a1a' : '#ffffff', color: textMain, border: `1px solid ${border}`, borderRadius: '12px 12px 12px 2px' }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2.5 rounded-xl" style={{ background: isDark ? '#1a1a1a' : '#ffffff', border: `1px solid ${border}` }}>
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map(delay => (
                      <span key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: textMuted, animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs px-3 py-2 rounded-lg"
                style={{ background: isDark ? '#1a0000' : '#fff5f5', color: '#ef4444', border: '1px solid #fca5a5' }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t" style={{ background: inputBg, borderColor: border }}>
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about findings, lineage, SQL…"
                disabled={loading}
                className="flex-1 text-[13px] px-3 py-2 rounded-lg border outline-none transition-colors disabled:opacity-50"
                style={{ background: isDark ? '#0a0a0a' : '#f9fafb', borderColor: border, color: textMain }}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 hover:opacity-80"
                style={{ background: btnBg }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke={btnFg} strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
