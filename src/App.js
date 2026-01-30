import React, { useState, useEffect, useRef } from 'react';
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
import AdminConversations from './components/AdminConversations';
import AdminChatView from './components/AdminChatView';
import AlphaPage from './components/AlphaPage';
import AlphaChannel from './components/AlphaChannel';
import { authService } from './services/authService';
import Pusher from 'pusher-js';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';


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
  
  // State برای ذخیره صفحه‌ای که کاربر می‌خواست بره و نیاز به لاگین داشت
  const [pendingTab, setPendingTab] = useState(null);
  
  // State برای ذخیره conversation انتخاب شده توسط ادمین
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  
  // State برای تعداد پیام‌های خوانده نشده
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Ref برای Pusher
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  const { user, isLoggedIn, loading } = useAuth();
  
  // چک کردن اینکه کاربر ادمین هست یا نه
  const isAdmin = authService.getUser()?.nicename === 'admin';

  // دریافت تعداد پیام‌های خوانده نشده
  const fetchUnreadCount = async () => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const token = authService.getToken();
      
      if (isAdmin) {
        // برای ادمین: مجموع پیام‌های خوانده نشده از همه کاربران
        const response = await fetch(`${API_URL}/admin/conversations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const conversations = await response.json();
          const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
          setUnreadCount(totalUnread);
        }
      } else {
        // برای کاربر عادی: پیام‌های خوانده نشده از ادمین
        const response = await fetch(`${API_URL}/conversation`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // شمارش پیام‌های ادمین که هنوز خوانده نشدن
          const unreadMessages = data.messages.filter(
            msg => msg.sender === 'admin' && msg.status !== 'read'
          );
          setUnreadCount(unreadMessages.length);
        }
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // اتصال به Pusher برای دریافت پیام‌های جدید
  const connectPusher = async () => {
    if (!isLoggedIn || pusherRef.current) return;
    
    const token = authService.getToken();
    
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
    
    if (isAdmin) {
      // ادمین به کانال admin-support گوش میده
      channelRef.current = pusherRef.current.subscribe('admin-support');
      channelRef.current.bind('new-message', (data) => {
        // فقط پیام‌های کاربران رو حساب کن
        if (data.sender === 'user') {
          setUnreadCount(prev => prev + 1);
        }
      });
    } else {
      // کاربر عادی: اول باید conversationId رو بگیره
      try {
        const response = await fetch(`${API_URL}/conversation`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const channelName = data.pusherChannel;
          
          channelRef.current = pusherRef.current.subscribe(channelName);
          channelRef.current.bind('new-message', (msgData) => {
            // فقط پیام‌های ادمین رو حساب کن و فقط وقتی در صفحه چت نیستیم
            if (msgData.sender === 'admin') {
              setUnreadCount(prev => prev + 1);
            }
          });
        }
      } catch (error) {
        console.error('Error connecting to pusher:', error);
      }
    }
  };

  // قطع اتصال Pusher
  const disconnectPusher = () => {
    if (channelRef.current) {
      channelRef.current.unbind_all();
      channelRef.current = null;
    }
    if (pusherRef.current) {
      pusherRef.current.disconnect();
      pusherRef.current = null;
    }
  };

  // وقتی کاربر لاگین/لاگاوت میکنه
  useEffect(() => {
    if (isLoggedIn) {
      fetchUnreadCount();
      connectPusher();
    } else {
      setUnreadCount(0);
      disconnectPusher();
    }
    
    return () => {
      disconnectPusher();
    };
  }, [isLoggedIn]);

  // وقتی کاربر وارد صفحه پشتیبانی میشه، unread رو صفر کن
  // (mark as read سمت سرور توسط SupportChat انجام میشه)
  useEffect(() => {
    if (activeTab === 'support' || activeTab === 'adminChat') {
      setUnreadCount(0);
    }
  }, [activeTab]);

  // تابع برای تغییر تب با چک کردن لاگین
  const handleTabChange = (tab) => {
    // اگر تب نیاز به لاگین داره و کاربر لاگین نیست
    const protectedTabs = ['support']; // تب‌هایی که نیاز به لاگین دارن
    
    if (protectedTabs.includes(tab) && !isLoggedIn) {
      // ذخیره تب مقصد و نمایش صفحه لاگین
      setPendingTab(tab);
      setActiveTab('profile'); // رفتن به صفحه لاگین
    } else {
      setActiveTab(tab);
    }
  };

  // تابعی که بعد از لاگین موفق صدا زده میشه
  const handleLoginSuccess = () => {
    if (pendingTab) {
      // اگر صفحه‌ای منتظر بود، برو به اون صفحه
      setActiveTab(pendingTab);
      setPendingTab(null);
    } else {
      // اگر نه، برو به صفحه اصلی
      setActiveTab('home');
    }
  };

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
              <LoginCard onSuccess={handleLoginSuccess} />

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
      if (isAdmin) {
        // اگر ادمین هست، لیست گفتگوها رو نشون بده
        return (
          <AdminConversations 
            onBack={() => setActiveTab('home')} 
            onSelectConversation={(convId) => {
              setSelectedConversationId(convId);
              setActiveTab('adminChat');
            }}
          />
        );
      }
      
      // اگر کاربر عادی هست، چت پشتیبانی معمولی
      return (
        <SupportChat 
          onBack={() => setActiveTab('home')} 
          onMessagesRead={() => setUnreadCount(0)}
        />
      );
    }
    
    // صفحه چت ادمین با یک کاربر خاص
    if (activeTab === 'adminChat') {
      return (
        <AdminChatView 
          conversationId={selectedConversationId}
          onBack={() => {
            setSelectedConversationId(null);
            setActiveTab('support');
          }} 
        />
      );
    }
    // صفحه آلفا
    if (activeTab === 'alpha') {
      return <AlphaPage onBack={() => setActiveTab('home')} onOpenChannel={() => setActiveTab('alphaChannel')} />;
    }
    // صفحه کانال آلفا
    if (activeTab === 'alphaChannel') {
      return <AlphaChannel onBack={() => setActiveTab('alpha')} />;
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
        {(activeTab === 'support' || activeTab === 'adminChat') && <div className="bg-glass-overlay"></div>}

        {/* Content */}
        {renderContent()}

        {/* Bottom Navigation - مخفی در صفحه پشتیبانی */}
        {activeTab !== 'support' && activeTab !== 'alphaChannel' && activeTab !== 'adminChat' && (
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
                onClick={() => handleTabChange('support')}
              >
                <div className="nav-icon-wrapper">
                  <Headphones size={22} strokeWidth={activeTab === 'support' ? 2.5 : 1.5} />
                  {unreadCount > 0 && (
                    <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </div>
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