import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import UploadModal from './UploadModal';
import IOSAddToHome from './IOSAddToHome';
import VideoUploadCard from './VideoUploadCard.js';
import './styles/cutify-glass.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import LoginCard from './components/LoginCard';
import ProfileCard from './components/ProfileCard';
import ProjectsPage from './components/ProjectsPage';
import SupportChat from './components/SupportChat';
import AdminConversations from './components/AdminConversations';
import AdminChatView from './components/AdminChatView';
import AlphaPage from './components/AlphaPage';
import AlphaChannel from './components/AlphaChannel';
import SubscriptionPage from './components/SubscriptionPage';
import MyPurchases from './components/MyPurchases';
import AdminSubscriptionManager from './components/AdminSubscriptionManager';
import AdminDiscountManager from './components/AdminDiscountManager';
import SubAdminManager from './components/SubAdminManager';
import AdminUsersManager from './components/AdminUsersManager';
import AdminNotificationSender from './components/AdminNotificationSender';
import TeamConversations from './components/TeamConversations';
import TeamChatView from './components/TeamChatView';
import PushPermission from './components/PushPermission';
import SettingsPage from './components/SettingsPage';
import { authService } from './services/authService';
import { pushService } from './services/pushService';
import Pusher from 'pusher-js';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';


import { 
  Home, 
  Headphones, 
  Plus, 
  ShoppingBag,
  User, 
  ChevronRight,
  Play,
  Rocket,
  GraduationCap,
  Brain,
  BookOpen,
  Loader2,
  Settings,
} from 'lucide-react';

const CutifyGlassDemo = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(102);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isImageZoomOpen, setIsImageZoomOpen] = useState(false);

  // گوش دادن به event از ImageZoomModal
  useEffect(() => {
    const handleZoomOpen = () => setIsImageZoomOpen(true);
    const handleZoomClose = () => setIsImageZoomOpen(false);
    
    window.addEventListener('imageZoomOpen', handleZoomOpen);
    window.addEventListener('imageZoomClose', handleZoomClose);

    // Hide splash loader when app is ready
    if (window.hideSplashLoader) {
      window.hideSplashLoader();
    }
    
    return () => {
      window.removeEventListener('imageZoomOpen', handleZoomOpen);
      window.removeEventListener('imageZoomClose', handleZoomClose);
    };
  }, []);

  // تشخیص چرخش گوشی (فقط موبایل)
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const checkOrientation = () => {
      if (isMobile) {
        setIsLandscape(window.innerWidth > window.innerHeight);
      } else {
        setIsLandscape(false);
      }
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);
  
  // State برای ذخیره صفحه‌ای که کاربر می‌خواست بره و نیاز به لاگین داشت
  const [pendingTab, setPendingTab] = useState(null);
  
  // State برای چک اشتراک آلفا
  const [alphaSubLoading, setAlphaSubLoading] = useState(false);
  
  // State برای ذخیره conversation انتخاب شده توسط ادمین
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  
  // State برای ذخیره team conversation انتخاب شده
  const [selectedTeamConversationId, setSelectedTeamConversationId] = useState(null);
  
  // State برای تعداد پیام‌های خوانده نشده
  const [unreadCount, setUnreadCount] = useState(0);
  
  // State برای تعداد پیام‌های خوانده نشده تیمی
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);
  
  // State برای نمایش prompt اعلان push
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  
  // State برای تعداد پست‌های خوانده نشده کانال آلفا
  const [alphaUnreadCount, setAlphaUnreadCount] = useState(0);
  
  // State برای تعداد اشتراک‌های pending (برای ادمین)
  const [pendingSubCount, setPendingSubCount] = useState(0);
  
  // Ref برای Pusher
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const teamChannelRef = useRef(null);
  const alphaChannelRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  
  // Extract user ID from JWT token
  const getUserIdFromToken = () => {
    try {
      const token = authService.getToken();
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return parseInt(payload?.data?.user?.id);
    } catch (e) { return null; }
  };

  const { user, isLoggedIn, loading, hasPermission } = useAuth();
  
  // Keep activeTabRef in sync
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
  // چک کردن اینکه کاربر ادمین هست یا نه
  const isAdmin = authService.getUser()?.nicename === 'admin';

  // چک دسترسی‌های ترکیبی: ادمین اصلی یا ساب‌ادمین با دسترسی مربوطه
  const canManageSupport = isAdmin || hasPermission('support');
  const canManageChannel = isAdmin || hasPermission('channel');
  const canManageSubscriptions = isAdmin || hasPermission('subscriptions');
  const canManageDiscounts = isAdmin || hasPermission('discounts');
  const canManualOrder = isAdmin || hasPermission('manual_order');

  // دریافت تعداد پیام‌های خوانده نشده
  const fetchUnreadCount = async () => {
    if (!isLoggedIn) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const token = authService.getToken();
      
      if (canManageSupport) {
        // برای ادمین یا ساب‌ادمین با دسترسی پشتیبانی: مجموع پیام‌های خوانده نشده از همه کاربران
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

  // دریافت تعداد پست‌های خوانده نشده کانال آلفا
  const fetchAlphaUnreadCount = async () => {
    if (!isLoggedIn) {
      setAlphaUnreadCount(0);
      return;
    }
    
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/channel/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAlphaUnreadCount(data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching alpha unread count:', error);
    }
  };

  // دریافت تعداد اشتراک‌های pending (برای ادمین یا ساب‌ادمین با دسترسی اشتراک)
  const fetchPendingSubCount = async () => {
    if (!isLoggedIn || !canManageSubscriptions) {
      setPendingSubCount(0);
      return;
    }
    
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/admin/subscriptions/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingSubCount(data.pending || 0);
      }
    } catch (error) {
      console.error('Error fetching pending sub count:', error);
    }
  };

  // دریافت تعداد پیام‌های خوانده نشده تیمی
  const fetchTeamUnreadCount = async () => {
    if (!isLoggedIn) { setTeamUnreadCount(0); return; }
    // فقط ادمین و ساب‌ادمین‌ها چت تیمی دارن
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamUnreadCount(data.reduce((sum, c) => sum + (c.unreadCount || 0), 0));
      }
    } catch (e) {}
  };

  // اتصال به Pusher برای دریافت پیام‌های جدید
  const connectPusher = async () => {
    if (!isLoggedIn || pusherRef.current) return;
    
    const token = authService.getToken();
    
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
    
    if (canManageSupport || canManageSubscriptions) {
      // ادمین یا ساب‌ادمین با دسترسی پشتیبانی/اشتراک به کانال admin-support گوش میده
      channelRef.current = pusherRef.current.subscribe('admin-support');
      
      if (canManageSupport) {
        channelRef.current.bind('new-message', (data) => {
          // فقط پیام‌های کاربران رو حساب کن
          if (data.sender === 'user') {
            setUnreadCount(prev => prev + 1);
          }
        });
        
        // وقتی یکی از تیم پیام‌ها رو خوند، بادج همه آپدیت بشه
        channelRef.current.bind('messages-read', (data) => {
          if (data.readBy === 'admin') {
            fetchUnreadCount();
          }
        });
        
        // وقتی یکی از تیم مکالمه رو unread کرد، بادج همه آپدیت بشه
        channelRef.current.bind('conversation-unread', (data) => {
          fetchUnreadCount();
        });
      }
      
      if (canManageSubscriptions) {
        // گوش دادن به درخواست‌های اشتراک جدید
        channelRef.current.bind('new-subscription', (data) => {
          setPendingSubCount(prev => prev + 1);
        });
      }
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
    
    // Subscribe to alpha-channel for badge (all logged-in users)
    const alphaChannel = pusherRef.current.subscribe('alpha-channel');
    alphaChannelRef.current = alphaChannel;
    alphaChannel.bind('new-post', (data) => {
      // فقط وقتی کاربر در صفحه کانال آلفا نیست بادج رو بالا ببر
      if (activeTabRef.current !== 'alphaChannel') {
        setAlphaUnreadCount(prev => prev + 1);
      }
    });
    
    // Subscribe to team channel for badge (admin + sub-admins)
    const myUserId = getUserIdFromToken();
    if (myUserId) {
      teamChannelRef.current = pusherRef.current.subscribe(`team-user-${myUserId}`);
      teamChannelRef.current.bind('new-team-message', (data) => {
        // فقط وقتی در صفحه چت تیمی نیست بادج رو بالا ببر
        if (activeTabRef.current !== 'teamChat' && activeTabRef.current !== 'teamChatView') {
          setTeamUnreadCount(prev => prev + 1);
        }
      });
    }
  };

  // قطع اتصال Pusher
  const disconnectPusher = () => {
    if (channelRef.current) {
      channelRef.current.unbind_all();
      channelRef.current = null;
    }
    if (teamChannelRef.current) {
      teamChannelRef.current.unbind_all();
      teamChannelRef.current = null;
    }
    if (alphaChannelRef.current) {
      alphaChannelRef.current.unbind_all();
      alphaChannelRef.current = null;
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
      fetchPendingSubCount();
      fetchAlphaUnreadCount();
      fetchTeamUnreadCount();
      connectPusher();
    } else {
      setUnreadCount(0);
      setPendingSubCount(0);
      setAlphaUnreadCount(0);
      setTeamUnreadCount(0);
      pushService.removeToken();
      disconnectPusher();
    }
    
    return () => {
      disconnectPusher();
    };
  }, [isLoggedIn, canManageSupport, canManageSubscriptions]);

  // Deep link: handle push notification click (URL params)
  useEffect(() => {
    if (!isLoggedIn) return;
    const params = new URLSearchParams(window.location.search);
    const open = params.get('open');
    const chatId = params.get('chatId');
    
    if (open === 'support' && chatId && canManageSupport) {
      // Admin: open specific support conversation
      setSelectedConversationId(parseInt(chatId));
      setActiveTab('adminChat');
      window.history.replaceState({}, '', '/');
    } else if (open === 'support') {
      // User: open support chat
      setActiveTab('support');
      window.history.replaceState({}, '', '/');
    } else if (open === 'teamChat' && chatId) {
      // Open specific team conversation
      setSelectedTeamConversationId(parseInt(chatId));
      setActiveTab('teamChatView');
      window.history.replaceState({}, '', '/');
    }
  }, [isLoggedIn, canManageSupport]);

  // Push notification: show prompt after login if not registered
  useEffect(() => {
    if (isLoggedIn && pushService.isSupported() && !pushService.isRegistered()) {
      // Show prompt after 3 seconds
      const timer = setTimeout(() => {
        if (pushService.getPermissionState() !== 'denied') {
          setShowPushPrompt(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  // General online status heartbeat (even when not in a specific chat)
  useEffect(() => {
    if (!isLoggedIn) return;
    const API = 'https://asadmindset.com/wp-json/asadmindset/v1';
    
    const sendHeartbeat = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const token = authService.getToken();
        if (!token) return;
        await fetch(`${API}/push/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ chatType: 'app', conversationId: 0 })
        });
      } catch (e) {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') sendHeartbeat();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLoggedIn]);

  // Push notification: listen for foreground messages
  useEffect(() => {
    if (!isLoggedIn) return;
    const unsubscribe = pushService.onForegroundMessage((payload) => {
      // When app is in foreground, do nothing - Pusher handles real-time updates
      // Notification only shows when app is in background (handled by SW)
      console.log('Foreground push received (suppressed):', payload);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [isLoggedIn]);

  // وقتی کاربر عادی وارد صفحه پشتیبانی میشه، unread رو صفر کن
  // برای ادمین/ساب‌ادمین صفر نکن چون فقط لیست مکالمات باز میشه
  useEffect(() => {
    if (activeTab === 'support' && !canManageSupport) {
      setUnreadCount(0);
    }
    // وقتی وارد چت تیمی می‌شه بادج صفر بشه
    if (activeTab === 'teamChat' || activeTab === 'teamChatView') {
      setTeamUnreadCount(0);
    }
    if (activeTab === 'shop' && canManageSubscriptions) {
    }
    // وقتی کاربر وارد کانال آلفا میشه، بادج صفر بشه و سرور آپدیت بشه
    if (activeTab === 'alphaChannel' && isLoggedIn) {
      setAlphaUnreadCount(0);
      const token = authService.getToken();
      fetch(`${API_URL}/channel/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(err => console.error('Error marking alpha as read:', err));
    }
  }, [activeTab]);

  // تابع برای تغییر تب با چک کردن لاگین
  const handleTabChange = (tab) => {
    // اگر تب نیاز به لاگین داره و کاربر لاگین نیست
    const protectedTabs = ['support', 'shop']; // تب‌هایی که نیاز به لاگین دارن
    
    if (protectedTabs.includes(tab) && !isLoggedIn) {
      // ذخیره تب مقصد و نمایش صفحه لاگین
      setPendingTab(tab);
      setActiveTab('profile'); // رفتن به صفحه لاگین
    } else {
      setActiveTab(tab);
    }
  };

  // تابع چک اشتراک و هدایت به صفحه مناسب آلفا
  const handleAlphaClick = async () => {
    if (!isLoggedIn) {
      // کاربر لاگین نیست → صفحه معرفی آلفا (لندینگ)
      setActiveTab('alpha');
      return;
    }
    
    // کاربر لاگین هست → چک اشتراک
    setAlphaSubLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/subscription/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.hasActiveSubscription) {
          // اشتراک فعال داره → مستقیم به کانال آلفا
          setActiveTab('alphaChannel');
        } else {
          // اشتراک نداره یا تمام شده → صفحه خرید اشتراک
          setActiveTab('subscription');
        }
      } else {
        // خطا در چک اشتراک → صفحه معرفی آلفا
        setActiveTab('alpha');
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setActiveTab('alpha');
    } finally {
      setAlphaSubLoading(false);
    }
  };

  // تابع هندل کلیک "عضویت" در صفحه AlphaPage
  const handleAlphaJoin = () => {
    if (!isLoggedIn) {
      // لاگین نیست → بره صفحه لاگین، بعد لاگین چک اشتراک بشه
      setPendingTab('alphaCheck');
      setActiveTab('profile');
    } else {
      // لاگین هست → بره صفحه خرید اشتراک
      setActiveTab('subscription');
    }
  };

  // تابعی که بعد از لاگین موفق صدا زده میشه
  const handleLoginSuccess = async () => {
    if (pendingTab === 'alphaCheck') {
      // بعد لاگین از مسیر آلفا → چک اشتراک
      setPendingTab(null);
      setAlphaSubLoading(true);
      try {
        const token = authService.getToken();
        const response = await fetch(`${API_URL}/subscription/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.hasActiveSubscription) {
            setActiveTab('alphaChannel');
          } else {
            setActiveTab('subscription');
          }
        } else {
          setActiveTab('subscription');
        }
      } catch (error) {
        console.error('Error checking subscription after login:', error);
        setActiveTab('subscription');
      } finally {
        setAlphaSubLoading(false);
      }
    } else if (pendingTab) {
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
          <ProfileCard 
            onNavigateToSubscription={() => setActiveTab('subscription')} 
            onNavigateToSubAdmin={() => setActiveTab('subAdminManager')}
            onNavigateToUsers={() => setActiveTab('adminUsers')}
            onNavigateToNotifications={() => setActiveTab('adminNotifications')}
          />
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
      if (canManageSupport) {
        // اگر ادمین یا ساب‌ادمین با دسترسی پشتیبانی هست، لیست گفتگوها رو نشون بده
        return (
          <AdminConversations 
            onBack={() => setActiveTab('home')} 
            onSelectConversation={(convId) => {
              setSelectedConversationId(convId);
              setActiveTab('adminChat');
            }}
            onTeamChat={() => setActiveTab('teamChat')}
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
    
    // صفحه لیست چت تیمی
    if (activeTab === 'teamChat') {
      return (
        <TeamConversations
          onBack={() => setActiveTab('support')}
          onSelectConversation={(convId) => {
            setSelectedTeamConversationId(convId);
            setActiveTab('teamChatView');
          }}
        />
      );
    }
    
    // صفحه چت تیمی با یک مکالمه خاص
    if (activeTab === 'teamChatView') {
      return (
        <TeamChatView
          conversationId={selectedTeamConversationId}
          onBack={() => {
            setSelectedTeamConversationId(null);
            setActiveTab('teamChat');
          }}
        />
      );
    }
    // صفحه تنظیمات
    if (activeTab === 'settings') {
      return (
        <SettingsPage 
          onBack={() => setActiveTab('home')}
          isTeamMember={canManageSupport}
        />
      );
    }
    // صفحه آلفا
    if (activeTab === 'alpha') {
      return <AlphaPage onBack={() => setActiveTab('home')} onOpenChannel={handleAlphaJoin} />;
    }
    // صفحه کانال آلفا
    if (activeTab === 'alphaChannel') {
      return <AlphaChannel onBack={() => setActiveTab('home')} isAdmin={canManageChannel} />;
    }
    
    // صفحه اشتراک
    if (activeTab === 'subscription') {
      return <SubscriptionPage onBack={() => setActiveTab('home')} onNavigateToSupport={() => setActiveTab('support')} />;
    }

    // صفحه مدیریت کاربران ارشد (فقط ادمین اصلی)
    if (activeTab === 'subAdminManager') {
      return (
        <SubAdminManager 
          onBack={() => setActiveTab('profile')} 
        />
      );
    }

    // صفحه لیست کاربران (فقط ادمین اصلی)
    if (activeTab === 'adminUsers') {
      return (
        <AdminUsersManager 
          onBack={() => setActiveTab('profile')} 
        />
      );
    }

    // صفحه ارسال نوتیفیکیشن (فقط ادمین ارشد)
    if (activeTab === 'adminNotifications') {
      return (
        <AdminNotificationSender 
          onBack={() => setActiveTab('profile')} 
        />
      );
    }

    // صفحه مدیریت کدهای تخفیف (ادمین یا ساب‌ادمین با دسترسی تخفیف)
    if (activeTab === 'adminDiscounts') {
      return (
        <AdminDiscountManager 
          onBack={() => setActiveTab('shop')} 
        />
      );
    }
    
    // صفحه خریدها / مدیریت اشتراک‌ها
    if (activeTab === 'shop') {
      if (canManageSubscriptions) {
        return (
          <AdminSubscriptionManager 
            onBack={() => setActiveTab('home')} 
            onPendingCountChange={(count) => setPendingSubCount(count)}
            onNavigateToDiscounts={() => setActiveTab('adminDiscounts')}
          />
        );
      }
      return (
        <MyPurchases 
          onBack={() => setActiveTab('home')} 
          onNavigateToSubscription={() => setActiveTab('subscription')}
          onNavigateToSupport={() => setActiveTab('support')}
          onNavigateToRenewal={(purchaseId) => setActiveTab('subscription')}
        />
      );
    }
    
    // صفحه اصلی
    return (
      <div className="content">

        {/* Logo + Settings */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
          <button 
            onClick={() => setActiveTab('settings')}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              padding: '8px',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
          >
            <Settings size={20} />
          </button>
          <div className="logo">
            <div className="logo-container">
              <img src="/cutify-icon.png" alt="Cutify Logo" className="custom-logo" />
            </div>
          </div>
          <div style={{ width: 36 }}></div>
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
          onClick={handleAlphaClick}
          style={{ position: 'relative', pointerEvents: alphaSubLoading ? 'none' : 'auto' }}
        >
          {/* Spinner overlay */}
          {alphaSubLoading && (
            <div className="alpha-loading-overlay">
              <Loader2 size={24} className="alpha-spinner" />
            </div>
          )}
          <div className="menu-card-content">
            <div className="menu-icon-wrapper" style={{ position: 'relative' }}>
              <Rocket size={24} />
              {alphaUnreadCount > 0 && !alphaSubLoading && (
                <span className="alpha-badge">{alphaUnreadCount > 100 ? '100+' : alphaUnreadCount}</span>
              )}
            </div>
            <div className="menu-text-wrapper">
              <span className="menu-item-title">Alpha Group</span>
              <span className="menu-item-desc"></span>
            </div>
          </div>
          <ChevronRight size={22} className="menu-chevron" />
        </div>

       {/* Academy Card - Coming Soon */}
<div 
  className="quick-edit-card-glass menu-card-single menu-card-disabled"
  style={{ opacity: 0.5, cursor: 'not-allowed' }}
>
  <div className="menu-card-content">
    <div className="menu-icon-wrapper">
      <GraduationCap size={24} />
    </div>
    <div className="menu-text-wrapper">
      <span className="menu-item-title">Academy</span>
      <span className="menu-item-desc" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Coming Soon...</span>
    </div>
  </div>
  <ChevronRight size={22} className="menu-chevron" style={{ opacity: 0.3 }} />
</div>

{/* Mindset Card - Coming Soon */}
<div 
  className="quick-edit-card-glass menu-card-single menu-card-disabled"
  style={{ opacity: 0.5, cursor: 'not-allowed' }}
>
  <div className="menu-card-content">
    <div className="menu-icon-wrapper">
      <Brain size={24} />
    </div>
    <div className="menu-text-wrapper">
      <span className="menu-item-title">Mindset</span>
      <span className="menu-item-desc" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Coming Soon...</span>
    </div>
  </div>
  <ChevronRight size={22} className="menu-chevron" style={{ opacity: 0.3 }} />
</div>

{/* Books Card - Coming Soon */}
<div 
  className="quick-edit-card-glass menu-card-single menu-card-disabled"
  style={{ opacity: 0.5, cursor: 'not-allowed' }}
>
  <div className="menu-card-content">
    <div className="menu-icon-wrapper">
      <BookOpen size={24} />
    </div>
    <div className="menu-text-wrapper">
      <span className="menu-item-title">Books</span>
      <span className="menu-item-desc" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Coming Soon...</span>
    </div>
  </div>
  <ChevronRight size={22} className="menu-chevron" style={{ opacity: 0.3 }} />
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
        
        {/* لایه شیشه‌ای روی بک‌گراند - در صفحه پشتیبانی و خریدها */}
        {(activeTab === 'support' || activeTab === 'adminChat' || activeTab === 'shop' || activeTab === 'adminDiscounts' || activeTab === 'subAdminManager' || activeTab === 'adminUsers' || activeTab === 'adminNotifications' || activeTab === 'teamChat' || activeTab === 'teamChatView') && <div className="bg-glass-overlay"></div>}

        {/* Content */}
        {renderContent()}

        {/* Push notification permission prompt */}
        {showPushPrompt && (
          <PushPermission onClose={() => setShowPushPrompt(false)} />
        )}

        {/* Bottom Navigation - مخفی در صفحه‌های تمام‌صفحه */}
        {activeTab !== 'support' && activeTab !== 'alphaChannel' && activeTab !== 'adminChat' && activeTab !== 'subAdminManager' && activeTab !== 'adminUsers' && activeTab !== 'adminNotifications' && activeTab !== 'teamChat' && activeTab !== 'teamChatView' && activeTab !== 'settings' && (
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
                  {teamUnreadCount > 0 && (
                    <span className="nav-badge nav-badge-team">{teamUnreadCount > 99 ? '99+' : teamUnreadCount}</span>
                  )}
                </div>
                <span>Support</span>
              </button>
              <button 
                className="nav-item-ios add-button-ios"
                onClick={() => {}}
              >
                <div className="add-icon-ios ai-text">
                  Ai
                </div>
              </button>
              <button 
                className={`nav-item-ios ${activeTab === 'shop' ? 'active' : ''}`}
                onClick={() => handleTabChange('shop')}
              >
                <div className="nav-icon-wrapper">
                  <ShoppingBag size={22} strokeWidth={activeTab === 'shop' ? 2.5 : 1.5} />
                  {canManageSubscriptions && pendingSubCount > 0 && (
                    <span className="nav-badge">{pendingSubCount > 99 ? '99+' : pendingSubCount}</span>
                  )}
                </div>
                <span>{canManageSubscriptions ? 'اشتراک‌ها' : 'خریدها'}</span>
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

      {/* Landscape Warning Overlay */}
      {isLandscape && !isImageZoomOpen && (
        <div className="landscape-warning-overlay">
          <div className="landscape-warning-content">
            <div className="rotate-phone-icon">
              📱
            </div>
            <p>لطفاً گوشی را عمودی نگه دارید</p>
          </div>
          <style>{`
            .landscape-warning-overlay {
              position: fixed;
              inset: 0;
              background: rgba(0, 0, 0, 0.95);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 99999;
            }
            
            .landscape-warning-content {
              text-align: center;
              color: white;
              font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            }
            
            .rotate-phone-icon {
              font-size: 64px;
              margin-bottom: 20px;
              animation: rotateHint 2s ease-in-out infinite;
            }
            
            @keyframes rotateHint {
              0%, 100% { transform: rotate(0deg); }
              25% { transform: rotate(-30deg); }
              75% { transform: rotate(30deg); }
            }
            
            .landscape-warning-content p {
              font-size: 18px;
              color: rgba(255, 255, 255, 0.9);
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <ToastProvider>
      <CutifyGlassDemo />
    </ToastProvider>
  </AuthProvider>
);

export default App;