import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Trash2, Edit3, X, Paperclip, Mic, Square, Play, Pause, Check, CheckCheck, Reply, CornerDownLeft, ArrowDown, Video, Image, Loader2, ChevronLeft, User, Users, UserPlus, LogOut, Settings, Copy, Languages } from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';
import ImageZoomModal from './ImageZoomModal';
import usePresence from '../hooks/usePresence';
import useOnlineStatus, { formatLastSeen } from '../hooks/useOnlineStatus';
import { formatMsgTime, parseServerDate } from '../utils/dateUtils';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

const TeamChatView = ({ conversationId, onBack, onUnreadCountChange }) => {
  usePresence('team', conversationId);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const currentUser = authService.getUser();
  
  // Extract user ID from JWT token payload (authService doesn't store ID)
  const getCurrentUserId = () => {
    try {
      const token = authService.getToken();
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return parseInt(payload?.data?.user?.id);
    } catch (e) { return null; }
  };
  const currentUserId = getCurrentUserId();

  // Online status for DM partner
  const otherMemberId = conversation?.type === 'direct' 
    ? conversation?.members?.find(m => m.userId !== currentUserId)?.userId 
    : null;
  const onlineStatuses = useOnlineStatus(otherMemberId ? [otherMemberId] : []);

  // Typing
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutsRef = useRef({});
  const lastTypingSentRef = useRef(0);

  // Menu
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ y: 0 });
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomedVideo, setZoomedVideo] = useState(null);

  // Upload
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingTempId, setUploadingTempId] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Group info modal
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Reply
  const [replyingTo, setReplyingTo] = useState(null);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const recordingIndicatorRef = useRef(null);

  // Scroll
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showFlagMenu, setShowFlagMenu] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState(() => {
    try { const s = localStorage.getItem('teamchat_flag'); const f = s ? JSON.parse(s) : null; return f; } catch { return null; }
  });
  const [translatingIds, setTranslatingIds] = useState(new Set());
  const flagMenuRef = useRef(null);
  const selectedFlagRef = useRef((() => {
    try { const s = localStorage.getItem('teamchat_flag'); return s ? JSON.parse(s) : null; } catch { return null; }
  })());
  const flagLangMapRef = useRef({ IR: 'fa', CH: 'de', DE: 'de', FR: 'fr', GB: 'en', ES: 'es' });

  // Unread tracking
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const firstUnreadMsgIdRef = useRef(null);
  const observerReadyRef = useRef(false);
  const initialScrollDoneRef = useRef(false);
  const observerRef = useRef(null);

  // Refs
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRefs = useRef({});
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const messageRefs = useRef({});
  const pendingTempIds = useRef(new Set());

  useEffect(() => {
    const h = (e) => { if (showAttachMenu && !e.target.closest('.attach-menu-container-mobile')) setShowAttachMenu(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [showAttachMenu]);

  const scrollToMessage = (messageId) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(() => setHighlightedMessageId(null), 2500);
    }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleScroll = () => {
    if (messagesAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  useEffect(() => {
    if (conversationId) loadConversation();
    return () => {
      if (channelRef.current) channelRef.current.unbind_all();
      if (pusherRef.current) pusherRef.current.disconnect();
    };
  }, [conversationId]);

  // Old auto mark-as-read disabled for progressive tracking
  // useEffect(() => {
  //   if (conversationId && messages.length > 0) markAsRead();
  // }, [conversationId, messages.length]);

  const prevMsgCount = useRef(0);
  useEffect(() => {
    if (messages.length > prevMsgCount.current) scrollToBottom();
    prevMsgCount.current = messages.length;
  }, [messages]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) { document.body.style.position = 'fixed'; document.body.style.width = '100%'; document.body.style.height = '100%'; }
    return () => { if (isMobile) { document.body.style.position = ''; document.body.style.width = ''; document.body.style.height = ''; } };
  }, []);

  useEffect(() => {
    const h = (e) => { if (showMenu && !e.target.closest('.message-menu-glass')) { setShowMenu(false); setSelectedMessage(null); } };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [showMenu]);

  const markAsRead = async () => {
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/team/conversations/${conversationId}/read`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    } catch (e) {}
  };

  const loadConversation = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/conversations/${conversationId}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setConversation(data.conversation);
      const othersReadAt = data.conversation.othersLastReadAt ? parseServerDate(data.conversation.othersLastReadAt) : null;
      setMessages(data.messages.map(msg => {
        // Determine read status for own messages
        let status = 'sent';
        if (msg.senderId === currentUserId && othersReadAt) {
          const msgTime = parseServerDate(msg.createdAt);
          if (msgTime <= othersReadAt) {
            status = 'read';
          } else {
            status = 'delivered';
          }
        }
        return {
          id: msg.id,
          text: msg.type === 'text' ? msg.content : null,
          translatedText: msg.translatedContent || null,
          originalText: msg.type === 'text' ? msg.content : null,
          senderLang: msg.senderLang || 'fa',
          image: msg.type === 'image' ? msg.mediaUrl : null,
          video: msg.type === 'video' ? msg.mediaUrl : null,
          audio: msg.type === 'audio' ? msg.mediaUrl : null,
          duration: msg.duration || 0,
          senderId: msg.senderId,
          senderName: msg.senderName,
          sender: msg.senderId === currentUserId ? 'user' : 'support',
          time: fmtTime(msg.createdAt),
          edited: msg.isEdited,
          status,
          showOriginal: false,
          replyTo: msg.replyTo ? {
            id: msg.replyTo.id, type: msg.replyTo.type,
            content: msg.replyTo.type === 'text' ? msg.replyTo.content : msg.replyTo.type === 'image' ? '📷 تصویر' : msg.replyTo.type === 'video' ? '🎬 ویدیو' : '🎤 صوتی',
            sender: msg.replyTo.senderId === currentUserId ? 'user' : 'support',
            senderName: msg.replyTo.senderName
          } : null
        };
      }));
      connectPusher();

      // Lazy translate: if user has non-Persian flag, translate Persian messages that don't have translation yet
      const myLang = selectedFlagRef.current ? flagLangMapRef.current[selectedFlagRef.current.code] : 'fa';
      if (myLang !== 'fa') {
        const needTranslation = data.messages.filter(m => 
          m.senderId !== currentUserId && m.type === 'text' && m.content && 
          m.senderLang === 'fa' && !m.translatedContent
        );
        needTranslation.forEach(msg => {
          translateText(msg.content, myLang).then(translated => {
            if (translated && translated !== msg.content) {
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translatedText: translated } : m));
              // Save to server for future loads
              const token = authService.getToken();
              fetch(`${API_URL}/team/messages/${msg.id}/translation`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ translatedContent: translated })
              }).catch(() => {});
            }
          });
        });
      }
      
      // Calculate unread
      const unreadN = data.conversation.unreadCount || 0;
      setChatUnreadCount(unreadN);
      if (unreadN > 0) {
        const otherMsgs = data.messages.filter(m => m.senderId !== currentUserId);
        if (otherMsgs.length > 0) {
          const idx = Math.max(0, otherMsgs.length - unreadN);
          firstUnreadMsgIdRef.current = otherMsgs[idx]?.id || null;
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // Scroll to first unread
  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      observerReadyRef.current = false;
      setTimeout(() => {
        if (firstUnreadMsgIdRef.current) {
          const divider = document.getElementById('unread-divider');
          if (divider) divider.scrollIntoView({ behavior: 'auto', block: 'start' });
          setTimeout(() => { observerReadyRef.current = true; }, 600);
          return;
        }
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        observerReadyRef.current = true;
      }, 150);
    }
  }, [loading, messages.length]);

  // IntersectionObserver
  useEffect(() => {
    if (loading || messages.length === 0) return;
    if (observerRef.current) observerRef.current.disconnect();
    const observer = new IntersectionObserver((entries) => {
      if (!observerReadyRef.current) return;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = parseInt(entry.target.dataset.msgId);
          if (msgId) {
            setChatUnreadCount(prev => {
              const n = Math.max(0, prev - 1);
              if (onUnreadCountChange) onUnreadCountChange(prevTotal => Math.max(0, prevTotal - 1));
              return n;
            });
            observer.unobserve(entry.target);
          }
        }
      });
    }, { root: messagesAreaRef.current, threshold: 0.5 });
    observerRef.current = observer;
    const otherMsgs = messages.filter(m => m.sender !== 'user');
    const startIdx = Math.max(0, otherMsgs.length - chatUnreadCount);
    otherMsgs.slice(startIdx).forEach(msg => {
      const el = messageRefs.current[msg.id];
      if (el) { el.dataset.msgId = msg.id; observer.observe(el); }
    });
    return () => observer.disconnect();
  }, [loading, messages]);

  // Debounced server sync
  const markReadTimerRef = useRef(null);
  useEffect(() => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => { if (conversationId) markAsRead(); }, 2000);
    return () => { if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current); };
  }, [chatUnreadCount]);

  // Handle back
  const handleBack = async () => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    if (conversationId) { try { await markAsRead(); } catch (e) {} }
    onBack();
  };

  const connectPusher = () => {
    if (pusherRef.current) return;
    pusherRef.current = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER, forceTLS: true });
    channelRef.current = pusherRef.current.subscribe(`team-conversation-${conversationId}`);

    channelRef.current.bind('new-message', (data) => {
      const isMe = data.senderId === currentUserId;
      if (isMe) {
        // اگه پیام خودمونه: یا tempId رو replace کن، یا اگه قبلاً replace شده ignore کن
        if (pendingTempIds.current.size > 0) {
          const tid = Array.from(pendingTempIds.current)[0];
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            if (prev.some(m => m.id === tid)) { pendingTempIds.current.delete(tid); return prev.map(m => m.id === tid ? { ...m, id: data.id, status: 'delivered' } : m); }
            return prev;
          });
        }
        // در هر صورت پیام خودمون رو دوباره اضافه نمی‌کنیم
        return;
      }
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, {
          id: data.id, text: data.type === 'text' ? data.content : null,
          translatedText: data.translatedContent || null,
          originalText: data.type === 'text' ? data.content : null,
          senderLang: data.senderLang || 'fa',
          image: data.type === 'image' ? data.mediaUrl : null, video: data.type === 'video' ? data.mediaUrl : null,
          audio: data.type === 'audio' ? data.mediaUrl : null, duration: data.duration || 0,
          senderId: data.senderId, senderName: data.senderName,
          sender: 'support',
          time: fmtTime(data.createdAt), edited: false, status: 'sent', showOriginal: false,
          replyTo: data.replyTo ? { id: data.replyTo.id, type: data.replyTo.type, content: data.replyTo.content, sender: data.replyTo.senderId === currentUserId ? 'user' : 'support', senderName: data.replyTo.senderName } : null
        }];
      });
      playSound(); markAsRead();

      // Lazy translate if Persian message received and user is non-Persian, and no translation provided
      if (data.type === 'text' && data.content && !data.translatedContent) {
        const myLang = selectedFlagRef.current ? flagLangMapRef.current[selectedFlagRef.current.code] : 'fa';
        const msgLang = data.senderLang || 'fa';
        if (myLang !== 'fa' && msgLang === 'fa') {
          translateText(data.content, myLang).then(translated => {
            if (translated && translated !== data.content) {
              setMessages(prev => prev.map(m => m.id === data.id ? { ...m, translatedText: translated } : m));
              // Save for future
              const token = authService.getToken();
              fetch(`${API_URL}/team/messages/${data.id}/translation`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ translatedContent: translated })
              }).catch(() => {});
            }
          });
        }
      }
    });

    channelRef.current.bind('message-edited', (d) => setMessages(p => p.map(m => m.id === d.id ? { ...m, text: d.content, edited: true } : m)));
    channelRef.current.bind('message-deleted', (d) => setMessages(p => p.filter(m => m.id !== d.id)));
    
    // Read receipt: when other user reads messages, update status to 'read'
    channelRef.current.bind('messages-read', (d) => {
      if (d.userId === currentUserId) return; // ignore own read events
      setMessages(p => p.map(m => {
        // Mark all my messages as read (since other person read them)
        if (m.sender === 'user' && m.status !== 'read') {
          return { ...m, status: 'read' };
        }
        return m;
      }));
    });

    channelRef.current.bind('typing', (d) => {
      if (d.userId === currentUserId) return;
      if (d.isTyping || d.isRecording) {
        setTypingUsers(p => ({ ...p, [d.userId]: d.userName }));
        if (typingTimeoutsRef.current[d.userId]) clearTimeout(typingTimeoutsRef.current[d.userId]);
        typingTimeoutsRef.current[d.userId] = setTimeout(() => setTypingUsers(p => { const n = { ...p }; delete n[d.userId]; return n; }), 3000);
      } else {
        setTypingUsers(p => { const n = { ...p }; delete n[d.userId]; return n; });
      }
    });

    channelRef.current.bind('member-added', () => loadConversation());
    channelRef.current.bind('member-removed', () => loadConversation());
    channelRef.current.bind('member-left', () => loadConversation());
    channelRef.current.bind('conversation-updated', (d) => setConversation(p => ({ ...p, ...d })));
  };

  const playSound = () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 800; o.type = 'sine'; g.gain.value = 0.1; o.start(); setTimeout(() => o.stop(), 150); } catch(e){} };

  const sendTypingIndicator = async (isTyping, isRecording = false) => {
    const now = Date.now();
    if ((isTyping || isRecording) && now - lastTypingSentRef.current < 1000) return;
    lastTypingSentRef.current = now;
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/team/conversations/${conversationId}/typing`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isTyping, isRecording }) });
    } catch(e){}
  };

  const handleInputChange = (e) => { setNewMessage(e.target.value); if (e.target.value.trim()) sendTypingIndicator(true); else sendTypingIndicator(false); };
  const fmtTime = (s) => formatMsgTime(s);
  const fmtDuration = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  // ─── Swipe to reply ───
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);
  const swipeCurrentX = useRef(0);
  const swipeDirection = useRef(null);
  const swipeActiveMsg = useRef(null);

  const handleTouchStart = (e, msg) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
    swipeCurrentX.current = e.touches[0].clientX;
    swipeDirection.current = null;
    swipeActiveMsg.current = msg;
    longPressTimer.current = setTimeout(() => {
      const rect = e.target.getBoundingClientRect();
      setSelectedMessage(msg);
      setMenuPosition({ y: rect.top - 60 });
      setShowMenu(true);
      if (navigator.vibrate) navigator.vibrate(50);
      swipeDirection.current = 'cancelled';
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!swipeActiveMsg.current || swipeDirection.current === 'cancelled') return;
    const t = e.touches[0];
    const dx = t.clientX - swipeTouchStartX.current;
    const dy = t.clientY - swipeTouchStartY.current;
    if (!swipeDirection.current) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        swipeDirection.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
      return;
    }
    if (swipeDirection.current !== 'horizontal') return;
    swipeCurrentX.current = t.clientX;
    const abs = Math.abs(dx);
    if (abs > 0) { e.currentTarget.style.transform = `translateX(${dx > 0 ? Math.min(abs,80) : -Math.min(abs,80)}px)`; e.currentTarget.style.transition = 'none'; }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (swipeDirection.current === 'horizontal' && swipeActiveMsg.current) {
      const dx = swipeCurrentX.current - swipeTouchStartX.current;
      e.currentTarget.style.transform = 'translateX(0)';
      e.currentTarget.style.transition = 'transform 0.2s ease';
      if (Math.abs(dx) > 60) { handleReply(swipeActiveMsg.current); if (navigator.vibrate) navigator.vibrate(30); }
    }
    swipeActiveMsg.current = null;
    swipeDirection.current = null;
  };

  // ─── Actions ───
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!selectedMessage) return;
    const id = selectedMessage.id;
    setMessages(p => p.filter(m => m.id !== id));
    setShowMenu(false); setSelectedMessage(null);
    try { const token = authService.getToken(); await fetch(`${API_URL}/team/messages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); } catch(e){ loadConversation(); }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (selectedMessage) { setEditingMessage(selectedMessage); setEditText(selectedMessage.text); setShowMenu(false); setSelectedMessage(null); }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    const id = editingMessage.id; const txt = editText;
    setMessages(p => p.map(m => m.id === id ? { ...m, text: txt, edited: true } : m));
    setEditingMessage(null); setEditText('');
    try { const token = authService.getToken(); await fetch(`${API_URL}/team/messages/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ content: txt }) }); } catch(e){ loadConversation(); }
  };

  const handleReply = (msg) => {
    setReplyingTo({
      id: msg.id,
      type: msg.text ? 'text' : msg.image ? 'image' : msg.video ? 'video' : 'audio',
      content: msg.text || (msg.image ? '📷 تصویر' : msg.video ? '🎬 ویدیو' : '🎤 صوتی'),
      sender: msg.sender,
      senderName: msg.senderName
    });
    setShowMenu(false); setSelectedMessage(null);
    inputRef.current?.focus();
  };

  // ─── Send ───
  // Language codes for flags
  const flagLangMap = { IR: 'fa', CH: 'de', DE: 'de', FR: 'fr', GB: 'en', ES: 'es' };

  const translateText = async (text, targetLang) => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text, targetLang })
      });
      if (!res.ok) return text;
      const data = await res.json();
      return data.translated || text;
    } catch (e) { return text; }
  };

  const handleSend = async () => {
    const txt = newMessage.trim();
    if (!txt) return;
    sendTypingIndicator(false);
    const tempId = Date.now();
    const time = fmtTime(new Date().toISOString());
    const reply = replyingTo;
    setNewMessage(''); setReplyingTo(null);
    setTimeout(() => inputRef.current?.focus(), 0);

    setMessages(p => [...p, { id: tempId, text: txt, sender: 'user', senderId: currentUserId, senderName: currentUser?.displayName || '', time, status: 'sending', replyTo: reply }]);
    pendingTempIds.current.add(tempId);

    try {
      const userLang = selectedFlag ? flagLangMap[selectedFlag.code] : 'fa';
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/team/conversations/${conversationId}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'text', content: txt, replyToId: reply?.id, senderLang: userLang })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      pendingTempIds.current.delete(tempId);
      setMessages(p => p.map(m => m.id === tempId ? { ...m, id: data.message.id, status: 'sent' } : m));
    } catch(e) { setMessages(p => p.filter(m => m.id !== tempId)); }
  };

  const handleKeyDown = (e) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ─── Image Upload ───
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const tempId = Date.now(); const time = fmtTime(new Date().toISOString()); const reply = replyingTo;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMessages(p => [...p, { id: tempId, image: ev.target.result, sender: 'user', senderId: currentUserId, senderName: '', time, status: 'sending', replyTo: reply }]);
      pendingTempIds.current.add(tempId);
    };
    reader.readAsDataURL(file);
    setReplyingTo(null);
    try {
      const token = authService.getToken();
      const fd = new FormData(); fd.append('file', file);
      const up = await fetch(`${API_URL}/admin/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!up.ok) throw new Error('Upload failed');
      const upData = await up.json();
      const msgRes = await fetch(`${API_URL}/team/conversations/${conversationId}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'image', mediaUrl: upData.url, replyToId: reply?.id })
      });
      if (!msgRes.ok) throw new Error('Failed');
      const msgData = await msgRes.json();
      pendingTempIds.current.delete(tempId);
      setMessages(p => p.map(m => m.id === tempId ? { ...m, id: msgData.message.id, image: upData.url, status: 'sent' } : m));
    } catch(e) { setMessages(p => p.filter(m => m.id !== tempId)); alert('خطا در آپلود'); }
    e.target.value = '';
  };

  // ─── Video Upload ───
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('حجم ویدیو نباید بیشتر از ۵۰ مگابایت باشد'); e.target.value = ''; return; }
    const tempId = Date.now(); const time = fmtTime(new Date().toISOString()); const reply = replyingTo;
    setUploadingVideo(true); setUploadingTempId(tempId); setReplyingTo(null);
    setMessages(p => [...p, { id: tempId, video: URL.createObjectURL(file), sender: 'user', senderId: currentUserId, time, status: 'sending', isUploading: true, uploadProgress: 0, replyTo: reply }]);
    pendingTempIds.current.add(tempId);
    try {
      const token = authService.getToken();
      const fd = new FormData(); fd.append('file', file);
      const up = await fetch(`${API_URL}/admin/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
      if (!up.ok) throw new Error('Upload failed');
      const upData = await up.json();
      const msgRes = await fetch(`${API_URL}/team/conversations/${conversationId}/message`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'video', mediaUrl: upData.url, replyToId: reply?.id })
      });
      const msgData = await msgRes.json();
      pendingTempIds.current.delete(tempId);
      setMessages(p => p.map(m => m.id === tempId ? { ...m, id: msgData.message.id, video: upData.url, status: 'sent', isUploading: false } : m));
    } catch(e) { setMessages(p => p.filter(m => m.id !== tempId)); alert('خطا در آپلود ویدیو'); }
    setUploadingVideo(false); setUploadingTempId(null); e.target.value = '';
  };

  // ─── Voice Recording ───
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      audioChunksRef.current = [];
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
        const dur = recordingTime;
        setRecordingTime(0);
        const tempId = Date.now(); const time = fmtTime(new Date().toISOString()); const reply = replyingTo;
        const url = URL.createObjectURL(blob);
        setMessages(p => [...p, { id: tempId, audio: url, duration: dur, sender: 'user', senderId: currentUserId, time, status: 'sending', replyTo: reply }]);
        pendingTempIds.current.add(tempId);
        setReplyingTo(null);
        try {
          const token = authService.getToken();
          const ext = mr.mimeType.includes('webm') ? 'webm' : 'm4a';
          const fd = new FormData();
          fd.append('file', new File([blob], `voice_${Date.now()}.${ext}`, { type: mr.mimeType }));
          const up = await fetch(`${API_URL}/admin/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
          if (!up.ok) throw new Error('Upload failed');
          const upData = await up.json();
          const msgRes = await fetch(`${API_URL}/team/conversations/${conversationId}/message`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'audio', mediaUrl: upData.url, duration: dur, replyToId: reply?.id })
          });
          const msgData = await msgRes.json();
          pendingTempIds.current.delete(tempId);
          setMessages(p => p.map(m => m.id === tempId ? { ...m, id: msgData.message.id, audio: upData.url, status: 'sent' } : m));
        } catch(e) { setMessages(p => p.filter(m => m.id !== tempId)); }
      };
      mr.start();
      setIsRecording(true);
      sendTypingIndicator(false, true);
      recordingIndicatorRef.current = setInterval(() => sendTypingIndicator(false, true), 2000);
      recordingTimerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch(e) { alert('لطفاً دسترسی به میکروفن را فعال کنید'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
      if (recordingIndicatorRef.current) { clearInterval(recordingIndicatorRef.current); recordingIndicatorRef.current = null; }
      sendTypingIndicator(false, false);
    }
  };

  const toggleAudioPlay = (msgId, audioUrl) => {
    const audio = audioRefs.current[msgId];
    if (playingAudioId === msgId) { audio?.pause(); setPlayingAudioId(null); setAudioCurrentTime(0); setPlaybackSpeed(1); }
    else {
      if (playingAudioId && audioRefs.current[playingAudioId]) { audioRefs.current[playingAudioId].pause(); audioRefs.current[playingAudioId].currentTime = 0; }
      setAudioCurrentTime(0); setPlaybackSpeed(1);
      if (audio) { audio.playbackRate = 1; audio.play().then(() => setPlayingAudioId(msgId)).catch(e => {}); }
    }
  };

  const toggleSpeed = (e, msgId) => {
    e.stopPropagation();
    const audio = audioRefs.current[msgId]; if (!audio) return;
    const ns = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    audio.playbackRate = ns; setPlaybackSpeed(ns);
  };

  const handleMicOrSend = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (newMessage.trim()) { handleSend(); requestAnimationFrame(() => inputRef.current?.focus()); }
    else if (isRecording) stopRecording();
    else startRecording();
  };

  // ─── Typing text ───
  const typingNames = Object.values(typingUsers);
  const typingText = typingNames.length === 1 ? `${typingNames[0]} ...در حال نوشتن` : typingNames.length > 1 ? `${typingNames.join('، ')} ...سدر حال نوشتن` : '';

  // ─── Get display name for header ───
  const getHeaderTitle = () => {
    if (!conversation) return 'چت تیمی';
    if (conversation.type === 'group') return conversation.name || 'گروه';
    // DM - show other person's name
    const other = conversation.members?.find(m => m.userId !== currentUserId);
    return other?.displayName || 'چت تیمی';
  };

  const getHeaderSubtitle = () => {
    if (!conversation) return '';
    if (conversation.type === 'group') return `${conversation.members?.length || 0} عضو`;
    // DM - show online status
    if (otherMemberId && onlineStatuses[String(otherMemberId)]?.online) return '🟢 آنلاین';
    if (otherMemberId && onlineStatuses[String(otherMemberId)]?.lastSeen) return `آخرین بازدید: ${formatLastSeen(onlineStatuses[String(otherMemberId)].lastSeen)}`;
    return '';
  };

  // ─── Render ───
  if (loading) {
    return (
      <div className="support-chat-container">
        <div className="chat-header-glass">
          <button className="chat-back-btn" onClick={handleBack}><ArrowLeft size={22} /></button>
          <div className="chat-header-info">
            <div className="chat-header-text">
              <span className="chat-header-title">چت تیمی</span>
              <span className="chat-header-status">...در حال اتصال</span>
            </div>
            <div className="chat-avatar-glass"><Users size={20} /></div>
          </div>
        </div>
        <div className="chat-loading"><div className="chat-loading-spinner"></div></div>
      </div>
    );
  }

  // Country flag menu
  const flags = [
    { code: 'IR', emoji: '🇮🇷', name: 'ایران' },
    { code: 'CH', emoji: '🇨🇭', name: 'سوئیس' },
    { code: 'DE', emoji: '🇩🇪', name: 'آلمان' },
    { code: 'FR', emoji: '🇫🇷', name: 'فرانسه' },
    { code: 'GB', emoji: '🇬🇧', name: 'انگلیس' },
    { code: 'ES', emoji: '🇪🇸', name: 'اسپانیا' },
  ];

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={handleBack}><ChevronLeft size={22} /></button>
        
        {/* Country flag selector */}
        <button
          onTouchEnd={(e) => { e.preventDefault(); setShowFlagMenu(prev => !prev); }}
          onClick={() => setShowFlagMenu(prev => !prev)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '12px',
            padding: '6px 10px',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {selectedFlag ? selectedFlag.emoji : '🌐'}
        </button>

        <div className="chat-header-info" style={{ flex: 1, justifyContent: 'flex-end', cursor: conversation?.type === 'group' ? 'pointer' : 'default' }} onClick={() => conversation?.type === 'group' && setShowGroupInfo(true)}>
          <div className="chat-header-text">
            <span className="chat-header-title">{getHeaderTitle()}</span>
            <span className="chat-header-status">{typingText || getHeaderSubtitle()}</span>
          </div>
          <div className="chat-avatar-glass" style={conversation?.type === 'group' ? { background: 'linear-gradient(135deg, #10b981, #3b82f6)' } : {}}>
            {conversation?.type === 'group' ? <Users size={20} /> : <User size={20} />}
          </div>
        </div>
      </div>

      {/* Flag dropdown overlay */}
      {showFlagMenu && (
        <>
          <div onTouchEnd={() => setShowFlagMenu(false)} onClick={() => setShowFlagMenu(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }} />
          <div style={{
            position: 'fixed',
            top: '85px',
            left: '55px',
            background: 'rgba(30,30,30,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '16px',
            padding: '8px',
            zIndex: 9999,
            minWidth: '150px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            {flags.map(flag => (
              <button
                key={flag.code}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedFlag(flag); selectedFlagRef.current = flag; localStorage.setItem('teamchat_flag', JSON.stringify(flag)); setShowFlagMenu(false); }}
                onClick={() => { setSelectedFlag(flag); selectedFlagRef.current = flag; localStorage.setItem('teamchat_flag', JSON.stringify(flag)); setShowFlagMenu(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  background: selectedFlag?.code === flag.code ? 'rgba(99,102,241,0.3)' : 'transparent',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                  direction: 'rtl',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ fontSize: '22px' }}>{flag.emoji}</span>
                <span>{flag.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Messages */}
      <div className="chat-messages-area" ref={messagesAreaRef} onScroll={handleScroll}>
        {messages.map((msg) => (
          <React.Fragment key={msg.id}>
            {firstUnreadMsgIdRef.current && msg.id === firstUnreadMsgIdRef.current && (
              <div id="unread-divider" style={{display:'flex',alignItems:'center',gap:'12px',padding:'8px 16px',margin:'8px 0',background:'rgba(255,255,255,0.75)',borderRadius:'8px'}}>
                <div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.25)'}} />
                <span style={{fontSize:'13px',color:'rgba(1,1,1,0.6)',whiteSpace:'nowrap',fontWeight:500}}>پیام‌های خوانده نشده</span>
                <div style={{flex:1,height:'1px',background:'rgba(0,0,0,0.25)'}} />
              </div>
            )}
          {/* Flex wrapper for translation toggle */}
          <div style={msg.sender !== 'user' && msg.translatedText ? { display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', maxWidth: '85%' } : { display: 'contents' }}>
          <div
            ref={el => messageRefs.current[msg.id] = el}
            className={`chat-bubble-glass ${msg.sender === 'user' ? 'user-bubble' : 'support-bubble'} ${selectedMessage?.id === msg.id ? 'selected' : ''} ${msg.image ? 'image-bubble' : ''} ${msg.audio ? 'audio-bubble' : ''} ${highlightedMessageId === msg.id ? 'highlighted' : ''}`}
            style={msg.sender !== 'user' && msg.translatedText ? { alignSelf: 'auto', maxWidth: '100%' } : undefined}
            onTouchStart={(e) => handleTouchStart(e, msg)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => { e.preventDefault(); setSelectedMessage(msg); setMenuPosition({ y: e.clientY - 60 }); setShowMenu(true); }}
            onClick={(e) => { if (!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) { setSelectedMessage(msg); setMenuPosition({ y: e.clientY - 60 }); setShowMenu(true); } }}
          >
            {/* Sender name for group messages from others */}
            {conversation?.type === 'group' && msg.sender === 'support' && msg.senderName && (
              <span className="team-sender-name">{msg.senderName}</span>
            )}
            
            {/* Reply preview */}
            {msg.replyTo && (
              <div className="reply-preview-bubble clickable" onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo.id); }}>
                <div className="reply-line"></div>
                <div className="reply-content">
                  <span className="reply-sender">{msg.replyTo.senderName || (msg.replyTo.sender === 'user' ? 'شما' : '')}</span>
                  <span className="reply-text">{msg.replyTo.type === 'text' ? (msg.replyTo.content?.substring(0,40) + (msg.replyTo.content?.length > 40 ? '...' : '')) : msg.replyTo.content}</span>
                </div>
              </div>
            )}

            {/* Video */}
            {msg.video ? (
              <div className="video-message-container">
                {msg.isUploading ? (
                  <div className="video-uploading-mobile">
                    <Loader2 size={28} className="spinning" />
                  </div>
                ) : (
                  <div 
                    className="video-thumbnail-mobile"
                    onClick={(e) => { e.stopPropagation(); setZoomedVideo(msg.video); }}
                  >
                    <video 
                      src={msg.video + '#t=0.5'} 
                      className="chat-video-preview" 
                      preload="metadata" 
                      muted 
                      playsInline
                      onLoadedData={(e) => { e.target.currentTime = 0.5; }}
                    />
                    <div className="video-play-overlay-mobile">
                      <Play size={36} fill="white" />
                    </div>
                  </div>
                )}
              </div>
            ) : msg.image ? (
              <img 
                src={msg.image} 
                alt="" 
                className="chat-image" 
                onClick={(e) => { e.stopPropagation(); setZoomedImage(msg.image); }} 
              />
            ) : msg.audio ? (
              <div className={`audio-message ${playingAudioId === msg.id ? 'playing' : ''}`}>
                <button 
                  className="audio-play-btn"
                  onClick={(e) => { e.stopPropagation(); toggleAudioPlay(msg.id, msg.audio); }}
                >
                  {playingAudioId === msg.id ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <div className="audio-wave">
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                  <div className="audio-wave-bar"></div>
                </div>
                <span className="audio-duration">
                  {playingAudioId === msg.id 
                    ? `${fmtDuration(Math.floor(audioCurrentTime))} / ${fmtDuration(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))}`
                    : fmtDuration(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))
                  }
                </span>
                {playingAudioId === msg.id && (
                  <button className="audio-speed-btn" onClick={(e) => toggleSpeed(e, msg.id)}>
                    {playbackSpeed}x
                  </button>
                )}
                <audio 
                  ref={el => audioRefs.current[msg.id] = el} 
                  src={msg.audio} 
                  preload="metadata"
                  onTimeUpdate={(e) => setAudioCurrentTime(e.target.currentTime)}
                  onEnded={() => { setPlayingAudioId(null); setAudioCurrentTime(0); setPlaybackSpeed(1); }} 
                />
              </div>
            ) : (
              <span className="bubble-text">{(() => {
                if (msg.sender === 'user') return msg.text;
                const myLang = selectedFlag ? flagLangMap[selectedFlag.code] : 'fa';
                const msgLang = msg.senderLang || 'fa';
                if (msgLang === myLang) return msg.text;
                if (msg.translatedText && !msg.showOriginal) return msg.translatedText;
                return msg.text;
              })()}</span>
            )}

            <span className="bubble-time">
              {msg.edited && <span className="edited-label">ویرایش شده • </span>}
              {msg.time}
              {msg.sender === 'user' && (
                msg.status === 'sending' ? <span className="message-status sending">○</span> 
                : msg.status === 'read' ? <CheckCheck size={14} className="message-status read" />
                : msg.status === 'delivered' ? <CheckCheck size={14} className="message-status delivered" />
                : <Check size={14} className="message-status sent" />
              )}
            </span>
            {/* Show sender name below time for own messages from other admins (in DM) */}
            {conversation?.type === 'direct' && msg.sender === 'support' && msg.senderName && (
              <span style={{ display: 'block', fontSize: '10px', color: 'hsla(0,0%,50%,1)', marginTop: 2, fontWeight: 600 }}>{msg.senderName}</span>
            )}
          </div>
          {msg.sender !== 'user' && msg.translatedText && (
            <button
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showOriginal: !m.showOriginal } : m)); }}
              onClick={(e) => { e.stopPropagation(); setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, showOriginal: !m.showOriginal } : m)); }}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: msg.showOriginal ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.3)',
                WebkitTapHighlightColor: 'transparent',
                transition: 'color 0.2s',
                flexShrink: 0,
              }}
            >
              <Languages size={15} />
            </button>
          )}
          </div>
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Menu */}
      {showMenu && selectedMessage && (
        <div className="message-menu-glass" style={{ top: `${menuPosition.y}px` }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <button className="menu-item-btn" onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleReply(selectedMessage); }} onClick={() => handleReply(selectedMessage)}><Reply size={18} /><span>Reply</span></button>
          {selectedMessage?.text && (
            <button className="menu-item-btn" onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); navigator.clipboard.writeText(selectedMessage.text); setShowMenu(false); setSelectedMessage(null); }} onClick={() => { navigator.clipboard.writeText(selectedMessage.text); setShowMenu(false); setSelectedMessage(null); }}><Copy size={18} /><span>کپی</span></button>
          )}
          {selectedMessage?.sender === 'user' && !selectedMessage?.image && !selectedMessage?.audio && (
            <button className="menu-item-btn" onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(e); }} onClick={handleEdit}><Edit3 size={18} /><span>ویرایش</span></button>
          )}
          {selectedMessage?.sender === 'user' && (
            <button className="menu-item-btn delete" onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(e); }} onClick={handleDelete}><Trash2 size={18} /><span>حذف</span></button>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingMessage && (
        <div className="edit-modal-overlay" onClick={() => { setEditingMessage(null); setEditText(''); }}>
          <div className="edit-modal-glass" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span>ویرایش پیام</span><button className="edit-close-btn" onClick={() => { setEditingMessage(null); setEditText(''); }}><X size={20} /></button></div>
            <textarea className="edit-textarea-glass" value={editText} onChange={e => setEditText(e.target.value)} autoFocus />
            <div className="edit-modal-actions">
              <button className="edit-cancel-btn" onClick={() => { setEditingMessage(null); setEditText(''); }}>لغو</button>
              <button className="edit-save-btn" onClick={handleSaveEdit}>ذخیره</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom */}
      {zoomedImage && <ImageZoomModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}

      {/* Video Zoom */}
      {zoomedVideo && (
        <div className="video-zoom-overlay" onClick={() => setZoomedVideo(null)}>
          <button className="zoom-close-btn" onClick={() => setZoomedVideo(null)}><X size={24} /></button>
          <video src={zoomedVideo} controls autoPlay className="zoomed-video" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="typing-indicator-container">
          <div className="typing-indicator">
            <span className="typing-dot"></span><span className="typing-dot"></span><span className="typing-dot"></span>
          </div>
        </div>
      )}

      {/* Scroll button */}
      {showScrollButton && <button className="scroll-to-bottom-btn" onClick={scrollToBottom}><ArrowDown size={20} />{chatUnreadCount > 0 && <span style={{position:'absolute',top:'-6px',right:'-6px',background:'#3b82f6',color:'white',borderRadius:'10px',padding:'1px 6px',fontSize:'11px',fontWeight:'bold',minWidth:'18px',textAlign:'center'}}>{chatUnreadCount}</span>}</button>}

      {/* Input */}
      <div className="chat-input-container-glass">
        {replyingTo && (
          <div className="reply-bar-glass">
            <div className="reply-bar-content">
              <CornerDownLeft size={16} />
              <div className="reply-bar-text">
                <span className="reply-bar-sender">پاسخ به {replyingTo.senderName || (replyingTo.sender === 'support' ? '' : 'خودتان')}</span>
                <span className="reply-bar-message">{replyingTo.content?.substring(0,35) || '📎'}{replyingTo.content?.length > 35 ? '...' : ''}</span>
              </div>
            </div>
            <button className="reply-bar-close" onClick={() => setReplyingTo(null)}><X size={18} /></button>
          </div>
        )}
        <div className="chat-input-wrapper-glass">
          {!isRecording && (
            <div className="attach-menu-container-mobile">
              <button className="chat-attach-btn" onClick={() => setShowAttachMenu(!showAttachMenu)}><Paperclip size={22} /></button>
              {showAttachMenu && (
                <div className="attach-menu-mobile">
                  <button className="attach-menu-item-mobile" onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}><Image size={20} /><span>Photo</span></button>
                  <button className="attach-menu-item-mobile" onClick={() => { setShowAttachMenu(false); videoInputRef.current?.click(); }} disabled={uploadingVideo}><Video size={20} /><span>Video</span></button>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
              <input type="file" ref={videoInputRef} onChange={handleVideoUpload} accept="video/*" style={{ display: 'none' }} />
            </div>
          )}
          {isRecording ? (
            <div className="recording-indicator"><div className="recording-dot"></div><span className="recording-time">{fmtDuration(recordingTime)}</span><span className="recording-text">...در حال ضبط</span></div>
          ) : (
            <textarea ref={inputRef} placeholder="پیام خود را بنویسید..." value={newMessage} onChange={handleInputChange} onBlur={() => sendTypingIndicator(false)} onKeyDown={handleKeyDown} className="chat-input-glass" rows={1} disabled={uploadingVideo} />
          )}
          <button className={`chat-send-btn-glass ${isRecording ? 'recording' : ''}`} onTouchEnd={handleMicOrSend} onMouseDown={handleMicOrSend} disabled={uploadingVideo}>
            {newMessage.trim() ? <Send size={20} /> : isRecording ? <Square size={20} /> : <Mic size={20} />}
          </button>
        </div>
      </div>

      {/* Group Info Modal */}
      {showGroupInfo && conversation?.type === 'group' && (
        <div className="team-modal-overlay" onClick={() => setShowGroupInfo(false)}>
          <div className="team-modal-content" onClick={e => e.stopPropagation()}>
            <div className="team-modal-header">
              <h3>{conversation.name}</h3>
              <button className="team-modal-close" onClick={() => setShowGroupInfo(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '8px 0', color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{conversation.members?.length} عضو</div>
            <div className="team-members-list" style={{ maxHeight: '50vh' }}>
              {conversation.members?.map(m => (
                <div key={m.userId} className="team-member-item">
                  <div className="team-member-avatar"><User size={18} /></div>
                  <div className="team-member-info">
                    <span className="team-member-name">{m.displayName} {m.userId === currentUserId ? '(شما)' : ''}</span>
                    <span className="team-member-role">{m.role === 'admin' ? 'ادمین گروه' : 'عضو'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .team-sender-name {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #a5b4fc;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

export default TeamChatView;