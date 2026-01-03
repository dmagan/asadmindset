import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isLoggedIn()) {
        const isValid = await authService.validateToken();
        if (isValid) {
          setUser(authService.getUser());
        } else {
          authService.logout();
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (username, password) => {
  const data = await authService.login(username, password);
  setUser({
    email: data.data?.email || data.user_email,
    name: data.data?.displayName || data.user_display_name,
    nicename: data.data?.nicename || data.user_nicename,
  });
  return data;
};
  const loginWithGoogle = async (credential) => {
    const data = await authService.googleLogin(credential);
    setUser({
      email: data.data?.email || data.user_email,
      name: data.data?.displayName || data.user_display_name,
      nicename: data.data?.nicename || data.user_nicename,
    });
    return data;
  };

  const logout = () => {
  authService.logout();
  setUser(null);
};

  const updateProfile = async (name) => {
    const data = await authService.updateProfile(name);
    setUser(prev => ({ ...prev, name: data.name }));
    return data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    return await authService.changePassword(currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login,
      loginWithGoogle,
      logout, 
      updateProfile,
      changePassword,
      loading, 
      isLoggedIn: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};