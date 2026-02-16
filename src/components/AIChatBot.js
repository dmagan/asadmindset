import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Loader2, Bot, Trash2, StopCircle } from 'lucide-react';

const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const KIMI_API_KEY = 'sk-m9QIC3zPql5zOIALDaM3OzyftZX1ywuMcRIIFEmtwkpwiuf2';

const AIChatBot = ({ onBack, userName }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // System prompt
  const systemPrompt = {
    role: 'system',
    content: `تو یک دستیار هوشمند هستی به نام "اسد AI". تو به زبان فارسی پاسخ می‌دهی مگر اینکه کاربر به زبان دیگری بنویسد. پاسخ‌هایت مختصر، مفید و دوستانه هستند. اگر سوالی درباره ارز دیجیتال، ترید یا بازار مالی باشد، تحلیل دقیق و حرفه‌ای ارائه بده.${userName ? ` نام کاربر: ${userName}` : ''}`
  };

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Send message with streaming
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // Build messages array for API
    const apiMessages = [
      systemPrompt,
      ...messages.slice(-20), // last 20 messages for context
      userMsg
    ];

    // Add empty assistant message for streaming
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(KIMI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIMI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'kimi-k2-0711-preview',
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `خطا: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim().startsWith('data:'));

        for (const line of lines) {
          const data = line.replace('data: ', '').trim();
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                return updated;
              });
            }
          } catch (e) {
            // skip parse errors
          }
        }
      }

      // If no content received, show error
      if (!fullContent) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: 'متأسفانه پاسخی دریافت نشد. لطفاً دوباره تلاش کنید.' };
          return updated;
        });
      }

    } catch (e) {
      if (e.name === 'AbortError') {
        // User stopped
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant' && !last.content) {
            updated[updated.length - 1] = { role: 'assistant', content: 'متوقف شد.' };
          }
          return updated;
        });
      } else {
        console.error('Kimi API error:', e);
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            if (!last.content) {
              updated[updated.length - 1] = { role: 'assistant', content: `خطا: ${e.message}` };
            }
          } else {
            updated.push({ role: 'assistant', content: `خطا: ${e.message}` });
          }
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown-like rendering
  const renderContent = (text) => {
    if (!text) return null;
    
    // Split by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <pre key={i} style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 8,
            padding: '10px 12px',
            overflow: 'auto',
            fontSize: 12,
            fontFamily: 'monospace',
            direction: 'ltr',
            textAlign: 'left',
            margin: '6px 0',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <code style={{ color: '#e2e8f0' }}>{code}</code>
          </pre>
        );
      }

      // Bold
      let processed = part.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      processed = processed.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>');
      
      return (
        <span
          key={i}
          dangerouslySetInnerHTML={{ __html: processed.replace(/\n/g, '<br/>') }}
        />
      );
    });
  };

  return (
    <div style={{ position: 'relative', zIndex: 5, display: 'flex', flexDirection: 'column', height: '100%', direction: 'rtl' }}>

      {/* ====== HEADER ====== */}
      <div className="chat-header-glass" style={{ direction: 'rtl' }}>
        <div className="chat-header-info">
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4))'
          }}>
            <Bot size={20} />
          </div>
          <div className="chat-header-text">
            <span className="chat-header-title">اسد AI</span>
            <span className="chat-header-status">
              {isStreaming ? 'در حال تایپ...' : 'دستیار هوشمند'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {messages.length > 0 && (
            <button onClick={clearChat} className="chat-back-btn" style={{ width: 34, height: 34 }}>
              <Trash2 size={16} />
            </button>
          )}
          <button className="chat-back-btn" onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
        </div>
      </div>

      {/* ====== MESSAGES ====== */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '16px',
        paddingBottom: '100px',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>

        {/* Welcome message */}
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 20px', gap: 16, textAlign: 'center',
          }}>
            <div style={{
              width: 70, height: 70, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}>
              <Bot size={32} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>سلام{userName ? ` ${userName}` : ''}!</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.8, maxWidth: 280 }}>
              من دستیار هوشمند اسد هستم. هر سوالی داری بپرس — از تحلیل بازار و ترید گرفته تا هر موضوع دیگه‌ای.
            </div>

            {/* Quick suggestions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              {[
                'تحلیل بیتکوین',
                'بهترین استراتژی ترید',
                'آموزش DeFi',
                'تفاوت اسپات و فیوچرز',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); setTimeout(() => inputRef.current?.focus(), 100); }}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 20,
                    padding: '8px 16px',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-start' : 'flex-end',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            {/* AI avatar */}
            {msg.role === 'assistant' && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={14} style={{ color: '#a78bfa' }} />
              </div>
            )}

            {/* Message bubble */}
            <div style={{
              maxWidth: '82%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2))'
                : 'rgba(255,255,255,0.07)',
              border: msg.role === 'user'
                ? '1px solid rgba(139, 92, 246, 0.25)'
                : '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}>
              <div style={{
                color: msg.role === 'user' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)',
                fontSize: 14,
                lineHeight: 1.7,
                direction: 'auto',
                wordBreak: 'break-word',
              }}>
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                {msg.role === 'assistant' && isStreaming && idx === messages.length - 1 && (
                  <span style={{
                    display: 'inline-block',
                    width: 6, height: 16,
                    background: '#a78bfa',
                    marginRight: 2,
                    borderRadius: 1,
                    animation: 'cursorBlink 0.8s infinite',
                    verticalAlign: 'text-bottom',
                  }} />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} style={{ color: '#a78bfa' }} />
            </div>
            <div style={{
              padding: '12px 18px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              <div className="ai-typing-dot" style={{ animationDelay: '0ms' }} />
              <div className="ai-typing-dot" style={{ animationDelay: '200ms' }} />
              <div className="ai-typing-dot" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ====== INPUT ====== */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: '4px 4px 4px 12px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="پیامت رو بنویس..."
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'none',
              direction: 'auto',
              padding: '8px 0',
              maxHeight: 120,
              lineHeight: 1.5,
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
          />

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: 'none',
                color: '#ef4444',
                width: 38, height: 38,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
              }}
            >
              <StopCircle size={20} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              style={{
                background: input.trim() ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.06)',
                border: 'none',
                color: input.trim() ? 'white' : 'rgba(255,255,255,0.2)',
                width: 38, height: 38,
                borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? <Loader2 size={18} className="live-spin" /> : <Send size={18} style={{ transform: 'rotate(180deg)' }} />}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cursorBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        .ai-typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(167, 139, 250, 0.6);
          animation: aiTypingBounce 1.2s infinite;
        }
        @keyframes aiTypingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default AIChatBot;