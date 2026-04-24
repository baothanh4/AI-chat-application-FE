import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import AiChatBot from '../components/AiChatBot';
import { useAuth } from '../context/AuthContext';
import { Client } from '@stomp/stompjs';
import api from '../services/api';
import { CallProvider } from '../context/CallContext';

const Chat = () => {
  const { currentUser } = useAuth();
  const [activeConversation, setActiveConversation] = useState(null);
  const [stompClient, setStompClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [presenceMap, setPresenceMap] = useState({}); // { [userId]: { online, lastSeenAt } }
  const [lastMessageMap, setLastMessageMap] = useState({}); // { [convId]: message }
  const [unreadMap, setUnreadMap] = useState({}); // { [convId]: count }
  const [activeChatMessages, setActiveChatMessages] = useState([]); // For AI context

  useEffect(() => {
    // Fetch user's conversations inbox (includes last message + unread count)
    const fetchInbox = async () => {
      try {
        const res = await api.get(`/conversations/users/${currentUser.id}/inbox`);
        const items = res.data || [];

        // Convert InboxItem -> ConversationResponse shape that Sidebar expects
        const convs = items.map(item => ({
          id: item.conversationId,
          type: item.conversationType,
          name: item.name,
          description: item.description,
          archived: item.archived,
          members: item.members,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));
        setConversations(convs);

        // Pre-populate lastMessageMap and unreadMap
        const msgMap = {};
        const unreadInit = {};
        items.forEach(item => {
          if (item.latestMessage) msgMap[item.conversationId] = item.latestMessage;
          if (item.unreadCount > 0) unreadInit[item.conversationId] = item.unreadCount;
        });
        setLastMessageMap(msgMap);
        setUnreadMap(unreadInit);
      } catch (err) {
        console.error("Failed to load inbox", err);
      }
    };
    fetchInbox();
  }, [currentUser.id]);

  // Heartbeat: mark current user online every 60 seconds
  useEffect(() => {
    const sendHeartbeat = () => {
      api.post('/presence/heartbeat', { userId: currentUser.id }).catch(() => {});
    };
    sendHeartbeat(); // send immediately
    const interval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  // Fetch presence for all conversation members periodically
  useEffect(() => {
    if (conversations.length === 0) return;

    // Collect unique other-user IDs from all conversations
    const otherUserIds = new Set();
    conversations.forEach(conv => {
      if (conv.members) {
        conv.members.forEach(m => {
          if (m.id !== currentUser.id) {
            otherUserIds.add(m.id);
          }
        });
      }
    });

    if (otherUserIds.size === 0) return;

    const fetchPresence = async () => {
      const newMap = {};
      await Promise.allSettled(
        [...otherUserIds].map(async (uid) => {
          try {
            const res = await api.get(`/presence/${uid}`);
            newMap[uid] = { online: res.data.online, lastSeenAt: res.data.lastSeenAt };
          } catch {
            newMap[uid] = { online: false, lastSeenAt: null };
          }
        })
      );
      setPresenceMap(newMap);
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [conversations, currentUser.id]);

  useEffect(() => {
    // Generate full URL based on current host for relative proxy resolution in StompJS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('Connected to WebSocket!');
        setConnected(true);
      },
      onWebSocketError: (event) => {
        console.error('WebSocket error:', event);
      },
      onStompError: (frame) => {
        console.error('Broker reported error: ' + frame.headers['message']);
        console.error('Additional details: ' + frame.body);
      },
    });

    client.activate();
    setStompClient(client);

    return () => {
      client.deactivate();
    };
  }, []);

  // Handle Notifications for all loaded conversations
  useEffect(() => {
    if (!stompClient || !connected || conversations.length === 0) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const subscriptions = conversations.map(c => 
      stompClient.subscribe(`/topic/conversations/${c.id}`, (message) => {
        const parsed = JSON.parse(message.body);

        // Always update last message preview
        setLastMessageMap(prev => ({ ...prev, [c.id]: parsed }));

        // Bubble conversation to top of list
        setConversations(prev => {
          const filtered = prev.filter(conv => conv.id !== c.id);
          const convToUpdate = prev.find(conv => conv.id === c.id);
          return convToUpdate ? [convToUpdate, ...filtered] : prev;
        });

        if (parsed.sender.id !== currentUser.id) {
           // Increment unread count if not currently viewing this conversation
           if (!activeConversation || activeConversation.id !== c.id) {
               setUnreadMap(prev => ({ ...prev, [c.id]: (prev[c.id] || 0) + 1 }));
           }
           // Show browser notification if tab is hidden
           if (document.hidden || !activeConversation || activeConversation.id !== c.id) {
               if (Notification.permission === 'granted') {
                   const notif = new Notification(`${parsed.sender.displayName}`, {
                       body: parsed.content,
                       icon: parsed.sender.avatarPath ? `http://localhost:8081${parsed.sender.avatarPath}` : '/favicon.ico'
                   });
                   notif.onclick = () => {
                       window.focus();
                       setActiveConversation(c);
                   };
               }
           }
        }
      })
    );

    return () => {
       subscriptions.forEach(s => s.unsubscribe());
    };
  }, [stompClient, connected, conversations, activeConversation, currentUser.id]);

  // Reset unread count when user opens a conversation
  const handleSetActiveConversation = (conv) => {
    setActiveConversation(conv);
    if (conv) {
      setUnreadMap(prev => ({ ...prev, [conv.id]: 0 }));
    }
  };

  return (
    <CallProvider stompClient={stompClient} connected={connected} currentUser={currentUser}>
      <div className="chat-layout animate-fade-in" style={{ padding: '24px' }}>
        <div className="glass" style={{ display: 'flex', width: '100%', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <Sidebar 
            conversations={conversations} 
            setConversations={setConversations}
            activeConversation={activeConversation}
            setActiveConversation={handleSetActiveConversation}
            presenceMap={presenceMap}
            stompClient={stompClient}
            connected={connected}
            lastMessageMap={lastMessageMap}
            unreadMap={unreadMap}
          />
          <ChatWindow 
            activeConversation={activeConversation}
            stompClient={stompClient}
            connected={connected}
            presenceMap={presenceMap}
            onMessagesChange={setActiveChatMessages}
          />
        </div>
      </div>
    </CallProvider>
  );
};

export default Chat;
