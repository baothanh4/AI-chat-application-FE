import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Send, Image as ImageIcon, Smile, MessageCircle, X, Loader2, Sparkles, Film, 
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Info, 
  Pin, ThumbsUp, Reply, Edit3, Trash, RotateCcw, MoreHorizontal, ChevronRight,
  PlusCircle, Heart, Mic, FileText, Sticker
} from 'lucide-react';
import api from '../services/api';
import clsx from 'clsx';
import { getConversationName, formatLastSeen, formatDateDivider, isDifferentDay, formatTime } from '../utils/chatUtils';
import AiPanel from './AiPanel';
import ConversationInfo from './ConversationInfo';
import PinnedMessagesModal from './PinnedMessagesModal';
import { useCall } from '../context/CallContext';



const ChatWindow = ({ activeConversation, stompClient, connected, presenceMap = {}, onNewAiInsight, onMessagesChange, onConversationUpdate }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const subscriptionRef = useRef(null);
  const fileInputRef = useRef(null);
  const { startCall } = useCall();

  // Side Panel state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);

  // Pin state
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const latestPin = pinnedMessages[0];

  // Reply/Edit state
  const [replyingTo, setReplyingTo] = useState(null); // ChatMessageResponse
  const [editingMessage, setEditingMessage] = useState(null); // ChatMessageResponse

  // Toggle AI Panel
  const toggleAiPanel = () => {
    setShowAiPanel(v => !v);
    setShowInfoPanel(false); 
  };

  // Toggle Info Panel
  const toggleInfoPanel = () => {
    setShowInfoPanel(v => !v);
    setShowAiPanel(false);
  };

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
    const mutationDest = `/topic/conversations/${activeConversation.id}/messages.mutated`;
    const pinDest = `/topic/conversations/${activeConversation.id}/messages.pinned`;
    
    // 1. Subscribe to new messages
    const subscription = stompClient.subscribe(destination, (message) => {
        if (message.body) {
            const newMsg = JSON.parse(message.body);
            setMessages(prev => {
                if (newMsg.conversationId && newMsg.conversationId !== activeChatIdRef.current) return prev;
                if (prev.find(m => m.id === newMsg.id || (newMsg.clientMessageId && m.clientMessageId === newMsg.clientMessageId))) return prev;
                return [...prev, newMsg];
            });
        }
    });

    // 2. Subscribe to mutations (Edit, Delete, Unsend, Reaction)
    const mutationSub = stompClient.subscribe(mutationDest, (message) => {
        if (message.body) {
            const event = JSON.parse(message.body);
            const updatedMsg = event.message;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
    });

    // 3. Subscribe to pin changes
    const pinSub = stompClient.subscribe(pinDest, (message) => {
        if (message.body) {
            const event = JSON.parse(message.body);
            const updatedMsg = event.message;
            
            // Update messages list
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
            
            // Update pinned list
            if (event.eventType === 'MESSAGE_PINNED') {
                setPinnedMessages(prev => [updatedMsg, ...prev.filter(p => p.id !== updatedMsg.id)]);
            } else {
                setPinnedMessages(prev => prev.filter(p => p.id !== updatedMsg.id));
            }
        }
    });

    return () => {
        subscription.unsubscribe();
        mutationSub.unsubscribe();
        pinSub.unsubscribe();
    };
  }, [connected, stompClient, activeConversation]);

  // Initial fetch for pinned messages
  useEffect(() => {
    if (!activeConversation || !currentUser) return;
    api.get(`/messages/conversations/${activeConversation.id}/pinned`, { params: { actorUserId: currentUser.id } })
       .then(res => setPinnedMessages(res.data))
       .catch(err => console.error("Failed to fetch pins", err));
  }, [activeConversation, currentUser]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !stompClient || !activeConversation) return;
    if (!connected) {
      alert("Mất kết nối tới server!");
      return;
    }

    const content = inputText.trim();
    const clientMessageId = `msg-${Date.now()}`;

    try {
      if (editingMessage) {
        // Handle Edit
        await api.patch(`/messages/${editingMessage.id}/edit`, { 
          actorUserId: currentUser.id,
          content 
        });
        setEditingMessage(null);
      } else if (replyingTo) {
        // Handle Reply
        await api.post(`/messages/${replyingTo.id}/reply`, {
          actorUserId: currentUser.id,
          content,
          clientMessageId
        });
        
        // Optimistic UI for reply
        setMessages(prev => [...prev, {
          id: clientMessageId,
          content,
          sender: currentUser,
          clientMessageId,
          type: 'TEXT',
          messageType: 'TEXT',
          replyToMessageId: replyingTo.id,
          createdAt: new Date().toISOString()
        }]);
        setReplyingTo(null);
      } else {
        // Regular Send
        const payload = {
          conversationId: activeConversation.id,
          senderId: currentUser.id,
          content,
          messageType: 'TEXT',
          clientMessageId
        };
        stompClient.publish({
          destination: '/app/chat.send',
          body: JSON.stringify(payload)
        });

        // Optimistic UI only for new messages
        setMessages(prev => [...prev, {
          id: clientMessageId,
          content,
          sender: currentUser,
          clientMessageId,
          type: 'TEXT',
          messageType: 'TEXT',
          createdAt: new Date().toISOString()
        }]);
      }
      setInputText('');
    } catch (err) {
      alert("Gửi tin nhắn thất bại!");
    }
  };

  // Message Mutation Actions
  const handlePinMessage = async (msgId, isPinned) => {
    try {
      const endpoint = isPinned ? `/messages/${msgId}/unpin` : `/messages/${msgId}/pin`;
      await api.patch(endpoint, { actorUserId: currentUser.id });
    } catch (err) { console.error("Failed to toggle pin", err); }
  };

  const handleReactMessage = async (msgId, emoji) => {
    try {
      await api.put(`/messages/${msgId}/reaction`, { 
        actorUserId: currentUser.id, 
        emoji 
      });
    } catch (err) { console.error("Failed to react", err); }
  };

  const handleRemoveReaction = async (msgId) => {
    try {
      await api.delete(`/messages/${msgId}/reaction`, { params: { actorUserId: currentUser.id } });
    } catch (err) { console.error("Failed to remove reaction", err); }
  };

  const handleUnsendMessage = async (msgId) => {
    try {
      await api.patch(`/messages/${msgId}/unsend`, { actorUserId: currentUser.id });
    } catch (err) { alert("Không thể thu hồi tin nhắn!"); }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Xóa tin nhắn này với mọi người?")) return;
    try {
      await api.delete(`/messages/${msgId}`, { data: { actorUserId: currentUser.id } });
    } catch (err) { alert("Không thể xóa tin nhắn!"); }
  };

  const startEditMessage = (msg) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    setInputText(msg.content);
  };

  const startReplyMessage = (msg) => {
    setReplyingTo(msg);
    setEditingMessage(null);
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
        let CallIcon = Phone;
        let iconColor = '';
        let iconBg = '';

        if (isMyMissed) {
          title = 'Bạn bị nhỡ';
          CallIcon = mode === 'VIDEO' ? Video : PhoneMissed;
          iconColor = '#ef4444';
          iconBg = 'rgba(239, 68, 68, 0.15)';
        } else {
          const typeStr = mode === 'VIDEO' ? 'video ' : '';
          title = amICaller ? `Cuộc gọi ${typeStr}đi` : `Cuộc gọi ${typeStr}đến`;
          CallIcon = mode === 'VIDEO' ? Video : (amICaller ? PhoneOutgoing : PhoneIncoming);
          iconColor = amICaller ? '#e2e8f0' : '#10b981';
          iconBg = amICaller ? 'rgba(255, 255, 255, 0.1)' : 'rgba(16, 185, 129, 0.15)';
        }

        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = `${mins} phút ${secs} giây`;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px', padding: '6px' }}>
            <div style={{ fontWeight: '600', marginBottom: '10px', color: isMyMissed ? '#ef4444' : 'inherit' }}>
              {title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', color: isMyMissed ? '#ef4444' : 'var(--text-muted)' }}>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                background: iconBg, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CallIcon size={18} color={iconColor} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: '500' }}>
                {isMissed ? (mode === 'VIDEO' ? 'Cuộc gọi video' : 'Cuộc gọi thoại') : durationStr}
              </span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', textAlign: 'center' }}>
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
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-panel)' }}>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* AI Panel Toggle Button */}
          <button
            onClick={toggleAiPanel}
            className={`ai-toggle-btn ${showAiPanel ? 'active' : ''}`}
            title="AI Insights"
          >
            <Sparkles size={16} />
            <span>AI</span>
          </button>
          {/* Info Panel Toggle Button */}
          <button
            onClick={toggleInfoPanel}
            className="icon"
            style={{ 
              background: showInfoPanel ? 'var(--bg-panel-hover)' : 'transparent',
              color: showInfoPanel ? 'var(--accent-primary)' : 'var(--text-muted)'
            }}
            title="Conversation Info"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {/* Pinned Messages Bar */}
      {latestPin && (
        <div style={{ 
          padding: '8px 20px', 
          background: 'rgba(59, 130, 246, 0.1)', 
          borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer'
        }} onClick={() => setShowPinnedModal(true)}>
          <Pin size={14} color="#3b82f6" />
          <div style={{ flex: 1, overflow: 'hidden' }}>
             <div style={{ fontSize: '11px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Tin nhắn đã ghim</div>
             <div style={{ fontSize: '13px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {latestPin.content}
             </div>
          </div>
          <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
        </div>
      )}

      {/* Messages Window */}
      <div style={{ 
        flex: 1, 
        padding: '20px', 
        overflowY: 'auto', 
        display: 'flex', 
        flexDirection: 'column',
        background: activeConversation?.themeColor 
          ? `linear-gradient(to bottom, var(--bg-dark) 0%, ${activeConversation.themeColor}15 100%)` 
          : 'var(--bg-dark)',
      }}>
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
                     <div id={`message-${msg.id}`} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '16px', gap: '8px' }}>
                        {!isMe && (
                            <div className="avatar" style={{ width: '28px', height: '28px', padding: 0, overflow: 'hidden', flexShrink: 0 }}>
                               {msg.sender?.avatarPath ? (
                                  <img src={msg.sender.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               ) : (
                                  <span style={{ fontSize: '12px' }}>{msg.sender?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
                               )}
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%', position: 'relative' }}>
                            {showSenderName && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '4px' }}>
                                    {msg.sender.displayName || msg.sender.username}
                                </div>
                            )}

                            {/* Reply Preview in Bubble */}
                            {msg.replyToMessageId && (
                              <div style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                padding: '8px 12px', 
                                borderRadius: '12px', 
                                borderLeft: '3px solid #3b82f6',
                                marginBottom: '-8px',
                                paddingBottom: '16px',
                                fontSize: '12px',
                                opacity: 0.8,
                                maxWidth: '100%'
                              }}>
                                <div style={{ fontWeight: '700', color: '#3b82f6', marginBottom: '2px' }}>
                                  Đang trả lời {(() => {
                                    const repliedMsg = messages.find(m => m.id === msg.replyToMessageId);
                                    return repliedMsg ? (repliedMsg.sender.id === currentUser.id ? 'chính bạn' : (repliedMsg.sender.displayName || repliedMsg.sender.username)) : '';
                                  })()}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {(() => {
                                    const repliedMsg = messages.find(m => m.id === msg.replyToMessageId);
                                    if (repliedMsg) {
                                      if (repliedMsg.messageType === 'IMAGE') return '[Hình ảnh]';
                                      if (repliedMsg.messageType === 'VIDEO') return '[Video]';
                                      if (repliedMsg.messageType === 'FILE') return '[Tập tin]';
                                      return repliedMsg.content;
                                    }
                                    return `Tin nhắn #${msg.replyToMessageId.substring(0, 8)}...`;
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {(() => {
                               const isFirstInGroup = idx === 0 || messages[idx - 1].senderId !== msg.senderId || isDifferentDay(msg.createdAt, messages[idx - 1].createdAt);
                               const isLastInGroup = idx === messages.length - 1 || messages[idx + 1].senderId !== msg.senderId || isDifferentDay(msg.createdAt, messages[idx + 1].createdAt);

                               const borderRadiusStyle = isMe
                                   ? `18px ${isFirstInGroup ? '18px' : '4px'} ${isLastInGroup ? '18px' : '4px'} 18px`
                                   : `${isFirstInGroup ? '18px' : '4px'} 18px 18px ${isLastInGroup ? '18px' : '4px'}`;

                               return (
                                 <div className="message-wrapper" style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                                   <div 
                                     className={clsx('message-bubble', isMe ? 'sent' : 'received', (isImage || msgType === 'VIDEO') && 'image-message')} 
                                     style={{ 
                                       marginBottom: 0, 
                                       position: 'relative',
                                       background: isMe ? (activeConversation.themeColor || 'var(--accent-primary)') : 'var(--bg-panel)',
                                       borderRadius: borderRadiusStyle
                                     }}
                                   >
                                     {msg.pinned && (
                                       <div style={{ position: 'absolute', top: '-8px', right: isMe ? 'auto' : '-8px', left: isMe ? '-8px' : 'auto', background: '#3b82f6', padding: '4px', borderRadius: '50%', border: '2px solid var(--bg-dark)' }}>
                                         <Pin size={10} color="white" />
                                       </div>
                                     )}
                                     
                                     {msg.unsent ? (
                                       <div style={{ fontStyle: 'italic', opacity: 0.5 }}>Tin nhắn đã được thu hồi</div>
                                     ) : msg.deletedForEveryone ? (
                                       <div style={{ fontStyle: 'italic', opacity: 0.5 }}>Tin nhắn đã bị xóa</div>
                                     ) : renderMessageContent(msg)}
                                   </div>

                                   {/* Quick Actions (Hover) */}
                                   {!msg.unsent && !msg.deletedForEveryone && (
                                     <div className="message-actions-hover" style={{ 
                                       position: 'absolute', 
                                       top: '50%', 
                                       transform: 'translateY(-50%)',
                                       [isMe ? 'right' : 'left']: 'calc(100% + 8px)',
                                       display: 'flex',
                                       flexDirection: isMe ? 'row-reverse' : 'row',
                                       gap: '4px',
                                       zIndex: 10
                                     }}>
                                        <div className="more-actions-dropdown-container" style={{ position: 'relative', display: 'flex' }}>
                                          <button title="Bày tỏ cảm xúc" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Smile size={18} />
                                          </button>
                                          
                                          <div className="emoji-picker-menu glass" style={{ [isMe ? 'right' : 'left']: 0, top: 'calc(100% + 4px)', marginTop: 0 }}>
                                            {['👍', '❤️', '😂', '😮', '😢', '😡'].map(emoji => (
                                              <button key={emoji} onClick={() => handleReactMessage(msg.id, emoji)} title={emoji}>
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        <button onClick={() => startReplyMessage(msg)} title="Trả lời" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Reply size={18} />
                                        </button>
                                        
                                        <div className="more-actions-dropdown-container" style={{ position: 'relative', display: 'flex' }}>
                                          <button title="Thêm" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <MoreHorizontal size={18} />
                                          </button>
                                          
                                          <div className="more-actions-menu glass" style={{ [isMe ? 'right' : 'left']: 0, top: 'calc(100% + 4px)', marginTop: 0 }}>
                                            <button onClick={() => handlePinMessage(msg.id, msg.pinned)} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: '500' }}>
                                              <Pin size={14} color={msg.pinned ? "#3b82f6" : "currentColor"} /> 
                                              {msg.pinned ? "Bỏ ghim" : "Ghim"}
                                            </button>
                                            {isMe && (
                                              <>
                                                <button onClick={() => startEditMessage(msg)} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: '500' }}>
                                                  <Edit3 size={14} /> Chỉnh sửa
                                                </button>
                                                <button onClick={() => handleUnsendMessage(msg.id)} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: '500' }}>
                                                  <RotateCcw size={14} /> Thu hồi
                                                </button>
                                              </>
                                            )}
                                            <button onClick={() => handleDeleteMessage(msg.id)} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', fontWeight: '500', color: '#ef4444 !important' }}>
                                              <Trash size={14} color="#ef4444" /> Xóa
                                            </button>
                                          </div>
                                        </div>
                                     </div>
                                   )}
                                 </div>
                               );
                            })()}

                            {/* Reactions Display */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div style={{ 
                                display: 'flex', 
                                gap: '4px', 
                                marginTop: '-10px', 
                                zIndex: 5,
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                marginLeft: isMe ? 0 : '8px',
                                marginRight: isMe ? '8px' : 0
                              }}>
                                {msg.reactions.map(r => (
                                  <div key={r.emoji} 
                                    onClick={() => r.userIds.includes(currentUser.id) ? handleRemoveReaction(msg.id) : handleReactMessage(msg.id, r.emoji)}
                                    style={{ 
                                      background: r.userIds.includes(currentUser.id) ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.1)', 
                                      border: r.userIds.includes(currentUser.id) ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                                      padding: '2px 6px', 
                                      borderRadius: '12px', 
                                      fontSize: '11px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      cursor: 'pointer'
                                    }}>
                                    <span>{r.emoji}</span>
                                    <span style={{ fontWeight: '700' }}>{r.count}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '4px', paddingRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                               {formatTime(msg.createdAt)}
                               {msg.edited && <span style={{ fontSize: '10px', opacity: 0.6 }}>• Đã chỉnh sửa</span>}
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
      <div style={{ padding: '12px 20px 20px', background: 'var(--bg-dark)', borderTop: '1px solid var(--border-color)' }}>
        
        {/* Reply Bar */}
        {replyingTo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '10px 16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', borderLeft: '4px solid #3b82f6' }}>
            <Reply size={16} color="#3b82f6" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6' }}>Đang trả lời @{replyingTo.sender.username}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {replyingTo.content}
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="icon" style={{ padding: '4px' }}><X size={16} /></button>
          </div>
        )}

        {/* Edit Bar */}
        {editingMessage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', padding: '10px 16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
            <Edit3 size={16} color="#10b981" />
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981' }}>Đang chỉnh sửa tin nhắn</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {editingMessage.content}
              </div>
            </div>
            <button onClick={() => { setEditingMessage(null); setInputText(''); }} className="icon" style={{ padding: '4px' }}><X size={16} /></button>
          </div>
        )}

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

        <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', color: activeConversation.themeColor || 'var(--accent-primary)' }}>
            <button type="button" className="icon" title="Thêm hành động" style={{ color: 'inherit', padding: '6px' }}>
              <PlusCircle size={22} />
            </button>
            <button type="button" className="icon" title="Đính kèm ảnh" onClick={() => fileInputRef.current?.click()} style={{ color: 'inherit', padding: '6px' }}>
              <ImageIcon size={22} />
            </button>
            <button type="button" className="icon" title="Chọn nhãn dán" style={{ color: 'inherit', padding: '6px' }}>
              <Sticker size={22} />
            </button>
            <button type="button" className="icon" title="Chọn GIF" style={{ color: 'inherit', padding: '6px' }}>
              <FileText size={22} />
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', borderRadius: '24px' }}>
            <input 
              type="text" 
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Aa" 
              style={{ width: '100%', paddingLeft: '16px', paddingRight: '44px', paddingBottom: '10px', paddingTop: '10px', borderRadius: '24px', background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '15px' }} 
            />
            <button type="button" className="icon" title="Thả biểu tượng" style={{ position: 'absolute', right: '12px', color: activeConversation.themeColor || 'var(--accent-primary)', padding: '0', background: 'transparent' }}>
              <Smile size={22} />
            </button>
          </div>

          {inputText.trim() ? (
            <button type="submit" className="icon" title="Gửi" style={{ color: activeConversation.themeColor || 'var(--accent-primary)', padding: '6px' }}>
              <Send size={22} />
            </button>
          ) : (
            <button 
              type="button"
              className="icon"
              onClick={() => handleReactMessage(messages[messages.length - 1]?.id, activeConversation.quickReactionEmoji || '👍')}
              style={{ fontSize: '24px', padding: '4px', cursor: 'pointer', background: 'transparent', border: 'none' }}
              title="Thả cảm xúc nhanh"
            >
              {activeConversation.quickReactionEmoji || '👍'}
            </button>
          )}
        </form>
      </div>
    </div>
    {/* Side Panels */}
    {showAiPanel && activeConversation && (
      <AiPanel
        conversationId={activeConversation.id}
        stompClient={stompClient}
        connected={connected}
        onClose={() => setShowAiPanel(false)}
      />
    )}
    {showInfoPanel && activeConversation && (
      <ConversationInfo
        activeConversation={activeConversation}
        currentUser={currentUser}
        messages={messages}
        onClose={() => setShowInfoPanel(false)}
        onShowPins={() => {
          setShowPinnedModal(true);
          setShowInfoPanel(false);
        }}
        onConversationUpdate={onConversationUpdate}
      />
    )}
    {showPinnedModal && (
      <PinnedMessagesModal 
        pins={pinnedMessages} 
        onClose={() => setShowPinnedModal(false)}
        onJumpTo={(msg) => {
          setShowPinnedModal(false);
          const element = document.getElementById(`message-${msg.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('highlight-message');
            setTimeout(() => element.classList.remove('highlight-message'), 2000);
          } else {
            alert("Tin nhắn này ở quá xa, vui lòng cuộn lên để tìm.");
          }
        }}
      />
    )}
    </div>
  );
};

export default ChatWindow;
