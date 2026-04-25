export const getConversationName = (conv, currentUser) => {
    if (!conv) return 'Chat';
    if (conv.type === 'PRIVATE' && conv.members) {
        const otherMember = conv.members.find(m => m.id !== currentUser?.id);
        return otherMember ? (otherMember.displayName || otherMember.username) : 'Private Chat';
    }
    return conv.name || 'Group Chat';
};

export const formatLastSeen = (lastSeenAt) => {
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

export const formatDateDivider = (d) => {
  const date = new Date(d);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const day = days[date.getDay()];
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${day} ${dd}/${mm}/${yyyy}`;
};

export const isDifferentDay = (d1, d2) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getDate() !== date2.getDate() ||
         date1.getMonth() !== date2.getMonth() ||
         date1.getFullYear() !== date2.getFullYear();
};

export const formatTime = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const formatMessagePreview = (msg, currentUser) => {
  if (!msg) return '...';
  const isMe = msg.sender?.id === currentUser?.id || msg.senderId === currentUser?.id;
  const prefix = isMe ? 'Bạn: ' : '';
  const msgType = msg.messageType || msg.type;
  const content = msg.content || '';

  if (msgType === 'IMAGE') return `${prefix}📷 Ảnh`;
  if (msgType === 'VIDEO') return `${prefix}🎥 Video`;
  
  if (msgType === 'SYSTEM' && content.startsWith('CALL_LOG|')) {
    const parts = content.split('|');
    const mode = parts[2];
    const status = parts[3];
    const callerId = parts[5];
    
    const amICaller = currentUser?.id === callerId;
    const isMissed = status === 'MISSED' || status === 'REJECTED';
    
    if (isMissed && !amICaller) {
      return '📞 Cuộc gọi nhỡ';
    }
    
    const typeStr = mode === 'VIDEO' ? 'video' : 'thoại';
    const direction = amICaller ? 'đi' : 'đến';
    return `📞 Cuộc gọi ${typeStr} ${direction}`;
  }
  
  return `${prefix}${content}`;
};
