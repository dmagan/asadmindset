import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Users,
  Loader2,
  Radio,
  MessageCircle,
  ChevronDown
} from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

// Pusher singleton
let livePusherInstance = null;
const getLivePusher = () => {
  if (!livePusherInstance) {
    livePusherInstance = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
  }
  return livePusherInstance;
};

const LivePage = ({ streamId, onBack }) => {
  // Stream states
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewersCount, setViewersCount] = useState(0);
  const [isEnded, setIsEnded] = useState(false);

  // Chat states
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);

  // HLS player states
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);

  // Refs
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const chatContainerRef = useRef(null);
  const chatInputRef = useRef(null);
  const autoScrollRef = useRef(true);
  const joinedRef = useRef(false);

  // Get current user
  const currentUser = authService.getUser();
  const currentUserId = currentUser ? parseInt(currentUser.id || currentUser.user_id) : null;

  // ==========================================
  // Load HLS.js dynamically
  // ==========================================
  const loadHls = useCallback((url) => {
    if (!url) return;
    
    const tryLoad = (forceHlsJs = false) => {
      if (!videoRef.current) {
        console.log('[LivePage] videoRef not ready, retrying...');
        setTimeout(() => tryLoad(forceHlsJs), 300);
        return;
      }

      const video = videoRef.current;
      console.log('[LivePage] Loading HLS:', url, 'forceHlsJs:', forceHlsJs);

      // Try native HLS first (Safari/iOS) - but not if we're forcing hls.js
      if (!forceHlsJs && video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[LivePage] Trying native HLS');
        
        const onSuccess = () => {
          console.log('[LivePage] Native HLS success');
          setPlayerReady(true);
          setIsBuffering(false);
          video.play().catch(() => {});
          cleanup();
        };
        
        const onError = () => {
          console.warn('[LivePage] Native HLS failed, falling back to hls.js');
          cleanup();
          // پاک کردن src قبلی
          video.removeAttribute('src');
          video.load();
          // Fallback به hls.js
          tryLoad(true);
        };
        
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onSuccess);
          video.removeEventListener('error', onError);
        };
        
        video.addEventListener('loadedmetadata', onSuccess, { once: true });
        video.addEventListener('error', onError, { once: true });
        video.src = url;
        video.load();
        return;
      }

      // Use hls.js
      loadHlsJs(url, video);
    };

    const loadHlsJs = (hlsUrl, videoEl) => {
      // HLS.js already loaded?
      if (window.Hls && window.Hls.isSupported()) {
        console.log('[LivePage] HLS.js available, initializing');
        initHls(hlsUrl, videoEl);
        return;
      }

      // Load HLS.js from CDN
      console.log('[LivePage] Loading HLS.js from CDN...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
      script.onload = () => {
        if (window.Hls && window.Hls.isSupported()) {
          initHls(hlsUrl, videoRef.current);
        } else {
          console.error('[LivePage] HLS.js not supported');
          setPlayerError(true);
          setIsBuffering(false);
        }
      };
      script.onerror = () => {
        console.error('[LivePage] Failed to load HLS.js');
        setPlayerError(true);
        setIsBuffering(false);
      };
      document.head.appendChild(script);
    };

    const initHls = (hlsUrl, videoEl) => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
        liveDurationInfinity: true,
        highBufferWatchdogPeriod: 1,
        maxBufferLength: 5,
        maxMaxBufferLength: 10,
        maxBufferSize: 2 * 1000 * 1000,
        startFragPrefetch: true
      });
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoEl);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        console.log('[LivePage] HLS.js manifest parsed - playing');
        setPlayerReady(true);
        setIsBuffering(false);
        videoEl.play().catch(() => {});
      });
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        console.error('[LivePage] HLS.js error:', data.type, data.details);
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setPlayerError(true);
              setIsBuffering(false);
              break;
          }
        }
      });
    };

    tryLoad();
  }, []);

  // ==========================================
  // Fetch stream data
  // ==========================================
  useEffect(() => {
    const fetchStream = async () => {
      try {
        setLoading(true);
        const token = authService.getToken();
        
        let id = streamId;
        
        // اگه streamId نداریم، از status بگیر
        if (!id) {
          const statusRes = await fetch(`${API_URL}/live/status`);
          const statusData = await statusRes.json();
          if (statusData.is_live && statusData.stream_id) {
            id = statusData.stream_id;
          } else {
            throw new Error('لایو فعالی وجود ندارد');
          }
        }
        
        const res = await fetch(`${API_URL}/live/watch/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('خطا در دریافت اطلاعات لایو');

        const data = await res.json();
        setStream(data);
        setViewersCount(data.viewers_count || 0);

        if (data.status === 'ended') {
          setIsEnded(true);
        }

        // Load HLS player - اگه video ref هنوز نیست، ذخیره میشه و بعد لود میشه
        if (data.playback_hls) {
          loadHls(data.playback_hls);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStream();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamId, loadHls]);

  // ==========================================
  // Join/Leave live
  // ==========================================
  useEffect(() => {
    if (!stream || stream.status !== 'live' || joinedRef.current) return;

    const joinLive = async () => {
      try {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/live/join/${stream.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setViewersCount(data.viewers_count);
          joinedRef.current = true;
        }
      } catch (e) {
        console.error('Join live error:', e);
      }
    };

    joinLive();

    return () => {
      if (joinedRef.current) {
        const token = authService.getToken();
        fetch(`${API_URL}/live/leave/${stream.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          keepalive: true
        }).catch(() => {});
        joinedRef.current = false;
      }
    };
  }, [stream]);

  // ==========================================
  // Load chat messages
  // ==========================================
  useEffect(() => {
    if (!stream?.id) return;

    const loadChat = async () => {
      try {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/live/chat/${stream.id}?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
          setTimeout(() => scrollChatToBottom(), 100);
        }
      } catch (e) {
        console.error('Load chat error:', e);
      }
    };

    loadChat();
  }, [stream?.id]);

  // ==========================================
  // Pusher subscriptions
  // ==========================================
  useEffect(() => {
    if (!stream?.id) return;

    const pusher = getLivePusher();
    const sid = stream.id;

    // Live stream events (viewer count)
    const streamChannel = pusher.subscribe('live-stream-' + sid);
    streamChannel.bind('viewer-count', (data) => {
      setViewersCount(data.count);
    });

    // Live channel events (live ended)
    const liveChannel = pusher.subscribe('live-channel');
    liveChannel.bind('live-ended', (data) => {
      if (data.stream_id === sid || data.stream_id === parseInt(sid)) {
        setIsEnded(true);
      }
    });

    // Chat messages
    const chatChannel = pusher.subscribe('live-chat-' + sid);
    chatChannel.bind('new-message', (data) => {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });

      if (autoScrollRef.current) {
        setTimeout(() => scrollChatToBottom(), 50);
      } else {
        setNewMsgCount(prev => prev + 1);
      }
    });

    return () => {
      streamChannel.unbind_all();
      liveChannel.unbind_all();
      chatChannel.unbind_all();
      pusher.unsubscribe('live-stream-' + sid);
      pusher.unsubscribe('live-channel');
      pusher.unsubscribe('live-chat-' + sid);
    };
  }, [stream?.id]);

  // ==========================================
  // Chat scroll
  // ==========================================
  const scrollChatToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      setNewMsgCount(0);
      autoScrollRef.current = true;
    }
  };

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 80;
    if (autoScrollRef.current) setNewMsgCount(0);
  };

  // ==========================================
  // Send chat message
  // ==========================================
  const handleSendMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || sending) return;

    setSending(true);
    setChatInput('');

    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stream_id: stream?.id, message: msg })
      });

      if (!res.ok) throw new Error('خطا در ارسال پیام');
    } catch (e) {
      console.error('Send message error:', e);
      setChatInput(msg);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ==========================================
  // Format time
  // ==========================================
  const formatChatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr.replace(' ', 'T'));
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  };

  // ==========================================
  // Handle back
  // ==========================================
  const handleBack = async () => {
    if (joinedRef.current) {
      try {
        const token = authService.getToken();
        await fetch(`${API_URL}/live/leave/${stream?.id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {}
      joinedRef.current = false;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    onBack();
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrapper}>
          <Loader2 size={32} className="live-spin" />
          <span style={styles.loadingText}>در حال بارگذاری لایو...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
          <span style={styles.headerTitle}>لایو</span>
          <div style={{ width: 38 }} />
        </div>
        <div style={styles.errorWrapper}>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.retryBtn} onClick={() => window.location.reload()}>
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={handleBack}>
          <ArrowLeft size={22} />
        </button>
        <div style={styles.headerCenter}>
          {!isEnded && (
            <div style={styles.liveBadge}>
              <Radio size={14} />
              <span>LIVE</span>
            </div>
          )}
          <span style={{ ...styles.headerTitle, direction: 'rtl' }}>
            {stream?.title || 'لایو'}
          </span>
        </div>
        <div style={styles.viewersBadge}>
          <Users size={14} />
          <span>{viewersCount}</span>
        </div>
      </div>

      {/* Video Player */}
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          style={styles.video}
          playsInline
          autoPlay
          controls={isEnded}
          muted={false}
        />

        {isBuffering && !playerError && (
          <div style={styles.bufferingOverlay}>
            <Loader2 size={40} className="live-spin" />
          </div>
        )}

        {playerError && (
          <div style={styles.bufferingOverlay}>
            <span style={styles.errorText}>خطا در پخش ویدیو</span>
            <button
              style={styles.retryBtn}
              onClick={() => {
                setPlayerError(false);
                setIsBuffering(true);
                if (stream?.playback_hls) loadHls(stream.playback_hls);
              }}
            >
              تلاش مجدد
            </button>
          </div>
        )}

        {isEnded && !playerError && playerReady && (
          <div style={styles.endedBanner}>
            <span style={styles.endedText}>لایو پایان یافت</span>
          </div>
        )}
      </div>

      {/* Chat Section */}
      <div style={{
        ...styles.chatSection,
        ...(chatCollapsed ? { flex: 'none' } : {})
      }}>
        {/* Chat Header */}
        <div style={styles.chatHeader} onClick={() => setChatCollapsed(!chatCollapsed)}>
          <div style={styles.chatHeaderLeft}>
            <MessageCircle size={16} />
            <span>چت لایو</span>
            {messages.length > 0 && (
              <span style={styles.chatCount}>{messages.length}</span>
            )}
          </div>
          <ChevronDown
            size={18}
            style={{
              color: 'rgba(255,255,255,0.4)',
              transition: 'transform 0.3s',
              transform: chatCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          />
        </div>

        {!chatCollapsed && (
          <>
            {/* Chat Messages */}
            <div
              ref={chatContainerRef}
              style={styles.chatMessages}
              onScroll={handleChatScroll}
            >
              {messages.length === 0 ? (
                <div style={styles.chatEmpty}>
                  <span>هنوز پیامی ارسال نشده...</span>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      ...styles.chatMsg,
                      ...(msg.is_admin ? styles.chatMsgAdmin : {}),
                      ...(msg.user_id === currentUserId ? styles.chatMsgSelf : {})
                    }}
                  >
                    <span style={{
                      ...styles.chatMsgName,
                      ...(msg.is_admin ? { color: '#34d399' } : {})
                    }}>
                      {msg.is_admin ? '🟢 ' : ''}{msg.display_name}
                    </span>
                    <span style={styles.chatMsgText}>{msg.message}</span>
                    <span style={styles.chatMsgTime}>{formatChatTime(msg.created_at)}</span>
                  </div>
                ))
              )}
            </div>

            {/* New messages indicator */}
            {newMsgCount > 0 && (
              <div style={{ position: 'relative' }}>
                <button style={styles.newMsgBtn} onClick={scrollChatToBottom}>
                  <ChevronDown size={14} />
                  <span>{newMsgCount} پیام جدید</span>
                </button>
              </div>
            )}

            {/* Chat Input */}
            {!isEnded && (
              <div style={styles.chatInputWrapper}>
                <input
                  ref={chatInputRef}
                  type="text"
                  placeholder="پیام خود را بنویسید..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  style={styles.chatInput}
                  maxLength={500}
                  dir="auto"
                />
                <button
                  style={{
                    ...styles.sendBtn,
                    ...(chatInput.trim() ? styles.sendBtnActive : {})
                  }}
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || sending}
                >
                  {sending ? (
                    <Loader2 size={18} className="live-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// Styles
// ==========================================
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    overflow: 'hidden',
    background: '#0a0a0a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    paddingTop: 'max(10px, env(safe-area-inset-top))',
    background: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    zIndex: 20,
    flexShrink: 0,
  },
  backBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'white',
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 600,
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  liveBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#ef4444',
    color: 'white',
    padding: '3px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
  },
  viewersBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    color: 'rgba(255, 255, 255, 0.7)',
    padding: '5px 10px',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 500,
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: '#000',
    flexShrink: 0,
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000',
  },
  bufferingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    background: 'rgba(0, 0, 0, 0.7)',
  },
  endedBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '6px 0',
    textAlign: 'center',
    background: 'rgba(0, 0, 0, 0.7)',
  },
  endedText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: 500,
  },
  chatSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'rgba(255, 255, 255, 0.03)',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    flexShrink: 0,
  },
  chatHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: 600,
  },
  chatCount: {
    background: 'rgba(255, 255, 255, 0.12)',
    color: 'rgba(255, 255, 255, 0.5)',
    padding: '1px 6px',
    borderRadius: 8,
    fontSize: 11,
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 10px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    WebkitOverflowScrolling: 'touch',
  },
  chatEmpty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 13,
  },
  chatMsg: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0 6px',
    padding: '5px 10px',
    borderRadius: 8,
    background: 'rgba(255, 255, 255, 0.03)',
  },
  chatMsgAdmin: {
    background: 'rgba(99, 102, 241, 0.1)',
    borderRight: '2px solid rgba(99, 102, 241, 0.4)',
  },
  chatMsgSelf: {
    background: 'rgba(59, 130, 246, 0.07)',
  },
  chatMsgName: {
    fontSize: 11,
    fontWeight: 700,
    color: '#818cf8',
    flexShrink: 0,
  },
  chatMsgText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    direction: 'auto',
  },
  chatMsgTime: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.2)',
    marginRight: 'auto',
    flexShrink: 0,
  },
  chatInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
    background: 'rgba(0, 0, 0, 0.4)',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    flexShrink: 0,
  },
  chatInput: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: '8px 14px',
    color: 'white',
    fontSize: 13,
    outline: 'none',
    direction: 'auto',
    fontFamily: 'inherit',
  },
  sendBtn: {
    background: 'rgba(255, 255, 255, 0.07)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.25)',
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  sendBtnActive: {
    background: '#6366f1',
    color: 'white',
  },
  newMsgBtn: {
    position: 'absolute',
    bottom: 4,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#6366f1',
    color: 'white',
    border: 'none',
    padding: '4px 12px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    zIndex: 5,
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    fontFamily: 'inherit',
  },
  loadingWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
  },
  errorWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: 'white',
    padding: '8px 20px',
    borderRadius: 10,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

// Inject CSS animations
if (typeof document !== 'undefined' && !document.querySelector('#live-page-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'live-page-styles';
  styleEl.textContent = `
    @keyframes livePulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .live-spin {
      animation: liveSpin 1s linear infinite;
    }
    @keyframes liveSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleEl);
}

export default LivePage;