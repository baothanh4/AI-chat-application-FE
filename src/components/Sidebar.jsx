import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, LogOut, MessageCircle, Bell, UserPlus, Check, X, Clock, Bot, Users, UploadCloud, Loader2, Shield, AlertTriangle } from 'lucide-react';
import api from '../services/api';

import { getConversationName, formatLastSeen, formatMessagePreview } from '../utils/chatUtils';


const Sidebar = ({ conversations, setConversations, activeConversation, setActiveConversation, presenceMap = {}, stompClient, connected, lastMessageMap = {}, unreadMap = {} }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatUsername, setNewChatUsername] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Group creation state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]); // selected members {id, displayName, username, avatarPath, isFriend}
  const [friends, setFriends] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [isGroupSearching, setIsGroupSearching] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const groupSearchTimeoutRef = useRef(null);

  // Search & Friend requests states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [sentRequestIds, setSentRequestIds] = useState(new Set()); // track locally sent requests

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);
  
  // AI Bot
  const [botUser, setBotUser] = useState(null);
  const [loadingBot, setLoadingBot] = useState(false);
  
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);
  const requestsContainerRef = useRef(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (requestsContainerRef.current && !requestsContainerRef.current.contains(event.target)) {
        setShowRequestsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch incoming requests
  const fetchIncomingRequests = async () => {
    try {
      const res = await api.get(`/friend-requests/incoming/${currentUser.id}`);
      setIncomingRequests(res.data);
    } catch (err) {
      console.error("Failed to load friend requests", err);
    }
  };

  useEffect(() => {
    fetchIncomingRequests();
  }, [currentUser.id]);

  // Fetch AI Bot user info
  useEffect(() => {
    const fetchBotUser = async () => {
      try {
        const res = await api.get('/users/bot');
        setBotUser(res.data);
      } catch (err) {
        console.warn('AI Bot user not available', err);
      }
    };
    fetchBotUser();
  }, []);

  // STOMP subscription for friend requests
  useEffect(() => {
    if (!stompClient || !connected) return;
    const sub = stompClient.subscribe(`/topic/friends/${currentUser.id}`, (message) => {
      const req = JSON.parse(message.body);
      // If it's a new request to me
      if (req.recipient.id === currentUser.id && req.status === 'PENDING') {
         setIncomingRequests(prev => [req, ...prev.filter(r => r.id !== req.id)]);
      } else if (req.status !== 'PENDING') {
         // remove from list if accepted/rejected
         setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
         
         // Add conversation if accepted
         if (req.status === 'ACCEPTED' && req.privateConversationId) {
            api.get(`/conversations/${req.privateConversationId}`)
               .then(convRes => {
                  setConversations(prev => {
                      const filtered = prev.filter(c => c.id !== convRes.data.id);
                      return [convRes.data, ...filtered];
                  });
               })
               .catch(e => console.error(e));
         }
      }
      // If we have search results open, maybe refresh them
      if (searchQuery.trim()) {
         handleSearch(searchQuery);
      }
    });
    return () => sub.unsubscribe();
  }, [stompClient, connected, currentUser.id, searchQuery]);

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.get(`/users/search`, {
        params: { query: query.trim(), viewerId: currentUser.id, limit: 10 }
      });
      // Merge server results with local sentRequestIds to avoid losing pending state
      setSearchResults(prev => {
        const localSent = sentRequestIds;
        return (res.data || []).map(u => {
          if (localSent.has(u.id) && u.relationshipStatus === 'NONE') {
            return { ...u, relationshipStatus: 'PENDING_OUT' };
          }
          return u;
        });
      });
      setShowSearchDropdown(true);
    } catch (err) {
      console.error("Search error", err);
    } finally {
      setIsSearching(false);
    }
  };

  const onSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val) {
       setShowSearchDropdown(false);
       setSearchResults([]);
       if(searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
       return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
       handleSearch(val);
    }, 300);
  };

  const handleSendRequest = async (userId) => {
    try {
      await api.post('/friend-requests', { senderId: currentUser.id, recipientId: userId });
      // Update local search result and track in sentRequestIds
      setSentRequestIds(prev => new Set([...prev, userId]));
      setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, relationshipStatus: 'PENDING_OUT' } : u));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to send request');
    }
  };

  const handleAcceptRequest = async (requestId, autoChat = false) => {
    try {
      const res = await api.post(`/friend-requests/${requestId}/accept`, { userId: currentUser.id });
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Update conversations if we have privateConversationId
      if (res.data.privateConversationId) {
         try {
            const convRes = await api.get(`/conversations/${res.data.privateConversationId}`);
            setConversations(prev => {
                const filtered = prev.filter(c => c.id !== convRes.data.id);
                return [convRes.data, ...filtered];
            });
            if (autoChat) {
               setActiveConversation(convRes.data);
               setShowSearchDropdown(false);
               setShowRequestsDropdown(false);
            }
         } catch(e) {}
      }
      if (searchQuery.trim()) handleSearch(searchQuery);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await api.post(`/friend-requests/${requestId}/reject`, { userId: currentUser.id });
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
      if (searchQuery.trim()) handleSearch(searchQuery);
    } catch (err) {
      console.error(err);
    }
  };

  const startChatWithFriend = async (friendId) => {
    // If we already have a direct conversation, find it
    const existing = conversations.find(c => c.type === 'PRIVATE' && c.members.some(m => m.id === friendId));
    if (existing) {
        setActiveConversation(existing);
        setShowSearchDropdown(false);
        setSearchQuery('');
        return;
    }
    // Else try to create/fetch
    try {
        const res = await api.post('/conversations/private', {
            ownerId: currentUser.id,
            recipientId: friendId
        });
        const newConv = res.data;
        setConversations(prev => {
             const filtered = prev.filter(c => c.id !== newConv.id);
             return [newConv, ...filtered];
        });
        setActiveConversation(newConv);
        setShowSearchDropdown(false);
        setSearchQuery('');
    } catch (err) {
        alert('Failed to start chat.');
    }
  };

  const startChatWithBot = async () => {
    if (!botUser || loadingBot) return;
    // Check if already have a conversation with bot
    const existing = conversations.find(c => c.type === 'PRIVATE' && c.members?.some(m => m.id === botUser.id));
    if (existing) {
      setActiveConversation(existing);
      return;
    }
    setLoadingBot(true);
    try {
      const res = await api.post('/conversations/private', {
        ownerId: currentUser.id,
        recipientId: botUser.id
      });
      const newConv = res.data;
      setConversations(prev => {
        const filtered = prev.filter(c => c.id !== newConv.id);
        return [newConv, ...filtered];
      });
      setActiveConversation(newConv);
    } catch (err) {
      alert('Không thể mở chat với AI Bot!');
    } finally {
      setLoadingBot(false);
    }
  };

  const handleCreateChat = async (e) => {
    e.preventDefault();
    if (!newChatUsername.trim()) return;
    setIsCreating(true);

    try {
        const resUser = await api.post('/users', { username: newChatUsername, displayName: newChatUsername });
        const targetUserId = resUser.data.id;

        if (targetUserId === currentUser.id) {
            alert('Cannot chat with yourself');
            setIsCreating(false);
            return;
        }

        const resRoom = await api.post('/conversations/private', {
            ownerId: currentUser.id,
            recipientId: targetUserId
        });

        const newConv = resRoom.data;
        setConversations(prev => {
             // Avoid duplicating if it already exists in the list
             const filtered = prev.filter(c => c.id !== newConv.id);
             return [newConv, ...filtered];
        });
        setActiveConversation(newConv);
        setShowNewChatDialog(false);
        setNewChatUsername('');
    } catch (err) {
        console.error("Error creating chat", err);
        alert(err.response?.data?.message || 'Failed to start direct message.');
    } finally {
        setIsCreating(false);
    }
  };

  // Get other user's presence for a private conversation
  const getOtherUserPresence = (conv) => {
    if (conv.type !== 'PRIVATE' || !conv.members) return null;
    const otherMember = conv.members.find(m => m.id !== currentUser.id);
    if (!otherMember) return null;
    return presenceMap[otherMember.id] || { online: false, lastSeenAt: null };
  };

  // Load friends when group modal opens
  const openGroupModal = async () => {
    setGroupName('');
    setGroupDescription('');
    setGroupAvatarFile(null);
    setGroupAvatarPreview(null);
    setGroupMembers([]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setGroupError('');
    setShowGroupModal(true);
    try {
      const res = await api.get(`/friend-requests/friends/${currentUser.id}`);
      setFriends(res.data || []);
    } catch (err) {
      console.error('Failed to load friends', err);
    }
  };

  const toggleGroupMember = (user, isFriend = false) => {
    setGroupMembers(prev => {
      const exists = prev.find(m => m.id === user.id);
      if (exists) return prev.filter(m => m.id !== user.id);
      return [...prev, { ...user, isFriend }];
    });
    setGroupError('');
  };

  const onGroupSearchChange = (e) => {
    const val = e.target.value;
    setGroupSearchQuery(val);
    if (!val.trim()) { setGroupSearchResults([]); return; }
    if (groupSearchTimeoutRef.current) clearTimeout(groupSearchTimeoutRef.current);
    groupSearchTimeoutRef.current = setTimeout(async () => {
      setIsGroupSearching(true);
      try {
        const res = await api.get('/users/search', { params: { query: val.trim(), viewerId: currentUser.id, limit: 8 } });
        // exclude self and already-selected
        setGroupSearchResults((res.data || []).filter(u => u.id !== currentUser.id));
      } catch { }
      finally { setIsGroupSearching(false); }
    }, 300);
  };

  const handleGroupAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setGroupError('Ảnh nhóm không quá 5MB.'); return; }
    setGroupAvatarFile(file);
    setGroupAvatarPreview(URL.createObjectURL(file));
  };

  const handleCreateGroup = async () => {
    setGroupError('');
    if (!groupName.trim()) { setGroupError('Vui lòng nhập tên nhóm.'); return; }
    const hasFriend = groupMembers.some(m => m.isFriend || m.relationshipStatus === 'FRIEND');
    if (!hasFriend) { setGroupError('Nhóm phải có ít nhất 1 người bạn bè của bạn.'); return; }
    // total = selected + self
    if (groupMembers.length + 1 < 3) { setGroupError(`Cần thêm ${3 - groupMembers.length - 1} người nữa (tối thiểu 3 người gồm bạn).`); return; }

    setIsCreatingGroup(true);
    try {
      // Upload avatar if selected
      let avatarPath = null;
      if (groupAvatarFile) {
        const fd = new FormData();
        fd.append('file', groupAvatarFile);
        const upRes = await api.post('/uploads/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        avatarPath = upRes.data.path || upRes.data.avatarPath || upRes.data.url || null;
      }
      const res = await api.post('/conversations/group', {
        ownerId: currentUser.id,
        name: groupName.trim(),
        description: groupDescription.trim() || null,
        avatarPath,
        memberIds: groupMembers.map(m => m.id),
      });
      const newConv = res.data;
      setConversations(prev => [newConv, ...prev.filter(c => c.id !== newConv.id)]);
      setActiveConversation(newConv);
      setShowGroupModal(false);
    } catch (err) {
      setGroupError(err.response?.data?.message || 'Tạo nhóm thất bại. Thử lại.');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <div className="sidebar" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="avatar"
            style={{ overflow: 'hidden', padding: 0, cursor: 'pointer', transition: 'opacity 0.2s' }}
            title="Xem thông tin cá nhân"
            onClick={() => navigate('/profile')}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
             {currentUser.avatarPath ? (
                 <img src={currentUser.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
             ) : (
                 currentUser.displayName ? currentUser.displayName.charAt(0) : 'U'
             )}
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>{currentUser.displayName}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{currentUser.username}</div>
          </div>
        </div>
    <div style={{ display: 'flex', gap: '8px' }}>
            {currentUser.role === 'ADMIN' && (
              <button
                className="icon-btn"
                title="Admin Panel"
                onClick={() => navigate('/admin')}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', cursor: 'pointer', borderRadius: '8px', padding: '6px' }}
              >
                <Shield size={18} />
              </button>
            )}
            {(currentUser.role === 'ADMIN' || currentUser.role === 'MODERATOR') && (
              <button
                className="icon-btn"
                title="Moderation"
                onClick={() => navigate('/moderation')}
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24', cursor: 'pointer', borderRadius: '8px', padding: '6px' }}
              >
                <AlertTriangle size={18} />
              </button>
            )}
            <button
              className="icon-btn"
              title="Tạo nhóm"
              onClick={openGroupModal}
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', borderRadius: '8px', padding: '6px' }}
            >
              <Users size={18} />
            </button>
            <button className="icon-btn" title="Logout" onClick={logout} style={{ background: 'transparent', border:'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <LogOut size={20} />
            </button>
        </div>
      </div>

      {/* Action / Search */}
      <div style={{ padding: '16px', display: 'flex', gap: '8px', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }} ref={searchContainerRef}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={onSearchChange}
            onFocus={() => { if(searchQuery) setShowSearchDropdown(true); }}
            style={{ width: '100%', paddingLeft: '40px', paddingRight:'12px', paddingBottom:'10px', paddingTop:'10px', fontSize: '14px', borderRadius: '20px' }} 
          />
          {showSearchDropdown && (
            <div className="search-dropdown-overlay glass animate-fade-in dropdown-menu">
              {isSearching ? (
                 <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tìm kiếm...</div>
              ) : searchResults.length === 0 ? (
                 <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy ai.</div>
              ) : (
                 searchResults.map(user => (
                   <div key={user.id} className="search-result-item">
                     <div className="avatar" style={{ width: '32px', height: '32px', minWidth: '32px', padding: 0 }}>
                        {user.avatarPath ? <img src={user.avatarPath} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : user.displayName.charAt(0)}
                     </div>
                     <div style={{ flex: 1, overflow: 'hidden' }}>
                       <div style={{ fontWeight: '500', fontSize: '14px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{user.displayName}</div>
                       <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user.username}</div>
                     </div>
                     <div>
                       {user.relationshipStatus === 'NONE' && (
                         <button className="action-btn small btn-primary" onClick={() => handleSendRequest(user.id)}>
                           <UserPlus size={14} style={{marginRight: '4px'}}/> Thêm bạn
                         </button>
                       )}
                       {user.relationshipStatus === 'PENDING_OUT' && (
                         <button className="action-btn small" disabled style={{ background: 'var(--bg-panel-hover)'}}>
                           <Clock size={14} style={{marginRight: '4px'}}/> Đã gửi
                         </button>
                       )}
                       {user.relationshipStatus === 'PENDING_IN' && (
                         <button className="action-btn small btn-success" onClick={() => handleAcceptRequest(user.pendingRequestId, true)}>
                           <Check size={14} style={{marginRight: '4px'}}/> Đồng ý
                         </button>
                       )}
                       {(user.relationshipStatus === 'FRIEND' || user.alreadyFriend) && (
                         <button className="action-btn small" style={{ background: 'var(--accent-secondary)'}} onClick={() => startChatWithFriend(user.id)}>
                           Nhắn tin
                         </button>
                       )}
                     </div>
                   </div>
                 ))
              )}
            </div>
          )}
        </div>
        
        <div style={{ position: 'relative' }} ref={requestsContainerRef}>
           <button className="icon" style={{ background: 'var(--bg-panel-hover)', color: 'white', position: 'relative' }} onClick={() => setShowRequestsDropdown(!showRequestsDropdown)} title="Friend Requests">
             <Bell size={20} />
             {incomingRequests.length > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: 'var(--error)', width: 18, height: 18, borderRadius: '50%', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                   {incomingRequests.length}
                </span>
             )}
           </button>
           {showRequestsDropdown && (
              <div className="search-dropdown-overlay glass animate-fade-in dropdown-menu" style={{ right: 0, left: 'auto', width: '300px' }}>
                 <div style={{ padding: '12px', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>Lời mời kết bạn</div>
                 {incomingRequests.length === 0 ? (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>Không có lời mời nào</div>
                 ) : (
                    incomingRequests.map(req => (
                       <div key={req.id} className="search-result-item" style={{ padding: '12px' }}>
                         <div className="avatar" style={{ width: '32px', height: '32px', minWidth: '32px', padding: 0 }}>
                            {req.sender?.avatarPath ? <img src={req.sender.avatarPath} alt="Avatar" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : req.sender?.displayName?.charAt(0)}
                         </div>
                         <div style={{ flex: 1, overflow: 'hidden' }}>
                           <div style={{ fontWeight: '500', fontSize: '14px', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{req.sender?.displayName}</div>
                           <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Muốn kết bạn với bạn</div>
                         </div>
                         <div style={{ display: 'flex', gap: '4px' }}>
                           <button className="icon-btn" style={{ background: 'var(--success)', color: 'white', padding: '4px' }} onClick={() => handleAcceptRequest(req.id, false)} title="Đồng ý">
                             <Check size={16} />
                           </button>
                           <button className="icon-btn" style={{ background: 'var(--bg-panel-hover)', color: 'white', padding: '4px' }} onClick={() => handleRejectRequest(req.id)} title="Từ chối">
                             <X size={16} />
                           </button>
                         </div>
                       </div>
                    ))
                 )}
              </div>
           )}
        </div>
      </div>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
         <div className="animate-fade-in" style={{ padding: '0 16px 16px 16px' }}>
           <form onSubmit={handleCreateChat} style={{ display: 'flex', gap: '8px' }}>
             <input value={newChatUsername} onChange={e => setNewChatUsername(e.target.value)} placeholder="Type exact @username" style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }} required />
             <button type="submit" style={{ padding: '8px 12px', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }} disabled={isCreating}>
               {isCreating ? '...' : 'Chat'}
             </button>
           </form>
         </div>
      )}

      {/* Recents list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
      {/* AI Bot Button — luôn hiển thị ở đầu danh sách */}
        {botUser && (
          <div
            className={`conversation-item ${activeConversation?.id && conversations.find(c => c.type === 'PRIVATE' && c.members?.some(m => m.id === botUser.id))?.id === activeConversation?.id ? 'active' : ''}`}
            onClick={startChatWithBot}
            style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(139,92,246,0.07)', cursor: loadingBot ? 'wait' : 'pointer' }}
          >
            <div className="avatar-wrapper">
              <div className="avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} color="white" />
              </div>
              <span className="status-dot online" />
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#a78bfa' }}>
                AI Assistant 🤖
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {loadingBot ? 'Đang kết nối...' : 'Nhắn "help" để xem lệnh'}
              </div>
            </div>
          </div>
        )}
        {conversations.length === 0 ? (
           <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
             No conversations yet.<br/>Click the chat icon to DM someone.
           </div>
        ) : (
           conversations
             .filter(conv => !botUser || !(conv.type === 'PRIVATE' && conv.members?.some(m => m.id === botUser.id)))
             .map(conv => {
              const displayName = getConversationName(conv, currentUser);
              const presence = getOtherUserPresence(conv);
              
              return (
                 <div 
                   key={conv.id} 
                   className={`conversation-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
                   onClick={() => setActiveConversation(conv)}
                 >
                   <div className="avatar-wrapper">
                     <div className="avatar" style={{ overflow: 'hidden', padding: 0, background: conv.type === 'GROUP' ? 'var(--bg-panel-hover)' : 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))' }}>
                       {conv.type === 'PRIVATE' && conv.members?.find(m => m.id !== currentUser.id)?.avatarPath ? (
                          <img src={conv.members.find(m => m.id !== currentUser.id).avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : conv.type === 'GROUP' && conv.avatarPath ? (
                          <img src={conv.avatarPath} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : (
                          displayName ? displayName.charAt(0).toUpperCase() : 'C'
                       )}
                     </div>
                     {presence && presence.online && (
                       <span className="status-dot online" />
                     )}
                   </div>
                   <div style={{ overflow: 'hidden', flex: 1 }}>
                     <div style={{ fontWeight: '500', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                     <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastMessageMap[conv.id] ? (
                          <span style={{ color: unreadMap[conv.id] > 0 ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontWeight: unreadMap[conv.id] > 0 ? '500' : 'normal' }}>
                            {formatMessagePreview(lastMessageMap[conv.id], currentUser)}
                          </span>
                        ) : presence ? (
                          presence.online 
                            ? <span style={{ color: 'var(--success)' }}>Đang hoạt động</span>
                            : presence.lastSeenAt 
                              ? formatLastSeen(presence.lastSeenAt)
                              : (conv.type === 'PRIVATE' ? 'Offline' : 'Group')
                        ) : (
                          conv.type === 'PRIVATE' ? 'Direct Message' : 'Group'
                        )}
                     </div>
                   </div>
                   {unreadMap[conv.id] > 0 && (
                     <div style={{ minWidth: '20px', height: '20px', background: 'var(--accent-primary)', borderRadius: '50%', fontSize: '11px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0 }}>
                       {unreadMap[conv.id] > 99 ? '99+' : unreadMap[conv.id]}
                     </div>
                   )}
                 </div>
              );
           })
        )}
      </div>

      {/* ─── CREATE GROUP MODAL ─── */}
      {showGroupModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="glass" style={{ borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', fontSize: '18px' }}>
                <Users size={22} color="var(--accent-primary)" />
                Tạo nhóm mới
              </div>
              <button onClick={() => setShowGroupModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {groupError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', color: '#f87171', fontSize: '13px' }}>
                {groupError}
              </div>
            )}

            {/* Group avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label htmlFor="group-avatar-upload" style={{ cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '2px dashed rgba(99,102,241,0.4)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  {groupAvatarPreview
                    ? <img src={groupAvatarPreview} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <UploadCloud size={24} color="rgba(99,102,241,0.7)" />}
                </div>
              </label>
              <input id="group-avatar-upload" type="file" accept="image/*" onChange={handleGroupAvatarFile} style={{ display: 'none' }} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Ảnh nhóm</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Click để chọn · Tối đa 5MB</div>
              </div>
            </div>

            {/* Group name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Tên nhóm *</label>
              <input
                type="text"
                value={groupName}
                onChange={e => { setGroupName(e.target.value); setGroupError(''); }}
                placeholder="Nhập tên nhóm..."
                maxLength={120}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', padding: '11px 14px', outline: 'none', width: '100%', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Group description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Mô tả nhóm</label>
              <input
                type="text"
                value={groupDescription}
                onChange={e => setGroupDescription(e.target.value)}
                placeholder="Nhóm dùng để... (không bắt buộc)"
                maxLength={255}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', padding: '11px 14px', outline: 'none', width: '100%', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Members section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Thêm thành viên</label>
                <span style={{ fontSize: '12px', color: groupMembers.length + 1 >= 3 ? '#4ade80' : 'var(--text-muted)' }}>
                  {groupMembers.length + 1}/3+ người
                </span>
              </div>

              {/* Selected members chips */}
              {groupMembers.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {groupMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: m.isFriend || m.relationshipStatus === 'FRIEND' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.08)', border: m.isFriend || m.relationshipStatus === 'FRIEND' ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                      {m.avatarPath
                        ? <img src={m.avatarPath} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>{(m.displayName || m.username || '?').charAt(0).toUpperCase()}</div>
                      }
                      {m.displayName || m.username}
                      {(m.isFriend || m.relationshipStatus === 'FRIEND') && <span style={{ fontSize: '10px', color: '#818cf8' }}>· bạn bè</span>}
                      <button onClick={() => toggleGroupMember(m)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, marginLeft: '2px', display: 'flex' }}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Friends list */}
              {friends.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Bạn bè của bạn</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '140px', overflowY: 'auto' }}>
                    {friends.map(f => {
                      const selected = groupMembers.some(m => m.id === f.id);
                      return (
                        <div key={f.id}
                          onClick={() => toggleGroupMember(f, true)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', background: selected ? 'rgba(99,102,241,0.15)' : 'transparent', transition: 'background 0.15s' }}
                          onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                          onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: 'white', flexShrink: 0 }}>
                            {f.avatarPath ? <img src={f.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (f.displayName || f.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.displayName || f.username}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{f.username} · Bạn bè</div>
                          </div>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid', borderColor: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)', background: selected ? 'var(--accent-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                            {selected && <Check size={12} color="white" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search more users */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={onGroupSearchChange}
                  placeholder="Tìm thêm người dùng..."
                  style={{ width: '100%', paddingLeft: '32px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '10px', padding: '9px 12px 9px 32px', outline: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Search results */}
              {(isGroupSearching || groupSearchResults.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '140px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '4px' }}>
                  {isGroupSearching ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Đang tìm...</div>
                  ) : groupSearchResults.filter(u => !friends.some(f => f.id === u.id)).map(u => {
                    const selected = groupMembers.some(m => m.id === u.id);
                    const isFriend = u.relationshipStatus === 'FRIEND';
                    return (
                      <div key={u.id}
                        onClick={() => toggleGroupMember(u, isFriend)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', background: selected ? 'rgba(99,102,241,0.15)' : 'transparent' }}
                        onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? 'rgba(99,102,241,0.15)' : 'transparent'; }}
                      >
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-panel-hover)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', flexShrink: 0 }}>
                          {u.avatarPath ? <img src={u.avatarPath} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.displayName || u.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: '13px', fontWeight: '500' }}>{u.displayName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{u.username}{isFriend ? ' · Bạn bè' : ''}</div>
                        </div>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid', borderColor: selected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)', background: selected ? 'var(--accent-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {selected && <Check size={11} color="white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setShowGroupModal(false)}
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
              >Huỷ</button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || groupMembers.length + 1 < 3 || !groupName.trim()}
                style={{ flex: 2, padding: '12px', background: isCreatingGroup || groupMembers.length + 1 < 3 || !groupName.trim() ? 'rgba(99,102,241,0.3)' : 'var(--accent-primary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', cursor: isCreatingGroup || groupMembers.length + 1 < 3 || !groupName.trim() ? 'not-allowed' : 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isCreatingGroup ? <><Loader2 size={16} className="spin" /> Đang tạo...</> : <><Users size={16} /> Tạo nhóm</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
