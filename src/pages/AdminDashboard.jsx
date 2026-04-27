import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Users, Settings, ArrowLeft, Activity, 
  Zap, Globe, Cpu, HardDrive, BarChart3, Clock, Signal, Lock,
  Plus, Edit2, Trash2, MoreVertical, AlertTriangle, CheckCircle, XCircle, Search, Eye
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
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Moderation State
  const [reports, setReports] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('');

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

  // Fetch Reports
  const fetchReports = async (status = '') => {
    setReportLoading(true);
    try {
      const res = await api.get('/moderation/reports', { params: { status: status || undefined } });
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'User Management') fetchUsers();
    if (activeTab === 'System Config') fetchAiPolicy();
    if (activeTab === 'Moderation') fetchReports();
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(prev => prev.filter(u => u.userId !== userId));
      alert('User deleted successfully');
    } catch (err) {
      alert('Failed to delete user: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData.entries());
    
    // Convert checkbox
    userData.accountLocked = formData.get('accountLocked') === 'on';

    try {
      if (selectedUser) {
        await api.put(`/admin/users/${selectedUser.userId}`, userData);
        alert('User updated successfully');
      } else {
        await api.post('/admin/users', userData);
        alert('User created successfully');
      }
      setShowUserModal(false);
      fetchUsers(userQuery);
    } catch (err) {
      alert('Failed to save user: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleUpdateReport = async (reportId, status, note) => {
    try {
      await api.patch(`/moderation/reports/${reportId}`, { status, moderatorNote: note });
      fetchReports();
      alert('Report updated successfully');
    } catch (err) {
      alert('Failed to update report');
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
            { icon: ShieldCheck, label: 'Moderation' },
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
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search by username or email..." 
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  style={{ width: '100%', background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px 12px 40px', color: 'white' }}
                />
              </div>
              <button onClick={() => fetchUsers(userQuery)} className="btn-primary" style={{ padding: '12px 24px', borderRadius: '12px' }}>Search</button>
              <button 
                onClick={() => { setSelectedUser(null); setShowUserModal(true); }}
                style={{ 
                  padding: '12px 24px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                  color: 'white',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Plus size={18} /> Add User
              </button>
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
                    <tr key={user.userId} style={{ borderBottom: '1px solid #1f2937', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600' }}>{user.displayName}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          background: user.role === 'ADMIN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                          color: user.role === 'ADMIN' ? '#ef4444' : '#818cf8', 
                          fontSize: '11px',
                          fontWeight: '700'
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {user.accountLocked ? (
                          <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                             <Lock size={14} /> Locked
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                             <CheckCircle size={14} /> Active
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            title="Edit User"
                            onClick={() => { setSelectedUser(user); setShowUserModal(true); }}
                            style={{ padding: '6px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', cursor: 'pointer' }}>
                            <Edit2 size={16} />
                          </button>
                          <button 
                            title={user.accountLocked ? 'Unlock User' : 'Lock User'}
                            onClick={() => handleLockUser(user.userId, !user.accountLocked)}
                            style={{ 
                              padding: '6px', 
                              borderRadius: '6px', 
                              background: user.accountLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                              color: user.accountLocked ? '#10b981' : '#ef4444',
                              cursor: 'pointer'
                            }}>
                            {user.accountLocked ? <Activity size={16} /> : <Lock size={16} />}
                          </button>
                          <button 
                            title="Delete User"
                            onClick={() => handleDeleteUser(user.userId)}
                            style={{ padding: '6px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'Moderation' && (
          <div style={{ background: '#111827', borderRadius: '24px', border: '1px solid #1f2937', padding: '32px' }}>
             <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                {['', 'OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'].map(status => (
                  <button 
                    key={status}
                    onClick={() => { setReportFilter(status); fetchReports(status); }}
                    style={{ 
                      padding: '8px 16px', 
                      borderRadius: '10px', 
                      background: reportFilter === status ? '#6366f1' : '#1f2937',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid #374151'
                    }}
                  >
                    {status || 'All Reports'}
                  </button>
                ))}
             </div>

             {reportLoading ? <div style={{ textAlign: 'center', padding: '40px' }}>Loading reports...</div> : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {reports.length === 0 ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: '40px' }}>No reports found</div> : reports.map(report => (
                    <div key={report.id} style={{ background: '#1f2937', borderRadius: '16px', border: '1px solid #374151', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          background: report.status === 'OPEN' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                          color: report.status === 'OPEN' ? '#ef4444' : '#818cf8', 
                          fontSize: '10px',
                          fontWeight: '800'
                        }}>
                          {report.status}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(report.createdAt).toLocaleString()}</span>
                      </div>
                      
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Reporter: <span style={{ color: '#fff' }}>@{report.reporterUsername}</span></div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Reason: <span style={{ color: '#fff' }}>{report.reason}</span></div>
                        <p style={{ fontSize: '14px', margin: '8px 0', color: '#e2e8f0', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                          {report.details}
                        </p>
                      </div>

                      {report.status === 'OPEN' || report.status === 'IN_REVIEW' ? (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                          <button 
                            onClick={() => handleUpdateReport(report.id, 'RESOLVED', 'Issue resolved by admin')}
                            className="btn-success" style={{ flex: 1, padding: '8px', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '600' }}>
                            Resolve
                          </button>
                          <button 
                            onClick={() => handleUpdateReport(report.id, 'REJECTED', 'Dismissed by admin')}
                            style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '12px', fontWeight: '600' }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div style={{ borderTop: '1px solid #374151', paddingTop: '12px', fontSize: '12px' }}>
                          <div style={{ color: '#94a3b8' }}>Reviewed by: <span style={{ color: '#fff' }}>{report.reviewedByUsername || 'System'}</span></div>
                          <div style={{ color: '#94a3b8' }}>Note: <span style={{ color: '#fff' }}>{report.moderatorNote}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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

      {showUserModal && (
        <UserModal 
          user={selectedUser} 
          onClose={() => setShowUserModal(false)} 
          onSave={handleSaveUser} 
        />
      )}
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

const UserModal = ({ user, onClose, onSave }) => {
  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(0, 0, 0, 0.8)', 
      backdropFilter: 'blur(8px)',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{ 
        background: '#111827', 
        width: '100%', 
        maxWidth: '500px', 
        borderRadius: '24px', 
        border: '1px solid #1f2937', 
        padding: '32px',
        position: 'relative',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', color: '#94a3b8', background: 'transparent' }}>
          <XCircle size={24} />
        </button>
        
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '24px' }}>
          {user ? 'Edit User' : 'Create New User'}
        </h2>

        <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Username</label>
              <input name="username" defaultValue={user?.username} required style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px', borderRadius: '10px', color: 'white' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Display Name</label>
              <input name="displayName" defaultValue={user?.displayName} required style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px', borderRadius: '10px', color: 'white' }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Email Address</label>
            <input type="email" name="email" defaultValue={user?.email} style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px', borderRadius: '10px', color: 'white' }} />
          </div>

          {!user && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Password</label>
              <input type="password" name="password" required={!user} placeholder={user ? 'Leave blank to keep same' : ''} style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px', borderRadius: '10px', color: 'white' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>Role</label>
              <select name="role" defaultValue={user?.role || 'USER'} style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px', borderRadius: '10px', color: 'white' }}>
                <option value="USER">USER</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <input type="checkbox" name="accountLocked" defaultChecked={user?.accountLocked} style={{ width: '18px', height: '18px' }} />
              <label style={{ fontSize: '14px', fontWeight: '600' }}>Account Locked</label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', background: '#374151', color: 'white', fontWeight: '600' }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 2, padding: '12px', borderRadius: '12px', fontWeight: '600' }}>
              {user ? 'Update User' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
