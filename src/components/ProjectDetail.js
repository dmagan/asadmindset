import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ChevronLeft, 
  Film, 
  Calendar, 
  Clock, 
  Download, 
  Send,
  CheckCircle,
  Circle,
  MessageSquare,
  User
} from 'lucide-react';
import { authService } from '../services/authService';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    labelDe: 'Ausstehend',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.15)'
  },
  need_info: {
    label: 'Need Info',
    labelDe: 'Info benötigt',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.15)'
  },
  in_progress: {
    label: 'In Progress',
    labelDe: 'In Bearbeitung',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.15)'
  },
  revision: {
    label: 'Revision',
    labelDe: 'Überarbeitung',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.15)'
  },
  completed: {
    label: 'Completed',
    labelDe: 'Abgeschlossen',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.15)'
  },
  delivered: {
    label: 'Delivered',
    labelDe: 'Geliefert',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)'
  }
};

const STATUS_ORDER = ['pending', 'in_progress', 'completed', 'delivered'];

const ProjectDetail = ({ project, onBack }) => {
  const { t, i18n } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState(project.messages || []);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef(null);

  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending;
  const isGerman = i18n.language === 'de';

  // Load messages when component mounts
  useEffect(() => {
    loadMessages();
  }, [project.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoadingMessages(true);
      const orderData = await authService.getMyOrder(project.id);
      if (orderData.messages) {
        setMessages(orderData.messages);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isGerman ? 'de-DE' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(isGerman ? 'de-DE' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatMessageDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return isGerman ? 'Heute' : 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return isGerman ? 'Gestern' : 'Yesterday';
    } else {
      return date.toLocaleDateString(isGerman ? 'de-DE' : 'en-US', {
        day: 'numeric',
        month: 'short'
      });
    }
  };

  const getCurrentStatusIndex = () => {
    return STATUS_ORDER.indexOf(project.status);
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    
    setSending(true);
    try {
      await authService.sendMessage(project.id, message);
      
      // Add message to local state
      const newMessage = {
        id: Date.now(),
        from: 'customer',
        text: message,
        date: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      setMessage('');
    } catch (error) {
      alert(t('messageFailed', 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const handleDownload = () => {
    if (project.finalVideo) {
      window.open(project.finalVideo, '_blank');
    } else {
      alert(t('noDownload', 'No file available for download'));
    }
  };

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const dateKey = new Date(msg.date).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="project-detail">
      {/* Header */}
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          <ChevronLeft size={24} />
          <span>{t('back', 'Back')}</span>
        </button>
        
        <span 
          className="detail-status"
          style={{ color: status.color, background: status.bg }}
        >
          {isGerman ? status.labelDe : status.label}
        </span>
      </div>

      {/* Project Info */}
      <div className="detail-section">
        <div className="detail-row">
          <span className="detail-label">{t('style', 'Style')}</span>
          <span className="detail-value">{project.style}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">
            <Calendar size={16} />
            {t('orderDate', 'Order Date')}
          </span>
          <span className="detail-value">{formatDate(project.createdAt)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">
            <Clock size={16} />
            {t('delivery', 'Delivery')}
          </span>
          <span className="detail-value">{project.deliveryTime}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">{t('total', 'Total')}</span>
          <span className="detail-value price">${project.total}</span>
        </div>
      </div>

      {/* Status Timeline */}
      <div className="detail-section">
        <h3 className="section-title">{t('progress', 'Progress')}</h3>
        <div className="status-timeline">
          {STATUS_ORDER.map((statusKey, index) => {
            const statusInfo = STATUS_CONFIG[statusKey];
            const currentIndex = getCurrentStatusIndex();
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <div key={statusKey} className="timeline-item">
                <div className={`timeline-dot ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                  {isCompleted ? (
                    <CheckCircle size={20} />
                  ) : (
                    <Circle size={20} />
                  )}
                </div>
                <span className={`timeline-label ${isCompleted ? 'completed' : ''}`}>
                  {isGerman ? statusInfo.labelDe : statusInfo.label}
                </span>
                {index < STATUS_ORDER.length - 1 && (
                  <div className={`timeline-line ${index < currentIndex ? 'completed' : ''}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Videos */}
      <div className="detail-section">
        <h3 className="section-title">
          {t('videos', 'Videos')} ({project.videos?.length || 0})
        </h3>
        <div className="videos-list">
          {(project.videos || []).map((video, index) => (
            <div key={video.id} className="video-item">
              <div className="video-icon">
                <Film size={20} />
              </div>
              <div className="video-info">
                <span className="video-name">{video.name}</span>
                {video.description && (
                  <span className="video-desc">{video.description}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* General Description */}
      {project.generalDescription && (
        <div className="detail-section">
          <h3 className="section-title">{t('generalDescription', 'Description')}</h3>
          <p className="general-desc">{project.generalDescription}</p>
        </div>
      )}

      {/* Messages Section */}
      <div className="detail-section messages-section">
        <h3 className="section-title">
          <MessageSquare size={18} />
          {t('messages', 'Messages')}
        </h3>
        
        <div className="messages-container">
          {loadingMessages ? (
            <div className="messages-loading">
              <div className="loading-spinner"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="no-messages">
              <MessageSquare size={32} />
              <p>{t('noMessages', 'No messages yet')}</p>
            </div>
          ) : (
            <div className="messages-list">
              {Object.entries(messageGroups).map(([dateKey, msgs]) => (
                <div key={dateKey}>
                  <div className="message-date-divider">
                    <span>{formatMessageDate(msgs[0].date)}</span>
                  </div>
                  {msgs.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`message-bubble ${msg.from === 'admin' ? 'admin' : 'customer'}`}
                    >
                      <div className="message-content">
                        <p className="message-text">{msg.text}</p>
                        <span className="message-time">{formatMessageTime(msg.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="message-input-container">
          <input
            type="text"
            className="message-input"
            placeholder={t('typeMessage', 'Type your message...')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <div className="loading-spinner small"></div>
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>

      {/* Download Button - Only show when completed or delivered */}
      {(project.status === 'completed' || project.status === 'delivered') && project.finalVideo && (
        <button className="download-button" onClick={handleDownload}>
          <Download size={20} />
          <span>{t('downloadFiles', 'Download Files')}</span>
        </button>
      )}

      <style>{`
        .project-detail {
          padding: 20px;
          padding-bottom: 100px;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          margin: 16px;
        }

        .detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .back-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 10px;
          border: none;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .detail-status {
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
        }

        .detail-section {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          font-weight: 600;
          color: white;
          margin: 0 0 14px 0;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
        }

        .detail-value {
          font-size: 14px;
          color: white;
          font-weight: 500;
        }

        .detail-value.price {
          color: #10b981;
          font-weight: 700;
          font-size: 16px;
        }

        /* Status Timeline */
        .status-timeline {
          display: flex;
          justify-content: space-between;
          position: relative;
        }

        .timeline-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          position: relative;
          flex: 1;
        }

        .timeline-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.3);
          z-index: 1;
        }

        .timeline-dot.completed {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
        }

        .timeline-dot.current {
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
        }

        .timeline-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          text-align: center;
        }

        .timeline-label.completed {
          color: rgba(255, 255, 255, 0.7);
        }

        .timeline-line {
          position: absolute;
          top: 16px;
          left: 50%;
          width: 100%;
          height: 2px;
          background: rgba(255, 255, 255, 0.1);
        }

        .timeline-line.completed {
          background: rgba(34, 197, 94, 0.4);
        }

        /* Videos List */
        .videos-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .video-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
        }

        .video-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
          flex-shrink: 0;
        }

        .video-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .video-name {
          font-size: 14px;
          color: white;
          font-weight: 500;
        }

        .video-desc {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .general-desc {
          margin: 0;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        /* Messages Section */
        .messages-section {
          padding-bottom: 8px;
        }

        .messages-container {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 12px;
          padding-right: 4px;
        }

        .messages-container::-webkit-scrollbar {
          width: 4px;
        }

        .messages-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }

        .messages-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .messages-loading {
          display: flex;
          justify-content: center;
          padding: 30px;
        }

        .no-messages {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 30px;
          color: rgba(255, 255, 255, 0.3);
        }

        .no-messages p {
          margin: 0;
          font-size: 14px;
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message-date-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 16px 0 12px;
        }

        .message-date-divider span {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.08);
          padding: 4px 12px;
          border-radius: 10px;
        }

        .message-bubble {
          display: flex;
          margin-bottom: 4px;
        }

        .message-bubble.customer {
          justify-content: flex-end;
        }

        .message-bubble.admin {
          justify-content: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 16px;
          position: relative;
        }

        .message-bubble.customer .message-content {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border-bottom-right-radius: 4px;
        }

        .message-bubble.admin .message-content {
          background: rgba(255, 255, 255, 0.1);
          border-bottom-left-radius: 4px;
        }

        .message-text {
          margin: 0;
          font-size: 14px;
          color: white;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .message-time {
          display: block;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 4px;
          text-align: right;
        }

        .message-bubble.customer .message-time {
          color: rgba(255, 255, 255, 0.7);
        }

        /* Message Input */
        .message-input-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .message-input {
          flex: 1;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          color: white;
          font-size: 14px;
          outline: none;
          transition: all 0.2s;
        }

        .message-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .message-input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(255, 255, 255, 0.1);
        }

        .send-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Download Button */
        .download-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .download-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-spinner.small {
          width: 18px;
          height: 18px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProjectDetail;