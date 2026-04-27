import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, FileText, Download, Loader2 } from 'lucide-react';
import api from '../services/api';

const MediaList = ({ conversationId, currentUser, onClose }) => {
  const [activeTab, setActiveTab] = useState('MEDIA'); // 'MEDIA' | 'FILE'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      try {
        const type = activeTab === 'MEDIA' ? 'IMAGE' : 'FILE';
        const res = await api.get(`/messages/conversations/${conversationId}/media`, {
          params: { actorUserId: currentUser.id, type }
        });
        
        let fetchedItems = res.data.messages || [];
        
        // If MEDIA, we also want VIDEO
        if (activeTab === 'MEDIA') {
          const videoRes = await api.get(`/messages/conversations/${conversationId}/media`, {
            params: { actorUserId: currentUser.id, type: 'VIDEO' }
          });
          fetchedItems = [...fetchedItems, ...(videoRes.data.messages || [])];
          fetchedItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        
        setItems(fetchedItems);
      } catch (err) {
        console.error("Failed to fetch media", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, [conversationId, currentUser.id, activeTab]);

  // Group by month
  const groupedItems = items.reduce((acc, msg) => {
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
        <button 
          onClick={() => setActiveTab('MEDIA')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'MEDIA' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'MEDIA' ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
          File phương tiện
        </button>
        <button 
          onClick={() => setActiveTab('FILE')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'FILE' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'FILE' ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer'
          }}>
          File
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="spin" /></div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)', marginTop: '40px' }}>
            Không có {activeTab === 'MEDIA' ? 'file phương tiện' : 'file'} nào
          </div>
        ) : (
          Object.entries(groupedItems).map(([month, monthItems]) => (
            <div key={month} style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '12px' }}>{month}</h4>
              
              {activeTab === 'MEDIA' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
                  {monthItems.map((msg, idx) => {
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
                            <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0, 0, 0, 0.6)', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <Play size={10} fill="white" />
                            </div>
                          </>
                        ) : (
                          <img src={msg.content} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {monthItems.map((msg, idx) => (
                    <div key={msg.id || idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {msg.content.split('/').pop()}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.4)' }}>
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <a href={msg.content} download className="icon" style={{ padding: '8px' }}>
                        <Download size={18} />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MediaList;
