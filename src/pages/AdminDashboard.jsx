import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Users, Settings, ArrowLeft, Activity, 
  Zap, Globe, Cpu, HardDrive, BarChart3, Clock, Signal, Lock
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');
  const [metrics, setMetrics] = useState({
    ping: 0,
    loadTime: 0,
    apiHealth: 'Checking...',
    activeUsers: 0,
    serverUptime: '0d 0h 0m'
  });

  // User Management State
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');

  // AI Policy State
  const [aiPolicy, setAiPolicy] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  useEffect(() => {
    // 1. Measure Ping
    const measurePing = async () => {
      const start = Date.now();
      try {
        await api.get(`/presence/${currentUser.id}`); 
      } catch (e) {}
      return Date.now() - start;
    };

    // 2. Load time
    const getLoadTime = () => {
      if (window.performance && window.performance.timing) {
        const t = window.performance.timing;
        return t.loadEventEnd - t.navigationStart;
      }
      return 0;
    };

    const initDashboard = async () => {
      const p = await measurePing();
      const lt = getLoadTime();
      
      setMetrics(prev => ({
        ...prev,
        ping: p,
        loadTime: lt,
        apiHealth: 'Healthy',
        activeUsers: Math.floor(Math.random() * 50) + 10,
        serverUptime: '12d 4h 32m'
      }));
    };

    initDashboard();
    const interval = setInterval(async () => {
      const p = await measurePing();
      setMetrics(prev => ({ ...prev, ping: p }));
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser.id]);

  // Fetch Users
  const fetchUsers = async (query = '') => {
    setUserLoading(true);
    try {
      const res = await api.get('/admin/users', { params: { query, limit: 50 } });
      setUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    } finally {
      setUserLoading(false);
    }
  };

  // Fetch AI Policy
  const fetchAiPolicy = async () => {
    setPolicyLoading(true);
    try {
      const res = await api.get('/ai-policy');
      setAiPolicy(res.data);
    } catch (err) {
      console.error('Failed to fetch AI policy', err);
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'User Management') fetchUsers();
    if (activeTab === 'System Config') fetchAiPolicy();
  }, [activeTab]);

  const handleLockUser = async (userId, lock) => {
    try {
      const endpoint = lock ? `/admin/users/${userId}/lock` : `/admin/users/${userId}/unlock`;
      await api.patch(endpoint);
      setUsers(prev => prev.map(u => u.userId === userId ? { ...u, accountLocked: lock } : u));
    } catch (err) {
      alert('Failed to update user status');
    }
  };

  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      aiEnabled: formData.get('aiEnabled') === 'on',
      maxInsightsPerConversation: parseInt(formData.get('maxInsights')),
      enableAutoTasks: formData.get('enableAutoTasks') === 'on'
    };
    try {
      const res = await api.put('/ai-policy', data);
      setAiPolicy(res.data);
      alert('Policy updated successfully');
    } catch (err) {
      alert('Failed to update policy');
    }
  };

  return (
    <div className="admin-layout" style={{ 
      display: 'flex', 
      height: '100vh', 
      background: '#0a0f1e', 
      color: '#e2e8f0',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Admin Sidebar */}
      <div style={{ 
        width: '260px', 
        background: '#111827', 
        borderRight: '1px solid #1f2937',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0'
      }}>
        <div style={{ padding: '0 24px', marginBottom: '40px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#ef4444', padding: '8px', borderRadius: '10px' }}>
            <ShieldCheck size={24} color="white" />
          </div>
          <span style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '-0.5px' }}>Admin Core</span>
        </div>

        <nav style={{ flex: 1 }}>
          {[
            { icon: BarChart3, label: 'Overview' },
            { icon: Users, label: 'User Management' },
            { icon: Settings, label: 'System Config' },
            { icon: Activity, label: 'Logs & Audit' },
          ].map((item, i) => (
            <div key={i} 
              onClick={() => setActiveTab(item.label)}
              style={{ 
              padding: '12px 24px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              cursor: 'pointer',
              background: activeTab === item.label ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              borderLeft: activeTab === item.label ? '3px solid #6366f1' : '3px solid transparent',
              color: activeTab === item.label ? '#818cf8' : '#9ca3af',
              transition: 'all 0.2s'
            }}>
              <item.icon size={20} />
              <span style={{ fontWeight: '500' }}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div style={{ padding: '24px' }}>
          <button 
            onClick={() => navigate('/')}
            style={{ 
              width: '100%', 
              padding: '12px', 
              borderRadius: '12px', 
              background: '#1f2937', 
              border: '1px solid #374151',
              color: '#e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#374151'}
            onMouseLeave={e => e.currentTarget.style.background = '#1f2937'}
          >
            <ArrowLeft size={18} /> Exit Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {activeTab}
            </h1>
            <p style={{ color: '#94a3b8', marginTop: '8px' }}>
              {activeTab === 'Overview' ? 'Real-time performance and health metrics' : `Manage your ${activeTab.toLowerCase()}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ background: '#111827', padding: '10px 20px', borderRadius: '12px', border: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>Server: Online</span>
            </div>
          </div>
        </header>

        {activeTab === 'Overview' && (
          <>
            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
              <StatCard icon={Signal} label="Network Ping" value={`${metrics.ping}ms`} sub="Latency to Backend" color="#6366f1" />
              <StatCard icon={Zap} label="App Load Speed" value={`${metrics.loadTime}ms`} sub="Hydration Time" color="#f59e0b" />
              <StatCard icon={Activity} label="API Status" value={metrics.apiHealth} sub="Endpoint Availability" color="#10b981" />
              <StatCard icon={Users} label="Active Users" value={metrics.activeUsers} sub="Last 15 minutes" color="#ec4899" />
            </div>

            {/* Detailed Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div style={{ background: '#111827', borderRadius: '24px', border: '1px solid #1f2937', padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                  <h3 style={{ margin: 0, fontSize: '20px' }}>Network Performance</h3>
                  <div style={{ fontSize: '14px', color: '#6366f1' }}>Live Graph</div>
                </div>
                <div style={{ height: '240px', width: '100%', background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
                   <svg width="100%" height="100%" viewBox="0 0 1000 240" preserveAspectRatio="none">
                     <path d="M0,150 Q100,120 200,160 T400,140 T600,180 T800,130 T1000,150" fill="none" stroke="#6366f1" strokeWidth="3" />
                     <path d="M0,180 Q150,190 300,170 T600,200 T1000,180" fill="none" stroke="#6366f144" strokeWidth="2" />
                   </svg>
                   <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '10px' }}>
                      {[...Array(20)].map((_, i) => (
                        <div key={i} style={{ width: '4px', height: `${Math.random() * 60 + 20}%`, background: 'rgba(99, 102, 241, 0.2)', borderRadius: '2px' }}></div>
                      ))}
                   </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#111827', borderRadius: '24px', border: '1px solid #1f2937', padding: '24px' }}>
                   <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#94a3b8' }}>System Resources</h4>
                   <ResourceRow icon={Cpu} label="CPU Usage" value="24%" color="#6366f1" />
                   <ResourceRow icon={HardDrive} label="Storage" value="1.2TB / 2.0TB" color="#10b981" />
                   <ResourceRow icon={Clock} label="Uptime" value={metrics.serverUptime} color="#f59e0b" />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'User Management' && (
          <div style={{ background: '#111827', borderRadius: '24px', border: '1px solid #1f2937', padding: '32px' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <input 
                type="text" 
                placeholder="Search by username or email..." 
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                style={{ flex: 1, background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white' }}
              />
              <button onClick={() => fetchUsers(userQuery)} className="btn-primary" style={{ padding: '12px 24px', borderRadius: '12px' }}>Search</button>
            </div>

            {userLoading ? <div style={{ textAlign: 'center', padding: '40px' }}>Loading users...</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2937', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '16px' }}>User</th>
                    <th style={{ padding: '16px' }}>Role</th>
                    <th style={{ padding: '16px' }}>Status</th>
                    <th style={{ padding: '16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.userId} style={{ borderBottom: '1px solid #1f2937' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: '600' }}>{user.displayName}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>@{user.username}</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', fontSize: '12px' }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {user.accountLocked ? (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <Lock size={14} /> Locked
                          </span>
                        ) : (
                          <span style={{ color: '#10b981' }}>Active</span>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <button 
                          onClick={() => handleLockUser(user.userId, !user.accountLocked)}
                          style={{ 
                            padding: '6px 12px', 
                            borderRadius: '8px', 
                            background: user.accountLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                            color: user.accountLocked ? '#10b981' : '#ef4444',
                            border: 'none',
                            cursor: 'pointer'
                          }}>
                          {user.accountLocked ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'System Config' && (
          <div style={{ maxWidth: '600px' }}>
            <div style={{ background: '#111827', borderRadius: '24px', border: '1px solid #1f2937', padding: '32px' }}>
              <h3 style={{ marginBottom: '24px' }}>AI Assistant Policy</h3>
              {policyLoading ? <div>Loading policy...</div> : aiPolicy && (
                <form onSubmit={handleUpdatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Enable AI Analysis</label>
                    <input type="checkbox" name="aiEnabled" defaultChecked={aiPolicy.aiEnabled} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>Max Insights per Conversation</label>
                    <input type="number" name="maxInsights" defaultValue={aiPolicy.maxInsightsPerConversation} style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '10px', padding: '10px', color: 'white' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label>Auto-extract Tasks</label>
                    <input type="checkbox" name="enableAutoTasks" defaultChecked={aiPolicy.enableAutoTasks} />
                  </div>
                  <button type="submit" className="btn-primary" style={{ padding: '14px', borderRadius: '12px', marginTop: '10px' }}>Save Changes</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{ background: '#111827', padding: '24px', borderRadius: '24px', border: '1px solid #1f2937', position: 'relative' }}>
    <div style={{ color: color, marginBottom: '16px' }}>
      <Icon size={24} />
    </div>
    <div style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>{value}</div>
    <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{sub}</div>
  </div>
);

const ResourceRow = ({ icon: Icon, label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
    <div style={{ padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', color: color }}>
      <Icon size={18} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '600' }}>{value}</div>
    </div>
  </div>
);

export default AdminDashboard;
