import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Radio,
  Video,
  VideoOff,
  Copy,
  Check,
  Loader2,
  Play,
  Square,
  Trash2,
  Users,
  Clock,
  Eye,
  ChevronDown,
  ChevronUp,
  Camera,
  Monitor,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminLiveManager = ({ onBack }) => {
  // States
  const [currentLive, setCurrentLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [showOBSInfo, setShowOBSInfo] = useState(false);
  const [streamMode, setStreamMode] = useState(null); // 'obs' | 'camera' | null
  const [confirmEnd, setConfirmEnd] = useState(false);
  
  // Webcam states
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState(null);
  
  // Refs
  const webcamVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // ==========================================
  // Check current live status
  // ==========================================
  const checkStatus = useCallback(async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_live || data.preparing) {
          // Get full details
          const streamId = data.stream_id;
          const detailRes = await fetch(`${API_URL}/live/watch/${streamId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            setCurrentLive(detail);
          }
        } else {
          setCurrentLive(null);
        }
      }
    } catch (e) {
      console.error('Check status error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // ==========================================
  // Create live
  // ==========================================
  const handleCreate = async () => {
    if (!title.trim()) {
      setError('عنوان لایو را وارد کنید');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          title: title.trim(),
          description: description.trim()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'خطا در ایجاد لایو');
      }

      setCurrentLive(data);
      setSuccess('لایو با موفقیت ساخته شد');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  // ==========================================
  // Start live
  // ==========================================
  const handleStart = async () => {
    if (!currentLive) return;

    setStarting(true);
    setError(null);

    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stream_id: currentLive.id })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'خطا در شروع لایو');
      }

      setCurrentLive(prev => ({ ...prev, status: 'live' }));
      setSuccess('🔴 لایو شروع شد! کاربران مطلع شدند.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  // ==========================================
  // End live
  // ==========================================
  const handleEnd = async () => {
    if (!currentLive) return;

    setEnding(true);
    setError(null);

    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/live/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stream_id: currentLive.id })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'خطا در پایان لایو');
      }

      // Stop webcam if active
      stopWebcam();

      setCurrentLive(null);
      setStreamMode(null);
      setConfirmEnd(false);
      setTitle('');
      setDescription('');
      setSuccess('لایو با موفقیت پایان یافت. ویدیو در آرشیو ذخیره شد.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnding(false);
    }
  };

  // ==========================================
  // Copy to clipboard
  // ==========================================
  const copyToClipboard = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // ==========================================
  // Webcam (for mobile/camera streaming)
  // ==========================================
  const startWebcam = async () => {
    try {
      setWebcamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      
      mediaStreamRef.current = stream;
      
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
      }
      
      setWebcamActive(true);
    } catch (e) {
      console.error('Webcam error:', e);
      setWebcamError('خطا در دسترسی به دوربین. لطفاً دسترسی دوربین را اجازه دهید.');
    }
  };

  const stopWebcam = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
    setWebcamActive(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, []);

  // ==========================================
  // Format helpers
  // ==========================================
  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div style={styles.container}>
        <div className="chat-header-glass" style={{ direction: 'rtl' }}>
          <div className="chat-header-info">
            <div className="chat-avatar-glass" style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(234, 179, 8, 0.3))'
            }}>
              <Radio size={20} />
            </div>
            <div className="chat-header-text">
              <span className="chat-header-title">مدیریت لایو</span>
              <span className="chat-header-status">در حال بارگذاری...</span>
            </div>
          </div>
          <button className="chat-back-btn" onClick={onBack}>
            <ArrowLeft size={22} />
          </button>
        </div>
        <div style={styles.center}>
          <Loader2 size={28} className="live-spin" />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div className="chat-header-glass" style={{ direction: 'rtl' }}>
        <div className="chat-header-info">
          <div className="chat-avatar-glass" style={{
            background: currentLive?.status === 'live' 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.4), rgba(239, 68, 68, 0.2))'
              : 'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(139, 92, 246, 0.3))'
          }}>
            <Radio size={20} style={{ color: currentLive?.status === 'live' ? '#ef4444' : 'white' }} />
          </div>
          <div className="chat-header-text">
            <span className="chat-header-title">مدیریت لایو</span>
            <span className="chat-header-status">
              {currentLive?.status === 'live' ? '🔴 لایو فعال' : currentLive ? 'آماده استریم' : 'ساخت لایو جدید'}
            </span>
          </div>
        </div>
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
      </div>

      <div className="alpha-content-area" style={{ direction: 'rtl' }}>
        {/* Error/Success messages */}
        {error && (
          <div style={styles.alertError}>
            <AlertCircle size={16} />
            <span>{error}</span>
            <button style={styles.alertClose} onClick={() => setError(null)}>×</button>
          </div>
        )}
        {success && (
          <div style={styles.alertSuccess}>
            <Check size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* ============ No active live - Create form ============ */}
        {!currentLive && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <Video size={18} />
              <span>ساخت لایو جدید</span>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>عنوان لایو *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: تحلیل بازار بیتکوین"
                style={styles.input}
                dir="auto"
                maxLength={200}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>توضیحات (اختیاری)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات کوتاه درباره لایو..."
                style={styles.textarea}
                dir="auto"
                rows={3}
                maxLength={500}
              />
            </div>

            <button
              style={{
                ...styles.primaryBtn,
                opacity: creating ? 0.7 : 1
              }}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 size={18} className="live-spin" />
              ) : (
                <Video size={18} />
              )}
              <span>{creating ? 'در حال ساخت...' : 'ساخت لایو'}</span>
            </button>
          </div>
        )}

        {/* ============ Active live - Management ============ */}
        {currentLive && (
          <>
            {/* Status Card */}
            <div style={{
              ...styles.statusCard,
              borderColor: currentLive.status === 'live' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'
            }}>
              <div style={styles.statusRow}>
                <div style={{
                  ...styles.statusBadge,
                  background: currentLive.status === 'live' ? '#ef4444' : '#eab308'
                }}>
                  {currentLive.status === 'live' ? (
                    <><Radio size={12} /><span>لایو</span></>
                  ) : (
                    <><Clock size={12} /><span>آماده</span></>
                  )}
                </div>
                <span style={styles.statusTitle}>{currentLive.title}</span>
              </div>

              {currentLive.status === 'live' && (
                <div style={styles.statsRow}>
                  <div style={styles.stat}>
                    <Users size={14} />
                    <span>{currentLive.viewers_count || 0} بیننده</span>
                  </div>
                  {currentLive.started_at && (
                    <div style={styles.stat}>
                      <Clock size={14} />
                      <span>شروع: {new Date(currentLive.started_at.replace(' ', 'T')).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stream Mode Selection (only in idle) */}
            {currentLive.status === 'idle' && !streamMode && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <span>روش استریم را انتخاب کنید</span>
                </div>

                <div style={styles.modeButtons}>
                  <button style={styles.modeBtn} onClick={() => setStreamMode('obs')}>
                    <Monitor size={28} style={{ color: '#818cf8' }} />
                    <span style={styles.modeBtnTitle}>OBS / نرم‌افزار</span>
                    <span style={styles.modeBtnDesc}>با کامپیوتر استریم کنید</span>
                  </button>

                  <button style={styles.modeBtn} onClick={() => { setStreamMode('camera'); startWebcam(); }}>
                    <Camera size={28} style={{ color: '#34d399' }} />
                    <span style={styles.modeBtnTitle}>دوربین موبایل</span>
                    <span style={styles.modeBtnDesc}>مستقیم از دوربین</span>
                  </button>
                </div>
              </div>
            )}

            {/* OBS Mode - Show RTMPS details */}
            {(streamMode === 'obs' || currentLive.status === 'live') && currentLive.rtmps_url && (
              <div style={styles.section}>
                <div 
                  style={styles.sectionTitleClickable}
                  onClick={() => setShowOBSInfo(!showOBSInfo)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Monitor size={16} />
                    <span>اطلاعات OBS</span>
                  </div>
                  {showOBSInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {showOBSInfo && (
                  <div style={styles.obsInfo}>
                    {/* RTMPS URL */}
                    <div style={styles.copyField}>
                      <label style={styles.copyLabel}>Server URL</label>
                      <div style={styles.copyRow}>
                        <input
                          type="text"
                          value={currentLive.rtmps_url}
                          readOnly
                          style={styles.copyInput}
                          dir="ltr"
                        />
                        <button
                          style={styles.copyBtn}
                          onClick={() => copyToClipboard(currentLive.rtmps_url, 'url')}
                        >
                          {copiedField === 'url' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Stream Key */}
                    <div style={styles.copyField}>
                      <label style={styles.copyLabel}>Stream Key</label>
                      <div style={styles.copyRow}>
                        <input
                          type="password"
                          value={currentLive.rtmps_key}
                          readOnly
                          style={styles.copyInput}
                          dir="ltr"
                        />
                        <button
                          style={styles.copyBtn}
                          onClick={() => copyToClipboard(currentLive.rtmps_key, 'key')}
                        >
                          {copiedField === 'key' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={styles.obsHelp}>
                      <p>۱. OBS را باز کنید → Settings → Stream</p>
                      <p>۲. Service را Custom انتخاب کنید</p>
                      <p>۳. Server URL و Stream Key را وارد کنید</p>
                      <p>۴. Start Streaming بزنید</p>
                      <p>۵. بعد از اتصال، دکمه "شروع لایو" را بزنید</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Camera Mode - Webcam Preview */}
            {streamMode === 'camera' && currentLive.status === 'idle' && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <Camera size={16} />
                  <span>پیش‌نمایش دوربین</span>
                </div>

                <div style={styles.webcamWrapper}>
                  <video
                    ref={webcamVideoRef}
                    style={styles.webcamVideo}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!webcamActive && !webcamError && (
                    <div style={styles.webcamOverlay}>
                      <Loader2 size={28} className="live-spin" />
                      <span>در حال اتصال به دوربین...</span>
                    </div>
                  )}
                  {webcamError && (
                    <div style={styles.webcamOverlay}>
                      <AlertCircle size={28} style={{ color: '#ef4444' }} />
                      <span style={{ color: '#ef4444', fontSize: 13 }}>{webcamError}</span>
                      <button style={styles.retrySmall} onClick={startWebcam}>
                        <RefreshCw size={14} />
                        <span>تلاش مجدد</span>
                      </button>
                    </div>
                  )}
                </div>

                <p style={styles.cameraNote}>
                  ⚠️ توجه: استریم مستقیم از دوربین در مرورگر محدودیت‌هایی دارد. برای کیفیت بهتر از OBS استفاده کنید.
                  <br /><br />
                  برای استریم از دوربین، RTMPS URL و Stream Key رو کپی کنید و از اپ‌هایی مثل <strong>Larix Broadcaster</strong> (iOS/Android) استفاده کنید.
                </p>

                {/* Show RTMPS for mobile apps */}
                {currentLive.rtmps_url && (
                  <div style={styles.obsInfo}>
                    <div style={styles.copyField}>
                      <label style={styles.copyLabel}>Server URL (برای Larix یا اپ مشابه)</label>
                      <div style={styles.copyRow}>
                        <input type="text" value={currentLive.rtmps_url} readOnly style={styles.copyInput} dir="ltr" />
                        <button style={styles.copyBtn} onClick={() => copyToClipboard(currentLive.rtmps_url, 'url2')}>
                          {copiedField === 'url2' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                    <div style={styles.copyField}>
                      <label style={styles.copyLabel}>Stream Key</label>
                      <div style={styles.copyRow}>
                        <input type="password" value={currentLive.rtmps_key} readOnly style={styles.copyInput} dir="ltr" />
                        <button style={styles.copyBtn} onClick={() => copyToClipboard(currentLive.rtmps_key, 'key2')}>
                          {copiedField === 'key2' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={styles.actions}>
              {/* Start Live Button */}
              {currentLive.status === 'idle' && streamMode && (
                <button
                  style={{ ...styles.startBtn, opacity: starting ? 0.7 : 1 }}
                  onClick={handleStart}
                  disabled={starting}
                >
                  {starting ? (
                    <Loader2 size={20} className="live-spin" />
                  ) : (
                    <Play size={20} />
                  )}
                  <span>{starting ? 'در حال شروع...' : 'شروع لایو 🔴'}</span>
                </button>
              )}

              {/* End Live Button */}
              {(currentLive.status === 'live' || currentLive.status === 'idle') && (
                <>
                  {!confirmEnd ? (
                    <button
                      style={styles.endBtn}
                      onClick={() => setConfirmEnd(true)}
                    >
                      <Square size={18} />
                      <span>{currentLive.status === 'live' ? 'پایان لایو' : 'لغو لایو'}</span>
                    </button>
                  ) : (
                    <div style={styles.confirmBox}>
                      <span style={styles.confirmText}>
                        {currentLive.status === 'live' 
                          ? 'آیا مطمئنید می‌خواهید لایو را پایان دهید؟'
                          : 'آیا مطمئنید می‌خواهید لایو را لغو کنید؟'
                        }
                      </span>
                      <div style={styles.confirmBtns}>
                        <button
                          style={{ ...styles.confirmYes, opacity: ending ? 0.7 : 1 }}
                          onClick={handleEnd}
                          disabled={ending}
                        >
                          {ending ? <Loader2 size={16} className="live-spin" /> : <Check size={16} />}
                          <span>بله</span>
                        </button>
                        <button
                          style={styles.confirmNo}
                          onClick={() => setConfirmEnd(false)}
                        >
                          <span>خیر</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Change mode */}
              {currentLive.status === 'idle' && streamMode && (
                <button
                  style={styles.changeModeBtn}
                  onClick={() => { setStreamMode(null); stopWebcam(); }}
                >
                  <RefreshCw size={14} />
                  <span>تغییر روش استریم</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .alpha-content-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 20px 16px;
          padding-bottom: 120px;
          -webkit-overflow-scrolling: touch;
        }
        .alpha-content-area::-webkit-scrollbar {
          display: none;
        }
      `}</style>
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
    position: 'relative',
    zIndex: 5,
    overflow: 'hidden',
    direction: 'rtl',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    paddingTop: 'max(12px, env(safe-area-inset-top))',
    background: 'rgba(255, 255, 255, 0.06)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    zIndex: 20,
  },
  headerCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 600,
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'rgba(255,255,255,0.4)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    paddingBottom: 120,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    WebkitOverflowScrolling: 'touch',
  },

  // Alerts
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    fontSize: 13,
    direction: 'rtl',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderRadius: 12,
    background: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid rgba(34, 197, 94, 0.2)',
    color: '#86efac',
    fontSize: 13,
    direction: 'rtl',
  },
  alertClose: {
    marginRight: 'auto',
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: 18,
    cursor: 'pointer',
    padding: '0 4px',
  },

  // Sections - glassmorphism
  section: {
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: 600,
    direction: 'rtl',
  },
  sectionTitleClickable: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    direction: 'rtl',
  },

  // Form
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: 500,
    direction: 'rtl',
  },
  input: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: '12px 14px',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    direction: 'auto',
  },
  textarea: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: '12px 14px',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    resize: 'none',
    direction: 'auto',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Status Card
  statusCard: {
    background: 'rgba(255, 255, 255, 0.07)',
    border: '1px solid',
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    direction: 'rtl',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 10px',
    borderRadius: 8,
    color: 'white',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  statusTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    direction: 'rtl',
  },
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    direction: 'rtl',
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },

  // Mode Selection
  modeButtons: {
    display: 'flex',
    gap: 12,
  },
  modeBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '20px 12px',
    borderRadius: 14,
    border: '1px solid rgba(255, 255, 255, 0.12)',
    background: 'rgba(255, 255, 255, 0.07)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  modeBtnTitle: {
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
  },
  modeBtnDesc: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
  },

  // OBS Info
  obsInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  copyField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  copyLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontWeight: 500,
    direction: 'rtl',
  },
  copyRow: {
    display: 'flex',
    gap: 6,
  },
  copyInput: {
    flex: 1,
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: '8px 12px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
  },
  copyBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  obsHelp: {
    background: 'rgba(99, 102, 241, 0.08)',
    border: '1px solid rgba(99, 102, 241, 0.15)',
    borderRadius: 10,
    padding: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 1.8,
    direction: 'rtl',
  },

  // Webcam
  webcamWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#000',
  },
  webcamVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  webcamOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
  },
  cameraNote: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    lineHeight: 1.7,
    direction: 'rtl',
    padding: '0 4px',
  },
  retrySmall: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: 'white',
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  // Action Buttons
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  startBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 20px',
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    color: 'white',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  endBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 20px',
    borderRadius: 12,
    border: '1px solid rgba(239, 68, 68, 0.25)',
    background: 'rgba(239, 68, 68, 0.08)',
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmBox: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 14,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    direction: 'rtl',
  },
  confirmText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  confirmBtns: {
    display: 'flex',
    gap: 8,
  },
  confirmYes: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#ef4444',
    color: 'white',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  confirmNo: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  changeModeBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px',
    border: 'none',
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default AdminLiveManager;