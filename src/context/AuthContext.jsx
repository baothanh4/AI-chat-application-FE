import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const storedUserId = localStorage.getItem('chatUserId');
      if (storedUserId) {
        try {
          const res = await api.get(`/users/${storedUserId}`);
          setCurrentUser(res.data);
        } catch (error) {
          console.error("Failed to fetch user", error);
          localStorage.removeItem('chatUserId');
        }
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await api.post('/auth/login', { username, password });
      setCurrentUser(res.data);
      localStorage.setItem('chatUserId', res.data.id);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const loginWithFace = async (faceBlob) => {
    try {
      const formData = new FormData();
      formData.append('faceImage', faceBlob, 'face-login.jpg');
      
      const res = await api.post('/auth/login/face', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCurrentUser(res.data);
      localStorage.setItem('chatUserId', res.data.id);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const res = await api.post('/auth/register', userData);
      setCurrentUser(res.data);
      localStorage.setItem('chatUserId', res.data.id);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const registerWithFace = async (userData, faceBlob, avatarPath) => {
    try {
      const formData = new FormData();
      Object.keys(userData).forEach(key => {
        if (userData[key]) {
          formData.append(key, userData[key]);
        }
      });
      if (avatarPath) {
        formData.append('avatarPath', avatarPath);
      }
      formData.append('faceImage', faceBlob, 'face-enrollment.jpg');
      
      const res = await api.post('/auth/register/face', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setCurrentUser(res.data);
      localStorage.setItem('chatUserId', res.data.id);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const updateProfile = async (userId, userData, avatarFile) => {
    try {
      const res = await api.put(`/users/${userId}`, userData);
      
      let finalUserData = res.data;
      if (avatarFile) {
          const formData = new FormData();
          formData.append('file', avatarFile);
          
          const avatarRes = await api.post(`/users/${userId}/avatar`, formData, {
              headers: {
                  'Content-Type': 'multipart/form-data'
              }
          });
          finalUserData = avatarRes.data;
      }
      
      setCurrentUser(finalUserData);
      return finalUserData;
    } catch (error) {
      throw error;
    }
  };

  const removeAvatar = async (userId) => {
    try {
      const res = await api.delete(`/users/${userId}/avatar`);
      setCurrentUser(res.data);
      return res.data;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (userId, oldPassword, newPassword, confirmNewPassword) => {
    const res = await api.put(`/users/${userId}/password`, { oldPassword, newPassword, confirmNewPassword });
    return res.data;
  };

  const disableFaceId = async (userId) => {
    const res = await api.put(`/users/${userId}/face/disable`);
    setCurrentUser(res.data);
    return res.data;
  };

  const enableFaceId = async (userId) => {
    const res = await api.put(`/users/${userId}/face/enable`);
    setCurrentUser(res.data);
    return res.data;
  };

  const deleteFaceId = async (userId) => {
    const res = await api.delete(`/users/${userId}/face`);
    setCurrentUser(res.data);
    return res.data;
  };

  const updateFaceId = async (userId, faceBlob) => {
    const formData = new FormData();
    formData.append('faceImage', faceBlob, 'face-update.jpg');
    const res = await api.post(`/users/${userId}/face`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setCurrentUser(res.data);
    return res.data;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('chatUserId');
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, loginWithFace, register, registerWithFace, updateProfile, removeAvatar, changePassword, disableFaceId, enableFaceId, deleteFaceId, updateFaceId, logout, loading }}>
        {!loading && children}
    </AuthContext.Provider>
  );
};
