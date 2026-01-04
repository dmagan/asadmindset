import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Headphones, Trash2, Edit3, X, Paperclip, Mic, Square, Play, Pause } from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

const SupportChat = ({ onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  
  // Menu states
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRefs = useRef({});
  const pusherRef = useRef(null);
  const channelRef = useRef(null);

  // Initialize: Load conversation and connect to Pusher
  useEffect(() => {
    loadConversation();
    
    return () => {
      // Cleanup Pusher on unmount
      if (channelRef.current) {
        channelRef.current.unbind_all();
      }
      if (pusherRef.current) {
        pusherRef.current.disconnect();
      }
    };
  }, []);

  // Load conversation from API
  const loadConversation = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/conversation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load conversation');
      
      const data = await response.json();
      
      // Format messages
      const formattedMessages = data.messages.map(msg => ({
        id: msg.id,
        text: msg.type === 'text' ? msg.content : null,
        image: msg.type === 'image' ? msg.mediaUrl : null,
        audio: msg.type === 'audio' ? msg.mediaUrl : null,
        duration: msg.duration || 0,
        sender: msg.sender === 'admin' ? 'support' : 'user',
        time: formatMessageTime(msg.createdAt),
        edited: msg.isEdited
      }));
      
      setMessages(formattedMessages);
      setConversationId(data.conversationId);
      
      // Connect to Pusher
      connectPusher(data.pusherChannel);
      
    } catch (error) {
      console.error('Error loading conversation:', error);
      // Show default welcome message on error
      setMessages([{
        id: 1,
        text: 'سلام! به پشتیبانی خوش آمدید 👋',
        sender: 'support',
        time: formatMessageTime(new Date().toISOString())
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Connect to Pusher
  const connectPusher = (channelName) => {
    if (pusherRef.current) return;
    
    pusherRef.current = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true
    });
    
    channelRef.current = pusherRef.current.subscribe(channelName);
    
    // Listen for new messages
    channelRef.current.bind('new-message', (data) => {
      // Only add admin messages (user messages are added locally)
      if (data.sender === 'admin') {
        const newMsg = {
          id: data.id,
          text: data.type === 'text' ? data.content : null,
          image: data.type === 'image' ? data.mediaUrl : null,
          audio: data.type === 'audio' ? data.mediaUrl : null,
          duration: data.duration || 0,
          sender: 'support',
          time: formatMessageTime(data.createdAt),
          edited: false
        };
        setMessages(prev => [...prev, newMsg]);
        
        // Play notification sound
        playNotificationSound();
      }
    });
    
    // Listen for message edits
    channelRef.current.bind('message-edited', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.id ? { ...msg, text: data.content, edited: true } : msg
      ));
    });
    
    // Listen for message deletions
    channelRef.current.bind('message-deleted', (data) => {
      setMessages(prev => prev.filter(msg => msg.id !== data.id));
    });
  };

  // Play notification sound
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
    } catch (e) {
      // Ignore audio errors
    }
  };

  // Format message time
  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // Format recording time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mobile body lock
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

  // Close menu on outside click
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

  // Long press handlers
  const handleTouchStart = (e, msg) => {
    if (msg.sender !== 'user') return; // Only user messages can be edited/deleted
    
    longPressTimer.current = setTimeout(() => {
      const rect = e.target.getBoundingClientRect();
      
      setSelectedMessage(msg);
      setMenuPosition({ y: rect.top - 60 });
      setShowMenu(true);
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Delete message
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!selectedMessage) return;
    
    const msgId = selectedMessage.id;
    
    // Optimistic update
    setMessages(messages.filter(m => m.id !== msgId));
    setShowMenu(false);
    setSelectedMessage(null);
    
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete');
    } catch (error) {
      console.error('Error deleting message:', error);
      // Reload conversation on error
      loadConversation();
    }
  };

  // Edit message
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
    
    // Optimistic update
    setMessages(messages.map(m => 
      m.id === msgId 
        ? { ...m, text: newText, edited: true }
        : m
    ));
    setEditingMessage(null);
    setEditText('');
    
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/messages/${msgId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newText })
      });
      
      if (!response.ok) throw new Error('Failed to edit');
    } catch (error) {
      console.error('Error editing message:', error);
      // Reload conversation on error
      loadConversation();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  // Send text message
  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const tempId = Date.now();
    const time = formatMessageTime(new Date().toISOString());
    
    // Add message locally first (optimistic update)
    const localMessage = {
      id: tempId,
      text: newMessage,
      sender: 'user',
      time: time
    };
    
    setMessages(prev => [...prev, localMessage]);
    setNewMessage('');
    setSending(true);

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
          content: newMessage
        })
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      // Update with real ID
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, id: data.message.id } : m
      ));
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed message
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('خطا در ارسال پیام');
    } finally {
      setSending(false);
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

  // Upload image
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const tempId = Date.now();
    const time = formatMessageTime(new Date().toISOString());
    
    // Show local preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const localMessage = {
        id: tempId,
        image: event.target.result,
        sender: 'user',
        time: time
      };
      setMessages(prev => [...prev, localMessage]);
    };
    reader.readAsDataURL(file);

    // Upload to server
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

      // Send message with image URL
      const messageResponse = await fetch(`${API_URL}/conversation/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'image',
          mediaUrl: uploadData.url
        })
      });

      if (!messageResponse.ok) throw new Error('Failed to send image');
      
      const messageData = await messageResponse.json();
      
      // Update with real data
      setMessages(prev => prev.map(m => 
        m.id === tempId ? { ...m, id: messageData.message.id, image: uploadData.url } : m
      ));

    } catch (error) {
      console.error('Error uploading image:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      alert('خطا در آپلود تصویر');
    }
    
    e.target.value = '';
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // Start recording
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
        
        const tempId = Date.now();
        const time = formatMessageTime(new Date().toISOString());
        
        // Add local preview
        const localMessage = {
          id: tempId,
          audio: audioUrl,
          duration: duration,
          sender: 'user',
          time: time
        };
        setMessages(prev => [...prev, localMessage]);

        // Upload to server
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

          // Send message
          const messageResponse = await fetch(`${API_URL}/conversation/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              type: 'audio',
              mediaUrl: uploadData.url,
              duration: duration
            })
          });

          if (!messageResponse.ok) throw new Error('Failed to send audio');
          
          const messageData = await messageResponse.json();
          
          // Update with real data
          setMessages(prev => prev.map(m => 
            m.id === tempId ? { ...m, id: messageData.message.id, audio: uploadData.url } : m
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

  // Toggle audio play
  const toggleAudioPlay = (msgId, audioUrl) => {
    const audio = audioRefs.current[msgId];
    
    if (playingAudioId === msgId) {
      audio?.pause();
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
        audioRefs.current[playingAudioId].currentTime = 0;
      }
      setAudioCurrentTime(0);
      
      if (audio) {
        audio.play()
          .then(() => setPlayingAudioId(msgId))
          .catch(err => console.error('Play error:', err));
      }
    }
  };

  const handleMicOrSend = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (newMessage.trim()) {
      handleSend();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
          <ArrowLeft size={22} />
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
      <div className="chat-messages-area">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble-glass ${msg.sender === 'user' ? 'user-bubble' : 'support-bubble'} ${selectedMessage?.id === msg.id ? 'selected' : ''} ${msg.image ? 'image-bubble' : ''} ${msg.audio ? 'audio-bubble' : ''}`}
            onTouchStart={(e) => handleTouchStart(e, msg)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => {
              if (msg.sender !== 'user') return;
              e.preventDefault();
              setSelectedMessage(msg);
              setMenuPosition({ y: e.clientY - 60 });
              setShowMenu(true);
            }}
            onClick={(e) => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile && msg.sender === 'user' && !msg.image && !msg.audio) {
                setSelectedMessage(msg);
                setMenuPosition({ y: e.clientY - 60 });
                setShowMenu(true);
              }
            }}
          >
            {msg.image ? (
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
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Menu Popup */}
      {showMenu && selectedMessage?.sender === 'user' && (
        <div 
          className="message-menu-glass"
          style={{ top: `${menuPosition.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {!selectedMessage?.image && !selectedMessage?.audio && (
            <button className="menu-item-btn" onClick={handleEdit}>
              <Edit3 size={18} />
              <span>ویرایش</span>
            </button>
          )}
          <button className="menu-item-btn delete" onClick={handleDelete}>
            <Trash2 size={18} />
            <span>حذف</span>
          </button>
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
        <div className="image-zoom-overlay" onClick={() => setZoomedImage(null)}>
          <button className="zoom-close-btn" onClick={() => setZoomedImage(null)}>
            <X size={24} />
          </button>
          <img 
            src={zoomedImage} 
            alt="zoomed" 
            className="zoomed-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-container-glass">
        <div className="chat-input-wrapper-glass">
          {!isRecording && (
            <>
              <button className="chat-attach-btn" onClick={handleAttachClick}>
                <Paperclip size={22} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </>
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
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="chat-input-glass"
              rows={1}
              disabled={sending}
            />
          )}
          
          <button 
            className={`chat-send-btn-glass ${isRecording ? 'recording' : ''}`}
            onTouchEnd={handleMicOrSend}
            onMouseDown={handleMicOrSend}
            disabled={sending}
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