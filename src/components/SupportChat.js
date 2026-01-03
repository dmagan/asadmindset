import React, { useState, useRef, useEffect } from 'react';
import { Send, ArrowLeft, Headphones, Trash2, Edit3, X, Paperclip, Mic, Square, Play, Pause } from 'lucide-react';

const SupportChat = ({ onBack }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'سلام! به پشتیبانی خوش آمدید 👋',
      sender: 'support',
      time: '10:30'
    },
    {
      id: 2,
      text: 'چطور می‌تونم کمکتون کنم؟',
      sender: 'support',
      time: '10:30'
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [zoomedImage, setZoomedImage] = useState(null);
  
  // وضعیت ضبط صدا
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const audioRefs = useRef({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // جلوگیری از اسکرول بک‌گراند با کیبورد - فقط موبایل
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

  // بستن منو با کلیک بیرون
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

  // شروع لانگ پرس
  const handleTouchStart = (e, msg) => {
    longPressTimer.current = setTimeout(() => {
      const rect = e.target.getBoundingClientRect();
      
      setSelectedMessage(msg);
      setMenuPosition({
        y: rect.top - 60
      });
      setShowMenu(true);
      
      // ویبره در موبایل
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

  // حذف پیام
  const handleDelete = (e) => {
    e.stopPropagation();
    if (selectedMessage) {
      setMessages(messages.filter(m => m.id !== selectedMessage.id));
      setShowMenu(false);
      setSelectedMessage(null);
    }
  };

  // شروع ویرایش
  const handleEdit = (e) => {
    e.stopPropagation();
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setEditText(selectedMessage.text);
      setShowMenu(false);
      setSelectedMessage(null);
    }
  };

  // ذخیره ویرایش
  const handleSaveEdit = () => {
    if (editingMessage && editText.trim()) {
      setMessages(messages.map(m => 
        m.id === editingMessage.id 
          ? { ...m, text: editText, edited: true }
          : m
      ));
      setEditingMessage(null);
      setEditText('');
    }
  };

  // لغو ویرایش
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

    setMessages([
      ...messages,
      {
        id: Date.now(),
        text: newMessage,
        sender: 'user',
        time: time
      }
    ]);
    setNewMessage('');
  };

  // کلیک روی دکمه ارسال - جلوگیری از blur
  const handleSendClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleSend();
    // فوکوس رو برگردون
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e) => {
    // موبایل: اینتر = خط جدید
    // کامپیوتر: اینتر = ارسال، Shift+Enter = خط جدید
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // آپلود عکس
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        setMessages([
          ...messages,
          {
            id: Date.now(),
            image: event.target.result,
            sender: 'user',
            time: time
          }
        ]);
      };
      reader.readAsDataURL(file);
    }
    // ریست کردن input برای انتخاب مجدد همان فایل
    e.target.value = '';
  };

  // باز کردن انتخاب فایل
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // شروع ضبط صدا
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // انتخاب فرمت مناسب برای iOS و Android
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

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        const now = new Date();
        const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        setMessages(prev => [
          ...prev,
          {
            id: Date.now(),
            audio: audioUrl,
            duration: recordingTime,
            sender: 'user',
            time: time
          }
        ]);
        
        // بستن استریم
        stream.getTracks().forEach(track => track.stop());
        setRecordingTime(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // تایمر ضبط
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('خطا در دسترسی به میکروفن:', err);
      alert('لطفاً دسترسی به میکروفن را فعال کنید');
    }
  };

  // توقف ضبط
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  // فرمت زمان
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // پخش/توقف صدا
  const toggleAudioPlay = (msgId, audioUrl) => {
    const audio = audioRefs.current[msgId];
    
    if (playingAudioId === msgId) {
      audio?.pause();
      setPlayingAudioId(null);
      setAudioCurrentTime(0);
    } else {
      // توقف صدای قبلی
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
        audioRefs.current[playingAudioId].currentTime = 0;
      }
      setAudioCurrentTime(0);
      
      // پخش با هندل کردن خطا
      if (audio) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setPlayingAudioId(msgId);
            })
            .catch(err => {
              console.error('خطا در پخش صدا:', err);
            });
        }
      }
    }
  };

  // هندل کلیک روی دکمه میکروفن/ارسال
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
              e.preventDefault();
              setSelectedMessage(msg);
              setMenuPosition({ y: e.clientY - 60 });
              setShowMenu(true);
            }}
            onClick={(e) => {
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (!isMobile && !msg.image && !msg.audio) {
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
                <span className="audio-duration" data-msgid={msg.id}>
                  {playingAudioId === msg.id 
                    ? `${formatTime(audioCurrentTime)} / ${formatTime(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))}`
                    : formatTime(Math.floor(audioRefs.current[msg.id]?.duration || msg.duration || 0))
                  }
                </span>
                <audio 
                  ref={el => audioRefs.current[msg.id] = el}
                  src={msg.audio}
                  onLoadedMetadata={(e) => {
                    // آپدیت duration واقعی
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

      {/* منوی پاپ‌آپ */}
      {showMenu && (
        <div 
          className="message-menu-glass"
          style={{
            top: `${menuPosition.y}px`,
          }}
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

      {/* مودال ویرایش */}
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

      {/* مودال زوم عکس */}
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
            />
          )}
          
          <button 
            className={`chat-send-btn-glass ${isRecording ? 'recording' : ''}`}
            onTouchEnd={handleMicOrSend}
            onMouseDown={handleMicOrSend}
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