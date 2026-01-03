import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import UploadModal from './UploadModal';
import IOSAddToHome from './IOSAddToHome';
import VideoUploadCard from './VideoUploadCard.js';
import './styles/cutify-glass.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginCard from './components/LoginCard';
import ProfileCard from './components/ProfileCard';
import ProjectsPage from './components/ProjectsPage';
import SupportChat from './components/SupportChat';


import { 
  Home, 
  Headphones, 
  Plus, 
  LayoutGrid, 
  User, 
  ChevronRight,
  Play,
  Rocket,
  GraduationCap,
  Brain,
  BookOpen,
} from 'lucide-react';

const CutifyGlassDemo = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(102);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const { user, isLoggedIn, loading } = useAuth();

  const totalDuration = 11 * 60;

  const videos = [
    {
      id: 1,
      thumbnail: 'https://images.unsplash.com/photo-1529335764857-3f1164d1cb24?w=300&h=300&fit=crop',
      duration: '0:26',
    },
    {
      id: 2,
      thumbnail: 'https://images.unsplash.com/photo-1564415315949-7a0c4c73aab4?w=300&h=300&fit=crop',
      duration: '0:50',
    },
    {
      id: 3,
      thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop',
      duration: '1:15',
    },
  ];

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  // رندر محتوای اصلی بر اساس تب
  const renderContent = () => {

    // صفحه پروفایل
    if (activeTab === 'profile') {
      // اگه لاگین نیست → صفحه لاگین
      if (!isLoggedIn) {
        return (
          <div className="content profile-content">
            <div style={{ 
              background: 'rgba(255,255,255,0.08)', 
              backdropFilter: 'blur(40px)', 
              borderRadius: '24px', 
              border: '1px solid rgba(255,255,255,0.12)',
              margin: '20px 16px'
            }}>
              <LoginCard onSuccess={() => setActiveTab('home')} />

            </div>
          </div>
        );
      }
      // اگه لاگین هست → صفحه پروفایل
      return (
        <div className="content profile-content">
          <ProfileCard />
        </div>
      );
    }

    // صفحه پروژه‌ها
if (activeTab === 'projects') {
  return (
    <div className="content">
      <ProjectsPage />
    </div>
  );
}

    // صفحه پشتیبانی
    if (activeTab === 'support') {
      return (
        <SupportChat onBack={() => setActiveTab('home')} />
      );
    }
    // صفحه اصلی
    return (
      <div className="content">

        {/* Logo */}
        <div className="logo">
          <div className="logo-container">
            <img src="/cutify-icon.png" alt="Cutify Logo" className="custom-logo" />
          </div>
        </div>

        {/* Quick Edit Card */}
        <div className="quick-edit-card-glass">
          <div className="card-header"></div>
          <div className="video-preview-glass">
            <img 
              src="https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&h=400&fit=crop" 
              alt={t('videoPreview')}
            />
            <div className="video-overlay-glass">
              <button 
                className="play-button-glass"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                <div className="play-btn-inner">
                  {isPlaying ? (
                    <div className="pause-icon">
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <Play size={28} fill="white" stroke="white" />
                  )}
                </div>
              </button>
            </div>
            <div className="progress-container-ios">
              <span className="time-label">{formatTime(currentTime)}</span>
              <div className="progress-track">
                <div 
                  className="progress-fill-ios" 
                  style={{ width: `${(currentTime / totalDuration) * 100}%` }}
                ></div>
                <div 
                  className="progress-thumb"
                  style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                ></div>
              </div>
              <span className="time-label">11</span>
            </div>
          </div>       
        </div>

        {/* Alpha Card */}
        <div 
          className="quick-edit-card-glass menu-card-single"
          onClick={() => setActiveTab('alpha')}
        >
          <div className="menu-card-content">
            <div className="menu-icon-wrapper">
              <Rocket size={24} />
            </div>
            <div className="menu-text-wrapper">
              <span className="menu-item-title">Alpha</span>
              <span className="menu-item-desc"></span>
            </div>
          </div>
          <ChevronRight size={22} className="menu-chevron" />
        </div>

        {/* Academy Card */}
        <div 
          className="quick-edit-card-glass menu-card-single"
          onClick={() => setActiveTab('academy')}
        >
          <div className="menu-card-content">
            <div className="menu-icon-wrapper">
              <GraduationCap size={24} />
            </div>
            <div className="menu-text-wrapper">
              <span className="menu-item-title">Academy</span>
              <span className="menu-item-desc"></span>
            </div>
          </div>
          <ChevronRight size={22} className="menu-chevron" />
        </div>

        {/* Mindset Card */}
        <div 
          className="quick-edit-card-glass menu-card-single"
          onClick={() => setActiveTab('mindset')}
        >
          <div className="menu-card-content">
            <div className="menu-icon-wrapper">
              <Brain size={24} />
            </div>
            <div className="menu-text-wrapper">
              <span className="menu-item-title">Mindset</span>
              <span className="menu-item-desc"></span>
            </div>
          </div>
          <ChevronRight size={22} className="menu-chevron" />
        </div>

        {/* Books Card */}
        <div 
          className="quick-edit-card-glass menu-card-single"
          onClick={() => setActiveTab('books')}
        >
          <div className="menu-card-content">
            <div className="menu-icon-wrapper">
              <BookOpen size={24} />
            </div>
            <div className="menu-text-wrapper">
              <span className="menu-item-title">Books</span>
              <span className="menu-item-desc"></span>
            </div>
          </div>
          <ChevronRight size={22} className="menu-chevron" />
        </div>

 


      </div>
    );
  };

  return (
    <div className="cutify-app">
      <div className="phone-frame">
        {/* Background */}
        <div className="bg-image"></div>
        <div className="bg-overlay"></div>
        
        {/* لایه شیشه‌ای روی بک‌گراند - فقط در صفحه پشتیبانی */}
        {activeTab === 'support' && <div className="bg-glass-overlay"></div>}

        {/* Content */}
        {renderContent()}

        {/* Bottom Navigation - مخفی در صفحه پشتیبانی */}
        {activeTab !== 'support' && (
          <div className="bottom-nav-glass">
            <div className="nav-items">
              <button 
                className={`nav-item-ios ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 1.5} />
                <span>{t('home')}</span>
              </button>
              <button 
                className={`nav-item-ios ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveTab('support')}
              >
                <Headphones size={22} strokeWidth={activeTab === 'support' ? 2.5 : 1.5} />
                <span>Support</span>
              </button>
              <button 
                className="nav-item-ios add-button-ios"
                onClick={() => setShowUploadModal(true)}
              >
                <div className="add-icon-ios">
                  <Plus size={30} strokeWidth={2.5} />
                </div>
              </button>
              <button 
                className={`nav-item-ios ${activeTab === 'templates' ? 'active' : ''}`}
                onClick={() => setActiveTab('templates')}
              >
                <LayoutGrid size={22} strokeWidth={activeTab === 'templates' ? 2.5 : 1.5} />
                <span>{t('templates')}</span>
              </button>
              <button 
                className={`nav-item-ios ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 1.5} />
                <span>{t('profile')}</span>
              </button>
            </div>
            <div className="home-indicator"></div>
          </div>
        )}

        <UploadModal 
          isOpen={showUploadModal} 
          onClose={() => setShowUploadModal(false)} 
        />
      </div>

      <IOSAddToHome />
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <CutifyGlassDemo />
  </AuthProvider>
);

export default App;