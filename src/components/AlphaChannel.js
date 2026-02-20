import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Heart, 
  Eye, 
  Pin, 
  PinOff,
  Play, 
  Pause, 
  X,
  Loader2,
  ArrowDown,
  Plus,
  Edit3,
  Trash2,
  Image,
  Video,
  Mic,
  Send,
  Square,
  Reply,
  CornerDownLeft,
  Check
} from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';
import ImageZoomModal from './ImageZoomModal';
import { formatRelativeTime } from '../utils/dateUtils';
import usePresence from '../hooks/usePresence';

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

// Persistent last read tracking (survives component unmount/remount)
let persistedLastReadPostId = 0;
let syncInProgress = false;
let syncTimer = null;

// Sync to server - throttled (max once per 2 seconds)
const syncToServer = (postId) => {
  if (syncTimer) return; // already scheduled
  
  syncTimer = setTimeout(async () => {
    syncTimer = null;
    if (syncInProgress) return;
    
    const latest = persistedLastReadPostId;
    if (latest <= 0) return;
    
    console.log('syncToServer - sending postId:', latest);
    syncInProgress = true;
    try {
      const token = authService.getToken();
      if (token) {
        await fetch(`${API_URL}/channel/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ postId: latest })
        });
      }
    } catch (e) {
      console.error('Sync mark-read error:', e);
    } finally {
      syncInProgress = false;
    }
  }, 2000);
};

// Reset persisted data (call on logout)
export const resetAlphaChannelState = () => {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  persistedLastReadPostId = 0;
};

const AlphaChannel = ({ onBack, isAdmin: isAdminProp, onUnreadCountChange }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Unread tracking states
  const [lastReadPostId, setLastReadPostId] = useState(0);
  const [channelUnreadCount, setChannelUnreadCount] = useState(0);
  const lastReadPostIdRef = useRef(0);
  const observerRef = useRef(null);
  const initialScrollDoneRef = useRef(false);
  const firstUnreadPostIdRef = useRef(null); // Fixed divider position
  
  // Handle back button - sync to server before leaving
  const handleBack = async () => {
    // Cancel any pending throttled sync
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    
    // Direct sync to server
    const postId = persistedLastReadPostId;
    console.log('handleBack - syncing postId:', postId);
    if (postId > 0) {
      try {
        const token = authService.getToken();
        if (token) {
          const resp = await fetch(`${API_URL}/channel/mark-read`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ postId })
          });
          const result = await resp.json();
          console.log('handleBack - server response:', result);
        }
      } catch (e) {
        console.error('handleBack - sync error:', e);
      }
    }
    
    onBack();
  };
  const isAdmin = isAdminProp !== undefined ? isAdminProp : authService.getUser()?.nicename === 'admin';
  
  // Track presence in alpha channel (prevents push notifications while viewing)
  usePresence('alpha', 'channel');
  
  // Media states
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomedVideo, setZoomedVideo] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Admin modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [deletingPost, setDeletingPost] = useState(null);
  const [pinMenuPost, setPinMenuPost] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Create/Edit form states
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Refs
  const containerRef = useRef(null);
  const postsEndRef = useRef(null);
  const audioRefs = useRef({});
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const notificationChannelRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const uploadXhrRef = useRef(null);
  const inputRef = useRef(null);
  
  // Scroll to bottom button
  const [showScrollButton, setShowScrollButton] = useState(false);
  const attachMenuRef = useRef(null);
  const [highlightedPostId, setHighlightedPostId] = useState(null);


  // Load posts
  const loadPosts = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);
      
      const response = await authService.authenticatedFetch(`${API_URL}/channel/posts?page=${pageNum}&per_page=20`);
      
      if (!response.ok) throw new Error('Failed to load posts');
      
      const data = await response.json();
      
      if (append) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
        
        // Set lastReadPostId from server (only on first load)
        if (data.lastReadPostId !== undefined) {
          // Use the higher of server value or locally persisted value
          // (local may be ahead if previous flush hasn't been processed yet)
          const serverLastRead = Math.max(data.lastReadPostId, persistedLastReadPostId);
          console.log('loadPosts - server lastReadPostId:', data.lastReadPostId, 'persisted:', persistedLastReadPostId, 'using:', serverLastRead);
          setLastReadPostId(serverLastRead);
          lastReadPostIdRef.current = serverLastRead;
          persistedLastReadPostId = serverLastRead;
          
          // Calculate initial unread count
          const unread = data.posts.filter(p => p.id > serverLastRead).length;
          setChannelUnreadCount(unread);
          
          // Remember the first unread post id for divider (fixed position)
          const sortedForDivider = [...data.posts].reverse();
          const firstUnread = sortedForDivider.find(p => p.id > serverLastRead);
          firstUnreadPostIdRef.current = firstUnread ? firstUnread.id : null;
          
          // Also sync home page badge
          if (onUnreadCountChange) {
            onUnreadCountChange(unread);
          }
        } else {
          console.warn('⚠️ Server did NOT return lastReadPostId - is the new alpha-channel.php deployed?');
        }
      }
      
      setHasMore(pageNum < data.pagination.totalPages);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error loading posts:', error);
      // If it's an auth error, the authService will handle logout
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    try {
      const response = await authService.authenticatedFetch(`${API_URL}/notifications?per_page=10`);
      
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
      const response = await authService.authenticatedFetch(`${API_URL}/notifications/unread-count`);
      
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
    
    if (!pusher._alphaConnectionBound) {
      pusher.connection.bind('connected', () => {
        console.log('Pusher connected!');
      });
      pusher.connection.bind('error', (err) => {
        console.error('Pusher connection error:', err);
      });
      pusher._alphaConnectionBound = true;
    }
    
    if (!alphaChannelInstance) {
      alphaChannelInstance = pusher.subscribe('alpha-channel');
      console.log('Subscribing to alpha-channel...');
      
      alphaChannelInstance.bind('pusher:subscription_succeeded', () => {
        console.log('Subscribed to alpha-channel');
      });
    }
    channelRef.current = alphaChannelInstance;
    
    channelRef.current.unbind('new-post');
    channelRef.current.bind('new-post', (data) => {
      console.log('New post received:', data);
      setPosts(prev => {
        // If we have a temp post, Pusher event is the real one - replace or skip
        const hasTempPost = prev.some(p => p._isTemp);
        if (hasTempPost) {
          let replaced = false;
          return prev.map(p => {
            if (p._isTemp && !replaced) {
              replaced = true;
              return { ...data, _isTemp: false, _justSent: true };
            }
            return p;
          });
        }
        // Check if already exists
        if (prev.some(p => p.id === data.id)) return prev;
        // New post from someone else - no auto scroll
        return [data, ...prev];
      });
      
      // If user is scrolled up (not near bottom), increment unread
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (!isNearBottom) {
          setChannelUnreadCount(prev => prev + 1);
        }
      }
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
    
    return () => {};
  }, [loadPosts, loadNotifications, loadUnreadCount, connectPusher]);

  // Fix iOS keyboard pushing content
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

  // Scroll to first unread post after initial load (instead of bottom)
  const observerReadyRef = useRef(false);
  
  useEffect(() => {
    if (!loading && posts.length > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      observerReadyRef.current = false; // Don't observe yet
      
      setTimeout(() => {
        const sortedPosts = [...posts].reverse(); // chronological order
        const firstUnread = sortedPosts.find(p => p.id > lastReadPostIdRef.current);
        
        if (firstUnread) {
          // Scroll to the unread divider (which is just above the first unread post)
          const divider = document.getElementById('unread-divider');
          if (divider) {
            divider.scrollIntoView({ behavior: 'auto', block: 'start' });
          } else {
            const el = document.getElementById(`post-${firstUnread.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'auto', block: 'start' });
            }
          }
          
          // Enable observer after scroll settles (prevent auto-counting)
          setTimeout(() => {
            observerReadyRef.current = true;
          }, 600);
          return;
        }
        // If no unread, scroll to bottom and enable observer
        postsEndRef.current?.scrollIntoView({ behavior: 'auto' });
        observerReadyRef.current = true;
      }, 150);
    }
  }, [loading, posts.length, lastReadPostId]);

  // Mark post as read (update local + throttled server sync)
  const markPostAsRead = useCallback((postId) => {
    if (postId <= lastReadPostIdRef.current) return;
    
    console.log('markPostAsRead:', postId);
    
    // Update local tracking
    lastReadPostIdRef.current = postId;
    setLastReadPostId(postId);
    persistedLastReadPostId = postId;
    
    // Throttled sync to server (every 2 seconds)
    syncToServer(postId);
  }, []);

  // IntersectionObserver to detect when unread posts become visible
  useEffect(() => {
    if (loading || posts.length === 0) return;
    
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Don't count until initial scroll is settled
        if (!observerReadyRef.current) return;
        
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const postId = parseInt(entry.target.dataset.postId);
            if (postId && postId > lastReadPostIdRef.current) {
              markPostAsRead(postId);
              
              // Update unread count
              setChannelUnreadCount(prev => {
                const newCount = Math.max(0, prev - 1);
                // Also update home page badge
                if (onUnreadCountChange) {
                  onUnreadCountChange(newCount);
                }
                return newCount;
              });
              
              // Stop observing this post
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5, // Post is "seen" when 50% visible
        rootMargin: '0px'
      }
    );
    
    observerRef.current = observer;
    
    // Observe only unread posts
    const sortedPosts = [...posts].reverse();
    sortedPosts.forEach(post => {
      if (post.id > lastReadPostIdRef.current) {
        const el = document.getElementById(`post-${post.id}`);
        if (el) {
          el.dataset.postId = post.id;
          observer.observe(el);
        }
      }
    });
    
    return () => {
      observer.disconnect();
    };
  }, [loading, posts, markPostAsRead, onUnreadCountChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }
    };
  }, []);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(event.target)) {
        setShowAttachMenu(false);
      }
    };

    if (showAttachMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showAttachMenu]);

  // Scroll to bottom
  const scrollToBottom = () => {
    postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollButton(!isNearBottom);
    
    if (scrollTop < 300 && !loadingMore && hasMore) {
      loadPosts(page + 1, true);
    }
  };

  // Toggle reaction
  const toggleReaction = async (postId, currentlyReacted) => {
    try {
      const token = authService.getToken();
      
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
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      
    } catch (error) {
      console.error('Error toggling reaction:', error);
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
    return formatRelativeTime(dateString);
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

  // ============ ADMIN FUNCTIONS ============

  // Reset form
  const resetForm = () => {
    setContent('');
    setMediaType(null);
    setMediaUrl('');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaDuration(0);
    setUploading(false);
    setUploadProgress(0);
    setSubmitting(false);
    setIsRecording(false);
    setRecordingTime(0);
    setReplyingTo(null);
  };

  // Open create modal
  const openCreateModal = () => {
    resetForm();
    setEditingPost(null);
    setShowCreateModal(true);
  };

  // Open edit modal
  const openEditModal = (post) => {
    resetForm();
    setContent(post.content || '');
    setMediaType(post.mediaType);
    setMediaUrl(post.mediaUrl || '');
    setMediaPreview(post.mediaUrl);
    setMediaDuration(post.mediaDuration || 0);
    setEditingPost(post);
    setShowCreateModal(true);
  };

  // Close modal
  const closeModal = () => {
    if (uploading && uploadXhrRef.current) {
      uploadXhrRef.current.abort();
    }
    if (isRecording) {
      stopRecording();
    }
    resetForm();
    setShowCreateModal(false);
    setEditingPost(null);
  };

  // Handle reply
  const handleReply = (post) => {
    setReplyingTo(post);
    // Focus on input
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Scroll to replied post
  const scrollToPost = (postId) => {
    document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: 'smooth' });
    setHighlightedPostId(postId);
    setTimeout(() => setHighlightedPostId(null), 2000);
  };

  // Get reply preview text
  const getReplyPreview = (post) => {
    if (post.content) {
      return post.content.substring(0, 60) + (post.content.length > 60 ? '...' : '');
    }
    if (post.mediaType === 'image') return '🖼 تصویر';
    if (post.mediaType === 'video') return '🎬 ویدیو';
    if (post.mediaType === 'audio') return '🎵 صوت';
    return '';
  };

  // Handle image select
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    setMediaFile(file);
    setMediaType('image');
    setMediaPreview(URL.createObjectURL(file));
    setMediaUrl('');
    e.target.value = '';
  };

  // Handle video select
  const handleVideoSelect = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('video/')) return;
    
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('حجم ویدیو نباید بیشتر از ۵۰ مگابایت باشد');
      e.target.value = '';
      return;
    }
    
    setMediaFile(file);
    setMediaType('video');
    setMediaPreview(URL.createObjectURL(file));
    setMediaUrl('');
    e.target.value = '';
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      let extension = 'webm';
      
      const mimeTypes = [
        { mime: 'audio/webm;codecs=opus', ext: 'webm' },
        { mime: 'audio/webm', ext: 'webm' },
        { mime: 'audio/mp4', ext: 'm4a' },
        { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
        { mime: 'audio/wav', ext: 'wav' }
      ];
      
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type.mime)) {
          mimeType = type.mime;
          extension = type.ext;
          break;
        }
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const actualMime = mediaRecorderRef.current.mimeType || mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const fileName = `recording_${Date.now()}.${extension}`;
        const audioFile = new File([audioBlob], fileName, { type: actualMime });
        
        setMediaFile(audioFile);
        setMediaType('audio');
        setMediaPreview(audioUrl);
        setMediaUrl('');
        setMediaDuration(recordingTime);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone error:', err);
      alert('لطفاً دسترسی به میکروفن را فعال کنید');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // Remove media
  const removeMedia = () => {
    setMediaFile(null);
    setMediaType(null);
    setMediaPreview(null);
    setMediaUrl('');
    setMediaDuration(0);
  };

  // Upload media with progress
  const uploadMediaWithProgress = (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const xhr = new XMLHttpRequest();
      uploadXhrRef.current = xhr;
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      });
      
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(new Error('Upload failed'));
        }
      });
      
      xhr.addEventListener('error', () => reject(new Error('Upload failed')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
      
      const token = authService.getToken();
      xhr.open('POST', `${API_URL}/admin/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);
    });
  };

  // Submit form
  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile && !mediaUrl) {
      return;
    }
    
    const savedContent = content.trim();
    const savedMediaFile = mediaFile;
    const savedMediaUrl = mediaUrl;
    const savedMediaType = mediaType;
    const savedMediaDuration = mediaDuration;
    const savedReplyingTo = replyingTo;
    const savedEditingPost = editingPost;
    
    // Clear form immediately so user can type next message
    resetForm();
    setShowAttachMenu(false);
    
    // Keep focus on input (iOS keyboard fix)
    setTimeout(() => inputRef.current?.focus(), 0);
    
    // For edit mode, no optimistic update
    if (savedEditingPost) {
      try {
        const token = authService.getToken();
        let finalMediaUrl = savedMediaUrl;
        if (savedMediaFile) {
          setUploading(true);
          const uploadResponse = await uploadMediaWithProgress(savedMediaFile, (progress) => setUploadProgress(progress));
          finalMediaUrl = uploadResponse.url;
          setUploading(false);
        }
        await fetch(`${API_URL}/admin/channel/posts/${savedEditingPost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authService.getToken()}` },
          body: JSON.stringify({ content: savedContent, mediaType: savedMediaType, mediaUrl: finalMediaUrl || null, mediaDuration: savedMediaDuration, replyToId: savedReplyingTo?.id || null })
        });
        setEditingPost(null);
      } catch (error) {
        console.error('Error updating post:', error);
      } finally {
        setUploading(false);
      }
      return;
    }
    
    // Optimistic update - add temp post immediately
    const tempId = `temp-${Date.now()}`;
    const tempPost = {
      id: tempId,
      content: savedContent,
      mediaType: savedMediaFile ? savedMediaType : (savedMediaUrl ? savedMediaType : null),
      mediaUrl: savedMediaFile ? URL.createObjectURL(savedMediaFile) : savedMediaUrl,
      mediaDuration: savedMediaDuration,
      createdAt: new Date().toISOString(),
      isEdited: false,
      isPinned: false,
      viewsCount: 0,
      reactionsCount: 0,
      userReacted: false,
      replyTo: savedReplyingTo ? {
        id: savedReplyingTo.id,
        content: savedReplyingTo.content,
        mediaType: savedReplyingTo.mediaType
      } : null,
      _isTemp: true
    };
    
    setPosts(prev => [tempPost, ...prev]);
    
    // Scroll to bottom to show new post
    setTimeout(() => {
      postsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    
    try {
      const token = authService.getToken();
      let finalMediaUrl = savedMediaUrl;
      
      if (savedMediaFile) {
        setUploading(true);
        const uploadResponse = await uploadMediaWithProgress(savedMediaFile, (progress) => setUploadProgress(progress));
        finalMediaUrl = uploadResponse.url;
        setUploading(false);
      }
      
      const response = await fetch(`${API_URL}/admin/channel/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: savedContent, mediaType: savedMediaType, mediaUrl: finalMediaUrl || null, mediaDuration: savedMediaDuration, replyToId: savedReplyingTo?.id || null })
      });
      
      if (!response.ok) throw new Error('Failed to create post');
      
      const data = await response.json();
      
      // Replace temp post with real one
      setPosts(prev => prev.map(p => p.id === tempId ? { ...p, ...data.post, _isTemp: false, _justSent: true } : p));
      
    } catch (error) {
      console.error('Error submitting post:', error);
      // Remove temp post on error
      setPosts(prev => prev.filter(p => p.id !== tempId));
    } finally {
      setUploading(false);
    }
  };

  // Delete post
  const [deleting, setDeleting] = useState(false);
  
  const handleDelete = async () => {
    if (!deletingPost || deleting) return;
    
    setDeleting(true);
    
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/admin/channel/posts/${deletingPost.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setPosts(prev => prev.filter(p => p.id !== deletingPost.id));
      setDeletingPost(null);
    } catch (error) {
      console.error('Error deleting post:', error);
    } finally {
      setDeleting(false);
    }
  };

  // Toggle pin
  const togglePin = async (post, duration = null) => {
    // If unpinning, do it directly
    if (post.isPinned) {
      try {
        const token = authService.getToken();
        const response = await fetch(`${API_URL}/admin/channel/posts/${post.id}/pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to toggle pin');
        
        const data = await response.json();
        setPosts(prev => {
          const updated = prev.map(p => 
            p.id === post.id ? { ...p, isPinned: data.isPinned } : p
          );
          return updated.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
        });
      } catch (error) {
        console.error('Error toggling pin:', error);
      }
      return;
    }
    
    // If pinning, check limit and show menu
    const pinnedCount = posts.filter(p => p.isPinned).length;
    if (pinnedCount >= 3) {
      alert('حداکثر ۳ پست می‌توانند پین شوند');
      return;
    }
    
    // If no duration provided, show menu
    if (!duration) {
      setPinMenuPost(post);
      return;
    }
    
    // Pin with duration
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/admin/channel/posts/${post.id}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ duration })
      });
      
      if (!response.ok) throw new Error('Failed to toggle pin');
      
      const data = await response.json();
      setPosts(prev => {
        const updated = prev.map(p => 
          p.id === post.id ? { ...p, isPinned: data.isPinned } : p
        );
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Find replied post
  const findRepliedPost = (replyToId) => {
    return posts.find(p => p.id === replyToId);
  };

  // Render post content based on type
  const renderPostContent = (post) => {
    const repliedPost = post.replyToId ? findRepliedPost(post.replyToId) : null;
    
    return (
      <>
        {/* Reply Reference */}
        {repliedPost && (
          <div 
            className="reply-reference"
            onClick={() => scrollToPost(repliedPost.id)}
          >
            <div className="reply-reference-bar" />
            <div className="reply-reference-content">
              <span className="reply-reference-label">
                <CornerDownLeft size={12} />
                پاسخ به
              </span>
              <p className="reply-reference-text">
                {getReplyPreview(repliedPost)}
              </p>
            </div>
          </div>
        )}
        
        {post.content && (
          <p className="post-text">{post.content}</p>
        )}
        
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
          <button className="chat-back-btn" onClick={handleBack}>
            <ArrowLeft size={22} />
          </button>
          <div className="chat-header-info">
            <div className="chat-header-text">
              <span className="chat-header-title">Alfa Channel</span>
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
        <button className="chat-back-btn" onClick={handleBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">Alfa Channel</span>
          </div>
          <div className="chat-avatar-glass channel-avatar-img-container">
            <img src="/channel-avatar.jpg" alt="Alfa Group" className="channel-avatar-img" />
          </div>
        </div>
      </div>

      {/* Pinned Posts Bar */}
      {posts.filter(p => p.isPinned).length > 0 && (
        <div className="pinned-posts-container">
          {posts.filter(p => p.isPinned).map(pinnedPost => (
            <div 
              key={pinnedPost.id}
              className="pinned-post-bar"
              onClick={() => {
                document.getElementById(`post-${pinnedPost.id}`)?.scrollIntoView({ behavior: 'smooth' });
                setHighlightedPostId(pinnedPost.id);
                setTimeout(() => setHighlightedPostId(null), 2000);
              }}
            >
              <div className="pinned-bar-icon">
                <Pin size={16} />
              </div>
              <div className="pinned-bar-content">
                <span className="pinned-bar-label">پیام پین شده</span>
                <p className="pinned-bar-text">
                  {pinnedPost.content?.substring(0, 50) || 
                   (pinnedPost.mediaType === 'image' ? '🖼 تصویر' :
                    pinnedPost.mediaType === 'video' ? '🎬 ویدیو' :
                    pinnedPost.mediaType === 'audio' ? '🎵 صوت' : '')}
                  {pinnedPost.content?.length > 50 ? '...' : ''}
                </p>
              </div>
              {pinnedPost.mediaType === 'image' && (
                <img 
                  src={pinnedPost.mediaUrl} 
                  className="pinned-bar-thumb"
                  alt=""
                />
              )}
              {pinnedPost.mediaType === 'video' && (
                <div className="pinned-bar-thumb video-thumb">
                  <video src={pinnedPost.mediaUrl + '#t=0.5'} />
                  <Play size={14} />
                </div>
              )}
              {pinnedPost.mediaType === 'audio' && (
                <div className="pinned-bar-thumb audio-thumb">
                  <Mic size={18} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Posts Area */}
      <div 
        className="channel-posts-area"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className="loading-more">
            <Loader2 size={24} className="spinning" />
          </div>
        )}
        
        {!hasMore && posts.length > 0 && (
          <div className="no-more-posts">پست‌های بیشتری وجود ندارد</div>
        )}

        {[...posts].reverse().map((post, index, arr) => {
          // Show divider only at the fixed first unread position (set at mount time)
          const showDivider = firstUnreadPostIdRef.current && post.id === firstUnreadPostIdRef.current;
          
          return (
            <React.Fragment key={post.id}>
              {showDivider && (
                <div id="unread-divider" className="unread-divider">
                  <div className="unread-divider-line" />
                  <span className="unread-divider-text">پیام‌های خوانده نشده</span>
                  <div className="unread-divider-line" />
                </div>
              )}
              <div 
                id={`post-${post.id}`}
                className={`channel-post-card ${post.isPinned ? 'pinned' : ''} ${highlightedPostId === post.id ? 'highlighted' : ''}`}
              >
            {post.isPinned && (
              <div className="pin-indicator">
                <Pin size={14} />
                <span>پین شده</span>
              </div>
            )}
            
            <div className="post-content">
              {renderPostContent(post)}
            </div>
            
            <div className="post-footer">
              <div className="post-stats">
                <span className="post-time">
                  {formatTime(post.createdAt)}
                  {post.isEdited && <span className="edited-label"> • ویرایش شده</span>}
                  {isAdmin && post._isTemp && (
                    <span className="post-status sending" style={{marginRight:'4px',color:'rgba(255,255,255,0.4)',fontSize:'12px'}}>○</span>
                  )}
                  {isAdmin && !post._isTemp && post._justSent && (
                    <Check size={13} style={{marginRight:'4px',color:'rgba(255,255,255,0.5)',verticalAlign:'middle'}} />
                  )}
                </span>
                <div className="post-counters">
                  <span className="view-count">
                    <Eye size={14} />
                    {post.viewsCount}
                  </span>
                </div>
              </div>
              
              <div className="post-actions-row">
                {/* Admin Actions */}
                {isAdmin && (
                  <div className="admin-actions">
                    <button 
                      className="admin-action-btn"
                      onClick={() => handleReply(post)}
                      title="پاسخ"
                    >
                      <Reply size={16} />
                    </button>
                    <button 
                      className="admin-action-btn"
                      onClick={() => togglePin(post)}
                      title={post.isPinned ? 'برداشتن پین' : 'پین کردن'}
                    >
                      {post.isPinned ? <PinOff size={16} /> : <Pin size={16} />}
                    </button>
                    <button 
                      className="admin-action-btn"
                      onClick={() => openEditModal(post)}
                      title="ویرایش"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      className="admin-action-btn delete"
                      onClick={() => setDeletingPost(post)}
                      title="حذف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
                
                <button 
                  className={`reaction-btn ${post.userReacted ? 'reacted' : ''}`}
                  onClick={() => toggleReaction(post.id, post.userReacted)}
                >
                  <Heart size={20} fill={post.userReacted ? '#ef4444' : 'none'} />
                  <span>{post.reactionsCount}</span>
                </button>
              </div>
            </div>
          </div>
            </React.Fragment>
          );
        })}
        
        {!loading && posts.length === 0 && (
          <div className="empty-channel">
            <span className="empty-icon">📭</span>
            <p>هنوز پستی منتشر نشده است</p>
          </div>
        )}
        
        <div ref={postsEndRef} />
      </div>
      
      {/* Scroll to Bottom Button with Unread Badge */}
      {showScrollButton && (
        <button className="scroll-to-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={20} />
          {channelUnreadCount > 0 && (
            <span className="scroll-btn-badge">{channelUnreadCount > 99 ? '99+' : channelUnreadCount}</span>
          )}
        </button>
      )}

      {/* Admin Input Area */}
      {isAdmin && (
        <div className="admin-input-container">
          {/* Reply Preview */}
          {replyingTo && (
            <div className="reply-preview">
              <div className="reply-preview-bar" />
              <div className="reply-preview-content">
                <span className="reply-preview-label">در پاسخ به:</span>
                <p className="reply-preview-text">{getReplyPreview(replyingTo)}</p>
              </div>
              <button className="reply-cancel-btn" onClick={cancelReply}>
                <X size={18} />
              </button>
            </div>
          )}
          
          {/* Media Preview */}
          {mediaPreview && (
            <div className="input-media-preview">
              {mediaType === 'image' && <img src={mediaPreview} alt="" />}
              {mediaType === 'video' && <video src={mediaPreview} />}
              {mediaType === 'audio' && (
                <div className="input-audio-preview">
                  <Mic size={20} />
                  <span>{formatDuration(mediaDuration)}</span>
                </div>
              )}
              <button className="remove-preview-btn" onClick={removeMedia}>
                <X size={16} />
              </button>
            </div>
          )}
          
          {/* Recording Indicator */}
          {isRecording && (
            <div className="input-recording">
              <div className="recording-dot" />
              <span>{formatDuration(recordingTime)}</span>
              <span>در حال ضبط...</span>
            </div>
          )}
          
          {/* Upload Progress */}
          {uploading && (
            <div className="input-upload-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span>{uploadProgress}%</span>
            </div>
          )}
          
          <div className="admin-input-wrapper">
            {/* Attach Button */}
            {!isRecording && (
              <div className="attach-menu-container" ref={attachMenuRef}>
                <button 
                  className="attach-btn"
                  onTouchEnd={(e) => { e.preventDefault(); setShowAttachMenu(!showAttachMenu); }}
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                >
                  <Plus size={22} />
                </button>
                
                {showAttachMenu && (
                  <div className="attach-menu">
                    <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }}>
                      <Image size={20} />
                      <span>تصویر</span>
                    </button>
                    <button onClick={() => { videoInputRef.current?.click(); setShowAttachMenu(false); }}>
                      <Video size={20} />
                      <span>ویدیو</span>
                    </button>
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  style={{ display: 'none' }}
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoSelect}
                  accept="video/*"
                  style={{ display: 'none' }}
                />
              </div>
            )}
            
            {/* Text Input or Recording */}
            {isRecording ? (
              <div className="recording-display">
                <div className="recording-dot" />
                <span>{formatDuration(recordingTime)}</span>
              </div>
            ) : (
              <textarea
                ref={inputRef}
                className="admin-input"
                placeholder="پیام خود را بنویسید..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={1}
                disabled={uploading}
              />
            )}
            
            {/* Send or Mic Button */}
            <button 
              className={`send-btn ${isRecording ? 'recording' : ''}`}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isRecording) {
                  stopRecording();
                } else if (content.trim() || mediaFile) {
                  handleSubmit();
                } else {
                  startRecording();
                }
              }}
              onClick={(e) => {
                e.preventDefault();
                if (isRecording) {
                  stopRecording();
                } else if (content.trim() || mediaFile) {
                  handleSubmit();
                } else {
                  startRecording();
                }
              }}
              disabled={uploading}
            >
              {content.trim() || mediaFile ? (
                <Send size={20} />
              ) : isRecording ? (
                <Square size={20} />
              ) : (
                <Mic size={20} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Image Zoom Modal with Pinch-to-Zoom */}
      {zoomedImage && (
        <ImageZoomModal 
          src={zoomedImage} 
          onClose={() => setZoomedImage(null)} 
        />
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPost ? 'ویرایش پست' : 'پست جدید'}</h2>
              <button className="close-btn" onClick={closeModal}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <textarea
                className="post-textarea"
                placeholder="متن پست را بنویسید..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
              />
              
              {mediaPreview && (
                <div className="media-preview">
                  {mediaType === 'image' && (
                    <img src={mediaPreview} alt="" />
                  )}
                  {mediaType === 'video' && (
                    <video src={mediaPreview} controls />
                  )}
                  {mediaType === 'audio' && (
                    <div className="audio-preview">
                      <audio src={mediaPreview} controls />
                      <span>مدت: {formatDuration(mediaDuration)}</span>
                    </div>
                  )}
                  <button className="remove-media-btn" onClick={removeMedia}>
                    <X size={20} />
                  </button>
                </div>
              )}
              
              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span>{uploadProgress}%</span>
                </div>
              )}
              
              {isRecording && (
                <div className="recording-indicator-modal">
                  <div className="recording-dot" />
                  <span>{formatDuration(recordingTime)}</span>
                  <span>در حال ضبط...</span>
                </div>
              )}
              
              {!mediaPreview && !isRecording && (
                <div className="media-buttons">
                  <button 
                    className="media-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Image size={20} />
                    <span>تصویر</span>
                  </button>
                  <button 
                    className="media-btn"
                    onClick={() => videoInputRef.current?.click()}
                  >
                    <Video size={20} />
                    <span>ویدیو</span>
                  </button>
                  <button 
                    className="media-btn"
                    onClick={startRecording}
                  >
                    <Mic size={20} />
                    <span>صدا</span>
                  </button>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                  <input
                    type="file"
                    ref={videoInputRef}
                    onChange={handleVideoSelect}
                    accept="video/*"
                    style={{ display: 'none' }}
                  />
                </div>
              )}
              
              {isRecording && (
                <button className="stop-recording-btn" onClick={stopRecording}>
                  <Square size={20} />
                  <span>توقف ضبط</span>
                </button>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal}>
                انصراف
              </button>
              <button 
                className="submit-btn"
                onClick={handleSubmit}
                disabled={uploading || isRecording}
              >
                  <>
                    <Send size={20} />
                    <span>{editingPost ? 'ذخیره' : 'انتشار'}</span>
                  </>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPost && (
        <div className="modal-overlay" onClick={() => setDeletingPost(null)}>
          <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>حذف پست</h2>
              <button className="close-btn" onClick={() => setDeletingPost(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p>آیا از حذف این پست اطمینان دارید؟</p>
              <p className="warning-text">این عمل قابل بازگشت نیست.</p>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setDeletingPost(null)}>
                انصراف
              </button>
              <button className="delete-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <Loader2 size={20} className="spinning" />
                ) : (
                  <Trash2 size={20} />
                )}
                <span>{deleting ? '... در حال حذف' : 'حذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pin Duration Modal */}
      {pinMenuPost && (
        <div className="modal-overlay" onClick={() => setPinMenuPost(null)}>
          <div className="modal-content pin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>مدت زمان پین</h2>
              <button className="close-btn" onClick={() => setPinMenuPost(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p>این پست تا چه زمانی پین بماند؟</p>
              <div className="pin-duration-options">
                <button 
                  className="pin-duration-btn"
                  onClick={() => {
                    togglePin(pinMenuPost, '24h');
                    setPinMenuPost(null);
                  }}
                >
                  <span className="duration-icon">🕐</span>
                  <span className="duration-text">۲۴ ساعت</span>
                </button>
                <button 
                  className="pin-duration-btn"
                  onClick={() => {
                    togglePin(pinMenuPost, '1w');
                    setPinMenuPost(null);
                  }}
                >
                  <span className="duration-icon">📅</span>
                  <span className="duration-text">۱ هفته</span>
                </button>
                <button 
                  className="pin-duration-btn"
                  onClick={() => {
                    togglePin(pinMenuPost, '30d');
                    setPinMenuPost(null);
                  }}
                >
                  <span className="duration-icon">📆</span>
                  <span className="duration-text">۳۰ روز</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .channel-avatar-img-container {
          overflow: hidden;
          padding: 0 !important;
          border-radius: 50%;
        }
        
        .channel-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .channel-posts-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px;
          padding-bottom: 80px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .channel-posts-area::-webkit-scrollbar {
          display: none;
        }
        
        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 80px;
          right: 16px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 100;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }
        
        .scroll-btn-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          background: #3b82f6;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
        }
        
        .channel-post-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.2s;
        }
        
        .unread-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 16px;
          margin: 8px 0;
          background: rgba(255, 255, 255, 0.75);
          border-radius: 8px;
        }
        
        .unread-divider-line {
          flex: 1;
          height: 1px;
          background: rgba(0, 0, 0, 0.25);
        }
        
        .unread-divider-text {
          font-size: 13px;
          color: rgba(1, 1, 1, 0.6);
          white-space: nowrap;
          font-weight: 500;
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
        
        /* Reply Reference Styles */
        .reply-reference {
          display: flex;
          align-items: stretch;
          gap: 10px;
          margin-bottom: 12px;
          padding: 10px 12px;
          background: rgba(99, 102, 241, 0.1);
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .reply-reference:active {
          background: rgba(99, 102, 241, 0.2);
        }
        
        .reply-reference-bar {
          width: 3px;
          background: #6366f1;
          border-radius: 2px;
          flex-shrink: 0;
        }
        
        .reply-reference-content {
          flex: 1;
          min-width: 0;
        }
        
        .reply-reference-label {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #a5b4fc;
          margin-bottom: 4px;
        }
        
        .reply-reference-text {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        /* Reply Preview in Input */
        .reply-preview {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding: 10px 12px;
          background: rgba(99, 102, 241, 0.15);
          border-radius: 12px;
        }
        
        .reply-preview-bar {
          width: 3px;
          height: 36px;
          background: #6366f1;
          border-radius: 2px;
          flex-shrink: 0;
        }
        
        .reply-preview-content {
          flex: 1;
          min-width: 0;
        }
        
        .reply-preview-label {
          font-size: 11px;
          color: #a5b4fc;
          margin-bottom: 2px;
        }
        
        .reply-preview-text {
          margin: 0;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.8);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .reply-cancel-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        
        .reply-cancel-btn:active {
          background: rgba(255, 255, 255, 0.2);
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
        
        .post-actions-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .admin-actions {
          display: flex;
          gap: 6px;
        }
        
        .admin-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .admin-action-btn:active {
          transform: scale(0.9);
        }
        
        .admin-action-btn.delete {
          color: #ef4444;
        }
        
        .admin-action-btn.delete:hover {
          background: rgba(239, 68, 68, 0.2);
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
        
        .pinch-zoom-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          touch-action: pan-x pan-y pinch-zoom;
        }
        
        .pinch-zoom-image {
          transition: transform 0.3s ease;
          touch-action: pinch-zoom;
          cursor: zoom-in;
        }
        
        .pinch-zoom-image[style*="scale(2)"] {
          cursor: zoom-out;
        }
        
        .zoomed-video {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 8px;
        }
        
        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        
        .modal-content {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          background: rgba(30, 30, 45, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .modal-header h2 {
          margin: 0;
          font-size: 18px;
          color: white;
        }
        
        .close-btn {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 4px;
        }
        
        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        
        .post-textarea {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 14px;
          color: white;
          font-size: 15px;
          font-family: inherit;
          resize: none;
          outline: none;
        }
        
        .post-textarea:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
        
        .media-preview {
          position: relative;
          margin-top: 16px;
          border-radius: 12px;
          overflow: hidden;
        }
        
        .media-preview img,
        .media-preview video {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
        }
        
        .audio-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
        }
        
        .audio-preview audio {
          width: 100%;
        }
        
        .audio-preview span {
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
        }
        
        .remove-media-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        
        .upload-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
        }
        
        .progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          transition: width 0.3s;
        }
        
        .upload-progress span {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          min-width: 40px;
        }
        
        .recording-indicator-modal {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 16px;
          padding: 16px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 12px;
          color: #ef4444;
        }
        
        .recording-dot {
          width: 12px;
          height: 12px;
          background: #ef4444;
          border-radius: 50%;
          animation: pulse 1s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .media-buttons {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }
        
        .media-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .media-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.1);
        }
        
        .media-btn span {
          font-size: 13px;
        }
        
        .stop-recording-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          margin-top: 16px;
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #ef4444;
          font-size: 15px;
          cursor: pointer;
        }
        
        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .cancel-btn {
          flex: 1;
          padding: 14px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          cursor: pointer;
        }
        
        .submit-btn {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          cursor: pointer;
        }
        
        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .delete-modal .modal-body p {
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 8px 0;
        }
        
        .warning-text {
          color: #ef4444 !important;
          font-size: 13px;
        }
        
        .delete-btn {
          flex: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: #ef4444;
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 15px;
          cursor: pointer;
        }
        
        /* Admin Input Area Styles */
        .admin-input-container {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(20, 20, 30, 0.95);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 16px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          z-index: 50;
        }
        
        .input-media-preview {
          position: relative;
          margin-bottom: 12px;
          border-radius: 12px;
          overflow: hidden;
          max-height: 150px;
        }
        
        .input-media-preview img,
        .input-media-preview video {
          width: 100%;
          max-height: 150px;
          object-fit: cover;
        }
        
        .input-audio-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          color: #a5b4fc;
        }
        
        .remove-preview-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          border: none;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        
        .input-recording {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          padding: 10px 14px;
          background: rgba(239, 68, 68, 0.15);
          border-radius: 12px;
          color: #ef4444;
          font-size: 14px;
        }
        
        .input-upload-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        
        .admin-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 10px;
        }
        
        .attach-menu-container {
          position: relative;
        }
        
        .attach-btn {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .attach-btn:active {
          transform: scale(0.9);
          background: rgba(255, 255, 255, 0.15);
        }
        
        .attach-menu {
          position: absolute;
          bottom: 54px;
          left: 0;
          background: rgba(30, 30, 45, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          overflow: hidden;
          min-width: 140px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
        }
        
        .attach-menu button {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 14px 18px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .attach-menu button:active {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .attach-menu button:not(:last-child) {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .admin-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 22px;
          padding: 12px 18px;
          color: white;
          font-size: 15px;
          font-family: inherit;
          resize: none;
          outline: none;
          max-height: 120px;
          min-height: 44px;
        }
        
        .admin-input:focus {
          border-color: rgba(99, 102, 241, 0.5);
        }
        
        .admin-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        
        .recording-display {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          background: rgba(239, 68, 68, 0.15);
          border-radius: 22px;
          color: #ef4444;
        }
        
        .send-btn {
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
          transition: all 0.2s;
          flex-shrink: 0;
        }
        
        .send-btn:active {
          transform: scale(0.9);
        }
        
        .send-btn.recording {
          background: #ef4444;
        }
        
        .send-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Pinned Posts Container */
        .pinned-posts-container {
          position: relative;
          z-index: 50;
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          margin: 16px;
          margin-bottom: 0;
          overflow: hidden;
          max-height: 200px;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 1);
        }
        
        .pinned-posts-container::-webkit-scrollbar {
          display: none;
        }

        /* Pinned Post Bar */
        .pinned-post-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .pinned-post-bar:last-child {
          border-bottom: none;
        }
        
        .pinned-post-bar:active {
          background: rgba(255, 255, 255, 0.1);
        }
        
        .pinned-bar-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
        }
        
        .pinned-bar-content {
          flex: 1;
          min-width: 0;
          overflow: hidden;
        }
        
        .pinned-bar-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }
        
        .pinned-bar-text {
          margin: 4px 0 0 0;
          font-size: 14px;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .pinned-bar-thumb {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .pinned-bar-thumb.video-thumb {
          position: relative;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .pinned-bar-thumb.video-thumb video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }
        
        .pinned-bar-thumb.video-thumb svg {
          position: absolute;
          color: white;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        
        .pinned-bar-thumb.audio-thumb {
          background: rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        /* Highlighted Post Animation */
        .channel-post-card.highlighted {
          animation: flashHighlight 2s ease-out;
        }
        
        @keyframes flashHighlight {
          0% {
            background: rgba(99, 102, 241, 0.5);
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
          }
          25% {
            background: rgba(99, 102, 241, 0.3);
            box-shadow: 0 0 15px rgba(99, 102, 241, 0.3);
          }
          50% {
            background: rgba(99, 102, 241, 0.4);
            box-shadow: 0 0 20px rgba(99, 102, 241, 0.4);
          }
          75% {
            background: rgba(99, 102, 241, 0.2);
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
          }
          100% {
            background: rgba(255, 255, 255, 0.05);
            box-shadow: none;
          }
        }
        
        .channel-post-card.pinned.highlighted {
          animation: flashHighlightPinned 2s ease-out;
        }
        
        @keyframes flashHighlightPinned {
          0% {
            background: rgba(99, 102, 241, 0.6);
            box-shadow: 0 0 25px rgba(99, 102, 241, 0.6);
          }
          25% {
            background: rgba(99, 102, 241, 0.4);
            box-shadow: 0 0 18px rgba(99, 102, 241, 0.4);
          }
          50% {
            background: rgba(99, 102, 241, 0.5);
            box-shadow: 0 0 22px rgba(99, 102, 241, 0.5);
          }
          75% {
            background: rgba(99, 102, 241, 0.25);
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
          }
          100% {
            background: rgba(99, 102, 241, 0.1);
            box-shadow: none;
          }
        }

        /* Pin Duration Modal */
        .pin-modal {
          max-width: 340px;
        }
        
        .pin-modal .modal-body p {
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 20px;
          text-align: center;
        }
        
        .pin-duration-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .pin-duration-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .pin-duration-btn:active {
          transform: scale(0.98);
          background: rgba(99, 102, 241, 0.2);
          border-color: rgba(99, 102, 241, 0.4);
        }
        
        .duration-icon {
          font-size: 24px;
        }
        
        .duration-text {
          flex: 1;
          text-align: right;
        }
      `}</style>
    </div>
  );
};

export default AlphaChannel;