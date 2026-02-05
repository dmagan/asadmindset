import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);

  // دریافت دسترسی‌های کاربر از سرور
  const fetchPermissions = useCallback(async () => {
    try {
      const token = authService.getToken();
      if (!token) {
        setPermissions([]);
        return;
      }

      const response = await fetch(`${API_URL}/my-permissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.permissions || []);
      } else {
        setPermissions([]);
      }
    } catch (e) {
      console.error('Error fetching permissions:', e);
      setPermissions([]);
    }
  }, []);

  // چک کردن اینکه آیا کاربر یه دسترسی خاص داره
  const hasPermission = useCallback((perm) => {
    const currentUser = authService.getUser();
    // ادمین اصلی همه دسترسی‌ها رو داره
    if (currentUser?.nicename === 'admin') return true;
    return permissions.includes(perm);
  }, [permissions]);

  // چک آیا ادمین اصلی یا ساب‌ادمین با حداقل یه دسترسی هست
  const isAdminOrSubAdmin = useCallback(() => {
    const currentUser = authService.getUser();
    if (currentUser?.nicename === 'admin') return true;
    return permissions.length > 0;
  }, [permissions]);

  // Handle auth state changes (from token expiry)
  const handleAuthChange = useCallback((isAuthenticated) => {
    if (!isAuthenticated) {
      setUser(null);
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (authService.isLoggedIn()) {
        const isValid = await authService.validateToken();
        if (isValid) {
          setUser(authService.getUser());
          // Start token check timer if user is logged in
          authService.startTokenCheck();
          // دریافت دسترسی‌ها
          await fetchPermissions();
        } else {
          authService.logout(false);
        }
      }
      setLoading(false);
    };
    
    checkAuth();
    
    // Listen for auth state changes (e.g., token expiry)
    const unsubscribe = authService.addAuthListener(handleAuthChange);
    
    return () => {
      unsubscribe();
      authService.stopTokenCheck();
    };
  }, [handleAuthChange, fetchPermissions]);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setUser({
      email: data.data?.email || data.user_email,
      name: data.data?.displayName || data.user_display_name,
      nicename: data.data?.nicename || data.user_nicename,
    });
    // بعد از لاگین، دسترسی‌ها رو بگیر
    setTimeout(() => fetchPermissions(), 300);
    return data;
  };

  const loginWithGoogle = async (credential) => {
    const data = await authService.googleLogin(credential);
    setUser({
      email: data.data?.email || data.user_email,
      name: data.data?.displayName || data.user_display_name,
      nicename: data.data?.nicename || data.user_nicename,
    });
    // بعد از لاگین، دسترسی‌ها رو بگیر
    setTimeout(() => fetchPermissions(), 300);
    return data;
  };

  const logout = () => {
    authService.logout(true);
    setUser(null);
    setPermissions([]);
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
      isLoggedIn: !!user,
      permissions,
      hasPermission,
      isAdminOrSubAdmin,
      fetchPermissions,
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