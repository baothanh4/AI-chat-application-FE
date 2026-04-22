import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, X, Send, Sparkles, ChevronDown, Loader2,
  Trash2, Copy, Check, AlertTriangle, Settings2,
  MessageSquare, RotateCcw, Minimize2, Maximize2,
} from 'lucide-react';
import { sendMessageStream, AVAILABLE_MODELS } from '../services/openrouter';

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
        'Tóm tắt cuộc trò chuyện này cho tôi',
        'Liệt kê các công việc cần làm trong đoạn chat',
        'Phân tích tâm trạng của cả hai người trong cuộc trò chuyện',
        'Có deadline nào được đề cập không?',
      ]
    : [
        'Bạn có thể làm gì cho tôi?',
        'Viết code React fetch API đơn giản',
        'Giải thích async/await bằng tiếng Việt',
        'Đề xuất best practices cho REST API',
      ];

  return (
    <div className="aicb-welcome">
      <div className="aicb-welcome-icon">
        <Sparkles size={28} />
      </div>
      <h3>AI Assistant</h3>
      <p>Tôi có thể giúp bạn viết code, phân tích, và trả lời mọi câu hỏi.</p>
      {conversationContext && (
        <div className="aicb-context-badge">
          <MessageSquare size={12} />
          <span>Đã nạp ngữ cảnh từ cuộc trò chuyện hiện tại</span>
        </div>
      )}
      <div className="aicb-suggestions">
        {suggestions.map((s, i) => (
          <button key={i} className="aicb-suggestion-btn" onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main AiChatBot Component ─────────────────────────────────────
const AiChatBot = ({ activeConversation, messages: chatMessages }) => {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [useContext, setUseContext] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const modelPickerRef = useRef(null);

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

  // Focus input when opened
  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  // Close model picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = useCallback(async (text) => {
    const userText = (text || input).trim();
    if (!userText || isStreaming) return;

    setInput('');
    setShowModelPicker(false);

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: userText };
    setMessages(prev => [...prev, userMsg]);

    // Start assistant placeholder
    const assistantId = Date.now() + 1;
    setIsThinking(true);

    // Build conversation history for API
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const systemMsgs = buildSystemMessages();
    const apiMessages = [...systemMsgs, ...history, { role: 'user', content: userText }];

    let fullContent = '';

    try {
      setIsThinking(false);
      setIsStreaming(true);

      // Add empty assistant message for streaming
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
      }]);

      abortRef.current = await sendMessageStream(
        apiMessages,
        // onChunk
        (chunk) => {
          fullContent += chunk;
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: fullContent }
              : m
          ));
        },
        // onDone
        () => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false }
              : m
          ));
          setIsStreaming(false);
        },
        // onError
        (err) => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: `❌ Lỗi: ${err.message}`, streaming: false, isError: true }
              : m
          ));
          setIsStreaming(false);
        },
        selectedModel
      );
    } catch (err) {
      setIsThinking(false);
      setIsStreaming(false);
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: `❌ Lỗi kết nối: ${err.message}`,
        isError: true,
      }]);
    }
  }, [input, isStreaming, messages, buildSystemMessages, selectedModel]);

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

  const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

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
                  {selectedModelInfo?.name || 'AI Model'}
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
                {/* Model picker */}
                <div className="aicb-model-picker-wrap" ref={modelPickerRef}>
                  <button
                    className="aicb-model-btn"
                    onClick={() => setShowModelPicker(v => !v)}
                  >
                    <Settings2 size={11} />
                    <span>{selectedModelInfo?.name || 'Model'}</span>
                    <ChevronDown size={10} className={showModelPicker ? 'rotated' : ''} />
                  </button>
                  {showModelPicker && (
                    <div className="aicb-model-dropdown">
                      {AVAILABLE_MODELS.map(m => (
                        <button
                          key={m.id}
                          className={`aicb-model-option ${selectedModel === m.id ? 'active' : ''}`}
                          onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                        >
                          <div>
                            <div className="aicb-model-name">
                              {m.name}
                              {m.recommended && (
                                <span style={{ marginLeft: 5, fontSize: 9, background: 'rgba(16,185,129,0.2)', color: '#34d399', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                                  ĐỀ XUẤT
                                </span>
                              )}
                            </div>
                            <div className="aicb-model-provider">
                              {m.provider}
                              {m.note && (
                                <span style={{ marginLeft: 4, color: '#f59e0b' }}>⚠ {m.note}</span>
                              )}
                            </div>
                          </div>
                          {selectedModel === m.id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
                  Powered by <span>OpenRouter</span> · {selectedModelInfo?.provider}
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
