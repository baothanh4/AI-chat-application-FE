import React from 'react';
import { X, Pin, MessageCircle, ArrowRight } from 'lucide-react';
import { formatTime, formatDateDivider } from '../utils/chatUtils';

const PinnedMessagesModal = ({ pins, onClose, onJumpTo }) => {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div className="animate-scale-in" style={{
        background: '#1e293b',
        width: '100%',
        maxWidth: '500px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: '8px', borderRadius: '12px', color: '#3b82f6' }}>
              <Pin size={20} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'white' }}>Tin nhắn đã ghim</h2>
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255, 255, 255, 0.5)', background: 'transparent' }}>
            <X size={24} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {pins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255, 255, 255, 0.4)' }}>
              <MessageCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <p>Chưa có tin nhắn nào được ghim</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pins.map(msg => (
                <div key={msg.id} style={{ 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  borderRadius: '16px', 
                  padding: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>@{msg.sender.username}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>{formatDateDivider(msg.createdAt)} {formatTime(msg.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: '14px', margin: 0, color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {msg.content}
                  </p>
                  <button 
                    onClick={() => onJumpTo(msg)}
                    style={{ 
                      marginTop: '12px', 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#3b82f6', 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      padding: 0
                    }}>
                    Đi tới tin nhắn <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PinnedMessagesModal;
