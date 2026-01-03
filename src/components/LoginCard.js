import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import ForgotPasswordCard from './ForgotPasswordCard';
import RegisterCard from './RegisterCard';

const LoginCard = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { login, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentView, setCurrentView] = useState('login'); // login, forgotPassword, register
  const [googleReady, setGoogleReady] = useState(false);

  // Load Google Sign-In script
  useEffect(() => {
    const loadGoogleScript = () => {
      if (document.getElementById('google-signin-script')) return;
      
      const script = document.createElement('script');
      script.id = 'google-signin-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    };
    
    loadGoogleScript();
  }, []);

  // Initialize Google Sign-In
  useEffect(() => {
    if (currentView !== 'login') return;
    
    const initializeGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: authService.getGoogleClientId(),
          callback: handleGoogleCallback,
        });
        setGoogleReady(true);
      }
    };

    // Wait for script to load
    const checkGoogle = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkGoogle);
        initializeGoogle();
      }
    }, 100);

    return () => clearInterval(checkGoogle);
  }, [currentView]);

  const handleGoogleCallback = async (response) => {
    setError('');
    setGoogleLoading(true);

    try {
      await loginWithGoogle(response.credential);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || t('googleLoginError', 'Google login failed. Please try again.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Custom Google Sign-In click handler
  const handleGoogleClick = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || t('loginError', 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // صفحه Forgot Password
  if (currentView === 'forgotPassword') {
    return <ForgotPasswordCard onBack={() => setCurrentView('login')} />;
  }

  // صفحه Register
  if (currentView === 'register') {
    return (
      <RegisterCard 
        onBack={() => setCurrentView('login')} 
        onSuccess={() => setCurrentView('login')}
      />
    );
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <h2 className="login-title">{t('welcomeBack', 'Welcome Back')}</h2>
        <p className="login-subtitle">{t('loginToContinue', 'Login to continue')}</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        {error && <div className="login-error">{error}</div>}

        <div className="input-group">
          <Mail size={18} className="input-icon" />
          <input
  type="text"
  inputMode="email"
  placeholder={t('usernameOrEmail', 'Username or Email')}
  value={username}
  onChange={(e) => setUsername(e.target.value)}
  required
/>
        </div>

        <div className="input-group">
          <Lock size={18} className="input-icon" />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder={t('password', 'Password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button type="submit" className="login-button" disabled={loading}>
          {loading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <LogIn size={18} />
              <span>{t('login', 'Login')}</span>
            </>
          )}
        </button>

        <button 
          type="button" 
          className="forgot-password-btn"
          onClick={() => setCurrentView('forgotPassword')}
        >
          {t('forgotPassword', 'Forgot Password?')}
        </button>

        <div className="divider">
          <span>{t('or', 'or')}</span>
        </div>

        {/* Custom Google Sign-In Button */}
        <button 
          type="button"
          className="google-button-glass"
          onClick={handleGoogleClick}
          disabled={googleLoading || !googleReady}
        >
          {googleLoading ? (
            <>
              <span className="loading-spinner"></span>
              <span>{t('signingIn', 'Signing in...')}</span>
            </>
          ) : (
            <>
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{t('signInWithGoogle', 'Sign in with Google')}</span>
            </>
          )}
        </button>

        <button 
          type="button" 
          className="register-link-btn"
          onClick={() => setCurrentView('register')}
        >
          {t('noAccount', "Don't have an account?")} <span>{t('register', 'Sign Up')}</span>
        </button>
      </form>

      <style>{`
       .login-card {
  padding: 24px;
  padding-bottom: 32px;
}


        .login-header {
  text-align: center;
  margin-bottom: 24px;
  margin-top: 8px;
}

        .login-title {
          font-size: 24px;
          font-weight: 700;
          color: white;
          margin: 0 0 8px 0;
        }

        .login-subtitle {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-error {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #f87171;
          font-size: 14px;
          text-align: center;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
        }

        .input-group input {
          width: 100%;
          padding: 16px 48px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s;
        }

        .input-group input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .input-group input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.08);
        }

        .password-toggle {
          position: absolute;
          right: 16px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          padding: 0;
          display: flex;
          transition: color 0.2s;
        }

        .password-toggle:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        .login-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          margin-top: 8px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .login-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .forgot-password-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          cursor: pointer;
          padding: 8px;
          transition: color 0.2s;
          text-align: center;
        }

        .forgot-password-btn:hover {
          color: #60a5fa;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 8px 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
        }

        .divider span {
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        .register-link-btn {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          cursor: pointer;
          padding: 8px;
          transition: color 0.2s;
          text-align: center;
        }

        .register-link-btn span {
          color: #60a5fa;
          font-weight: 600;
        }

        .register-link-btn:hover {
          color: white;
        }

        /* Custom Google Button - Glass Style */
        .google-button-glass {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .google-button-glass:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }

        .google-button-glass:active:not(:disabled) {
          transform: scale(0.98);
        }

        .google-button-glass:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .google-icon {
          flex-shrink: 0;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoginCard;