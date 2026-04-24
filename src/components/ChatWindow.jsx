import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Send, Image as ImageIcon, Smile, MessageCircle, X, Loader2, Sparkles, Film, Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import api from '../services/api';
import clsx from 'clsx';
import { getConversationName } from './Sidebar';
import AiPanel from './AiPanel';
import { useCall } from '../context/CallContext';

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

// Date dividers and timestamps
const isDifferentDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getDate() !== date2.getDate() ||
         date1.getMonth() !== date2.getMonth() ||
         date1.getFullYear() !== date2.getFullYear();
};

const formatDateDivider = (d) => {
  const date = new Date(d);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const day = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${day} ${dd}/${mm}/${yyyy}`;
};

const formatTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const ChatWindow = ({ activeConversation, stompClient, connected, presenceMap = {}, onNewAiInsight, onMessagesChange }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const fileInputRef = useRef(null);
  const { startCall } = useCall();

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

  // Expose messages to parent for AI context
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

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
    if (!inputText.trim() || !stompClient || !activeConversation) return;
    if (!connected) {
      alert("Mất kết nối tới server! Vui lòng kiểm tra lại Backend.");
      return;
    }

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

  // Handle media file selection (image or video)
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      alert('Chỉ cho phép file ảnh hoặc video!');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File không được vượt quá 10MB!');
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

  // Upload and send image or video
  const handleSendImage = async () => {
    if (!selectedImage || !stompClient || !activeConversation) return;
    if (!connected) {
      alert("Mất kết nối tới server! Vui lòng kiểm tra lại Backend.");
      return;
    }
    
    setUploadingImage(true);
    try {
      const isVideo = selectedImage.type.startsWith('video/');
      const uploadEndpoint = isVideo ? '/uploads/chat-video' : '/uploads/chat-image';
      const msgType = isVideo ? 'VIDEO' : 'IMAGE';

      // Step 1: Upload the media file
      const formData = new FormData();
      formData.append('file', selectedImage);

      const uploadRes = await api.post(uploadEndpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const mediaUrl = uploadRes.data.url;

      // Step 2: Send the message via STOMP
      const clientMessageId = `media-${Date.now()}`;
      const payload = {
        conversationId: activeConversation.id,
        senderId: currentUser.id,
        content: mediaUrl,
        messageType: msgType,
        clientMessageId: clientMessageId
      };

      stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify(payload)
      });

      // Optimistically update UI
      setMessages(prev => [...prev, {
        id: clientMessageId,
        content: mediaUrl,
        sender: currentUser,
        clientMessageId: clientMessageId,
        type: msgType,
        messageType: msgType
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
    if (msgType === 'VIDEO') {
      return (
        <video 
          src={msg.content} 
          controls 
          className="chat-video" 
          style={{ maxWidth: '300px', maxHeight: '400px', borderRadius: '8px' }}
        />
      );
    }
    
    if (msgType === 'SYSTEM') {
      if (msg.content?.startsWith('CALL_LOG|')) {
        const parts = msg.content.split('|');
        const callId = parts[1];
        const mode = parts[2];
        const status = parts[3];
        const duration = parseInt(parts[4] || '0', 10);
        const callerId = parts[5];
        const calleeId = parts[6];

        const amICaller = currentUser.id === callerId;
        const isMissed = status === 'MISSED' || status === 'REJECTED';
        const isMyMissed = isMissed && !amICaller;

        let title = '';
        if (isMyMissed) {
          title = 'Bạn bị nhỡ';
        } else {
          const typeStr = mode === 'VIDEO' ? 'video ' : '';
          title = amICaller ? `Cuộc gọi ${typeStr}đi` : `Cuộc gọi ${typeStr}đến`;
        }

        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = `${mins} phút ${secs} giây`;
        
        // Use standard coloring for missed calls and other calls
        const iconColor = isMyMissed ? '#ef4444' : (amICaller ? 'var(--text-muted)' : '#10b981'); 

        return (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '160px', padding: '4px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: isMyMissed ? '#ef4444' : 'inherit' }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: isMyMissed ? '#ef4444' : 'var(--text-muted)' }}>
              <div style={{ position: 'relative' }}>
                {mode === 'VIDEO' ? <Video size={20} color={iconColor} /> : <Phone size={20} color={iconColor} />}
                {/* Overlay arrow/status icon based on call type */}
                {isMyMissed ? (
                  <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bg-dark)', borderRadius: '50%', padding: '2px' }}>
                    <PhoneMissed size={10} color="#ef4444" />
                  </div>
                ) : amICaller ? (
                  <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bg-dark)', borderRadius: '50%', padding: '2px' }}>
                    <PhoneOutgoing size={10} color="var(--text-muted)" />
                  </div>
                ) : (
                  <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--bg-dark)', borderRadius: '50%', padding: '2px' }}>
                    <PhoneIncoming size={10} color="#10b981" />
                  </div>
                )}
              </div>
              <span style={{ fontSize: '14px' }}>
                {isMissed ? (mode === 'VIDEO' ? 'Cuộc gọi video' : 'Cuộc gọi thoại') : durationStr}
              </span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', textAlign: 'center' }}>
              <button 
                onClick={(e) => {
                   e.stopPropagation();
                   startCall(amICaller ? calleeId : callerId, activeConversation.id, mode);
                }}
                style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: '600', cursor: 'pointer', padding: '4px 12px', width: '100%' }}
              >
                Gọi lại
              </button>
            </div>
          </div>
        );
      } else {
        return <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '8px' }}>{msg.content}</div>;
      }
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
        {/* Call Buttons (Only for private chats) */}
        {otherMember && (
          <div style={{ display: 'flex', gap: '8px', marginRight: '12px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
            <button
              onClick={() => startCall(otherMember.id, activeConversation.id, 'AUDIO')}
              className="icon"
              title="Audio Call"
            >
              <Phone size={20} />
            </button>
            <button
              onClick={() => startCall(otherMember.id, activeConversation.id, 'VIDEO')}
              className="icon"
              title="Video Call"
            >
              <Video size={20} />
            </button>
          </div>
        )}
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
               const prevMsg = idx > 0 ? messages[idx - 1] : null;
               const showDateDivider = idx === 0 || isDifferentDay(msg.createdAt, prevMsg?.createdAt);

               const isMe = msg.sender?.id === currentUser.id || msg.senderId === currentUser.id;
               const isGroup = activeConversation?.type === 'GROUP';
               const showSenderName = !isMe && isGroup && msg.sender;
               const msgType = msg.messageType || msg.type;
               const isImage = msgType === 'IMAGE';
               const isSystem = msgType === 'SYSTEM';

               // If it's a non-call-log system message, render it full width centered
               if (isSystem && !msg.content?.startsWith('CALL_LOG|')) {
                 return (
                   <React.Fragment key={msg.id || idx}>
                     {showDateDivider && (
                       <div style={{ textAlign: 'center', margin: '24px 0' }}>
                         <span style={{ background: 'var(--bg-panel-hover)', padding: '6px 14px', borderRadius: '16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                           {formatDateDivider(msg.createdAt)}
                         </span>
                       </div>
                     )}
                     <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        {renderMessageContent(msg)}
                     </div>
                   </React.Fragment>
                 );
               }

               return (
                   <React.Fragment key={msg.id || idx}>
                     {showDateDivider && (
                       <div style={{ textAlign: 'center', margin: '24px 0' }}>
                         <span style={{ background: 'var(--bg-panel-hover)', padding: '6px 14px', borderRadius: '16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                           {formatDateDivider(msg.createdAt)}
                         </span>
                       </div>
                     )}
                     <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '16px', gap: '8px' }}>
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
                            <div className={clsx('message-bubble', isMe ? 'sent' : 'received', (isImage || msgType === 'VIDEO') && 'image-message')} style={{ marginBottom: 0 }}>
                               {renderMessageContent(msg)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px' }}>
                               {formatTime(msg.createdAt)}
                            </div>
                        </div>
                     </div>
                   </React.Fragment>
               )
            })
        )}
        <div ref={messagesEndRef} />
      </div>


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
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleImageSelect}
      />

      {/* Input Area */}
      <div style={{ padding: '12px 20px 20px', background: 'rgba(15, 23, 42, 0.6)', borderTop: '1px solid var(--border-color)' }}>
        {/* Inline Image Preview Strip */}
        {imagePreviewUrl && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '10px 12px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {selectedImage?.type?.startsWith('video/') ? (
                <video
                  src={imagePreviewUrl}
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                />
              ) : (
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', display: 'block' }}
                />
              )}
              {uploadingImage && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={18} color="white" className="spin" />
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '13px', color: 'white', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedImage?.name || 'Ảnh từ clipboard'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {selectedImage ? `${(selectedImage.size / 1024).toFixed(0)} KB` : 'File'} · Sẵn sàng gửi
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleCancelImage}
                disabled={uploadingImage}
                title="Huỷ"
                style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: 'none', color: 'var(--text-muted)', cursor: uploadingImage ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={handleSendImage}
                disabled={uploadingImage}
                title="Gửi"
                style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: uploadingImage ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: uploadingImage ? 0.6 : 1 }}
              >
                {uploadingImage ? <Loader2 size={14} className="spin" /> : <Send size={14} style={{ marginLeft: '1px' }} />}
              </button>
            </div>
          </div>
        )}

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
              style={{ position: 'absolute', right: '36px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Gửi video"
            >
              <Film size={20} />
            </button>
            <button 
              type="button" 
              className="icon" 
              style={{ position: 'absolute', right: '8px' }}
              onClick={() => fileInputRef.current?.click()}
              title="Gửi ảnh/video"
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
        stompClient={stompClient}
        connected={connected}
        onClose={() => setShowAiPanel(false)}
      />
    )}
    </div>
  );
};

export default ChatWindow;
