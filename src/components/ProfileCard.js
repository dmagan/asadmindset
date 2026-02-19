import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Users,
  LogOut, 
  ChevronRight, 
  ChevronLeft,
  Lock, 
  Check,
  Eye,
  EyeOff,
  Globe,
  Crown,
  Shield,
  Bell,
  BarChart2
} from 'lucide-react';

const ProfileCard = ({ onNavigateToSubscription, onNavigateToSubAdmin, onNavigateToUsers, onNavigateToNotifications, onNavigateToAnalytics }) => {
  const { t, i18n } = useTranslation();
  const { user, logout, updateProfile, changePassword } = useAuth();

  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser?.nicename === 'admin';
  
  const [currentView, setCurrentView] = useState('main');
  const [name, setName] = useState(currentUser?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const handleUpdateName = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      await updateProfile(name);
      setMessage({ type: 'success', text: t('nameUpdated', 'Name updated successfully!') });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('passwordMismatch', 'Passwords do not match') });
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: t('passwordTooShort', 'Password must be at least 6 characters') });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    
    try {
      await changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: t('passwordChanged', 'Password changed successfully!') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Main Profile View
  const renderMainView = () => (
    <>
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          <User size={40} />
        </div>
        <h2 className="profile-name">{currentUser?.name || 'User'}</h2>
        <p className="profile-email">{currentUser?.email || ''}</p>
      </div>

      {/* Menu Items */}
      <div className="profile-menu">
        <button className="profile-menu-item subscription-item" onClick={onNavigateToSubscription}>
          <div className="menu-item-left">
            <div className="menu-icon subscription-icon">
              <Crown size={20} />
            </div>
            <span className="menu-label">اشتراک</span>
          </div>
          <ChevronRight size={20} className="menu-arrow" />
        </button>

        {isAdmin && (
          <button className="profile-menu-item subadmin-item" onClick={onNavigateToSubAdmin}>
            <div className="menu-item-left">
              <div className="menu-icon subadmin-icon">
                <Shield size={20} />
              </div>
              <span className="menu-label">مدیریت کاربران ارشد</span>
            </div>
            <ChevronRight size={20} className="menu-arrow" />
          </button>
        )}

        {isAdmin && (
          <button className="profile-menu-item users-item" onClick={onNavigateToUsers}>
            <div className="menu-item-left">
              <div className="menu-icon users-icon">
                <Users size={20} />
              </div>
              <span className="menu-label">کاربران</span>
            </div>
            <ChevronRight size={20} className="menu-arrow" />
          </button>
        )}

        {isAdmin && (
          <button className="profile-menu-item" onClick={onNavigateToNotifications}>
            <div className="menu-item-left">
              <div className="menu-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                <Bell size={20} />
              </div>
              <span className="menu-label">ارسال نوتیفیکیشن</span>
            </div>
            <ChevronRight size={20} className="menu-arrow" />
          </button>
        )}

        {isAdmin && (
          <button className="profile-menu-item" onClick={onNavigateToAnalytics}>
            <div className="menu-item-left">
              <div className="menu-icon" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.6), rgba(59,130,246,0.6))' }}>
                <BarChart2 size={20} />
              </div>
              <span className="menu-label">آنالیتیکس</span>
            </div>
            <ChevronRight size={20} className="menu-arrow" />
          </button>
        )}

        <button className="profile-menu-item" onClick={() => setCurrentView('editName')}>
          <div className="menu-item-left">
            <div className="menu-icon">
              <User size={20} />
            </div>
            <span className="menu-label">{t('editName', 'Edit Name')}</span>
          </div>
          <ChevronRight size={20} className="menu-arrow" />
        </button>

        <button className="profile-menu-item" onClick={() => setCurrentView('changePassword')}>
          <div className="menu-item-left">
            <div className="menu-icon">
              <Lock size={20} />
            </div>
            <span className="menu-label">{t('changePassword', 'Change Password')}</span>
          </div>
          <ChevronRight size={20} className="menu-arrow" />
        </button>

        <button className="profile-menu-item" onClick={() => setCurrentView('language')}>
          <div className="menu-item-left">
            <div className="menu-icon">
              <Globe size={20} />
            </div>
            <span className="menu-label">{t('language', 'Language')}</span>
          </div>
          <div className="menu-right">
<span className="menu-value">
  {
    { 
      en: 'English', 
      de: 'Deutsch', 
      fr: 'Français', 
      it: 'Italiano',
      es: 'Español',
      rm: 'Rumantsch'
    }[i18n.language] || 'English'
  }
</span>
            <ChevronRight size={20} className="menu-arrow" />
          </div>
        </button>
      </div>

      {/* Logout Button */}
      <button className="logout-button" onClick={logout}>
        <LogOut size={20} />
        <span>{t('logout', 'Logout')}</span>
      </button>
    </>
  );

  // Edit Name View
  const renderEditNameView = () => (
    <>
      <div className="sub-header">
        <button className="back-btn" onClick={() => { setCurrentView('main'); setMessage({ type: '', text: '' }); }}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="sub-title">{t('editName', 'Edit Name')}</h2>
        <div style={{ width: 40 }}></div>
      </div>

      <div className="form-content">
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="input-group">
          <label>{t('fullName', 'Full Name')}</label>
          <div className="input-wrapper">
            <User size={18} className="input-icon" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterName', 'Enter your name')}
            />
          </div>
        </div>

        <button 
          className="save-button" 
          onClick={handleUpdateName}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <Check size={20} />
              <span>{t('save', 'Save')}</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  // Change Password View
  const renderChangePasswordView = () => (
    <>
      <div className="sub-header">
        <button className="back-btn" onClick={() => { setCurrentView('main'); setMessage({ type: '', text: '' }); }}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="sub-title">{t('changePassword', 'Change Password')}</h2>
        <div style={{ width: 40 }}></div>
      </div>

      <div className="form-content">
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="input-group">
          <label>{t('currentPassword', 'Current Password')}</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('enterCurrentPassword', 'Enter current password')}
            />
            <button 
              type="button" 
              className="password-toggle"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>{t('newPassword', 'New Password')}</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('enterNewPassword', 'Enter new password')}
            />
            <button 
              type="button" 
              className="password-toggle"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>{t('confirmPassword', 'Confirm Password')}</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('confirmNewPassword', 'Confirm new password')}
            />
          </div>
        </div>

        <button 
          className="save-button" 
          onClick={handleChangePassword}
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
        >
          {loading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <Check size={20} />
              <span>{t('save', 'Save')}</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  // Language View
  const renderLanguageView = () => (
    <>
      <div className="sub-header">
        <button className="back-btn" onClick={() => setCurrentView('main')}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="sub-title">{t('language', 'Language')}</h2>
        <div style={{ width: 40 }}></div>
      </div>

      <div className="language-list">
        <button 
  className={`language-item ${i18n.language === 'en' ? 'active' : ''}`}
  onClick={() => changeLanguage('en')}
>
  <div className="language-info">
    <span className="language-flag">🇬🇧</span>
    <span className="language-name">English</span>
  </div>
  {i18n.language === 'en' && <Check size={20} className="check-icon" />}
</button>

<button 
  className={`language-item ${i18n.language === 'de' ? 'active' : ''}`}
  onClick={() => changeLanguage('de')}
>
  <div className="language-info">
    <span className="language-flag">🇩🇪</span>
    <span className="language-name">Deutsch</span>
  </div>
  {i18n.language === 'de' && <Check size={20} className="check-icon" />}
</button>

<button 
  className={`language-item ${i18n.language === 'fr' ? 'active' : ''}`}
  onClick={() => changeLanguage('fr')}
>
  <div className="language-info">
    <span className="language-flag">🇫🇷</span>
    <span className="language-name">Français</span>
  </div>
  {i18n.language === 'fr' && <Check size={20} className="check-icon" />}
</button>

<button 
  className={`language-item ${i18n.language === 'it' ? 'active' : ''}`}
  onClick={() => changeLanguage('it')}
>
  <div className="language-info">
    <span className="language-flag">🇮🇹</span>
    <span className="language-name">Italiano</span>
  </div>
  {i18n.language === 'it' && <Check size={20} className="check-icon" />}
</button>

<button 
  className={`language-item ${i18n.language === 'es' ? 'active' : ''}`}
  onClick={() => changeLanguage('es')}
>
  <div className="language-info">
    <span className="language-flag">🇪🇸</span>
    <span className="language-name">Español</span>
  </div>
  {i18n.language === 'es' && <Check size={20} className="check-icon" />}
</button>

<button 
  className={`language-item ${i18n.language === 'rm' ? 'active' : ''}`}
  onClick={() => changeLanguage('rm')}
>
  <div className="language-info">
    <span className="language-flag">🇨🇭</span>
    <span className="language-name">Rumantsch</span>
  </div>
  {i18n.language === 'rm' && <Check size={20} className="check-icon" />}
</button>
      </div>
    </>
  );

  return (
    <div className="profile-page">
      <div className="profile-container">
        {currentView === 'main' && renderMainView()}
        {currentView === 'editName' && renderEditNameView()}
        {currentView === 'changePassword' && renderChangePasswordView()}
        {currentView === 'language' && renderLanguageView()}
      </div>

      <style>{`
      .language-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.language-flag {
  font-size: 24px;
}


        .profile-page {
          min-height: 100%;
          padding: 20px 16px;
        }

        .profile-container {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        /* Profile Header */
        .profile-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 20px;
        }

        .profile-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 16px;
        }

        .profile-name {
          color: white;
          font-size: 22px;
          font-weight: 600;
          margin: 0 0 6px 0;
        }

        .profile-email {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          margin: 0;
        }

        /* Menu */
        .profile-menu {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 24px;
        }

        .profile-menu-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .profile-menu-item:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .profile-menu-item:active {
          transform: scale(0.98);
        }

        .menu-item-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .menu-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffffff;
        }

        .menu-icon.subscription-icon {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.15) 100%);
          color: #fbbf24;
        }

        .profile-menu-item.subscription-item {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, rgba(245, 158, 11, 0.05) 100%);
          border-color: rgba(251, 191, 36, 0.2);
        }

        .profile-menu-item.subscription-item:hover {
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%);
          border-color: rgba(251, 191, 36, 0.3);
        }

        .menu-icon.subadmin-icon {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%);
          color: #a78bfa;
        }

        .profile-menu-item.subadmin-item {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%);
          border-color: rgba(139, 92, 246, 0.2);
        }

        .profile-menu-item.subadmin-item:hover {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
          border-color: rgba(139, 92, 246, 0.3);
        }

        .menu-icon.users-icon {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.15) 100%);
          color: #34d399;
        }

        .profile-menu-item.users-item {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.05) 100%);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .profile-menu-item.users-item:hover {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .menu-label {
          color: white;
          font-size: 15px;
          font-weight: 500;
        }

        .menu-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .menu-value {
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        .menu-arrow {
          color: rgba(255, 255, 255, 0.3);
        }

        /* Logout Button */
        .logout-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 14px;
          color: #f87171;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .logout-button:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .logout-button:active {
          transform: scale(0.98);
        }

        /* Sub Pages Header */
        .sub-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .sub-title {
          color: white;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        /* Form */
        .form-content {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-group label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 500;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
        }

        .input-wrapper input {
          width: 100%;
          padding: 14px 44px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: white;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s;
        }

        .input-wrapper input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .input-wrapper input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.08);
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          padding: 0;
          display: flex;
        }

        .password-toggle:hover {
          color: rgba(255, 255, 255, 0.7);
        }

        /* Message */
        .message {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          text-align: center;
        }

        .message.success {
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        .message.error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        /* Save Button */
        .save-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
          margin-top: 10px;
        }

        .save-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .save-button:active:not(:disabled) {
          transform: scale(0.98);
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Language List */
        .language-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .language-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .language-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .language-item.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .language-name {
          color: white;
          font-size: 15px;
          font-weight: 500;
        }

        .check-icon {
          color: #3b82f6;
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

export default ProfileCard;