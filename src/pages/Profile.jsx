import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Settings, UploadCloud, ArrowLeft, Lock, ScanFace,
  Eye, EyeOff, Camera, CheckCircle, XCircle, Shield, User, AlertTriangle,
  ZoomIn, ZoomOut, Move
} from 'lucide-react';

/* ─────────────────────────────── STYLES ─────────────────────────────── */
const tabStyle = (active) => ({
  flex: 1,
  padding: '12px 16px',
  background: active ? 'var(--accent-primary)' : 'transparent',
  border: 'none',
  borderRadius: '10px',
  color: active ? 'white' : 'var(--text-muted)',
  cursor: 'pointer',
  fontWeight: active ? '600' : '400',
  fontSize: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  transition: 'all 0.2s',
});

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: '10px',
  padding: '12px 14px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  fontSize: '14px',
  boxSizing: 'border-box',
};

/* ────────────────────────── AVATAR EDITOR MODAL ────────────────────── */

function AvatarEditor({ imageFile, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const stateRef = useRef({
    dragging: false,
    lastX: 0,
    lastY: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });
  const animFrameRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const SIZE = 340; // canvas size (square)

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      // Fit image to fill canvas initially
      const scaleToFill = Math.max(SIZE / img.width, SIZE / img.height);
      stateRef.current.scale = scaleToFill;
      stateRef.current.offsetX = (SIZE - img.width * scaleToFill) / 2;
      stateRef.current.offsetY = (SIZE - img.height * scaleToFill) / 2;
      setZoom(scaleToFill);
      draw();
    };
    img.src = URL.createObjectURL(imageFile);
    return () => URL.revokeObjectURL(img.src);
  }, [imageFile]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    const { offsetX, offsetY, scale } = stateRef.current;

    // Clear
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Draw image
    ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);

    // Circular clip overlay
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2, true);
    ctx.fill();
    // Circle border
    ctx.strokeStyle = 'rgba(99,102,241,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, []);

  // ── Pointer (mouse + touch) drag ──
  const onPointerDown = (e) => {
    e.preventDefault();
    const s = stateRef.current;
    s.dragging = true;
    const pos = getPos(e);
    s.lastX = pos.x;
    s.lastY = pos.y;
    canvasRef.current.style.cursor = 'grabbing';
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    const s = stateRef.current;
    if (!s.dragging) return;
    const pos = getPos(e);
    s.offsetX += pos.x - s.lastX;
    s.offsetY += pos.y - s.lastY;
    s.lastX = pos.x;
    s.lastY = pos.y;
    clampOffset();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  };

  const onPointerUp = () => {
    stateRef.current.dragging = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  };

  // ── Scroll to zoom ──
  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    applyZoom(delta);
  };

  // ── Touch pinch zoom ──
  const lastTouchDistRef = useRef(null);
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      lastTouchDistRef.current = getTouchDist(e.touches);
    } else {
      onPointerDown(e.touches[0]);
    }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getTouchDist(e.touches);
      if (lastTouchDistRef.current) {
        applyZoom(dist / lastTouchDistRef.current);
      }
      lastTouchDistRef.current = dist;
    } else {
      onPointerMove(e.touches[0]);
    }
  };
  const onTouchEnd = () => { lastTouchDistRef.current = null; onPointerUp(); };

  const getTouchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.pageX;
    const clientY = e.clientY ?? e.pageY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const applyZoom = (delta) => {
    const s = stateRef.current;
    const img = imgRef.current;
    if (!img) return;
    const minScale = Math.max(SIZE / img.width, SIZE / img.height) * 0.5;
    const maxScale = 5;
    const newScale = Math.min(maxScale, Math.max(minScale, s.scale * delta));
    // Zoom toward center
    const cx = SIZE / 2, cy = SIZE / 2;
    s.offsetX = cx - (cx - s.offsetX) * (newScale / s.scale);
    s.offsetY = cy - (cy - s.offsetY) * (newScale / s.scale);
    s.scale = newScale;
    setZoom(newScale);
    clampOffset();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
  };

  const clampOffset = () => {
    const s = stateRef.current;
    const img = imgRef.current;
    if (!img) return;
    const w = img.width * s.scale;
    const h = img.height * s.scale;
    // Keep circle area (full canvas) always covered
    if (w < SIZE) { s.offsetX = (SIZE - w) / 2; }
    else {
      s.offsetX = Math.min(0, Math.max(SIZE - w, s.offsetX));
    }
    if (h < SIZE) { s.offsetY = (SIZE - h) / 2; }
    else {
      s.offsetY = Math.min(0, Math.max(SIZE - h, s.offsetY));
    }
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    // Render clean circle crop to off-screen canvas
    const out = document.createElement('canvas');
    out.width = SIZE; out.height = SIZE;
    const ctx = out.getContext('2d');
    const { offsetX, offsetY, scale } = stateRef.current;
    // Clip to circle
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
    out.toBlob(blob => { if (blob) onConfirm(blob, URL.createObjectURL(blob)); }, 'image/jpeg', 0.92);
  };

  const zoomButtons = [
    { icon: <ZoomIn size={18} />, action: () => applyZoom(1.15), title: 'Phóng to' },
    { icon: <ZoomOut size={18} />, action: () => applyZoom(0.87), title: 'Thu nhỏ' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="glass animate-fade-in" style={{ borderRadius: '24px', padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', maxWidth: '420px', width: '100%' }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>
            <Move size={20} color="var(--accent-primary)" />
            Chỉnh ảnh đại diện
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Kéo để di chuyển · Cuộn hoặc pinch để zoom</p>
        </div>

        {/* Canvas */}
        <div ref={containerRef} style={{ position: 'relative', borderRadius: '50%', overflow: 'hidden', boxShadow: '0 0 0 3px rgba(99,102,241,0.5), 0 8px 32px rgba(0,0,0,0.5)' }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            style={{ display: 'block', cursor: 'grab', touchAction: 'none', borderRadius: '50%' }}
            onMouseDown={onPointerDown}
            onMouseMove={onPointerMove}
            onMouseUp={onPointerUp}
            onMouseLeave={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        </div>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {zoomButtons.map((btn, i) => (
            <button key={i} onClick={btn.action} title={btn.title}
              style={{ padding: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}>
              {btn.icon}
            </button>
          ))}
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '52px', textAlign: 'center' }}>
            {Math.round(zoom * 100 / (imgRef.current ? Math.max(SIZE / imgRef.current.width, SIZE / imgRef.current.height) : 1))}%
          </div>
          {/* Zoom slider */}
          <input type="range" min="50" max="300" value={Math.round(zoom * 100)} step="1"
            onChange={e => {
              const target = Number(e.target.value) / 100;
              const img = imgRef.current;
              if (!img) return;
              const base = Math.max(SIZE / img.width, SIZE / img.height);
              applyZoom(base * target / stateRef.current.scale);
            }}
            style={{ width: '100px', accentColor: 'var(--accent-primary)' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}>
            Huỷ
          </button>
          <button onClick={handleConfirm}
            style={{ flex: 1, padding: '13px', background: 'var(--accent-primary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── SUB-COMPONENTS ─────────────────────── */

function Alert({ type, children }) {
  const colors = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', text: '#f87171' },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)', text: '#4ade80' },
    warning: { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' },
  };
  const c = colors[type] || colors.error;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      padding: '12px 16px', borderRadius: '10px', fontSize: '14px',
      display: 'flex', alignItems: 'flex-start', gap: '8px'
    }}>
      {type === 'error' && <XCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
      {type === 'success' && <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
      {type === 'warning' && <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{children}</span>
    </div>
  );
}

function PasswordInput({ label, name, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder || '••••••••'}
          style={{ ...inputStyle, paddingRight: '44px' }}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(p => !p)}
          style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── TAB 1: PROFILE INFO ───────────────────────── */
function ProfileTab({ currentUser, updateProfile }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    displayName: '', fullName: '', email: '',
    phoneNumber: '', address: '', bio: '', dateOfBirth: '', gender: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [rawImageFile, setRawImageFile] = useState(null); // file waiting for editor
  const [showEditor, setShowEditor] = useState(false);
  const [status, setStatus] = useState(null); // { type, msg }
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        displayName: currentUser.displayName || '',
        fullName: currentUser.fullName || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
        address: currentUser.address || '',
        bio: currentUser.bio || '',
        dateOfBirth: currentUser.dateOfBirth || '',
        gender: currentUser.gender || ''
      });
      if (currentUser.avatarPath) setAvatarPreview(currentUser.avatarPath);
    }
  }, [currentUser]);

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  // When user picks a file → open editor instead of applying directly
  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // reset so same file can be re-picked
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { setStatus({ type: 'error', msg: 'File ảnh phải nhỏ hơn 15MB.' }); return; }
    setRawImageFile(file);
    setShowEditor(true);
    setStatus(null);
  };

  // User confirmed crop → get blob from editor
  const handleEditorConfirm = (blob, previewUrl) => {
    setAvatarFile(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    setAvatarPreview(previewUrl);
    setShowEditor(false);
    setRawImageFile(null);
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setRawImageFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.displayName.trim()) { setStatus({ type: 'error', msg: 'Tên hiển thị là bắt buộc.' }); return; }
    setStatus(null); setLoading(true);
    try {
      await updateProfile(currentUser.id, formData, avatarFile);
      setStatus({ type: 'success', msg: 'Cập nhật hồ sơ thành công!' });
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Lỗi khi cập nhật hồ sơ.' });
    } finally { setLoading(false); }
  };

  return (
    <>
      {/* Avatar Editor Modal */}
      {showEditor && rawImageFile && (
        <AvatarEditor
          imageFile={rawImageFile}
          onConfirm={handleEditorConfirm}
          onCancel={handleEditorCancel}
        />
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {status && <Alert type={status.type}>{status.msg}</Alert>}

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <label htmlFor="avatar-upload" style={{ cursor: 'pointer', flexShrink: 0, position: 'relative' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.2)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.75'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              {avatarPreview
                ? <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <UploadCloud color="rgba(255,255,255,0.4)" size={28} />}
            </div>
            {/* Edit hint overlay */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'transparent', transition: 'all 0.2s', pointerEvents: 'none' }}
              className="avatar-edit-hint" />
          </label>
          <input id="avatar-upload" type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Ảnh đại diện</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Click để chọn ảnh · Kéo &amp; zoom trong editor</div>
            {avatarPreview && (
              <button type="button" onClick={() => document.getElementById('avatar-upload').click()}
                style={{ marginTop: '8px', padding: '5px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#818cf8', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Chỉnh lại
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Tên hiển thị *</label>
            <input type="text" name="displayName" value={formData.displayName} onChange={handleChange} required style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Họ và tên</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Số điện thoại</label>
            <input type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Ngày sinh</label>
            <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Giới tính</label>
            <select name="gender" value={formData.gender} onChange={handleChange} style={{ ...inputStyle }}>
              <option value="">Chọn...</option>
              <option value="Male">Nam</option>
              <option value="Female">Nữ</option>
              <option value="Other">Khác</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Địa chỉ</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Giới thiệu bản thân</label>
            <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Chia sẻ đôi điều về bạn..." />
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ padding: '14px', background: loading ? 'var(--bg-panel-hover)' : 'var(--accent-primary)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
          {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>
    </>
  );
}

/* ──────────────────── TAB 2: CHANGE PASSWORD ────────────────────────── */
function ChangePasswordTab({ currentUser, changePassword }) {
  const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const getStrength = (pwd) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(form.newPassword);
  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Tốt', 'Mạnh'][strength];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#22c55e', '#6366f1'][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.oldPassword || !form.newPassword || !form.confirmNewPassword) {
      setStatus({ type: 'error', msg: 'Vui lòng điền đầy đủ tất cả các trường.' }); return;
    }
    if (form.newPassword !== form.confirmNewPassword) {
      setStatus({ type: 'error', msg: 'Mật khẩu mới và xác nhận không khớp.' }); return;
    }
    if (form.newPassword.length < 6) {
      setStatus({ type: 'error', msg: 'Mật khẩu mới phải có ít nhất 6 ký tự.' }); return;
    }
    setStatus(null); setLoading(true);
    try {
      await changePassword(currentUser.id, form.oldPassword, form.newPassword, form.confirmNewPassword);
      setStatus({ type: 'success', msg: 'Đổi mật khẩu thành công! Vui lòng đăng nhập lại nếu cần.' });
      setForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data || 'Đổi mật khẩu thất bại.';
      const isWrongOld = err.response?.status === 401;
      setStatus({ type: 'error', msg: isWrongOld ? 'Mật khẩu cũ không đúng.' : String(msg) });
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {status && <Alert type={status.type}>{status.msg}</Alert>}

      <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Shield size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          Mật khẩu mới nên có ít nhất <strong style={{ color: 'white' }}>8 ký tự</strong>, bao gồm chữ hoa, số và ký tự đặc biệt.
        </div>
      </div>

      <PasswordInput label="Mật khẩu hiện tại *" name="oldPassword" value={form.oldPassword} onChange={handleChange} placeholder="Nhập mật khẩu hiện tại" />
      <PasswordInput label="Mật khẩu mới *" name="newPassword" value={form.newPassword} onChange={handleChange} placeholder="Nhập mật khẩu mới" />

      {/* Password strength indicator */}
      {form.newPassword && (
        <div style={{ marginTop: '-12px' }}>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= strength ? strengthColor : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            ))}
          </div>
          <div style={{ fontSize: '12px', color: strengthColor }}>{strengthLabel}</div>
        </div>
      )}

      <PasswordInput label="Xác nhận mật khẩu mới *" name="confirmNewPassword" value={form.confirmNewPassword} onChange={handleChange} placeholder="Nhập lại mật khẩu mới" />

      {/* Match indicator */}
      {form.newPassword && form.confirmNewPassword && (
        <div style={{
          fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '-12px',
          color: form.newPassword === form.confirmNewPassword ? '#4ade80' : '#f87171'
        }}>
          {form.newPassword === form.confirmNewPassword
            ? <><CheckCircle size={14} /> Mật khẩu khớp</>
            : <><XCircle size={14} /> Mật khẩu không khớp</>}
        </div>
      )}

      <button type="submit" disabled={loading} style={{ padding: '14px', background: loading ? 'var(--bg-panel-hover)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '10px', color: 'white', fontWeight: '600', fontSize: '15px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
        {loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
}

/* ──────────────────── TAB 3: FACE ID MANAGEMENT ────────────────────── */
function FaceIdTab({ currentUser, disableFaceId, enableFaceId, deleteFaceId, updateFaceId }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null); // 'update' | null

  // Camera states
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [faceBlob, setFaceBlob] = useState(null);
  const [facePreview, setFacePreview] = useState(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (mode === 'update') {
      startCamera();
    } else {
      stopCamera();
      setFaceBlob(null);
      setFacePreview(null);
    }
  }, [mode]);

  // Auto-capture after 2s
  useEffect(() => {
    let t;
    if (mode === 'update' && isCameraActive && !faceBlob) {
      t = setTimeout(captureFace, 2000);
    }
    return () => clearTimeout(t);
  }, [mode, isCameraActive, faceBlob]);

  const startCamera = async () => {
    setStatus(null); setFaceBlob(null); setFacePreview(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      setStream(s);
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); setIsCameraActive(true); }
    } catch { setStatus({ type: 'error', msg: 'Không thể truy cập camera. Hãy cấp quyền camera.' }); }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsCameraActive(false);
  };

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(blob => {
      if (blob) { stopCamera(); setFacePreview(URL.createObjectURL(blob)); setFaceBlob(blob); }
      else { setStatus({ type: 'error', msg: 'Chụp ảnh thất bại. Thử lại.' }); }
    }, 'image/jpeg', 0.92);
  };

  const handleDisable = async () => {
    if (!window.confirm('Bạn có chắc muốn tắt đăng nhập bằng khuôn mặt?')) return;
    setLoading(true); setStatus(null);
    try {
      await disableFaceId(currentUser.id);
      setStatus({ type: 'success', msg: 'Đã tắt đăng nhập Face ID.' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Có lỗi xảy ra.' });
    } finally { setLoading(false); }
  };

  const handleEnable = async () => {
    setLoading(true); setStatus(null);
    try {
      await enableFaceId(currentUser.id);
      setStatus({ type: 'success', msg: 'Đã bật đăng nhập Face ID thành công!' });
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Có lỗi xảy ra.' });
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Xóa Face ID sẽ xóa hoàn toàn dữ liệu khuôn mặt của bạn. Bạn chắc chắn?')) return;
    setLoading(true); setStatus(null);
    try {
      await deleteFaceId(currentUser.id);
      setStatus({ type: 'success', msg: 'Đã xóa Face ID thành công.' });
      setMode(null);
    } catch (err) {
      setStatus({ type: 'error', msg: err.response?.data?.message || 'Có lỗi xảy ra.' });
    } finally { setLoading(false); }
  };

  const handleUpdateFace = async () => {
    if (!faceBlob) { setStatus({ type: 'error', msg: 'Chưa có ảnh khuôn mặt.' }); return; }
    setLoading(true); setStatus(null);
    try {
      await updateFaceId(currentUser.id, faceBlob);
      setStatus({ type: 'success', msg: 'Cập nhật Face ID thành công! Bạn có thể đăng nhập bằng khuôn mặt mới.' });
      setMode(null);
    } catch (err) {
      const msg = err.response?.data?.message || 'Cập nhật Face ID thất bại.';
      setStatus({ type: 'error', msg: String(msg) });
    } finally { setLoading(false); }
  };

  const hasFace = !!currentUser?.faceTemplatePath || !!currentUser?.faceEnrolledAt;
  const faceEnabled = currentUser?.faceLoginEnabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {status && <Alert type={status.type}>{status.msg}</Alert>}

      {/* Current Status Card */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: hasFace ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${hasFace ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
              <ScanFace size={24} color={hasFace ? '#4ade80' : 'rgba(255,255,255,0.3)'} />
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>Face ID</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {!hasFace ? 'Chưa đăng ký' : faceEnabled ? ' Đang hoạt động' : ' Đã tắt'}
              </div>
              {currentUser?.faceEnrolledAt && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Đăng ký lúc: {new Date(currentUser.faceEnrolledAt).toLocaleDateString('vi-VN')}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {hasFace && !faceEnabled && (
              <button onClick={handleEnable} disabled={loading} style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                Bật Face ID
              </button>
            )}
            {hasFace && faceEnabled && (
              <button onClick={handleDisable} disabled={loading} style={{ padding: '8px 16px', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                Tắt Face ID
              </button>
            )}
            {hasFace && (
              <button onClick={handleDelete} disabled={loading} style={{ padding: '8px 16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer' }}>
                Xóa Face ID
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Update/Register Face ID */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
        <button
          onClick={() => setMode(mode === 'update' ? null : 'update')}
          style={{ width: '100%', padding: '18px 20px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '15px', fontWeight: '600' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Camera size={20} color="var(--accent-primary)" />
            {hasFace ? 'Cập nhật Face ID mới' : 'Đăng ký Face ID'}
          </span>
          <span style={{ fontSize: '20px', transform: mode === 'update' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
        </button>

        {mode === 'update' && (
          <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <style>{`
              .face-scan-line {
                position: absolute; width: 100%; height: 3px;
                background: rgba(99,102,241,0.9);
                box-shadow: 0 0 20px rgba(99,102,241,0.8);
                animation: faceScan 2s linear infinite; z-index: 10;
              }
              @keyframes faceScan {
                0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; }
              }
            `}</style>

            {/* Camera container */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '300px', aspectRatio: '4/3', background: '#000', borderRadius: '16px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(99,102,241,0.3)' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ display: isCameraActive ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} />
              {isCameraActive && !facePreview && <div className="face-scan-line" />}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {facePreview && !isCameraActive && <img src={facePreview} alt="Face" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              {!isCameraActive && !facePreview && (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                  <Camera size={32} style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '12px', margin: 0 }}>Đang khởi động camera...</p>
                </div>
              )}
              {facePreview && (
                <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: '#22c55e', color: 'white', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ScanFace size={14} /> Đã chụp
                </div>
              )}
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
              {isCameraActive ? 'Nhìn thẳng vào camera. Tự động chụp sau 2 giây...' : facePreview ? 'Ảnh đã sẵn sàng. Xác nhận để lưu.' : ''}
            </p>

            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '300px' }}>
              {facePreview && (
                <button type="button" onClick={() => { setFaceBlob(null); setFacePreview(null); startCamera(); }} disabled={loading}
                  style={{ flex: 1, padding: '10px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
                  Chụp lại
                </button>
              )}
              {faceBlob && (
                <button type="button" onClick={handleUpdateFace} disabled={loading}
                  style={{ flex: 1, padding: '10px', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13px', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Đang lưu...' : ' Lưu Face ID'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Warning notice */}
      <Alert type="warning">
        Dữ liệu Face ID được lưu trữ an toàn. Chỉ bạn mới có thể đăng nhập bằng khuôn mặt của mình.
      </Alert>
    </div>
  );
}

/* ─────────────────────────── MAIN PROFILE PAGE ──────────────────────── */
const Profile = () => {
  const { currentUser, updateProfile, changePassword, disableFaceId, enableFaceId, deleteFaceId, updateFaceId } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();

  if (!currentUser) return null;

  const tabs = [
    { id: 'profile', label: 'Hồ sơ', icon: <User size={16} /> },
    { id: 'password', label: 'Mật khẩu', icon: <Lock size={16} /> },
    { id: 'face', label: 'Face ID', icon: <ScanFace size={16} /> },
  ];

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '680px', margin: '40px auto', padding: '0 16px' }}>
      <div className="glass" style={{ padding: '36px', borderRadius: '24px' }}>
        {/* Back link */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '24px', fontSize: '14px' }}>
          <ArrowLeft size={16} /> Quay lại Chat
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Settings color="white" size={26} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', margin: 0, fontWeight: '700' }}>Cài đặt tài khoản</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>@{currentUser.username}</p>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '14px', marginBottom: '28px' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={tabStyle(activeTab === t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && <ProfileTab currentUser={currentUser} updateProfile={updateProfile} />}
        {activeTab === 'password' && <ChangePasswordTab currentUser={currentUser} changePassword={changePassword} />}
        {activeTab === 'face' && <FaceIdTab currentUser={currentUser} disableFaceId={disableFaceId} enableFaceId={enableFaceId} deleteFaceId={deleteFaceId} updateFaceId={updateFaceId} />}
      </div>
    </div>
  );
};

export default Profile;
