import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  MessageSquare,
  Clock,
  CheckCircle,
  User,
  Loader2
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminConversations = ({ onBack, onSelectConversation }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

useEffect(() => {
  fetchConversations();
}, []);

  // Fix iOS scroll
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

        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    return conv.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           conv.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <Clock size={14} className="status-icon-open" />;
      case 'closed':
        return <CheckCircle size={14} className="status-icon-closed" />;
      default:
        return null;
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'الان';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} دقیقه`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ساعت`;
    
    return date.toLocaleDateString('fa-IR');
  };

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

      {/* Search & Filters */}
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
              className={`admin-conversation-item ${conv.unreadCount > 0 ? 'has-unread' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conv-avatar">
                <User size={24} />
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
        
        .admin-loading .spinning {
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
        
        .admin-conversation-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .admin-conversation-item:active {
          background: rgba(255, 255, 255, 0.08);
        }
        
        .admin-conversation-item.has-unread {
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
    </div>
  );
};

export default AdminConversations;