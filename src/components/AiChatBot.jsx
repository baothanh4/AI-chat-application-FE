import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, X, Send, Sparkles, ChevronDown, Loader2,
  Trash2, Copy, Check, AlertTriangle, Settings2,
  MessageSquare, RotateCcw, Minimize2, Maximize2,
  Clock, Code, Brain
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Markdown-lite renderer ───────────────────────────────────────
const renderMarkdown = (text) => {
  if (!text) return '';
  // Bold **text**
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');
  // Code blocks ```lang\n...\n```
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="ai-code-block"><code>$1</code></pre>');
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  return html;
};

// ─── Message bubble ───────────────────────────────────────────────
const MessageBubble = ({ msg }) => {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';
  const isError = msg.isError;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={`aicb-message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && (
        <div className="aicb-avatar">
          {isError ? <AlertTriangle size={14} /> : <Bot size={14} />}
        </div>
      )}
      <div className={`aicb-bubble ${isUser ? 'user' : isError ? 'error' : 'assistant'}`}>
        {isUser ? (
          <span>{msg.content}</span>
        ) : (
          <div
            className="aicb-md"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />
        )}
        {/* Streaming cursor */}
        {msg.streaming && <span className="aicb-cursor" />}
        {/* Copy button for assistant messages */}
        {!isUser && !msg.streaming && msg.content && (
          <button className="aicb-copy-btn" onClick={handleCopy} title="Sao chép">
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        )}
      </div>
      {isUser && (
        <div className="aicb-avatar user-avatar">
          <MessageSquare size={13} />
        </div>
      )}
    </div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="aicb-message-row assistant">
    <div className="aicb-avatar"><Bot size={14} /></div>
    <div className="aicb-bubble assistant aicb-typing">
      <span /><span /><span />
    </div>
  </div>
);

// ─── Welcome screen ───────────────────────────────────────────────
const WelcomeScreen = ({ onSuggestion, conversationContext }) => {
  const suggestions = conversationContext
    ? [
        { text: 'Tóm tắt nội dung', icon: <Bot size={14} /> },
        { text: 'Việc cần làm', icon: <Check size={14} /> },
        { text: 'Phân tích tâm trạng', icon: <Sparkles size={14} /> },
        { text: 'Thời gian & Deadline', icon: <Clock size={14} /> },
      ]
    : [
        { text: 'Bạn làm được gì?', icon: <Sparkles size={14} /> },
        { text: 'Viết code React', icon: <Code size={14} /> },
        { text: 'Giải thích thuật toán', icon: <Brain size={14} /> },
        { text: 'Sửa lỗi code', icon: <AlertTriangle size={14} /> },
      ];

  return (
    <div className="aicb-welcome">
      <div className="aicb-welcome-icon-wrap">
        <div className="aicb-welcome-icon">
          <Sparkles size={32} />
        </div>
        <div className="aicb-welcome-glow" />
      </div>
      <h3>AI Assistant</h3>
      <p>Trợ lý thông minh sẵn sàng hỗ trợ bạn 24/7</p>
      
      {conversationContext && (
        <div className="aicb-context-pill">
          <div className="aicb-pulse-dot" />
          <span>Đã kết nối với hội thoại hiện tại</span>
        </div>
      )}

      <div className="aicb-suggestions-grid">
        {suggestions.map((s, i) => (
          <button key={i} className="aicb-suggestion-card" onClick={() => onSuggestion(s.text)}>
            <div className="aicb-sugg-icon">{s.icon}</div>
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main AiChatBot Component ─────────────────────────────────────
const AiChatBot = ({ 
  activeConversation, 
  messages: chatMessages, 
  botConversation,
  stompClient,
  connected
}) => {
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Sync with persistent conversation if available
  useEffect(() => {
    if (!botConversation || !open) return;

    const fetchBotHistory = async () => {
      try {
        const res = await api.get(`/messages/conversations/${botConversation.id}/history?page=0&size=50`);
        const formatted = res.data.messages.map(m => ({
          id: m.id,
          role: m.sender.username === 'ai-assistant' ? 'assistant' : 'user',
          content: m.content,
          createdAt: m.createdAt
        }));
        setMessages(formatted);
      } catch (err) {
        console.error("Failed to fetch bot history", err);
      }
    };

    fetchBotHistory();
  }, [botConversation, open]);

  // WebSocket listener for bot conversation
  useEffect(() => {
    if (!stompClient || !connected || !botConversation || !open) return;

    const sub = stompClient.subscribe(`/topic/conversations/${botConversation.id}`, (msg) => {
      const parsed = JSON.parse(msg.body);
      const isBot = parsed.sender.username === 'ai-assistant';
      
      setMessages(prev => {
        // Prevent duplicates (especially for user messages which are added locally or via WS)
        if (prev.some(m => m.id === parsed.id)) return prev;
        
        return [...prev, {
          id: parsed.id,
          role: isBot ? 'assistant' : 'user',
          content: parsed.content,
          createdAt: parsed.createdAt
        }];
      });
      
      if (isBot) setIsThinking(false);
    });

    return () => sub.unsubscribe();
  }, [stompClient, connected, botConversation, open]);

  // Build system prompt with optional conversation context
  const buildSystemMessages = useCallback(() => {
    const base = {
      role: 'system',
      content: `Bạn là một trợ lý AI thông minh, thân thiện và hữu ích tích hợp trong ứng dụng ChatApp. 
Bạn hỗ trợ cả tiếng Việt và tiếng Anh. Trả lời ngắn gọn, súc tích và chính xác.
Khi viết code, luôn dùng markdown code blocks. Luôn ưu tiên trả lời bằng ngôn ngữ người dùng đang dùng.`,
    };

    if (!useContext || !chatMessages || chatMessages.length === 0) {
      return [base];
    }

    // Include last 20 messages as context
    const contextMsgs = chatMessages.slice(-20);
    const contextText = contextMsgs
      .map(m => {
        const sender = m.sender?.displayName || (m.senderId ? 'User' : 'Unknown');
        const type = m.messageType || m.type || 'TEXT';
        if (type === 'IMAGE') return `${sender}: [Đã gửi ảnh]`;
        return `${sender}: ${m.content || ''}`;
      })
      .join('\n');

    const convName = activeConversation?.name || 'cuộc trò chuyện này';
    return [
      base,
      {
        role: 'system',
        content: `Ngữ cảnh từ ${convName} (${contextMsgs.length} tin nhắn gần nhất):\n\n${contextText}\n\nHãy sử dụng ngữ cảnh này để trả lời chính xác hơn khi người dùng hỏi về cuộc trò chuyện.`,
      },
    ];
  }, [useContext, chatMessages, activeConversation]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Auto-resize textarea height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = scrollHeight > 120 ? '120px' : `${scrollHeight}px`;
    }
  }, [input]);

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleSend = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || isStreaming) return;

    setInput('');

    // If we have a persistent conversation, send through standard chat API
    if (botConversation) {
      setIsThinking(true);
      try {
        // We add local message immediately for better UX
        const tempId = Date.now();
        setMessages(prev => [...prev, { id: tempId, role: 'user', content: userText }]);

        await api.post('/messages', {
          conversationId: botConversation.id,
          senderId: currentUser.id,
          content: userText,
          messageType: 'TEXT',
          clientMessageId: `ai-sync-${tempId}`
        });
        // The bot's reply will come back via WebSocket
      } catch (err) {
        setIsThinking(false);
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: `❌ Lỗi: ${err.message}`, isError: true }]);
      }
      return;
    }

    // Fallback: direct AI chat (no persistence)
    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);

    // Start assistant placeholder
    const assistantId = Date.now() + 1;
    setIsThinking(true);

    // Build conversation history for context
    const history = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const systemMsgs = buildSystemMessages().map(m => m.content).join('\n');
    const fullPrompt = `${systemMsgs}\n\nLịch sử chat:\n${history}\n\nCâu hỏi mới: ${userText}`;

    try {
      const response = await api.post('/ai/chat', {
        prompt: fullPrompt,
        temperature: 0.7,
        maxTokens: 1024
      });

      setIsThinking(false);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: response.data,
      }]);
    } catch (err) {
      setIsThinking(false);
      const errMsg = err.response?.data || err.message;
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: `❌ Lỗi: ${errMsg}`,
        isError: true,
      }]);
    }
  }, [input, isStreaming, messages, buildSystemMessages, botConversation, currentUser.id]);

  const handleStop = () => {
    abortRef.current?.abort?.();
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  };

  const handleClear = () => {
    setMessages([]);
    setIsStreaming(false);
    abortRef.current?.abort?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Unread badge when closed
  const hasNewMessage = !open && messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant';

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          className="aicb-trigger"
          onClick={() => setOpen(true)}
          title="Mở AI Assistant"
        >
          <div className="aicb-trigger-inner">
            <Bot size={22} />
            {hasNewMessage && <span className="aicb-trigger-badge" />}
          </div>
          <div className="aicb-trigger-glow" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className={`aicb-window ${minimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="aicb-header">
            <div className="aicb-header-left">
              <div className="aicb-header-icon">
                <Sparkles size={14} />
              </div>
              <div>
                <div className="aicb-header-title">AI Assistant</div>
                <div className="aicb-header-sub">
                  Powered by Backend AI
                </div>
              </div>
            </div>
            <div className="aicb-header-actions">
              {messages.length > 0 && (
                <button className="aicb-hdr-btn" onClick={handleClear} title="Xoá lịch sử">
                  <Trash2 size={13} />
                </button>
              )}
              <button
                className="aicb-hdr-btn"
                onClick={() => setMinimized(v => !v)}
                title={minimized ? 'Mở rộng' : 'Thu nhỏ'}
              >
                {minimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button className="aicb-hdr-btn close" onClick={() => setOpen(false)} title="Đóng">
                <X size={14} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Toolbar */}
              <div className="aicb-toolbar">
                {/* Context toggle */}
                {chatMessages?.length > 0 && (
                  <button
                    className={`aicb-ctx-btn ${useContext ? 'active' : ''}`}
                    onClick={() => setUseContext(v => !v)}
                    title={useContext ? 'Đang dùng ngữ cảnh cuộc trò chuyện' : 'Không dùng ngữ cảnh'}
                  >
                    <MessageSquare size={11} />
                    <span>Context</span>
                  </button>
                )}

                {/* Reset */}
                {messages.length > 0 && (
                  <button className="aicb-ctx-btn" onClick={handleClear} title="Bắt đầu lại">
                    <RotateCcw size={11} />
                  </button>
                )}
              </div>

              {/* Messages area */}
              <div className="aicb-messages">
                {messages.length === 0 && (
                  <WelcomeScreen
                    onSuggestion={handleSend}
                    conversationContext={useContext && chatMessages?.length > 0}
                  />
                )}
                {messages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
                {isThinking && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="aicb-input-area">
                <div className="aicb-input-wrap">
                  <textarea
                    ref={inputRef}
                    className="aicb-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nhắn tin với AI... (Enter để gửi, Shift+Enter xuống dòng)"
                    rows={1}
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <button className="aicb-send-btn stop" onClick={handleStop} title="Dừng">
                      <div className="aicb-stop-icon" />
                    </button>
                  ) : (
                    <button
                      className="aicb-send-btn"
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      title="Gửi"
                    >
                      <Send size={15} />
                    </button>
                  )}
                </div>
                <div className="aicb-footer-note">
                  Sử dụng mô hình <span>Ring 2.6 1T</span> qua OpenRouter Backend
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default AiChatBot;
