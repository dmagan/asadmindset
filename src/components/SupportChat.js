import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Headphones, Trash2, Edit3, X, Paperclip, Mic, Square, Play, Pause, Check, CheckCheck, Reply, CornerDownLeft, ArrowDown, Video, Image, Loader2, ChevronLeft } from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';
import ImageZoomModal from './ImageZoomModal';
import usePresence from '../hooks/usePresence';
import { formatMsgTime } from '../utils/dateUtils';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

const SupportChat = ({ onBack, onMessagesRead }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  
  usePresence('support', conversationId);
  
  // Check if current user is admin
  const currentUser = authService.getUser();
  const isAdmin = currentUser?.nicename === 'admin';
  
  
  // Typing indicator state - shows when OTHER party is typing
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherRecording, setIsOtherRecording] = useState(false);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  
  // Menu states
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);
  const [zoomedVideo, setZoomedVideo] = useState(null);
  
  // Video upload states
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingTempId, setUploadingTempId] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  
  // بستن منو با کلیک بیرون
useEffect(() => {
  const handleClickOutside = (e) => {
    if (showAttachMenu && !e.target.closest('.attach-menu-container-mobile')) {
      setShowAttachMenu(false);
    }
  };
  
  document.addEventListener('click', handleClickOutside);
  return () => document.removeEventListener('click', handleClickOutside);
}, [showAttachMenu]);
  
  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const recordingIndicatorRef = useRef(null);
  
  // Highlighted message for scroll to reply
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  
  // Scroll to bottom button
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Refs
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const uploadXhrRef = useRef(null);
  const longPressTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRefs = useRef({});
  const pusherRef = useRef(null);
  const channelRef = useRef(null);
  const messageRefs = useRef({});
  
  // Scroll to message and highlight
  const scrollToMessage = (messageId) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      // Vibrate on mobile
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      setTimeout(() => setHighlightedMessageId(null), 2500);
    }
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll to show/hide scroll button
  const handleScroll = () => {
    if (messagesAreaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesAreaRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      setShowScrollButton(!isNearBottom);
    }
  };

  // Initialize
  useEffect(() => {
    loadConversation();
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unbind_all();
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, []);

  // Mark admin messages as read when chat is open (only once when loaded)
  const hasMarkedAsRead = useRef(false);
  
  useEffect(() => {
    if (conversationId && messages.length > 0 && !hasMarkedAsRead.current) {
      const unreadAdminMessages = messages.filter(m => m.sender === 'support' && m.status !== 'read');
      if (unreadAdminMessages.length > 0) {
        hasMarkedAsRead.current = true;
        markMessagesAsRead();
      }
    }
  }, [messages, conversationId]);

  const markMessagesAsRead = async () => {
    try {
      await authService.authenticatedFetch(`${API_URL}/conversation/read`, {
        method: 'POST'
      });
      
      // Update local state to mark admin messages as read
      setMessages(prev => prev.map(msg => 
        msg.sender === 'support' && msg.status !== 'read' 
          ? { ...msg, status: 'read' } 
          : msg
      ));
      
      // Notify parent that messages are read
      if (onMessagesRead) {
        onMessagesRead();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadConversation = async () => {
    try {
      const response = await authService.authenticatedFetch(`${API_URL}/conversation`);
      
      if (!response.ok) throw new Error('Failed to load conversation');
      
      const data = await response.json();
      
      const formattedMessages = data.messages.map(msg => ({
        id: msg.id,
        text: msg.type === 'text' ? msg.content : null,
        image: msg.type === 'image' ? msg.mediaUrl : null,
        video: msg.type === 'video' ? msg.mediaUrl : null,
        audio: msg.type === 'audio' ? msg.mediaUrl : null,
        duration: msg.duration || 0,
        sender: msg.sender === 'admin' ? 'support' : 'user',
        time: formatMessageTime(msg.createdAt),
        edited: msg.isEdited,
        status: msg.status || 'sent',
        replyTo: msg.replyTo ? {
  id: msg.replyTo.id,
  type: msg.replyTo.type,
  content: msg.replyTo.type === 'text' ? msg.replyTo.content : 
           msg.replyTo.type === 'image' ? '📷 تصویر' : 
           msg.replyTo.type === 'video' ? '🎬 ویدیو' : '🎤 پیام صوتی',
  sender: msg.replyTo.sender === 'admin' ? 'support' : 'user'
} : null
      }));
      
      setMessages(formattedMessages);
      setConversationId(data.conversationId);
      connectPusher(data.pusherChannel);
      
    } catch (error) {
      console.error('Error loading conversation:', error);
      setMessages([{
        id: 1,
        text: 'سلام! به پشتیبانی خوش آمدید 👋',
        sender: 'support',
        time: formatMessageTime(new Date().toISOString()),
        status: 'read'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const connectPusher = (channelName) => {
    if (pusherRef.current) return;
    
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
    
    channelRef.current = pusherRef.current.subscribe(channelName);
    
    // New message from admin
    channelRef.current.bind('new-message', (data) => {
      if (data.sender === 'admin') {
        const newMsg = {
          id: data.id,
          text: data.type === 'text' ? data.content : null,
          image: data.type === 'image' ? data.mediaUrl : null,
          video: data.type === 'video' ? data.mediaUrl : null,
          audio: data.type === 'audio' ? data.mediaUrl : null,
          duration: data.duration || 0,
          sender: 'support',
          time: formatMessageTime(data.createdAt),
          edited: false,
          status: 'delivered',
          replyTo: data.replyTo ? {
            id: data.replyTo.id,
            type: data.replyTo.type,
            content: data.replyTo.content,
            sender: data.replyTo.sender === 'admin' ? 'support' : 'user'
          } : null
        };
        setMessages(prev => [...prev, newMsg]);
        playNotificationSound();
        
        // Mark as read immediately since chat is open
        markMessagesAsRead();
      }
    });
    
    // Messages read by admin
    channelRef.current.bind('messages-read', (data) => {
      if (data.readBy === 'admin') {
        setMessages(prev => prev.map(msg => 
          data.messageIds.includes(msg.id) ? { ...msg, status: 'read' } : msg
        ));
      }
    });
    
    // Typing indicator - listen for OTHER party typing or recording
    channelRef.current.bind('typing', (data) => {
      console.log('📥 Received indicator:', data);
      
      // If I'm admin, show when user types. If I'm user, show when admin types.
      const shouldShow = isAdmin ? data.sender === 'user' : data.sender === 'admin';
      
      if (shouldShow) {
        setIsOtherTyping(data.isTyping);
        setIsOtherRecording(data.isRecording || false);
        
        console.log('👁 Showing:', { typing: data.isTyping, recording: data.isRecording });
        
        // Auto-hide after 3 seconds if no update
        if (data.isTyping || data.isRecording) {
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
            setIsOtherRecording(false);
          }, 3000);
        }
      }
    });
    
    // Message edited
    channelRef.current.bind('message-edited', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.id ? { ...msg, text: data.content, edited: true } : msg
      ));
    });
    
    // Message deleted
    channelRef.current.bind('message-deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.id));
    });
  };

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

  const formatMessageTime = (dateString) => {
    return formatMsgTime(dateString);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }

    // Android + iOS: resize container to match visualViewport when keyboard opens
    const container = document.querySelector('.support-chat-container');
    const handleViewportResize = () => {
      if (window.visualViewport && container) {
        container.style.height = window.visualViewport.height + 'px';
      }
    };

    if (isMobile && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }
    
    return () => {
      if (isMobile) {
        document.body.style.overflow = '';
      }
      if (isMobile && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
      if (container) {
        container.style.height = '';
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      if (showMenu) {
        setShowMenu(false);
        setSelectedMessage(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMenu]);

  // Swipe-to-reply refs
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);
  const swipeCurrentX = useRef(0);
  const swipeDirection = useRef(null);
  const swipeActiveMsg = useRef(null);
  const swipeThreshold = 60;

  const handleTouchStart = (e, msg) => {
    const touch = e.touches[0];
    swipeTouchStartX.current = touch.clientX;
    swipeTouchStartY.current = touch.clientY;
    swipeCurrentX.current = touch.clientX;
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

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    
    if (swipeDirection.current === 'horizontal' && swipeActiveMsg.current) {
      const diffX = swipeCurrentX.current - swipeTouchStartX.current;
      const el = e.currentTarget;
      
      el.style.transform = 'translateX(0)';
      el.style.transition = 'transform 0.2s ease';
      
      if (Math.abs(diffX) > swipeThreshold) {
        handleReply(swipeActiveMsg.current);
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }
    
    swipeActiveMsg.current = null;
    swipeDirection.current = null;
  };

  const handleTouchMove = (e) => {
    if (!swipeActiveMsg.current || swipeDirection.current === 'cancelled') {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      return;
    }
    
    const touch = e.touches[0];
    const diffX = touch.clientX - swipeTouchStartX.current;
    const diffY = touch.clientY - swipeTouchStartY.current;
    
    if (!swipeDirection.current) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        swipeDirection.current = Math.abs(diffX) > Math.abs(diffY) ? 'horizontal' : 'vertical';
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
      }
      return;
    }
    
    if (swipeDirection.current !== 'horizontal') return;
    
    swipeCurrentX.current = touch.clientX;
    const el = e.currentTarget;
    
    const absDiff = Math.abs(diffX);
    if (absDiff > 0) {
      const moveX = Math.min(absDiff, 80);
      el.style.transform = `translateX(${diffX > 0 ? moveX : -moveX}px)`;
      el.style.transition = 'none';
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!selectedMessage) return;
    
    const msgId = selectedMessage.id;
    
    setMessages(messages.filter(m => m.id !== msgId));
    setShowMenu(false);
    setSelectedMessage(null);
    
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      loadConversation();
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setEditText(selectedMessage.text);
      setShowMenu(false);
      setSelectedMessage(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    
    const msgId = editingMessage.id;
    const newText = editText;
    
    setMessages(messages.map(m => 
      m.id === msgId ? { ...m, text: newText, edited: true } : m
    ));
    setEditingMessage(null);
    setEditText('');
    
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newText })
      });
    } catch (error) {
      console.error('Error editing message:', error);
      loadConversation();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // Reply handlers
  const handleReply = (msg) => {
    setReplyingTo({
      id: msg.id,
      type: msg.text ? 'text' : msg.image ? 'image' : msg.video ? 'video' : 'audio',
      content: msg.text || (msg.image ? '📷 تصویر' : msg.video ? '🎬 ویدیو' : '🎤 پیام صوتی'),
      sender: msg.sender
    });
    setShowMenu(false);
    setSelectedMessage(null);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Send typing/recording indicator to server
  const sendTypingIndicator = async (isTyping, isRecording = false) => {
    // Throttle: don't send more than once per second
    const now = Date.now();
    if ((isTyping || isRecording) && now - lastTypingSentRef.current < 1000) return;
    lastTypingSentRef.current = now;
    
    console.log('📤 Sending indicator:', { isTyping, isRecording });
    
    try {
      const token = authService.getToken();
      
      // PHP will detect if user is admin and handle accordingly
      await fetch(`${API_URL}/conversation/typing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          isTyping,
          isRecording,
          conversationId: conversationId // Send conversationId for admin
        })
      });
    } catch (error) {
      console.error('❌ Indicator error:', error);
    }
  };

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Send typing indicator
    if (value.trim()) {
      sendTypingIndicator(true, false);
    } else {
      sendTypingIndicator(false, false);
    }
  };

  const handleSend = async () => {
    const messageText = newMessage.trim();
    if (!messageText) return;

    // Stop typing indicator
    sendTypingIndicator(false);

    const tempId = Date.now();
    const time = formatMessageTime(new Date().toISOString());
    const replyTo = replyingTo;
    
    // Clear input immediately so user can type next message
    setNewMessage('');
    setReplyingTo(null);
    
    // Keep focus on input (iOS keyboard fix)
    setTimeout(() => inputRef.current?.focus(), 0);
    
    // Optimistic update with 'sending' status
    const localMessage = {
      id: tempId,
      text: messageText,
      sender: 'user',
      time: time,
      status: 'sending',
      replyTo: replyTo
    };
    
    setMessages(prev => [...prev, localMessage]);

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/conversation/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'text',
          content: messageText,
          replyToId: replyTo?.id
        })
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Update to 'sent' status
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, id: data.message.id, status: 'sent' } : m
      ));
      
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, status: 'failed' } : m
      ));
    }
  };

  const handleSendClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSend();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const tempId = Date.now();
    const time = formatMessageTime(new Date().toISOString());
    const replyTo = replyingTo;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const localMessage = {
        id: tempId,
        image: event.target.result,
        sender: 'user',
        time: time,
        status: 'sending',
        replyTo: replyTo
      };
      setMessages(prev => [...prev, localMessage]);
    };
    reader.readAsDataURL(file);
    setReplyingTo(null);

    try {
      const token = authService.getToken();
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!uploadResponse.ok) throw new Error('Upload failed');
      
      const uploadData = await uploadResponse.json();

      const messageResponse = await fetch(`${API_URL}/conversation/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'image',
          mediaUrl: uploadData.url,
          replyToId: replyTo?.id
        })
      });

      if (!messageResponse.ok) throw new Error('Failed to send image');
      
      const messageData = await messageResponse.json();
      
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, id: messageData.message.id, image: uploadData.url, status: 'sent' } : m
      ));

    } catch (error) {
      console.error('Error uploading image:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('خطا در آپلود تصویر');
    }
    
    e.target.value = '';
  };

  const handleAttachClick = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const handleImageSelect = () => {
    setShowAttachMenu(false);
    fileInputRef.current?.click();
  };

  const handleVideoSelect = () => {
    setShowAttachMenu(false);
    videoInputRef.current?.click();
  };

  // Video upload with progress
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('حجم ویدیو نباید بیشتر از ۵۰ مگابایت باشد');
      e.target.value = '';
      return;
    }

    const tempId = Date.now();
    const time = formatMessageTime(new Date().toISOString());
    const replyTo = replyingTo;

    setUploadingVideo(true);
    setUploadingTempId(tempId);
    setReplyingTo(null);

    // Create temp message
    const localMessage = {
      id: tempId,
      video: URL.createObjectURL(file),
      sender: 'user',
      time: time,
      status: 'uploading',
      isUploading: true,
      uploadProgress: 0,
      replyTo: replyTo
    };
    setMessages(prev => [...prev, localMessage]);

    try {
      const token = authService.getToken();
      
      // Upload with progress using XHR
      const uploadResult = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhrRef.current = xhr;
        
        const formData = new FormData();
        formData.append('file', file);

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setMessages(prev => prev.map(m => 
              m.id === tempId ? { ...m, uploadProgress: progress } : m
            ));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error('پاسخ نامعتبر'));
            }
          } else {
            reject(new Error(`خطای سرور: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('خطای شبکه')));
        xhr.addEventListener('abort', () => reject(new Error('آپلود کنسل شد')));
        xhr.addEventListener('timeout', () => reject(new Error('زمان آپلود تمام شد')));

        xhr.timeout = 300000;
        xhr.open('POST', `${API_URL}/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
      });

      // Send video message
      const messageResponse = await fetch(`${API_URL}/conversation/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'video',
          mediaUrl: uploadResult.url,
          replyToId: replyTo?.id
        })
      });

      if (!messageResponse.ok) throw new Error('خطا در ارسال ویدیو');
      
      const messageData = await messageResponse.json();
      
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { 
          ...m, 
          id: messageData.message.id, 
          video: uploadResult.url, 
          status: 'sent',
          isUploading: false,
          uploadProgress: 100
        } : m
      ));

    } catch (error) {
      console.error('Error uploading video:', error);
      if (error.message !== 'آپلود کنسل شد') {
        alert('خطا در آپلود ویدیو: ' + error.message);
      }
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setUploadingVideo(false);
      setUploadingTempId(null);
      uploadXhrRef.current = null;
      e.target.value = '';
    }
  };

  // Cancel video upload
  const cancelVideoUpload = () => {
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }
    if (uploadingTempId) {
      setMessages(prev => prev.filter(m => m.id !== uploadingTempId));
    }
    setUploadingVideo(false);
    setUploadingTempId(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = recordingTime;
        const replyTo = replyingTo;
        
        const tempId = Date.now();
        const time = formatMessageTime(new Date().toISOString());
        
        const localMessage = {
          id: tempId,
          audio: audioUrl,
          duration: duration,
          sender: 'user',
          time: time,
          status: 'sending',
          replyTo: replyTo
        };
        setMessages(prev => [...prev, localMessage]);
        setReplyingTo(null);

        try {
          const token = authService.getToken();
          const formData = new FormData();
          formData.append('file', audioBlob, `audio-${Date.now()}.${mimeType.split('/')[1]}`);

          const uploadResponse = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!uploadResponse.ok) throw new Error('Upload failed');
          
          const uploadData = await uploadResponse.json();

          const messageResponse = await fetch(`${API_URL}/conversation/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              type: 'audio',
              mediaUrl: uploadData.url,
              duration: duration,
              replyToId: replyTo?.id
            })
          });

          if (!messageResponse.ok) throw new Error('Failed to send audio');
          
          const messageData = await messageResponse.json();
          
          setMessages(prev => prev.map(m => 
            m.id === tempId ? { ...m, id: messageData.message.id, audio: uploadData.url, status: 'sent' } : m
          ));

        } catch (error) {
          console.error('Error uploading audio:', error);
          setMessages(prev => prev.filter(m => m.id !== tempId));
          alert('خطا در ارسال صدا');
        }
        
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Send recording indicator immediately
      sendTypingIndicator(false, true);
      
      // Keep sending recording indicator every 2 seconds
      recordingIndicatorRef.current = setInterval(() => {
        sendTypingIndicator(false, true);
      }, 2000);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone error:', err);
      alert('لطفاً دسترسی به میکروفن را فعال کنید');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
      
      // Stop recording indicator interval
      if (recordingIndicatorRef.current) {
        clearInterval(recordingIndicatorRef.current);
        recordingIndicatorRef.current = null;
      }
      
      // Send stop recording indicator
      sendTypingIndicator(false, false);
    }
  };

  const toggleAudioPlay = (msgId, audioUrl) => {
    const audio = audioRefs.current[msgId];
    
    if (playingAudioId === msgId) {
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
          .then(() => setPlayingAudioId(msgId))
          .catch(err => console.error('Play error:', err));
      }
    }
  };

  // Toggle playback speed: 1x -> 1.5x -> 2x -> 1x
  const togglePlaybackSpeed = (e, msgId) => {
    e.stopPropagation();
    const audio = audioRefs.current[msgId];
    if (!audio) return;

    let newSpeed;
    if (playbackSpeed === 1) {
      newSpeed = 1.5;
    } else if (playbackSpeed === 1.5) {
      newSpeed = 2;
    } else {
      newSpeed = 1;
    }
    
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  const handleMicOrSend = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (newMessage.trim()) {
      handleSend();
      // Don't blur - iOS will keep keyboard open if we don't touch anything else
    } else if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Render message status ticks
  const renderMessageStatus = (msg) => {
    if (msg.sender !== 'user') return null;
    
    const status = msg.status || 'sent';
    
    if (status === 'sending') {
      return <span className="message-status sending">○</span>;
    } else if (status === 'sent') {
      return <Check size={14} className="message-status sent" />;
    } else if (status === 'delivered') {
      return <CheckCheck size={14} className="message-status delivered" />;
    } else if (status === 'read') {
      return <CheckCheck size={14} className="message-status read" />;
    }
    
    return <Check size={14} className="message-status sent" />;
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
              <span className="chat-header-title">پشتیبانی</span>
              <span className="chat-header-status">در حال اتصال...</span>
            </div>
            <div className="chat-avatar-glass">
              <Headphones size={20} />
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
            <ChevronLeft size={22} />
          </button>
          <div className="chat-header-info">
            <div className="chat-header-text">
              <span className="chat-header-title">پشتیبانی</span>
<span className="chat-header-status">آنلاین</span>
            </div>
            <div className="chat-avatar-glass">
                            <Headphones size={20} />
            </div>
          </div>
        </div>

      {/* Messages Area */}
      <div 
        className="chat-messages-area"
        ref={messagesAreaRef}
        onScroll={handleScroll}
        onTouchStart={() => {
          // Close keyboard when touching messages area
          if (document.activeElement === inputRef.current) {
            inputRef.current?.blur();
          }
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            ref={el => messageRefs.current[msg.id] = el}
            className={`chat-bubble-glass ${msg.sender === 'user' ? 'user-bubble' : 'support-bubble'} ${selectedMessage?.id === msg.id ? 'selected' : ''} ${msg.image ? 'image-bubble' : ''} ${msg.audio ? 'audio-bubble' : ''} ${highlightedMessageId === msg.id ? 'highlighted' : ''}`}
            onTouchStart={(e) => handleTouchStart(e, msg)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => {
              e.preventDefault();
              setSelectedMessage(msg);
              setMenuPosition({ y: e.clientY - 60 });
              setShowMenu(true);
            }}
            onClick={(e) => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile) {
                setSelectedMessage(msg);
                setMenuPosition({ y: e.clientY - 60 });
                setShowMenu(true);
              }
            }}
          >
            {/* Reply Preview */}
            {msg.replyTo && (
              <div 
                className="reply-preview-bubble clickable"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollToMessage(msg.replyTo.id);
                }}
              >
                <div className="reply-line"></div>
                <div className="reply-content">
                  <span className="reply-sender">
                    {msg.replyTo.sender === 'support' ? 'پشتیبانی' : 'شما'}
                  </span>
                  <span className="reply-text">
                    {msg.replyTo.type === 'text' 
                      ? (msg.replyTo.content?.substring(0, 40) + (msg.replyTo.content?.length > 40 ? '...' : ''))
                      : msg.replyTo.type === 'video' ? '🎬 ویدیو'
                      : msg.replyTo.content}
                  </span>
                </div>
              </div>
            )}
            
            {/* Video Message */}
            {msg.video ? (
              <div className="video-message-container">
                {msg.isUploading ? (
                  <div className="video-uploading-mobile">
                    <Loader2 size={28} className="spinning" />
                    <div className="upload-progress-bar-mobile">
                      <div 
                        className="upload-progress-fill-mobile" 
                        style={{ width: `${msg.uploadProgress || 0}%` }}
                      />
                    </div>
                    <span className="upload-progress-text-mobile">{msg.uploadProgress || 0}%</span>
                    <button 
                      className="cancel-upload-btn-mobile"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelVideoUpload();
                      }}
                    >
                      <X size={16} />
                      <span>انصراف</span>
                    </button>
                  </div>
                ) : (
                  <div 
                    className="video-thumbnail-mobile"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomedVideo(msg.video);
                    }}
                  >
                    <video 
                      src={msg.video + '#t=0.5'}
                      className="chat-video-preview"
                      preload="metadata"
                      muted
                      playsInline
                      onLoadedData={(e) => {
                        e.target.currentTime = 0.5;
                      }}
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
                alt="uploaded" 
                className="chat-image"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedImage(msg.image);
                }}
              />
            ) : msg.audio ? (
              <div className={`audio-message ${playingAudioId === msg.id ? 'playing' : ''}`}>
                <button 
                  className="audio-play-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAudioPlay(msg.id, msg.audio);
                  }}
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
                    ? `${formatTime(audioCurrentTime)} / ${formatTime(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))}`
                    : formatTime(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))
                  }
                </span>
                {playingAudioId === msg.id && (
                  <button 
                    className="audio-speed-btn"
                    onClick={(e) => togglePlaybackSpeed(e, msg.id)}
                  >
                    {playbackSpeed}x
                  </button>
                )}
                <audio 
                  ref={el => audioRefs.current[msg.id] = el}
                  src={msg.audio}
                  onLoadedMetadata={(e) => {
                    const realDuration = Math.floor(e.target.duration);
                    setMessages(prev => prev.map(m => 
                      m.id === msg.id ? { ...m, duration: realDuration } : m
                    ));
                  }}
                  onTimeUpdate={(e) => {
                    if (playingAudioId === msg.id) {
                      setAudioCurrentTime(Math.floor(e.target.currentTime));
                    }
                  }}
                  onEnded={() => {
                    setPlayingAudioId(null);
                    setAudioCurrentTime(0);
                  }}
                />
              </div>
            ) : (
              <p className="bubble-text">{msg.text}</p>
            )}
            <span className="bubble-time">
              {msg.edited && <span className="edited-label">ویرایش شده • </span>}
              {msg.time}
              {renderMessageStatus(msg)}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Menu Popup */}
      {showMenu && selectedMessage && (
        <div 
          className="message-menu-glass"
          style={{ top: `${menuPosition.y}px` }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button className="menu-item-btn" 
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleReply(selectedMessage); }}
            onClick={() => handleReply(selectedMessage)}
          >
            <Reply size={18} />
            <span>Reply</span>
          </button>
          {selectedMessage?.sender === 'user' && !selectedMessage?.image && !selectedMessage?.audio && (
            <button className="menu-item-btn" 
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(e); }}
              onClick={handleEdit}
            >
              <Edit3 size={18} />
              <span>ویرایش</span>
            </button>
          )}
          {selectedMessage?.sender === 'user' && (
            <button className="menu-item-btn delete" 
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(e); }}
              onClick={handleDelete}
            >
              <Trash2 size={18} />
              <span>حذف</span>
            </button>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingMessage && (
        <div className="edit-modal-overlay" onClick={handleCancelEdit}>
          <div className="edit-modal-glass" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span>ویرایش پیام</span>
              <button className="edit-close-btn" onClick={handleCancelEdit}>
                <X size={20} />
              </button>
            </div>
            <textarea
              className="edit-textarea-glass"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
            />
            <div className="edit-modal-actions">
              <button className="edit-cancel-btn" onClick={handleCancelEdit}>
                لغو
              </button>
              <button className="edit-save-btn" onClick={handleSaveEdit}>
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
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

      {/* Typing/Recording Indicator */}
      {(isOtherTyping || isOtherRecording) && (
        <div className="typing-indicator-container">
          {isOtherRecording ? (
            <div className="recording-indicator-bubble">
              <Mic size={16} className="recording-mic-icon" />
              <div className="recording-waves">
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
                <span className="wave-bar"></span>
              </div>
            </div>
          ) : (
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          )}
        </div>
      )}

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <button className="scroll-to-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={20} />
        </button>
      )}

      {/* Input Area */}
      <div className="chat-input-container-glass">
        {/* Reply Bar */}
        {replyingTo && (
          <div className="reply-bar-glass">
            <div className="reply-bar-content">
              <CornerDownLeft size={16} />
              <div className="reply-bar-text">
                <span className="reply-bar-sender">
                  پاسخ به {replyingTo.sender === 'support' ? 'پشتیبانی' : 'خودتان'}
                </span>
                <span className="reply-bar-message">
                  {replyingTo.content?.substring(0, 35) || '📎 فایل'}
                  {replyingTo.content?.length > 35 ? '...' : ''}
                </span>
              </div>
            </div>
            <button className="reply-bar-close" onClick={cancelReply}>
              <X size={18} />
            </button>
          </div>
        )}
        
        <div className="chat-input-wrapper-glass">
          {!isRecording && (
            <div className="attach-menu-container-mobile">
              <button className="chat-attach-btn" onClick={handleAttachClick}>
                <Paperclip size={22} />
              </button>
              
              {showAttachMenu && (
                <div className="attach-menu-mobile">
                  <button className="attach-menu-item-mobile" onClick={handleImageSelect}>
                    <Image size={20} />
                    <span>Photo</span>
                  </button>
                  <button 
                    className="attach-menu-item-mobile" 
                    onClick={handleVideoSelect}
                    disabled={uploadingVideo}
                  >
                    <Video size={20} />
                    <span>Video</span>
                  </button>
                </div>
              )}
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <input
                type="file"
                ref={videoInputRef}
                onChange={handleVideoUpload}
                accept="video/*"
                style={{ display: 'none' }}
              />
            </div>
          )}
          
          {isRecording ? (
            <div className="recording-indicator">
              <div className="recording-dot"></div>
              <span className="recording-time">{formatTime(recordingTime)}</span>
              <span className="recording-text">در حال ضبط...</span>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              placeholder="پیام خود را بنویسید..."
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onBlur={() => sendTypingIndicator(false)}
              className="chat-input-glass"
              rows={1}
              disabled={uploadingVideo}
            />
          )}
          
          <button 
            className={`chat-send-btn-glass ${isRecording ? 'recording' : ''}`}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleMicOrSend(e);
            }}
            onClick={(e) => {
              e.preventDefault();
              handleMicOrSend(e);
            }}
            disabled={uploadingVideo}
          >
            {newMessage.trim() ? (
              <Send size={20} />
            ) : isRecording ? (
              <Square size={20} />
            ) : (
              <Mic size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportChat;