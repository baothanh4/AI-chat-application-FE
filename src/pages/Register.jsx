import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, UploadCloud, Camera, ScanFace } from 'lucide-react';
import api from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    fullName: '',
    email: '',
    phoneNumber: '',
    address: '',
    bio: '',
    dateOfBirth: '',
    gender: ''
  });
  
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  
  // Face Scan State
  const [useFaceRegistration, setUseFaceRegistration] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [faceBlob, setFaceBlob] = useState(null);
  const [facePreview, setFacePreview] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, registerWithFace } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Auto-start camera when feature is toggled on
  useEffect(() => {
    if (!useFaceRegistration) {
      stopCamera();
      setFaceBlob(null);
      setFacePreview(null);
    } else {
      startCamera();
    }
  }, [useFaceRegistration]);

  // Auto-capture face after 2 seconds
  useEffect(() => {
    let timeoutId;
    if (useFaceRegistration && isCameraActive && !faceBlob) {
      timeoutId = setTimeout(() => {
        captureFace();
      }, 2000);
    }
    return () => clearTimeout(timeoutId);
  }, [useFaceRegistration, isCameraActive, faceBlob]);

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
      setError('Unable to access camera. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const captureFace = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraActive) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        stopCamera();
        setFacePreview(URL.createObjectURL(blob));
        
        // Immediately check if this face exists in the database
        try {
          const fd = new FormData();
          fd.append('faceImage', blob, 'face-check.jpg');
          
          await api.post('/auth/login/face', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          
          // If this succeeds, it means a user with this face already exists!
          setError('This Face ID is already registered to another account.');
          setFaceBlob(null); // Prevent form submission
        } catch (err) {
          if (err.response?.status === 401) {
            // 401 Unauthorized from login/face means face is NOT found. This is PERFECT for registration!
            setFaceBlob(blob);
            setError('');
          } else {
             setError('Failed to verify face uniqueness. Please try again.');
             setFaceBlob(null);
          }
        }
      } else {
        setError('Failed to capture face.');
      }
    }, 'image/jpeg', 0.92);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Avatar image must be under 5MB.');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile) return null;
    try {
      const fd = new FormData();
      fd.append('file', avatarFile);
      const res = await api.post('/uploads/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data.path;
    } catch (err) {
      throw new Error('Avatar upload failed.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.displayName.trim() || !formData.password.trim()) {
      setError('Username, Password, and Display Name are required.');
      return;
    }
    if (useFaceRegistration && !faceBlob) {
      setError('Face scanning is enabled. Please wait for camera to capture your face.');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      let avatarPath = null;
      if (avatarFile) {
        try {
          avatarPath = await uploadAvatar();
        } catch (err) {
          setError(err.message);
          setIsSubmitting(false);
          return;
        }
      }

      const submissionData = { ...formData };
      if (avatarPath) {
        submissionData.avatarPath = avatarPath;
      }

      let registeredUser;
      if (useFaceRegistration) {
        registeredUser = await registerWithFace(submissionData, faceBlob, avatarPath);
      } else {
        registeredUser = await register(submissionData);
      }
      
      if (registeredUser && registeredUser.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response?.data?.message || 'This Username or Face ID is already registered to another account.');
      } else {
        setError(err.response?.data?.message || 'Registration failed. Please check your information.');
      }
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '800px', margin: '40px auto' }}>
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
      <div className="glass" style={{ padding: '40px', borderRadius: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', padding: '16px', borderRadius: '50%', marginBottom: '16px', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)' }}>
            <UserPlus color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Create your Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Please complete your profile to join the community.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: '#ef4444', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' }}>{error}</div>}
          
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            {/* Left Column */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
                 <label htmlFor="avatar-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    <div style={{ width: '110px', height: '110px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: '8px', transition: 'all 0.2s', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                       {avatarPreview ? (
                           <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : (
                           <UploadCloud color="rgba(255,255,255,0.5)" size={40} />
                       )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '600' }}>Upload Picture (Optional)</span>
                 </label>
                 <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Username *</label>
                <input type="text" name="username" placeholder="e.g. john_doe" value={formData.username} onChange={handleInputChange} required style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Password *</label>
                <input type="password" name="password" minLength="6" placeholder="••••••••" value={formData.password} onChange={handleInputChange} required style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Display Name *</label>
                <input type="text" name="displayName" placeholder="e.g. John Doe" value={formData.displayName} onChange={handleInputChange} required style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Full Name</label>
                <input type="text" name="fullName" placeholder="Legal Name" value={formData.fullName} onChange={handleInputChange} style={inputStyle} />
              </div>
            </div>

            {/* Right Column */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Email Address</label>
                <input type="email" name="email" placeholder="user@example.com" value={formData.email} onChange={handleInputChange} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Phone Number</label>
                <input type="tel" name="phoneNumber" placeholder="+1..." value={formData.phoneNumber} onChange={handleInputChange} style={inputStyle} />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Date of Birth</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} style={inputStyle} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} style={inputStyle}>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>Bio / Description</label>
                <textarea name="bio" placeholder="Tell us a bit about yourself..." value={formData.bio} onChange={handleInputChange} style={{ ...inputStyle, resize: 'none', height: '80px' }}></textarea>
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '32px 0' }} />

          {/* Secure Face Registration Section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <ScanFace size={20} color="var(--accent-primary)" />
                  Secure Face ID Registration
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Enable this to sign in later with just your face.</p>
              </div>
              
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <input type="checkbox" className="sr-only" checked={useFaceRegistration} onChange={() => setUseFaceRegistration(!useFaceRegistration)} style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }} />
                  <div style={{ display: 'block', width: '48px', height: '26px', background: useFaceRegistration ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', borderRadius: '999px', transition: 'background 0.3s' }}></div>
                  <div style={{ position: 'absolute', left: useFaceRegistration ? '24px' : '2px', top: '2px', background: 'white', width: '22px', height: '22px', borderRadius: '50%', transition: 'left 0.3s' }}></div>
                </div>
              </label>
            </div>

            {useFaceRegistration && (
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {/* Camera View */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '320px', aspectRatio: '4/3', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    style={{ display: isCameraActive ? 'block' : 'none', width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  
                  {isCameraActive && !facePreview && <div className="scan-line"></div>}

                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  
                  {facePreview && !isCameraActive && (
                    <img src={facePreview} alt="Face Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}

                  {!isCameraActive && !facePreview && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Camera size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ fontSize: '12px' }}>Camera is off</p>
                    </div>
                  )}

                  {facePreview && (
                     <div style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'var(--success)', color: 'white', fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                       <ScanFace size={14} /> Captured
                     </div>
                  )}
                </div>

                {/* Camera Actions */}
                <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '320px', justifyContent: 'center' }}>
                  {facePreview ? (
                    <button type="button" onClick={() => { setFaceBlob(null); setFacePreview(null); startCamera(); }} style={camBtnStyle}>
                      Retake Photo
                    </button>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                      {isCameraActive ? 'Position your face in the frame. Auto-capturing...' : 'Starting camera...'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <button type="submit" className="primary" disabled={isSubmitting} style={{ width: '100%', marginTop: '30px', padding: '16px', fontSize: '16px', borderRadius: '12px', fontWeight: 'bold', opacity: (isSubmitting) ? 0.7 : 1 }}>
            {isSubmitting ? 'Creating your world...' : 'Complete Registration'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)' }}>
          Already have an account? {' '}
          <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: '600', textDecoration: 'none' }}>
            Login now
          </Link>
        </div>
      </div>
    </div>
  );
};

// Extracted styles
const inputStyle = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: '10px',
  padding: '12px 14px',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  fontSize: '14px'
};

const camBtnStyle = {
  flex: 1, 
  padding: '10px', 
  background: 'rgba(255,255,255,0.1)', 
  border: 'none', 
  color: 'white', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  fontWeight: '600',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};

export default Register;
