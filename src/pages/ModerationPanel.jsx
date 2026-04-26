import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Flag, CheckCircle, ArrowLeft } from 'lucide-react';

const ModerationPanel = () => {
  const navigate = useNavigate();

  return (
    <div className="profile-container animate-fade-in" style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <button 
        onClick={() => navigate('/')} 
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}
      >
        <ArrowLeft size={20} /> Quay lại Chat
      </button>

      <div className="glass" style={{ padding: '32px', borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
            <AlertTriangle size={32} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', margin: 0 }}>Moderation Panel</h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Kiểm duyệt nội dung và báo cáo vi phạm</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flag size={20} color="#f87171" />
                <h3 style={{ margin: 0 }}>Báo cáo chưa xử lý (0)</h3>
              </div>
              <button className="btn-primary" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '13px' }}>Làm mới</button>
            </div>
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
              <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <p>Tuyệt vời! Không có báo cáo nào cần xử lý.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;
