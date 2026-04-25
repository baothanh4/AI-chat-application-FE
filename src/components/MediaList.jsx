import React from 'react';
import { ArrowLeft, Play } from 'lucide-react';

const MediaList = ({ messages, onClose }) => {
  // Filter messages that are images or videos
  const mediaMessages = messages.filter(m => {
    const type = m.messageType || m.type;
    return type === 'IMAGE' || type === 'VIDEO';
  });

  // Group by month
  const groupedMedia = mediaMessages.reduce((acc, msg) => {
    const date = new Date(msg.createdAt);
    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();
    const monthYear = isCurrentYear 
      ? `Tháng ${date.getMonth() + 1}` 
      : `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(msg);
    return acc;
  }, {});

  return (
    <div className="media-list-container" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(15, 23, 42, 0.95)',
      color: 'white'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <button onClick={onClose} className="icon" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>File phương tiện và file</h3>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0 16px'
      }}>
        <button style={{
          flex: 1,
          padding: '12px 0',
          background: 'transparent',
          borderBottom: '2px solid #3b82f6',
          color: '#3b82f6',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          File phương tiện
        </button>
        <button style={{
          flex: 1,
          padding: '12px 0',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '14px'
        }}>
          File
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {Object.keys(groupedMedia).length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', marginTop: '40px' }}>
            Không có file phương tiện nào
          </div>
        ) : (
          Object.entries(groupedMedia).map(([month, items]) => (
            <div key={month} style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '12px' }}>{month}</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2px'
              }}>
                {items.map((msg, idx) => {
                  const isVideo = (msg.messageType || msg.type) === 'VIDEO';
                  return (
                    <div key={msg.id || idx} style={{
                      aspectRatio: '1/1',
                      position: 'relative',
                      background: 'rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      overflow: 'hidden'
                    }}>
                      {isVideo ? (
                        <>
                          <video src={msg.content} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{
                            position: 'absolute',
                            bottom: '4px',
                            right: '4px',
                            background: 'rgba(0, 0, 0, 0.6)',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            <Play size={10} fill="white" />
                            <span>0:15</span> {/* Placeholder duration */}
                          </div>
                        </>
                      ) : (
                        <img src={msg.content} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MediaList;
