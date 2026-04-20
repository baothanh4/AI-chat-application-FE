import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Image as ImageIcon, Smile, MessageCircle, X, Loader2, Sparkles } from 'lucide-react';
import api from '../services/api';
import clsx from 'clsx';
import { getConversationName } from './Sidebar';
import AiPanel from './AiPanel';

// Format "last seen" time
const formatLastSeen = (lastSeenAt) => {
  if (!lastSeenAt) return '';
  const now = new Date();
  const seen = new Date(lastSeenAt);
  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const ChatWindow = ({ activeConversation, stompClient, connected, presenceMap = {} }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const fileInputRef = useRef(null);

  // AI Panel state
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Image preview state
  const [selectedImage, setSelectedImage] = useState(null); // File object
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null); // blob URL for preview
  const [uploadingImage, setUploadingImage] = useState(false);

  // Lightbox state for viewing full-size images
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // Load message history when active conversation changes
  useEffect(() => {
    if (!activeConversation) return;

    const loadHistory = async () => {
      setMessages([]); // Clear stale messages from the previous conversation!
      setLoading(true);
      try {
        // Mark conversation as read first (resets unread count on backend)
        await api.post(`/conversations/${activeConversation.id}/read`, { userId: currentUser.id }).catch(() => {});

        const res = await api.get(`/conversations/${activeConversation.id}/messages`);
        // Extract from unpaginated (messages) or paginated (content) response
        if (res.data && res.data.messages) {
            setMessages(res.data.messages);
        } else if (res.data && res.data.content) {
            const msgs = [...res.data.content].reverse();
            setMessages(msgs);
        }
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [activeConversation]);

  // activeChatIdRef is needed because the WebSocket subscription callback is a closure.
  // It will "remember" the old activeConversation.id and bypass our guard if we switch chats quickly!
  const activeChatIdRef = useRef(activeConversation?.id);
  useEffect(() => {
    activeChatIdRef.current = activeConversation?.id;
  }, [activeConversation]);

  // Handle Websocket Subscription
  useEffect(() => {
    if (!connected || !stompClient || !activeConversation) return;

    const destination = `/topic/conversations/${activeConversation.id}`;
    
    // Subscribe to this room
    const subscription = stompClient.subscribe(destination, (message) => {
        if (message.body) {
            const newMsg = JSON.parse(message.body);
            setMessages(prev => {
                // STOMP subscriptions occasionally overlap before cleanup finishes. 
                // Guard: Only render messages matching the EXACT CURRENT UI active conversation!
                // We MUST use activeChatIdRef.current to avoid Javascript stale closures.
                if (newMsg.conversationId && newMsg.conversationId !== activeChatIdRef.current) {
                    return prev;
                }

                // Prevent duplicate client messages
                if (prev.find(m => m.id === newMsg.id || (newMsg.clientMessageId && m.clientMessageId === newMsg.clientMessageId))) {
                    return prev;
                }
                return [...prev, newMsg];
            });
        }
    });

    return () => {
        if (subscription) {
            subscription.unsubscribe();
        }
    };
  }, [connected, stompClient, activeConversation]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup image preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !connected || !stompClient || !activeConversation) return;

    const clientMessageId = `msg-${Date.now()}`;
    const payload = {
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      content: inputText,
      messageType: 'TEXT',
      clientMessageId: clientMessageId
    };

    // Stomp send
    stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify(payload)
    });

    // Optimistically update UI
    setMessages(prev => [...prev, {
       id: clientMessageId, // temporary id
       content: inputText,
       sender: currentUser,
       clientMessageId: clientMessageId,
       type: 'TEXT',
       messageType: 'TEXT'
    }]);

    setInputText('');
  };

  // Handle image file selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Chỉ cho phép file ảnh!');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Ảnh không được vượt quá 10MB!');
      return;
    }

    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    
    // Reset the file input so the same file can be re-selected
    e.target.value = '';
  };

  // Handle paste image from clipboard
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('Ảnh không được vượt quá 10MB!');
          return;
        }

        setSelectedImage(file);
        setImagePreviewUrl(URL.createObjectURL(file));
        return;
      }
    }
  };

  // Cancel image selection
  const handleCancelImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setSelectedImage(null);
    setImagePreviewUrl(null);
  };

  // Upload and send image
  const handleSendImage = async () => {
    if (!selectedImage || !connected || !stompClient || !activeConversation) return;
    
    setUploadingImage(true);
    try {
      // Step 1: Upload the image file
      const formData = new FormData();
      formData.append('file', selectedImage);

      const uploadRes = await api.post('/uploads/chat-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const imageUrl = uploadRes.data.url;

      // Step 2: Send the message with IMAGE type via STOMP
      const clientMessageId = `img-${Date.now()}`;
      const payload = {
        conversationId: activeConversation.id,
        senderId: currentUser.id,
        content: imageUrl,
        messageType: 'IMAGE',
        clientMessageId: clientMessageId
      };

      stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify(payload)
      });

      // Optimistically update UI
      setMessages(prev => [...prev, {
        id: clientMessageId,
        content: imageUrl,
        sender: currentUser,
        clientMessageId: clientMessageId,
        type: 'IMAGE',
        messageType: 'IMAGE'
      }]);

      // Clear preview
      handleCancelImage();

    } catch (err) {
      console.error('Failed to upload image:', err);
      alert('Gửi ảnh thất bại. Vui lòng thử lại!');
    } finally {
      setUploadingImage(false);
    }
  };

  // Render message content based on type
  const renderMessageContent = (msg) => {
    const msgType = msg.messageType || msg.type;
    
    if (msgType === 'IMAGE') {
      return (
        <img 
          src={msg.content} 
          alt="Sent image"
          className="chat-image"
          onClick={() => setLightboxUrl(msg.content)}
          loading="lazy"
        />
      );
    }

    return msg.content;
  };

  if (!activeConversation) {
    return (
      <div className="chat-window-wrapper">
        <div className="chat-window" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-panel-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
               <MessageCircle size={32} opacity={0.5} />
            </div>
            <h2 style={{ marginBottom: '8px' }}>Direct Messages</h2>
            <p>Select someone to chat with directly.</p>
          </div>
        </div>
      </div>
    );
  }

  const roomName = getConversationName(activeConversation, currentUser);
  const otherMember = activeConversation?.type === 'PRIVATE' 
     ? activeConversation.members?.find(m => m.id !== currentUser.id)
     : null;
  const otherPresence = otherMember ? (presenceMap[otherMember.id] || { online: false, lastSeenAt: null }) : null;

  return (
    <div className="chat-window-wrapper">
    <div className="chat-window">
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.4)' }}>
        {otherMember ? (
            <div className="avatar-wrapper">
              <div className="avatar" style={{ width: '40px', height: '40px', padding: 0, overflow: 'hidden' }}>
                 {otherMember.avatarPath ? (
                     <img src={otherMember.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                     otherMember.displayName ? otherMember.displayName.charAt(0).toUpperCase() : 'U'
                 )}
              </div>
              {otherPresence?.online && <span className="status-dot online" />}
            </div>
        ) : (
            <div className="avatar" style={{ width: '40px', height: '40px', background: 'var(--bg-panel-hover)' }}>
               {roomName.charAt(0).toUpperCase()}
            </div>
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>{roomName}</h2>
          {otherPresence && (
            <div style={{ fontSize: '12px', marginTop: '2px', color: otherPresence.online ? 'var(--success)' : 'var(--text-muted)' }}>
              {otherPresence.online ? 'Đang hoạt động' : otherPresence.lastSeenAt ? formatLastSeen(otherPresence.lastSeenAt) : 'Offline'}
            </div>
          )}
        </div>
        {/* AI Panel Toggle Button */}
        <button
          onClick={() => setShowAiPanel(v => !v)}
          className={`ai-toggle-btn ${showAiPanel ? 'active' : ''}`}
          title="AI Insights"
        >
          <Sparkles size={16} />
          <span>AI</span>
        </button>
      </div>

      {/* Messages Window */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px' }}>Loading...</div>
        ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto' }}>
                No messages here yet... Say hi!
            </div>
        ) : (
            messages.map((msg, idx) => {
               const isMe = msg.sender?.id === currentUser.id || msg.senderId === currentUser.id;
               const isGroup = activeConversation?.type === 'GROUP';
               const showSenderName = !isMe && isGroup && msg.sender;
               const msgType = msg.messageType || msg.type;
               const isImage = msgType === 'IMAGE';

               return (
                   <div key={msg.id || idx} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '12px', gap: '8px' }}>
                      {!isMe && (
                          <div className="avatar" style={{ width: '28px', height: '28px', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                             {msg.sender?.avatarPath ? (
                                <img src={msg.sender.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             ) : (
                                <span style={{ fontSize: '12px' }}>{msg.sender?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                             )}
                          </div>
                      )}
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                          {showSenderName && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px' }}>
                                  {msg.sender.displayName || msg.sender.username}
                              </div>
                          )}
                          <div className={clsx('message-bubble', isMe ? 'sent' : 'received', isImage && 'image-message')} style={{ marginBottom: 0 }}>
                             {renderMessageContent(msg)}
                          </div>
                      </div>
                   </div>
               )
            })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Image Preview Overlay */}
      {imagePreviewUrl && (
        <div className="image-preview-overlay">
          <div className="image-preview-container">
            <button 
              type="button" 
              className="image-preview-close" 
              onClick={handleCancelImage}
              disabled={uploadingImage}
            >
              <X size={20} />
            </button>
            <img src={imagePreviewUrl} alt="Preview" className="image-preview-img" />
            <div className="image-preview-actions">
              <span className="image-preview-filename">{selectedImage?.name}</span>
              <button 
                type="button" 
                className="image-preview-send"
                onClick={handleSendImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 size={20} className="spin" />
                ) : (
                  <Send size={18} style={{ marginLeft: '2px' }} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox for full-size image */}
      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>
            <X size={24} />
          </button>
          <img src={lightboxUrl} alt="Full size" className="lightbox-img" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Hidden file input */}
      <input 
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      {/* Input Area */}
      <div style={{ padding: '20px', background: 'rgba(15, 23, 42, 0.6)', borderTop: '1px solid var(--border-color)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button type="button" className="icon" style={{ position: 'absolute', left: '8px' }}>
              <Smile size={20} />
            </button>
            <input 
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Type a message..." 
              style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px', borderRadius: '24px', background: 'var(--bg-dark)' }} 
            />
            <button 
              type="button" 
              className="icon" 
              style={{ position: 'absolute', right: '8px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Gửi ảnh"
            >
              <ImageIcon size={20} />
            </button>
          </div>
          <button type="submit" style={{ 
            background: 'var(--accent-primary)', 
            color: 'white', 
            width: '44px', 
            height: '44px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            opacity: inputText.trim() ? 1 : 0.5,
            cursor: inputText.trim() ? 'pointer' : 'default'
          }}>
            <Send size={18} style={{ marginLeft: '2px' }} />
          </button>
        </form>
      </div>
    </div>
    {/* AI Panel */}
    {showAiPanel && activeConversation && (
      <AiPanel
        conversationId={activeConversation.id}
        onClose={() => setShowAiPanel(false)}
      />
    )}
    </div>
  );
};

export default ChatWindow;
