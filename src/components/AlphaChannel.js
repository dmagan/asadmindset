import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Eye, 
  Pin, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX,
  X,
  Bell,
  Loader2,
  RefreshCw,
  ArrowDown
} from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

// Pusher singleton to prevent multiple connections
let pusherInstance = null;
let alphaChannelInstance = null;
let notificationChannelInstance = null;

const getPusher = () => {
  if (!pusherInstance) {
    pusherInstance = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
    console.log('Created new Pusher instance');
  }
  return pusherInstance;
};

const AlphaChannel = ({ onBack }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Media states
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomedVideo, setZoomedVideo] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Refs
  const containerRef = useRef(null);
  const postsEndRef = useRef(null);
  const audioRefs = useRef({});
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const notificationChannelRef = useRef(null);
  
  // Scroll to bottom button
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Load posts
  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/channel/posts?page=${pageNum}&per_page=20`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load posts');
      
      const data = await response.json();
      
      if (append) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      
      setHasMore(pageNum < data.pagination.totalPages);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/notifications?per_page=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      setNotifications(data.notifications);
      
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, []);

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      setUnreadCount(data.count);
      
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, []);

  // Connect Pusher
  const connectPusher = useCallback(() => {
    const pusher = getPusher();
    pusherRef.current = pusher;
    
    // Only bind connection events once
    if (!pusher._alphaConnectionBound) {
      pusher.connection.bind('connected', () => {
        console.log('Pusher connected!');
      });
      pusher.connection.bind('error', (err) => {
        console.error('Pusher connection error:', err);
      });
      pusher._alphaConnectionBound = true;
    }
    
    // Subscribe to alpha-channel if not already
    if (!alphaChannelInstance) {
      alphaChannelInstance = pusher.subscribe('alpha-channel');
      console.log('Subscribing to alpha-channel...');
      
      alphaChannelInstance.bind('pusher:subscription_succeeded', () => {
        console.log('Subscribed to alpha-channel');
      });
    }
    channelRef.current = alphaChannelInstance;
    
    // Bind events (unbind first to prevent duplicates)
    channelRef.current.unbind('new-post');
    channelRef.current.bind('new-post', (data) => {
      console.log('New post received:', data);
      setPosts(prev => [data, ...prev]);
      playNotificationSound();
    });
    
    channelRef.current.unbind('post-updated');
    channelRef.current.bind('post-updated', (data) => {
      console.log('Post updated:', data);
      setPosts(prev => prev.map(p => p.id === data.id ? { ...p, ...data } : p));
    });
    
    channelRef.current.unbind('post-deleted');
    channelRef.current.bind('post-deleted', (data) => {
      console.log('Post deleted:', data);
      setPosts(prev => prev.filter(p => p.id !== data.id));
    });
    
    channelRef.current.unbind('post-pinned');
    channelRef.current.bind('post-pinned', (data) => {
      console.log('Post pinned:', data);
      setPosts(prev => {
        const updated = prev.map(p => p.id === data.id ? { ...p, isPinned: data.isPinned } : p);
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
    });
    
    channelRef.current.unbind('reaction-updated');
    channelRef.current.bind('reaction-updated', (data) => {
      console.log('Reaction updated:', data);
      setPosts(prev => prev.map(p => 
        p.id === data.postId ? { ...p, reactionsCount: data.reactionsCount } : p
      ));
    });
    
    // Notifications channel
    if (!notificationChannelInstance) {
      notificationChannelInstance = pusher.subscribe('alpha-notifications');
      console.log('Subscribing to alpha-notifications...');
      
      notificationChannelInstance.bind('pusher:subscription_succeeded', () => {
        console.log('Subscribed to alpha-notifications');
      });
    }
    notificationChannelRef.current = notificationChannelInstance;
    
    notificationChannelRef.current.unbind('new-notification');
    notificationChannelRef.current.bind('new-notification', (data) => {
      console.log('New notification:', data);
      setUnreadCount(prev => prev + 1);
      setNotifications(prev => [{
        id: Date.now(),
        ...data,
        isRead: false,
        createdAt: new Date().toISOString()
      }, ...prev.slice(0, 9)]);
      
      playNotificationSound();
    });
    
  }, []);

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), 150);
    } catch (e) {}
  };

  // Initialize
  useEffect(() => {
    loadPosts();
    loadNotifications();
    loadUnreadCount();
    connectPusher();
    
    // Cleanup only unbinds local handlers, doesn't disconnect Pusher
    return () => {
      // Events will be re-bound on next mount
    };
  }, [loadPosts, loadNotifications, loadUnreadCount, connectPusher]);

  // Scroll to bottom after initial posts load
  useEffect(() => {
    if (!loading && posts.length > 0) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        postsEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [loading]);

  // Scroll to bottom
  const scrollToBottom = () => {
    postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll - for infinite scroll (load older posts at top) and show/hide scroll button
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // Show scroll button when not at bottom
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollButton(!isNearBottom);
    
    // Load more posts when scrolling to TOP (older posts)
    if (scrollTop < 300 && !loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  // Toggle reaction
  const toggleReaction = async (postId, currentlyReacted) => {
    try {
      const token = authService.getToken();
      
      // Optimistic update
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            userReacted: !currentlyReacted,
            reactionsCount: currentlyReacted ? p.reactionsCount - 1 : p.reactionsCount + 1
          };
        }
        return p;
      }));
      
      const response = await fetch(`${API_URL}/channel/posts/${postId}/react`, {
        method: currentlyReacted ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type: 'like' })
      });
      
      if (!response.ok) throw new Error('Failed to toggle reaction');
      
      // Vibrate
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      
    } catch (error) {
      console.error('Error toggling reaction:', error);
      // Revert on error
      loadPosts(1, false);
    }
  };

  // Mark all notifications as read
  const markAllRead = async () => {
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  // Format time
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'همین الان';
    if (minutes < 60) return `${minutes} دقیقه پیش`;
    if (hours < 24) return `${hours} ساعت پیش`;
    if (days < 7) return `${days} روز پیش`;
    
    return date.toLocaleDateString('fa-IR');
  };

  // Format audio duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Toggle audio play
  const toggleAudioPlay = (postId, audioUrl) => {
    const audio = audioRefs.current[postId];
    
    if (playingAudioId === postId) {
      audio?.pause();
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
      setPlaybackSpeed(1);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
        audioRefs.current[playingAudioId].currentTime = 0;
      }
      setAudioCurrentTime(0);
      setPlaybackSpeed(1);
      
      if (audio) {
        audio.playbackRate = 1;
        audio.play()
          .then(() => setPlayingAudioId(postId))
          .catch(err => console.error('Play error:', err));
      }
    }
  };

  // Toggle playback speed
  const togglePlaybackSpeed = (e, postId) => {
    e.stopPropagation();
    const audio = audioRefs.current[postId];
    if (!audio) return;

    let newSpeed;
    if (playbackSpeed === 1) newSpeed = 1.5;
    else if (playbackSpeed === 1.5) newSpeed = 2;
    else newSpeed = 1;
    
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  // Render post content based on type
  const renderPostContent = (post) => {
    return (
      <>
        {/* Text content */}
        {post.content && (
          <p className="post-text">{post.content}</p>
        )}
        
        {/* Image */}
        {post.mediaType === 'image' && post.mediaUrl && (
          <div className="post-media">
            <img 
              src={post.mediaUrl} 
              alt="" 
              className="post-image"
              onClick={() => setZoomedImage(post.mediaUrl)}
            />
          </div>
        )}
        
        {/* Video */}
        {post.mediaType === 'video' && post.mediaUrl && (
          <div className="post-media">
            <div 
              className="video-thumbnail"
              onClick={() => setZoomedVideo(post.mediaUrl)}
            >
              <video 
                src={post.mediaUrl + '#t=0.5'}
                className="post-video-preview"
                preload="metadata"
                muted
                playsInline
              />
              <div className="video-play-overlay">
                <Play size={48} fill="white" />
              </div>
            </div>
          </div>
        )}
        
        {/* Audio */}
        {post.mediaType === 'audio' && post.mediaUrl && (
          <div className={`audio-player ${playingAudioId === post.id ? 'playing' : ''}`}>
            <button 
              className="audio-play-btn"
              onClick={() => toggleAudioPlay(post.id, post.mediaUrl)}
            >
              {playingAudioId === post.id ? <Pause size={22} /> : <Play size={22} />}
            </button>
            <div className="audio-wave">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="audio-wave-bar"></div>
              ))}
            </div>
            <span className="audio-duration">
              {playingAudioId === post.id 
                ? `${formatDuration(audioCurrentTime)} / ${formatDuration(audioRefs.current[post.id]?.duration || post.mediaDuration || 0)}`
                : formatDuration(audioRefs.current[post.id]?.duration || post.mediaDuration || 0)
              }
            </span>
            {playingAudioId === post.id && (
              <button 
                className="audio-speed-btn"
                onClick={(e) => togglePlaybackSpeed(e, post.id)}
              >
                {playbackSpeed}x
              </button>
            )}
            <audio 
              ref={el => audioRefs.current[post.id] = el}
              src={post.mediaUrl}
              onTimeUpdate={(e) => {
                if (playingAudioId === post.id) {
                  setAudioCurrentTime(e.target.currentTime);
                }
              }}
              onEnded={() => {
                setPlayingAudioId(null);
                setAudioCurrentTime(0);
              }}
            />
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <div className="support-chat-container">
        <div className="chat-header-glass">
          <button className="chat-back-btn" onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
          <div className="chat-header-info">
            <div className="chat-header-text">
              <span className="chat-header-title">کانال آلفا</span>
              <span className="chat-header-status">در حال بارگذاری...</span>
            </div>
            <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              📢
            </div>
          </div>
        </div>
        <div className="chat-loading">
          <div className="chat-loading-spinner"></div>
        </div>
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
            <span className="chat-header-title">کانال آلفا</span>
            <span className="chat-header-status">{posts.length} پست</span>
          </div>
          <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            📢
          </div>
        </div>
        
        {/* Notification Bell */}
        <button 
          className="notification-bell-btn"
          onClick={() => {
            setShowNotifications(!showNotifications);
            if (!showNotifications) markAllRead();
          }}
        >
          <Bell size={22} />
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <span>اعلان‌ها</span>
            <button onClick={() => setShowNotifications(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">اعلانی وجود ندارد</div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`notification-item ${n.isRead ? '' : 'unread'}`}>
                  <div className="notification-title">{n.title}</div>
                  <div className="notification-message">{n.message}</div>
                  <div className="notification-time">{formatTime(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Posts Area */}
      <div 
        className="channel-posts-area"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {/* Loading more indicator at top */}
        {loadingMore && (
          <div className="loading-more">
            <Loader2 size={24} className="spinning" />
          </div>
        )}
        
        {/* No more posts - at top */}
        {!hasMore && posts.length > 0 && (
          <div className="no-more-posts">پست‌های بیشتری وجود ندارد</div>
        )}

        {/* Posts - reversed so newest is at bottom */}
        {[...posts].reverse().map((post) => (
          <div 
            key={post.id} 
            className={`channel-post-card ${post.isPinned ? 'pinned' : ''}`}
          >
            {/* Pin indicator */}
            {post.isPinned && (
              <div className="pin-indicator">
                <Pin size={14} />
                <span>پین شده</span>
              </div>
            )}
            
            {/* Post content */}
            <div className="post-content">
              {renderPostContent(post)}
            </div>
            
            {/* Post footer */}
            <div className="post-footer">
              <div className="post-stats">
                <span className="post-time">
                  {formatTime(post.createdAt)}
                  {post.isEdited && <span className="edited-label"> • ویرایش شده</span>}
                </span>
                <div className="post-counters">
                  <span className="view-count">
                    <Eye size={14} />
                    {post.viewsCount}
                  </span>
                </div>
              </div>
              
              <button 
                className={`reaction-btn ${post.userReacted ? 'reacted' : ''}`}
                onClick={() => toggleReaction(post.id, post.userReacted)}
              >
                <Heart size={20} fill={post.userReacted ? '#ef4444' : 'none'} />
                <span>{post.reactionsCount}</span>
              </button>
            </div>
          </div>
        ))}
        
        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div className="empty-channel">
            <span className="empty-icon">📭</span>
            <p>هنوز پستی منتشر نشده است</p>
          </div>
        )}
        
        {/* Ref for scrolling to bottom */}
        <div ref={postsEndRef} />
      </div>
      
      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button className="scroll-to-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={20} />
        </button>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="image-zoom-overlay" onClick={() => setZoomedImage(null)}>
          <button className="zoom-close-btn" onClick={() => setZoomedImage(null)}>
            <X size={24} />
          </button>
          <img 
            src={zoomedImage} 
            alt="" 
            className="zoomed-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Video Modal */}
      {zoomedVideo && (
        <div className="video-zoom-overlay" onClick={() => setZoomedVideo(null)}>
          <button className="zoom-close-btn" onClick={() => setZoomedVideo(null)}>
            <X size={24} />
          </button>
          <video 
            src={zoomedVideo} 
            controls 
            autoPlay
            className="zoomed-video"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <style>{`
        .channel-posts-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px;
          padding-bottom: 40px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        
        .channel-posts-area::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }
        
        .channel-avatar {
          overflow: hidden;
          padding: 0;
        }
        
        .channel-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 67;
          left : 93%;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
          transition: all 0.3s ease;
        }
        
        .scroll-to-bottom-btn:active {
          transform: translateX(-50%) scale(0.9);
        }
        
        .refresh-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 12px;
          margin-bottom: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'Vazirmatn', sans-serif;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .refresh-btn:active {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(0.98);
        }
        
        .channel-post-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.2s;
        }
        
        .channel-post-card.pinned {
          border-color: rgba(99, 102, 241, 0.5);
          background: rgba(99, 102, 241, 0.1);
        }
        
        .pin-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #6366f1;
          font-size: 12px;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .post-content {
          margin-bottom: 12px;
        }
        
        .post-text {
          color: #fff;
          font-size: 15px;
          line-height: 1.8;
          white-space: pre-wrap;
          word-wrap: break-word;
          margin: 0 0 12px 0;
        }
        
        .post-media {
          margin-top: 12px;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .post-image {
          width: 100%;
          max-height: 400px;
          object-fit: cover;
          cursor: pointer;
          transition: transform 0.2s;
        }
        
        .post-image:active {
          transform: scale(0.98);
        }
        
        .video-thumbnail {
          position: relative;
          cursor: pointer;
        }
        
        .post-video-preview {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
        }
        
        .video-play-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 72px;
          height: 72px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .audio-player {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.3);
          padding: 12px 16px;
          border-radius: 24px;
          margin-top: 12px;
        }
        
        .audio-play-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        
        .audio-wave {
          display: flex;
          align-items: center;
          gap: 3px;
          flex: 1;
          height: 32px;
        }
        
        .audio-wave-bar {
          width: 4px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 2px;
          height: 100%;
          animation: none;
        }
        
        .audio-player.playing .audio-wave-bar {
          animation: audioWave 0.5s ease-in-out infinite alternate;
        }
        
        .audio-wave-bar:nth-child(1) { height: 40%; animation-delay: 0s; }
        .audio-wave-bar:nth-child(2) { height: 70%; animation-delay: 0.1s; }
        .audio-wave-bar:nth-child(3) { height: 50%; animation-delay: 0.2s; }
        .audio-wave-bar:nth-child(4) { height: 90%; animation-delay: 0.3s; }
        .audio-wave-bar:nth-child(5) { height: 60%; animation-delay: 0.4s; }
        .audio-wave-bar:nth-child(6) { height: 80%; animation-delay: 0.5s; }
        .audio-wave-bar:nth-child(7) { height: 45%; animation-delay: 0.6s; }
        .audio-wave-bar:nth-child(8) { height: 75%; animation-delay: 0.7s; }
        .audio-wave-bar:nth-child(9) { height: 55%; animation-delay: 0.8s; }
        .audio-wave-bar:nth-child(10) { height: 85%; animation-delay: 0.9s; }
        .audio-wave-bar:nth-child(11) { height: 65%; animation-delay: 1s; }
        .audio-wave-bar:nth-child(12) { height: 50%; animation-delay: 1.1s; }
        
        @keyframes audioWave {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1); }
        }
        
        .audio-duration {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          min-width: 80px;
          text-align: left;
        }
        
        .audio-speed-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 8px;
          color: white;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
        }
        
        .post-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .post-stats {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .post-time {
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
        }
        
        .edited-label {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .post-counters {
          display: flex;
          gap: 12px;
        }
        
        .view-count {
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 12px;
        }
        
        .reaction-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 20px;
          padding: 8px 16px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .reaction-btn:active {
          transform: scale(0.95);
        }
        
        .reaction-btn.reacted {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }
        
        .reaction-btn.reacted svg {
          color: #ef4444;
        }
        
        .notification-bell-btn {
          position: relative;
          background: transparent;
          border: none;
          color: white;
          padding: 8px;
          cursor: pointer;
          margin-left: auto;
          margin-right: 8px;
        }
        
        .notification-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 18px;
          height: 18px;
          background: #ef4444;
          border-radius: 9px;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }
        
        .notifications-dropdown {
          position: absolute;
          top: 70px;
          left: 16px;
          right: 16px;
          max-height: 400px;
          background: rgba(30, 30, 45, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          overflow: hidden;
          z-index: 100;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        
        .notifications-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          font-weight: 600;
        }
        
        .notifications-header button {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
        }
        
        .notifications-list {
          max-height: 340px;
          overflow-y: auto;
        }
        
        .notification-item {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .notification-item.unread {
          background: rgba(99, 102, 241, 0.1);
        }
        
        .notification-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
        }
        
        .notification-message {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          margin-bottom: 4px;
        }
        
        .notification-time {
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
        }
        
        .no-notifications {
          padding: 40px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
        }
        
        .loading-more {
          display: flex;
          justify-content: center;
          padding: 20px;
        }
        
        .spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .no-more-posts {
          text-align: center;
          padding: 20px;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }
        
        .empty-channel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        
        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        
        .empty-channel p {
          color: rgba(255, 255, 255, 0.5);
        }
        
        .image-zoom-overlay,
        .video-zoom-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        
        .zoom-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1001;
        }
        
        .zoomed-image {
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
          border-radius: 8px;
        }
        
        .zoomed-video {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default AlphaChannel;