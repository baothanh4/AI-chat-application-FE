import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Camera, Lock, User, ScanFace } from 'lucide-react';

const Login = () => {
  const [activeTab, setActiveTab] = useState('password'); // 'password' or 'face'
  
  // Password Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Face Login State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [faceBlob, setFaceBlob] = useState(null);
  const [facePreview, setFacePreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, loginWithFace } = useAuth();
  const navigate = useNavigate();

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle Tab Switch (Auto-start camera)
  useEffect(() => {
    if (activeTab === 'password') {
      stopCamera();
      setError('');
    } else if (activeTab === 'face') {
      startCamera();
    }
  }, [activeTab]);

  // Auto-scanning loop
  useEffect(() => {
    let timeoutId;
    if (activeTab === 'face' && isCameraActive && !isSubmitting && !faceBlob) {
      // Wait 2 seconds before capturing to allow user to position their face
      timeoutId = setTimeout(() => {
        captureAndSubmitFace();
      }, 2000);
    }
    return () => clearTimeout(timeoutId);
  }, [activeTab, isCameraActive, isSubmitting, faceBlob]);

  const startCamera = async () => {
    setError('');
    setFaceBlob(null);
    setFacePreview(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const captureAndSubmitFace = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        // Show preview and loading state immediately
        setFaceBlob(blob);
        setFacePreview(URL.createObjectURL(blob));
        setIsSubmitting(true);
        setError(''); // Clear previous errors during new scan
        
        try {
          const data = await loginWithFace(blob);
          stopCamera();
          if (data.user && data.user.role === 'ADMIN') {
            navigate('/admin');
          } else {
            navigate('/');
          }
        } catch (err) {
          if (err.response?.status === 401) {
            // Only retry automatically if it's explicitly unauthorized
            setError('Face not recognized. Scanning again...');
            setFaceBlob(null);
            setFacePreview(null);
            setIsSubmitting(false);
          } else {
            // For other errors (like Server Down / 500 / Network Error), halt auto-scan
            setError('System error or Server is down. Please try again.');
            setIsSubmitting(false);
            stopCamera();
          }
        }
      } else {
        setError('Failed to capture face. Retrying...');
      }
    }, 'image/jpeg', 0.92);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      const data = await login(username, password);
      if (data.user && data.user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError('Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '440px', margin: 'auto' }}>
      <style>{`
        .scan-line {
          position: absolute;
          width: 100%;
          height: 4px;
          background: rgba(139, 92, 246, 0.8);
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.8);
          animation: scan 2s linear infinite;
          z-index: 10;
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
      
      <div className="glass" style={{ padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', padding: '16px', borderRadius: '50%', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
            <MessageSquare color="white" size={32} />
          </div>
        </div>
        <h1 style={{ marginBottom: '8px', fontSize: '24px' }}>Welcome back</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
          Select your preferred way to log in
        </p>
        
        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('password')}
            style={{ 
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none', 
              background: activeTab === 'password' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'password' ? 'white' : 'var(--text-muted)',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <Lock size={16} /> Password
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('face')}
            style={{ 
              flex: 1, padding: '10px', borderRadius: '8px', border: 'none', 
              background: activeTab === 'face' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'face' ? 'white' : 'var(--text-muted)',
              fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            <ScanFace size={16} /> Face ID
          </button>
        </div>

        {error && activeTab === 'password' && <div style={{ color: '#ef4444', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}
        
        {/* Password Login Panel */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Username</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="@username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 14px 12px 40px', color: 'white', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: '40px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px 14px 12px 40px', color: 'white', outline: 'none' }}
                  required
                />
              </div>
            </div>
            
            <button type="submit" className="primary" disabled={isSubmitting} style={{ marginTop: '16px', opacity: isSubmitting ? 0.7 : 1, padding: '14px', borderRadius: '12px', fontWeight: 'bold' }}>
              {isSubmitting ? 'Logging in...' : 'Login Securely'}
            </button>
          </form>
        )}

        {/* Face Login Panel */}
        {activeTab === 'face' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Camera view */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ display: isCameraActive ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                
                {isCameraActive && !isSubmitting && <div className="scan-line"></div>}

                <canvas ref={canvasRef} style={{ display: 'none' }} />
                
                {facePreview && isSubmitting && (
                  <>
                    <img src={facePreview} alt="Face Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(139, 92, 246, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(4px)' }}>
                       <div style={{ background: 'rgba(0,0,0,0.7)', padding: '12px 24px', borderRadius: '24px', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <ScanFace className="spin" size={18} /> Authenticating...
                       </div>
                    </div>
                  </>
                )}

                {!isCameraActive && !facePreview && !error && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Camera size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontSize: '12px' }}>Starting camera...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Text Area */}
            <div style={{ minHeight: '40px', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {error ? (
                <div style={{ color: '#ef4444', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px 16px', borderRadius: '8px', fontWeight: '500', width: '100%' }}>
                  {error}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
                  {isSubmitting ? 'Verifying identity...' : isCameraActive ? 'Position your face in the frame. Auto-scanning...' : ''}
                </p>
              )}
            </div>
            
          </div>
        )}

        <div style={{ marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Don't have an account? {' '}
          <Link to="/register" style={{ color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'none' }}>
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
