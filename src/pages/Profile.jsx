import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Settings, UploadCloud, ArrowLeft } from 'lucide-react';

const Profile = () => {
  const { currentUser, updateProfile } = useAuth();
  
  const [formData, setFormData] = useState({
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

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
        if (currentUser.avatarPath) {
            setAvatarPreview(currentUser.avatarPath); // proxy will handle /uploads
        }
    }
  }, [currentUser]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.displayName.trim()) {
      setError('Display Name is required.');
      return;
    }
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    try {
      await updateProfile(currentUser.id, formData, avatarFile);
      setSuccess('Profile updated successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError('An error occurred during update.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '700px', margin: '40px auto' }}>
      <div className="glass" style={{ padding: '40px', borderRadius: '24px' }}>
        
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', textDecoration: 'none', marginBottom: '20px' }}>
            <ArrowLeft size={18} /> Back to Chat
        </Link>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'inline-flex', background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
            <Settings color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>Profile Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Modify your personal info and avatar.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: '#ef4444', fontSize: '14px', background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ color: 'var(--success)', fontSize: '14px', background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>{success}</div>}
          
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            {/* Left Column: Avatar & Basic Info */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                 <label htmlFor="avatar-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '2px dashed var(--border-color)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: '8px', position: 'relative' }}>
                       {avatarPreview ? (
                           <img src={avatarPreview} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       ) : (
                           <UploadCloud color="var(--text-muted)" size={32} />
                       )}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--accent-secondary)', fontWeight: '500' }}>Change Avatar</span>
                 </label>
                 <input id="avatar-upload" type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Display Name (Required) *</label>
                <input type="text" name="displayName" placeholder="e.g. John Doe" value={formData.displayName} onChange={handleInputChange} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Full Name</label>
                <input type="text" name="fullName" placeholder="Legal Name" value={formData.fullName} onChange={handleInputChange} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Email Address</label>
                <input type="email" name="email" placeholder="user@example.com" value={formData.email} onChange={handleInputChange} />
              </div>
            </div>

            {/* Right Column: Extended Details */}
            <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Phone Number</label>
                <input type="tel" name="phoneNumber" placeholder="+1..." value={formData.phoneNumber} onChange={handleInputChange} />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleInputChange} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gender</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '8px', padding: '12px 16px', outline: 'none' }}>
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Address</label>
                <input type="text" name="address" placeholder="City, Country" value={formData.address} onChange={handleInputChange} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <label style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Bio / Description</label>
                <textarea name="bio" placeholder="Tell us a bit about yourself..." value={formData.bio} onChange={handleInputChange} style={{ flex: 1, resize: 'none' }}></textarea>
              </div>
            </div>
          </div>
          
          <button type="submit" className="primary" disabled={isSubmitting} style={{ width: '100%', marginTop: '30px', padding: '16px', fontSize: '16px', opacity: isSubmitting ? 0.7 : 1 }}>
            {isSubmitting ? 'Saving changes...' : 'Save Profile'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Profile;
