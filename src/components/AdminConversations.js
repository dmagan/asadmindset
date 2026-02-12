import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Search, 
  MessageSquare,
  Clock,
  CheckCircle,
  User,
  Users,
  Loader2,
  MailOpen,
  UserPlus,
  X,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { authService } from '../services/authService';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { formatConvTime } from '../utils/dateUtils';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminConversations = ({ onBack, onSelectConversation, onTeamChat }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamUnreadCount, setTeamUnreadCount] = useState(0);
  
  // User picker modal
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  
  // Archive view
  const [showArchived, setShowArchived] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState([]);
  
  // Online status for all conversation users
  const userIds = conversations.map(c => c.userId).filter(Boolean);
  const onlineStatuses = useOnlineStatus(userIds);
  
  // Swipe state
  const [swipedId, setSwipedId] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const swipeThreshold = 70;

  useEffect(() => {
    fetchConversations();
    if (onTeamChat) fetchTeamUnread();
  }, []);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }
    return () => {
      if (isMobile) {
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    };
  }, []);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/admin/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamUnread = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      const total = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setTeamUnreadCount(total);
    } catch (e) {}
  };

  const fetchArchivedConversations = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/admin/conversations?archived=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedConversations(data);
      }
    } catch (e) {}
  };

  const unarchiveConversation = async (convId) => {
    setActionLoadingId(convId);
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/admin/conversations/${convId}/archive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setArchivedConversations(prev => prev.filter(c => c.id !== convId));
      setSwipedId(null);
    } catch (e) {}
    setActionLoadingId(null);
  };

  // Search users for user picker
  const searchUsers = async (query) => {
    setUserSearch(query);
    if (!query.trim()) { setUserResults([]); return; }
    setUserLoading(true);
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/admin/users?search=${encodeURIComponent(query)}&per_page=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUserResults(data.users || []);
      }
    } catch (e) {}
    setUserLoading(false);
  };

  // Start chat with user by ID
  const startChatWithUser = async (userId) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/admin/start-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        setShowUserPicker(false);
        setUserSearch('');
        setUserResults([]);
        onSelectConversation(data.conversationId);
      }
    } catch (e) {}
  };

  const markAsUnread = async (convId) => {
    setActionLoadingId(convId);
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/admin/conversations/${convId}/unread`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.map(c => 
        c.id === convId ? { ...c, unreadCount: Math.max(c.unreadCount || 0, 1) } : c
      ));
      setSwipedId(null);
      document.querySelectorAll('.conv-swipe-content').forEach(el => {
        el.style.transform = 'translateX(0)';
        el.style.transition = 'transform 0.2s ease';
      });
      document.querySelectorAll('.admin-conversation-item-wrapper').forEach(el => {
        el.classList.remove('swiping');
      });
    } catch (error) {
      console.error('Error marking as unread:', error);
    }
    setActionLoadingId(null);
  };

  const archiveConversation = async (convId) => {
    setActionLoadingId(convId);
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/admin/conversations/${convId}/archive`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== convId));
      setSwipedId(null);
    } catch (error) {
      console.error('Error archiving:', error);
    }
    setActionLoadingId(null);
  };

  // Swipe handlers
  const handleTouchStart = (e, convId) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e, convId) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    const wrapper = e.currentTarget;
    const el = wrapper.querySelector('.conv-swipe-content');
    if (Math.abs(diff) > 10) {
      wrapper.classList.add('swiping');
      // Show correct action based on direction
      if (diff > 0) {
        wrapper.classList.add('swipe-left');
        wrapper.classList.remove('swipe-right');
      } else {
        wrapper.classList.add('swipe-right');
        wrapper.classList.remove('swipe-left');
      }
    }
    if (el) {
      if (diff > 0) {
        // Swipe left (RTL: unread)
        el.style.transform = `translateX(-${Math.min(diff, 90)}px)`;
      } else {
        // Swipe right (RTL: archive)
        el.style.transform = `translateX(${Math.min(Math.abs(diff), 90)}px)`;
      }
      el.style.transition = 'none';
    }
  };

  const handleTouchEnd = (e, convId) => {
    const diff = touchStartX.current - touchCurrentX.current;
    const wrapper = e.currentTarget;
    const el = wrapper.querySelector('.conv-swipe-content');
    
    if (diff > swipeThreshold) {
      // Swiped left → show unread
      if (el) {
        el.style.transform = 'translateX(-80px)';
        el.style.transition = 'transform 0.2s ease';
      }
      setSwipedId(convId);
      wrapper.classList.add('swipe-left');
      wrapper.classList.remove('swipe-right');
    } else if (diff < -swipeThreshold) {
      // Swiped right → show archive
      if (el) {
        el.style.transform = 'translateX(80px)';
        el.style.transition = 'transform 0.2s ease';
      }
      setSwipedId(convId);
      wrapper.classList.add('swipe-right');
      wrapper.classList.remove('swipe-left');
    } else {
      if (el) {
        el.style.transform = 'translateX(0)';
        el.style.transition = 'transform 0.2s ease';
      }
      wrapper.classList.remove('swiping', 'swipe-left', 'swipe-right');
      if (swipedId === convId) setSwipedId(null);
    }
  };

  // Close swipe on outside tap
  useEffect(() => {
    const handleOutside = (e) => {
      if (swipedId && !e.target.closest('.conv-swipe-action') && !e.target.closest('.conv-swipe-action-left')) {
        setSwipedId(null);
        document.querySelectorAll('.conv-swipe-content').forEach(el => {
          el.style.transform = 'translateX(0)';
          el.style.transition = 'transform 0.2s ease';
        });
        document.querySelectorAll('.admin-conversation-item-wrapper').forEach(el => {
          el.classList.remove('swiping', 'swipe-left', 'swipe-right');
        });
      }
    };
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [swipedId]);

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    return conv.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <Clock size={14} className="status-icon-open" />;
      case 'closed': return <CheckCircle size={14} className="status-icon-closed" />;
      default: return null;
    }
  };

  const formatTime = (dateString) => {
    return formatConvTime(dateString);
  };

  // Archived view - full page like support
  if (showArchived) {
    const archivedSwipeStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchCurrentX.current = e.touches[0].clientX;
    };
    const archivedSwipeMove = (e) => {
      touchCurrentX.current = e.touches[0].clientX;
      const diff = touchStartX.current - touchCurrentX.current;
      const wrapper = e.currentTarget;
      const el = wrapper.querySelector('.conv-swipe-content');
      if (diff < -10) {
        wrapper.classList.add('swiping', 'swipe-right');
      }
      if (el && diff < 0) {
        el.style.transform = `translateX(${Math.min(Math.abs(diff), 90)}px)`;
        el.style.transition = 'none';
      }
    };
    const archivedSwipeEnd = (e, convId) => {
      const diff = touchStartX.current - touchCurrentX.current;
      const wrapper = e.currentTarget;
      const el = wrapper.querySelector('.conv-swipe-content');
      if (diff < -swipeThreshold) {
        if (el) {
          el.style.transform = 'translateX(80px)';
          el.style.transition = 'transform 0.2s ease';
        }
        setSwipedId(convId);
      } else {
        if (el) {
          el.style.transform = 'translateX(0)';
          el.style.transition = 'transform 0.2s ease';
        }
        wrapper.classList.remove('swiping', 'swipe-right');
        if (swipedId === convId) setSwipedId(null);
      }
    };

    return (
      <div className="support-chat-container">
        <div className="chat-header-glass">
          <button className="chat-back-btn" onClick={() => setShowArchived(false)}>
            <ArrowLeft size={22} />
          </button>
          <div className="chat-header-info">
            <div className="chat-header-text">
              <span className="chat-header-title">آرشیو</span>
              <span className="chat-header-status">{archivedConversations.length} مکالمه</span>
            </div>
            <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <Archive size={22} />
            </div>
          </div>
        </div>

        <div className="admin-conversations-list">
          {archivedConversations.length === 0 ? (
            <div className="admin-empty-state">
              <Archive size={48} />
              <h3>آرشیوی وجود ندارد</h3>
              <p>مکالمات آرشیو شده اینجا نمایش داده می‌شوند</p>
            </div>
          ) : (
            archivedConversations.map(conv => (
              <div 
                key={conv.id}
                className="admin-conversation-item-wrapper"
                onTouchStart={archivedSwipeStart}
                onTouchMove={archivedSwipeMove}
                onTouchEnd={(e) => archivedSwipeEnd(e, conv.id)}
              >
                <div className="conv-swipe-action-left" style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                }}
                  onClick={(e) => { e.stopPropagation(); if (actionLoadingId) return; unarchiveConversation(conv.id); }}
                  onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); if (actionLoadingId) return; unarchiveConversation(conv.id); }}
                >
                  {actionLoadingId === conv.id ? <Loader2 size={20} className="spinning" /> : <ArchiveRestore size={20} />}
                  <span>{actionLoadingId === conv.id ? '...' : 'بازگردانی'}</span>
                </div>

                <div 
                  className="conv-swipe-content"
                  onClick={() => { setShowArchived(false); onSelectConversation(conv.id); }}
                >
                  <div className="conv-avatar">
                    <User size={24} />
                  </div>
                  <div className="conv-details">
                    <div className="conv-top-row">
                      <span className="conv-name">{conv.userName}</span>
                      {conv.lastMessageAt && (
                        <span className="conv-time">{formatConvTime(conv.lastMessageAt)}</span>
                      )}
                    </div>
                    <div className="conv-preview">
                      <p className="conv-message">{conv.lastMessage || 'بدون پیام'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <style>{`
          .conv-swipe-action-left {
            position: absolute; top: 0; left: 0; width: 80px; height: 100%;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 4px; color: white; font-size: 11px; font-weight: 600;
            cursor: pointer; z-index: 1; opacity: 0;
            transition: opacity 0.15s ease; pointer-events: none;
          }
          .admin-conversation-item-wrapper.swiping.swipe-right .conv-swipe-action-left {
            opacity: 1; pointer-events: auto;
          }
          .admin-conversations-list {
            flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch;
          }
          .admin-conversations-list::-webkit-scrollbar { display: none; }
          .admin-empty-state {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 12px; height: 300px; color: rgba(255,255,255,0.4); text-align: center; padding: 20px;
          }
          .admin-empty-state h3 { font-size: 18px; color: rgba(255,255,255,0.7); margin: 0; }
          .admin-empty-state p { font-size: 14px; margin: 0; }
          .admin-conversation-item-wrapper {
            position: relative; overflow: hidden;
            border-bottom: 1px solid rgba(255,255,255,0.08);
          }
          .conv-swipe-content {
            position: relative; display: flex; align-items: center; gap: 14px; padding: 16px;
            background: rgb(15 15 25 / 40%); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            cursor: pointer; z-index: 2; will-change: transform;
          }
          .conv-swipe-content:active { background: rgba(255,255,255,0.06); }
          .conv-avatar {
            width: 52px; height: 52px; border-radius: 50%;
            background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(139,92,246,0.4));
            display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;
          }
          .conv-details { flex: 1; min-width: 0; overflow: hidden; }
          .conv-top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
          .conv-name { font-size: 16px; font-weight: 600; color: #fff; }
          .conv-time { font-size: 12px; color: rgba(255,255,255,0.5); }
          .conv-preview { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
          .conv-message {
            flex: 1; font-size: 14px; color: rgba(255,255,255,0.6);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">پشتیبانی</span>
            <span className="chat-header-status">{conversations.length} گفتگو</span>
          </div>
          <div className="chat-avatar-glass">
            <MessageSquare size={22} />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="admin-filters-container">
        <div className="admin-search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="جستجو..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onTeamChat && (
            <button className="team-chat-nav-btn" onClick={() => { setShowUserPicker(true); }}
              style={{ width: '10%', justifyContent: 'center', padding: '8px 0' }}>
              <UserPlus size={18} />
            </button>
          )}
          {onTeamChat && (
            <button className="team-chat-nav-btn" onClick={() => { setShowArchived(true); fetchArchivedConversations(); }}
              style={{ width: '10%', justifyContent: 'center', padding: '8px 0' }}>
              <Archive size={18} />
            </button>
          )}
          {onTeamChat && (
            <button className="team-chat-nav-btn" onClick={onTeamChat} style={{ width: '80%', justifyContent: 'center' }}>
              <Users size={18} />
              <span>چت تیمی</span>
              {teamUnreadCount > 0 && (
                <span className="team-chat-badge">{teamUnreadCount}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="admin-conversations-list">
        {loading ? (
          <div className="admin-loading">
            <Loader2 size={32} className="spinning" />
            <span>در حال بارگذاری...</span>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="admin-empty-state">
            <MessageSquare size={48} />
            <h3>گفتگویی یافت نشد</h3>
            <p>هنوز هیچ گفتگویی وجود ندارد</p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <div 
              key={conv.id}
              className="admin-conversation-item-wrapper"
              onTouchStart={(e) => handleTouchStart(e, conv.id)}
              onTouchMove={(e) => handleTouchMove(e, conv.id)}
              onTouchEnd={(e) => handleTouchEnd(e, conv.id)}
            >
              {/* Swipe action behind - RIGHT side (unread) */}
              <div className="conv-swipe-action" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (actionLoadingId) return;
                  markAsUnread(conv.id);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (actionLoadingId) return;
                  markAsUnread(conv.id);
                }}
              >
                {actionLoadingId === conv.id ? <Loader2 size={20} className="spinning" /> : <MailOpen size={20} />}
                <span>{actionLoadingId === conv.id ? '...' : 'Unread'}</span>
              </div>

              {/* Swipe action behind - LEFT side (archive) */}
              <div className="conv-swipe-action-left" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (actionLoadingId) return;
                  archiveConversation(conv.id);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (actionLoadingId) return;
                  archiveConversation(conv.id);
                }}
              >
                {actionLoadingId === conv.id ? <Loader2 size={20} className="spinning" /> : <Archive size={20} />}
                <span>{actionLoadingId === conv.id ? '...' : 'آرشیو'}</span>
              </div>
              
              {/* Main content */}
              <div 
                className={`conv-swipe-content ${conv.unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={(e) => {
                  if (swipedId === conv.id) {
                    e.stopPropagation();
                    return;
                  }
                  onSelectConversation(conv.id);
                }}
              >
                <div className="conv-avatar">
                  <User size={24} />
                  {onlineStatuses[String(conv.userId)]?.online && <span className="online-dot-avatar"></span>}
                </div>
                
                <div className="conv-content">
                  <div className="conv-header">
                    <span className="conv-name">{conv.userName || 'کاربر'}</span>
                    <span className="conv-time">{formatTime(conv.lastMessageAt)}</span>
                  </div>
                  <div className="conv-preview">
                    <p className="conv-message">{conv.lastMessage || 'بدون پیام'}</p>
                    <div className="conv-meta">
                      {conv.unreadCount > 0 && (
                        <span className="conv-unread-badge">{conv.unreadCount}</span>
                      )}
                      {getStatusIcon(conv.status)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .admin-filters-container {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .admin-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .admin-search-box svg {
          color: rgba(255, 255, 255, 0.5);
          flex-shrink: 0;
        }
        
        .admin-search-box input {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font-size: 15px;
          font-family: inherit;
        }
        
        .admin-search-box input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .team-chat-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 10px;
          color: #6ee7b7;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          position: relative;
        }
        
        .team-chat-nav-btn:active {
          background: rgba(16, 185, 129, 0.25);
          transform: scale(0.98);
        }
        
        .team-chat-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .admin-conversations-list {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        
        .admin-conversations-list::-webkit-scrollbar {
          display: none;
        }
        
        .admin-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          height: 300px;
          color: rgba(255, 255, 255, 0.6);
        }
        
        .spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .admin-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 300px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
          padding: 20px;
        }
        
        .admin-empty-state h3 {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
        }
        
        .admin-empty-state p {
          font-size: 14px;
          margin: 0;
        }
        
        /* Swipe container */
        .admin-conversation-item-wrapper {
          position: relative;
          overflow: hidden;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        /* Swipe action (behind) - hidden by default */
        .conv-swipe-action {
          position: absolute;
          top: 0;
          right: 0;
          width: 80px;
          height: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          z-index: 1;
          opacity: 0;
          transition: opacity 0.15s ease;
          pointer-events: none;
        }
        
        .admin-conversation-item-wrapper.swiping.swipe-left .conv-swipe-action {
          opacity: 1;
          pointer-events: auto;
        }

        .admin-conversation-item-wrapper.swiping.swipe-right .conv-swipe-action-left {
          opacity: 1;
          pointer-events: auto;
        }
        
        .conv-swipe-action:active {
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
        }

        /* Archive action - LEFT side */
        .conv-swipe-action-left {
          position: absolute;
          top: 0;
          left: 0;
          width: 80px;
          height: 100%;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: white;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          z-index: 1;
          opacity: 0;
          transition: opacity 0.15s ease;
          pointer-events: none;
        }

        .conv-swipe-action-left:active {
          background: linear-gradient(135deg, #dc2626, #b91c1c);
        }
        
        /* Main content (slides) */
        .conv-swipe-content {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          background: rgb(15 15 25 / 40%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          cursor: pointer;
          z-index: 2;
          will-change: transform;
        }
        
        .conv-swipe-content:active {
          background: rgba(255, 255, 255, 0.06);
        }
        
        .conv-swipe-content.has-unread {
          background: rgba(99, 102, 241, 0.08);
        }
        
        .conv-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }
        
        .conv-content {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        
        .conv-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        
        .conv-name {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }
        
        .conv-time {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .conv-preview {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        
        .conv-message {
          flex: 1;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }
        
        .conv-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        
        .conv-unread-badge {
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 11px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .status-icon-open {
          color: #fbbf24;
        }
        
        .status-icon-closed {
          color: #10b981;
        }
      `}</style>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div style={modalStyles.overlay} onClick={() => setShowUserPicker(false)}>
          <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div style={modalStyles.header}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>انتخاب کاربر</span>
              <button onClick={() => setShowUserPicker(false)} style={modalStyles.closeBtn}><X size={18} /></button>
            </div>
            <div style={modalStyles.searchBox}>
              <Search size={16} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="جستجو نام یا ایمیل..."
                value={userSearch}
                onChange={e => searchUsers(e.target.value)}
                style={modalStyles.searchInput}
                dir="rtl"
                autoFocus
              />
            </div>
            <div style={modalStyles.list}>
              {userLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : userResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  {userSearch ? 'کاربری یافت نشد' : 'نام یا ایمیل کاربر را جستجو کنید'}
                </div>
              ) : (
                userResults.map(u => (
                  <button key={u.id} onClick={() => startChatWithUser(u.id)} style={modalStyles.userItem}>
                    <div style={modalStyles.avatar}>
                      {(u.displayName || u.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'white', textAlign: 'right' }}>{u.displayName || u.username}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>{u.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const modalStyles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '20px',
  },
  modal: {
    width: '100%', maxWidth: '380px', maxHeight: '70vh',
    background: 'rgba(30,30,40,0.95)', borderRadius: '20px',
    border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column', direction: 'rtl',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: 'white',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer', padding: '4px', display: 'flex',
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', margin: '12px 16px 0',
    background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: 'white', fontSize: '13px', fontFamily: 'inherit',
  },
  list: {
    flex: 1, overflowY: 'auto', padding: '8px 16px 16px',
    display: 'flex', flexDirection: 'column', gap: '4px',
  },
  userItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '12px', cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    transition: 'background 0.2s', width: '100%', color: 'white',
  },
  avatar: {
    width: '34px', height: '34px', borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '600', fontSize: '14px', color: 'white', flexShrink: 0,
  },
  archivedItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px', borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    width: '100%',
  },
};

export default AdminConversations;