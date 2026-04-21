import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, RefreshCw, X, ChevronRight, Clock, AlertTriangle,
  CheckCircle2, ListTodo, BarChart3, MessageSquare, Zap, Target,
  Calendar, TrendingUp, Brain
} from 'lucide-react';
import api from '../services/api';

// ─────────────────────────── helpers ────────────────────────────
const fmt = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d - now;
  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays < 0) return { label: `Quá hạn ${Math.abs(diffDays)} ngày`, color: '#ef4444', urgent: true };
  if (diffDays === 0) return { label: 'Hôm nay', color: '#f59e0b', urgent: true };
  if (diffDays === 1) return { label: 'Ngày mai', color: '#f59e0b', urgent: false };
  return {
    label: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`,
    color: diffDays <= 3 ? '#f59e0b' : '#10b981',
    urgent: false
  };
};

const priorityMeta = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Cao',    glow: '0 0 10px rgba(239,68,68,0.4)' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Trung',  glow: '0 0 10px rgba(245,158,11,0.3)' },
  LOW:    { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Thấp',   glow: '0 0 10px rgba(16,185,129,0.3)' },
};
const pm = (p) => priorityMeta[p?.toUpperCase()] || priorityMeta.LOW;

const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}`;
};

// ─────────────────────────── Skeleton ───────────────────────────
const Skeleton = ({ h = 16, w = '100%', r = 8 }) => (
  <div className="ai-skeleton" style={{ height: h, width: w, borderRadius: r }} />
);

// ─────────────────────────── Summary Tab ────────────────────────
const SummaryTab = ({ insight, loading }) => {
  if (loading) return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={18} w="80%" />
      <Skeleton h={14} w="100%" />
      <Skeleton h={14} w="90%" />
      <Skeleton h={14} w="75%" />
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <Skeleton h={44} w="32%" r={12} />
        <Skeleton h={44} w="32%" r={12} />
        <Skeleton h={44} w="32%" r={12} />
      </div>
    </div>
  );

  if (!insight || !insight.summary) return (
    <div className="ai-empty-state">
      <Brain size={40} opacity={0.3} />
      <p>Nhấn <strong>"Phân tích"</strong> để AI tổng hợp tin nhắn</p>
    </div>
  );

  const nextDl = insight.nextDeadlineAt ? fmt(insight.nextDeadlineAt) : null;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { icon: <ListTodo size={16} />, val: insight.openTaskCount, label: 'Task mở', color: '#8b5cf6' },
          { icon: <AlertTriangle size={16} />, val: insight.overdueTaskCount, label: 'Quá hạn', color: '#ef4444' },
          { icon: <MessageSquare size={16} />, val: insight.sourceMessageCount, label: 'Tin nhắn', color: '#3b82f6' },
        ].map((s, i) => (
          <div key={i} className="ai-stat-card" style={{ borderColor: s.color + '40' }}>
            <div style={{ color: s.color, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Focus topic */}
      {insight.focusTopic && (
        <div className="ai-focus-badge">
          <Target size={13} />
          <span>Chủ đề: <strong>{insight.focusTopic}</strong></span>
        </div>
      )}

      {/* Summary text */}
      <div className="ai-summary-box">
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-main)', margin: 0 }}>
          {insight.summary}
        </p>
      </div>

      {/* Bullets */}
      {insight.summaryBullets?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {insight.summaryBullets.map((b, i) => (
            <div key={i} className="ai-bullet">
              <ChevronRight size={14} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next deadline */}
      {nextDl && (
        <div className={`ai-deadline-banner ${nextDl.urgent ? 'urgent' : ''}`}>
          <Calendar size={14} />
          <span>Deadline gần nhất: <strong>{nextDl.label}</strong></span>
        </div>
      )}

      {/* Generated at */}
      {insight.generatedAt && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <Clock size={10} /> Cập nhật lúc {fmtTime(insight.generatedAt)}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────── Task List Tab ──────────────────────
const TaskListTab = ({ tasks, loading }) => {
  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1,2,3].map(i => <div key={i} className="ai-task-card-skeleton"><Skeleton h={14} w="70%" /><Skeleton h={11} w="90%" /><Skeleton h={11} w="50%" /></div>)}
    </div>
  );
  if (!tasks || tasks.length === 0) return (
    <div className="ai-empty-state">
      <CheckCircle2 size={40} opacity={0.3} />
      <p>Chưa có task nào được nhận diện.<br /><span style={{fontSize:11}}>Hãy phân tích tin nhắn trước.</span></p>
    </div>
  );

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tasks.map((task, i) => {
        const meta = pm(task.priority);
        const dl = task.dueAt ? fmt(task.dueAt) : null;
        const confidence = Math.round((task.confidenceScore || 0) * 100);
        return (
          <div key={task.taskId || i} className="ai-task-card" style={{ borderLeftColor: meta.color, background: meta.bg }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.4, flex: 1 }}>{task.title}</span>
              <span className="ai-priority-badge" style={{ background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}40` }}>
                {meta.label}
              </span>
            </div>
            {/* Description */}
            {task.description && task.description !== task.title && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                {task.description.length > 100 ? task.description.slice(0, 100) + '...' : task.description}
              </p>
            )}
            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {dl ? (
                <span className="ai-deadline-chip" style={{ color: dl.color, borderColor: dl.color + '50', background: dl.color + '15' }}>
                  <Calendar size={10} />{dl.label}
                </span>
              ) : (
                <span className="ai-deadline-chip" style={{ color: 'var(--text-muted)', borderColor: 'var(--border-color)' }}>
                  <Calendar size={10} />Chưa có deadline
                </span>
              )}
              {/* Confidence bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 40, height: 4, borderRadius: 4, background: 'var(--border-color)', overflow: 'hidden' }}>
                  <div style={{ width: `${confidence}%`, height: '100%', background: meta.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{confidence}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────── Gantt Chart Tab ────────────────────
const GanttTab = ({ tasks, loading }) => {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const tasksWithDue = tasks?.filter(t => t.dueAt) || [];

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (tasksWithDue.length === 0) return;

    const now = new Date();
    const nowTs = now.getTime();
    const allDates = tasksWithDue.map(t => new Date(t.dueAt).getTime());
    const minTs = Math.min(nowTs - 86400000, ...allDates);
    const maxTs = Math.max(nowTs + 86400000 * 2, ...allDates) + 86400000;
    const span = maxTs - minTs;

    const LABEL_W = 110;
    const ROW_H = 36;
    const BAR_H = 18;
    const TOP_PAD = 32;
    const BAR_PAD = (ROW_H - BAR_H) / 2;
    const chartW = W - LABEL_W - 16;

    // Background alternating rows
    tasksWithDue.forEach((_, i) => {
      const y = TOP_PAD + i * ROW_H;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
      ctx.fillRect(0, y, W, ROW_H);
    });

    // Draw grid lines (day markers)
    const dayMs = 86400000;
    const startDay = new Date(minTs);
    startDay.setHours(0, 0, 0, 0);
    let d = startDay.getTime();
    ctx.font = '9px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    while (d <= maxTs) {
      const x = LABEL_W + ((d - minTs) / span) * chartW;
      const date = new Date(d);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x, TOP_PAD - 20, 1, H - TOP_PAD + 20);
      if (x > LABEL_W + 10) {
        ctx.fillStyle = 'rgba(148,163,184,0.5)';
        ctx.fillText(`${date.getDate()}/${date.getMonth()+1}`, x - 10, TOP_PAD - 8);
      }
      d += dayMs;
    }

    // TODAY line
    const todayX = LABEL_W + ((nowTs - minTs) / span) * chartW;
    const grad = ctx.createLinearGradient(todayX, TOP_PAD, todayX, H);
    grad.addColorStop(0, 'rgba(239,68,68,0.9)');
    grad.addColorStop(1, 'rgba(239,68,68,0.1)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(todayX, TOP_PAD - 4);
    ctx.lineTo(todayX, H - 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.fillText('HÔM NAY', todayX + 3, TOP_PAD - 5);

    // Draw bars
    tasksWithDue.forEach((task, i) => {
      const dueTs = new Date(task.dueAt).getTime();
      const startTs = Math.max(minTs, dueTs - 2 * dayMs);
      const x1 = LABEL_W + ((startTs - minTs) / span) * chartW;
      const x2 = LABEL_W + ((dueTs - minTs) / span) * chartW;
      const barW = Math.max(x2 - x1, 30);
      const y = TOP_PAD + i * ROW_H + BAR_PAD;
      const meta = pm(task.priority);
      const isOverdue = dueTs < nowTs;

      // Bar gradient
      const barGrad = ctx.createLinearGradient(x1, y, x1 + barW, y);
      barGrad.addColorStop(0, meta.color + 'aa');
      barGrad.addColorStop(1, meta.color);
      ctx.fillStyle = barGrad;
      ctx.shadowColor = meta.color;
      ctx.shadowBlur = isOverdue ? 8 : 4;
      // Rounded rect
      const r = BAR_H / 2;
      ctx.beginPath();
      ctx.moveTo(x1 + r, y);
      ctx.lineTo(x1 + barW - r, y);
      ctx.quadraticCurveTo(x1 + barW, y, x1 + barW, y + r);
      ctx.quadraticCurveTo(x1 + barW, y + BAR_H, x1 + barW - r, y + BAR_H);
      ctx.lineTo(x1 + r, y + BAR_H);
      ctx.quadraticCurveTo(x1, y + BAR_H, x1, y + r);
      ctx.quadraticCurveTo(x1, y, x1 + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Overdue stripe pattern
      if (isOverdue) {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 3;
        for (let sx = x1 - BAR_H; sx < x1 + barW; sx += 8) {
          ctx.beginPath();
          ctx.moveTo(sx, y);
          ctx.lineTo(sx + BAR_H, y + BAR_H);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Task label (left side)
      ctx.fillStyle = 'rgba(248,250,252,0.85)';
      ctx.font = '11px Inter, sans-serif';
      const label = task.title.length > 14 ? task.title.slice(0, 13) + '…' : task.title;
      ctx.textAlign = 'right';
      ctx.fillText(label, LABEL_W - 8, TOP_PAD + i * ROW_H + ROW_H / 2 + 4);
      ctx.textAlign = 'left';
    });
  }, [tasksWithDue]);

  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(120, tasksWithDue.length * 36 + 56);
      drawChart();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [drawChart, tasksWithDue.length]);

  // Tooltip on hover
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || tasksWithDue.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const my = e.clientY - rect.top;
    const TOP_PAD = 32;
    const ROW_H = 36;
    const idx = Math.floor((my - TOP_PAD) / ROW_H);
    if (idx >= 0 && idx < tasksWithDue.length) {
      const t = tasksWithDue[idx];
      setTooltip({ task: t, x: e.clientX - rect.left, y: e.clientY - rect.top });
    } else {
      setTooltip(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton h={200} r={12} />
    </div>
  );

  if (tasksWithDue.length === 0) return (
    <div className="ai-empty-state">
      <BarChart3 size={40} opacity={0.3} />
      <p>Chưa có task nào có deadline.<br /><span style={{fontSize:11}}>AI sẽ tự động nhận diện deadline từ tin nhắn.</span></p>
    </div>
  );

  return (
    <div style={{ padding: '12px 8px' }}>
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16, padding: '0 8px' }}>
        {[
          { color: '#ef4444', label: 'Cao' },
          { color: '#f59e0b', label: 'Trung' },
          { color: '#10b981', label: 'Thấp' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 2, background: '#ef4444', borderTop: '2px dashed #ef4444' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Hôm nay</span>
        </div>
      </div>

      <div style={{ position: 'relative', background: 'rgba(15,23,42,0.5)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          style={{ display: 'block', cursor: 'crosshair' }}
        />
        {tooltip && (
          <div className="ai-gantt-tooltip" style={{ left: Math.min(tooltip.x + 12, 220), top: tooltip.y + 12 }}>
            <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 4, color: pm(tooltip.task.priority).color }}>
              {tooltip.task.title}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Priority: {pm(tooltip.task.priority).label}<br />
              Deadline: {fmt(tooltip.task.dueAt)?.label || 'Không có'}<br />
              Độ tin cậy: {Math.round((tooltip.task.confidenceScore || 0) * 100)}%
            </div>
          </div>
        )}
      </div>

      {/* Task list below chart */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
        {tasksWithDue.map((t, i) => {
          const dl = fmt(t.dueAt);
          const meta = pm(t.priority);
          return (
            <div key={t.taskId || i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
              <span style={{ fontSize: 10, color: dl?.color || 'var(--text-muted)', whiteSpace: 'nowrap' }}>{dl?.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────── Main AiPanel ───────────────────────
const AiPanel = ({ conversationId, onClose, stompClient, connected }) => {
  const [tab, setTab] = useState('summary');
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [autoUpdated, setAutoUpdated] = useState(false); // badge khi AI tự cập nhật

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadInsight = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const res = await api.get(`/ai/conversations/${conversationId}`);
      setInsight(res.data);
    } catch (err) {
      console.error('Failed to load AI insight', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setInsight(null);
    setTab('summary');
    setAutoUpdated(false);
    loadInsight();
  }, [conversationId, loadInsight]);

  // ── Subscribe WebSocket: auto-update khi backend push AI insight mới ──
  useEffect(() => {
    if (!stompClient || !connected || !conversationId) return;
    const topic = `/topic/conversations/${conversationId}/ai`;
    const sub = stompClient.subscribe(topic, (message) => {
      try {
        const newInsight = JSON.parse(message.body);
        setInsight(newInsight);
        setAutoUpdated(true);
        // Hiện badge "Đã cập nhật" 4 giây rồi tắt
        setTimeout(() => setAutoUpdated(false), 4000);
      } catch (e) {
        console.error('Failed to parse AI insight from WebSocket', e);
      }
    });
    return () => sub.unsubscribe();
  }, [stompClient, connected, conversationId]);

  const handleRefresh = async () => {
    if (!conversationId || refreshing) return;
    setRefreshing(true);
    try {
      const res = await api.post(`/ai/conversations/${conversationId}/refresh`);
      setInsight(res.data);
      showToast('Đã phân tích xong!', 'success');
    } catch (err) {
      console.error('Failed to refresh insight', err);
      showToast('Phân tích thất bại!', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const tasks = insight?.tasks || [];
  const tabs = [
    { id: 'summary', icon: <Brain size={14} />, label: 'Tóm tắt' },
    { id: 'tasks',   icon: <ListTodo size={14} />, label: `Tasks${tasks.length > 0 ? ` (${tasks.length})` : ''}` },
    { id: 'chart',   icon: <BarChart3 size={14} />, label: 'Biểu đồ' },
  ];

  return (
    <div className="ai-panel animate-slide-in-right">
      {/* Header */}
      <div className="ai-panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ai-icon-wrapper">
            <Sparkles size={16} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>AI Insights</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Phân tích thông minh</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {autoUpdated && (
            <span style={{
              fontSize: 10,
              background: 'rgba(16,185,129,0.2)',
              color: '#10b981',
              border: '1px solid rgba(16,185,129,0.4)',
              borderRadius: 20,
              padding: '2px 8px',
              fontWeight: 600,
              animation: 'fadeIn 0.3s ease',
            }}>✓ Tự cập nhật</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="ai-refresh-btn"
            title="Phân tích thủ công"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Đang phân tích...' : 'Phân tích'}</span>
          </button>
          <button onClick={onClose} className="ai-close-btn" title="Đóng">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ai-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`ai-tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="ai-panel-content">
        {tab === 'summary' && <SummaryTab insight={insight} loading={loading} />}
        {tab === 'tasks'   && <TaskListTab tasks={tasks} loading={loading} />}
        {tab === 'chart'   && <GanttTab tasks={tasks} loading={loading} />}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`ai-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AiPanel;
