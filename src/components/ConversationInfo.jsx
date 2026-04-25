import React, { useState } from 'react';
import { 
  User, BellOff, Search, ChevronDown, ChevronUp, Pin, 
  Palette, Heart, Type, Image as ImageIcon, FileText, 
  Lock, Shield, Clock, Eye, UserMinus, Ban, AlertCircle,
  Info, ChevronRight
} from 'lucide-react';
import { getConversationName } from '../utils/chatUtils';
import MediaList from './MediaList';

const InfoSection = ({ title, isOpen, onToggle, children }) => {
  return (
    <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontWeight: '600',
          fontSize: '15px',
          cursor: 'pointer'
        }}
      >
        <span>{title}</span>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && (
        <div style={{ padding: '0 8px 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const InfoItem = ({ icon: Icon, label, value, onClick, color }) => {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: '50%', 
        background: color || 'rgba(255, 255, 255, 0.1)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={18} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ fontSize: '14px', fontWeight: '500' }}>{label}</div>
        {value && <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>{value}</div>}
      </div>
    </button>
  );
};

const ConversationInfo = ({ activeConversation, currentUser, messages = [], onClose }) => {
  const [subView, setSubView] = useState('main'); // 'main' | 'media' | 'files'
  const [openSections, setOpenSections] = useState({
    chatInfo: true,
    customization: true,
    media: true,
    privacy: true
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const roomName = getConversationName(activeConversation, currentUser);
  const otherMember = activeConversation?.type === 'PRIVATE' 
    ? activeConversation.members?.find(m => m.id !== currentUser.id)
    : null;

  if (subView === 'media') {
    return (
      <div className="animate-slide-in-right" style={{ width: '340px', minWidth: '340px', height: '100%', borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <MediaList messages={messages} onClose={() => setSubView('main')} />
      </div>
    );
  }

  return (
    <div className="animate-slide-in-right" style={{
      width: '340px',
      minWidth: '340px',
      height: '100%',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto'
    }}>
      {/* Header Profile */}
      <div style={{ 
        padding: '32px 16px 24px 16px', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <div className="avatar" style={{ 
          width: '80px', 
          height: '80px', 
          fontSize: '32px', 
          marginBottom: '16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          {otherMember?.avatarPath ? (
            <img src={otherMember.avatarPath} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            roomName.charAt(0).toUpperCase()
          )}
        </div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px 0', color: 'white' }}>{roomName}</h3>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          padding: '4px 12px', 
          background: 'rgba(255, 255, 255, 0.08)', 
          borderRadius: '20px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <Lock size={12} />
          <span>Được mã hóa đầu cuối</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '24px', 
        padding: '0 16px 24px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button className="icon" style={{ width: '40px', height: '40px', background: 'rgba(255, 255, 255, 0.1)' }}>
            <User size={20} />
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>Trang cá n...</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button className="icon" style={{ width: '40px', height: '40px', background: 'rgba(255, 255, 255, 0.1)' }}>
            <BellOff size={20} />
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>Tắt thông báo</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button className="icon" style={{ width: '40px', height: '40px', background: 'rgba(255, 255, 255, 0.1)' }}>
            <Search size={20} />
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>Tìm kiếm</span>
        </div>
      </div>

      {/* Sections */}
      <InfoSection 
        title="Thông tin về đoạn chat" 
        isOpen={openSections.chatInfo} 
        onToggle={() => toggleSection('chatInfo')}
      >
        <InfoItem icon={Pin} label="Xem tin nhắn đã ghim" />
      </InfoSection>

      <InfoSection 
        title="Tùy chỉnh đoạn chat" 
        isOpen={openSections.customization} 
        onToggle={() => toggleSection('customization')}
      >
        <InfoItem icon={Palette} label="Đổi chủ đề" color="rgba(168, 85, 247, 0.2)" />
        <InfoItem icon={Heart} label="Thay đổi biểu tượng cảm xúc" color="rgba(239, 68, 68, 0.2)" />
        <InfoItem icon={Type} label="Chỉnh sửa biệt danh" />
      </InfoSection>

      <InfoSection 
        title="File phương tiện & file" 
        isOpen={openSections.media} 
        onToggle={() => toggleSection('media')}
      >
        <InfoItem icon={ImageIcon} label="File phương tiện" onClick={() => setSubView('media')} />
        <InfoItem icon={FileText} label="File" />
      </InfoSection>

      <InfoSection 
        title="Quyền riêng tư và hỗ trợ" 
        isOpen={openSections.privacy} 
        onToggle={() => toggleSection('privacy')}
      >
        <InfoItem icon={BellOff} label="Tắt thông báo" />
        <InfoItem icon={Shield} label="Quyền nhắn tin" />
        <InfoItem icon={Clock} label="Tin nhắn tự hủy" />
        <InfoItem icon={Eye} label="Thông báo đã đọc" value="Tắt" />
        <InfoItem icon={Lock} label="Xác minh mã hóa đầu cuối" />
        <InfoItem icon={UserMinus} label="Hạn chế" />
        <InfoItem icon={Ban} label="Chặn" />
        <InfoItem icon={AlertCircle} label="Báo cáo" value="Đóng góp ý kiến và báo cáo cuộc trò chuyện" />
      </InfoSection>

      {/* Close button for mobile or compact view if needed */}
      <div style={{ padding: '20px', marginTop: 'auto' }}>
        <button 
          onClick={onClose}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#f87171', 
            borderRadius: '10px',
            fontWeight: '600'
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  );
};

export default ConversationInfo;
