import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, MessageSquare, Users, Radio, Settings } from 'lucide-react';
import { authService } from '../services/authService';
import { pushService } from '../services/pushService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const SettingsPage = ({ onBack, isTeamMember }) => {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState('default');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/push/preferences`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setPrefs(await res.json());
    } catch (e) {}
    setLoading(false);
  };

  const savePrefs = async (newPrefs) => {
    setPrefs(newPrefs);
    try {
      const token = authService.getToken();
      await fetch(`${API_URL}/push/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newPrefs)
      });
    } catch (e) {}
  };

  const isMasterOn = prefs?.enabled && permissionState === 'granted' && pushService.isRegistered();

  const toggleMaster = async () => {
    if (isMasterOn) {
      savePrefs({ ...prefs, enabled: false });
    } else {
      if (permissionState === 'denied') {
        alert('نوتیفیکیشن‌ها در تنظیمات مرورگر مسدود شده‌اند. لطفاً از تنظیمات مرورگر یا سیستم‌عامل اجازه دهید.');
        return;
      }
      setRequesting(true);
      try {
        await pushService.requestPermissionAndGetToken();
        setPermissionState('granted');
        savePrefs({ ...prefs, enabled: true, alpha_channel: true, support: true, team_chat: true });
      } catch (e) {
        setPermissionState(Notification.permission);
        if (Notification.permission === 'denied') {
          alert('شما اجازه نوتیفیکیشن را رد کردید. برای فعال‌سازی مجدد از تنظیمات مرورگر اقدام کنید.');
        }
      }
      setRequesting(false);
    }
  };

  const toggleSub = (key) => {
    if (!isMasterOn) return;
    savePrefs({ ...prefs, [key]: !prefs[key] });
  };

  return (
    <div style={styles.container}>
      {/* Header - same as support chat: info RIGHT, back LEFT */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">تنظیمات</span>
          </div>
          <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)' }}>
            <Settings size={20} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="chat-loading-spinner"></div>
        </div>
      ) : (
        <div style={styles.content}>
          {/* Section title */}
          <div style={styles.sectionTitle}>
            <Bell size={16} />
            <span>نوتیفیکیشن‌ها</span>
          </div>

          {/* Master toggle */}
          <div style={styles.masterItem}>
            <Toggle checked={isMasterOn} onChange={toggleMaster} loading={requesting} />
            <div style={styles.itemInfo}>
              <span style={styles.itemLabel}>نوتیفیکیشن‌ها</span>
              <span style={styles.itemDesc}>
                {permissionState === 'denied' 
                  ? 'در تنظیمات مرورگر مسدود شده' 
                  : requesting 
                    ? 'در حال درخواست دسترسی...'
                    : 'فعال یا غیرفعال کردن تمام نوتیفیکیشن‌ها'}
              </span>
            </div>
          </div>

          {/* Denied warning */}
          {permissionState === 'denied' && (
            <div style={styles.warningBox}>
              <span>⚠️ نوتیفیکیشن‌ها توسط مرورگر مسدود شده‌اند. برای فعال‌سازی مراحل زیر را انجام دهید:</span>
              <div style={{ marginTop: 8, lineHeight: 2 }}>
                <span>۱: Setting → Apps → AsadMindset → Notification → Allow Notification را فعال کنید</span><br/>
                <span>و یا اینکه اپ را حذف و دوباره نصب کنید. این بار در پاسخ به پیام روی Allow کلیک کنید.</span>
              </div>
            </div>
          )}

          {/* Sub toggles */}
          <div style={{ opacity: isMasterOn ? 1 : 0.35, pointerEvents: isMasterOn ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
            
            <div style={styles.subItem}>
              <Toggle checked={prefs?.alpha_channel} onChange={() => toggleSub('alpha_channel')} />
              <div style={styles.itemInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...styles.itemIcon, background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}><Radio size={18} /></div>
                  <div>
                    <span style={styles.itemLabel}>کانال آلفا</span>
                    <span style={styles.itemDesc}>نوتیفیکیشن پست‌های جدید کانال</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={styles.subItem}>
              <Toggle checked={prefs?.support} onChange={() => toggleSub('support')} />
              <div style={styles.itemInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ ...styles.itemIcon, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}><MessageSquare size={18} /></div>
                  <div>
                    <span style={styles.itemLabel}>پشتیبانی</span>
                    <span style={styles.itemDesc}>نوتیفیکیشن پیام‌های پشتیبانی</span>
                  </div>
                </div>
              </div>
            </div>

            {isTeamMember && (
              <div style={styles.subItem}>
                <Toggle checked={prefs?.team_chat} onChange={() => toggleSub('team_chat')} />
                <div style={styles.itemInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ ...styles.itemIcon, background: 'rgba(52,211,153,0.15)', color: '#34d399' }}><Users size={18} /></div>
                    <div>
                      <span style={styles.itemLabel}>چت تیمی</span>
                      <span style={styles.itemDesc}>نوتیفیکیشن پیام‌های تیم</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* iOS-style Toggle */
const Toggle = ({ checked, onChange, loading }) => (
  <div 
    onClick={loading ? undefined : onChange}
    style={{
      width: 51, height: 31, borderRadius: 31, flexShrink: 0,
      background: checked ? '#34d399' : 'rgba(255,255,255,0.15)',
      position: 'relative', cursor: loading ? 'wait' : 'pointer',
      transition: 'background 0.3s',
      opacity: loading ? 0.6 : 1,
    }}
  >
    <div style={{
      width: 27, height: 27, borderRadius: '50%', background: 'white',
      position: 'absolute', top: 2,
      left: checked ? 22 : 2,
      transition: 'left 0.3s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    }} />
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    color: 'white',
    position: 'relative',
    zIndex: 10,
    background: 'rgba(0, 0, 0, 0.55)',
  },
  content: { flex: 1, overflowY: 'auto', padding: '20px 16px', direction: 'rtl' },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 12, padding: '0 4px',
  },
  masterItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', borderRadius: 16,
    background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  subItem: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px', borderRadius: 16,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  itemInfo: { flex: 1 },
  itemLabel: { display: 'block', fontSize: 15, fontWeight: 500, color: 'white' },
  itemDesc: { display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  itemIcon: {
    width: 36, height: 36, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  warningBox: {
    padding: '12px 16px', borderRadius: 12,
    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
    marginBottom: 16, fontSize: 13, color: '#fbbf24', lineHeight: 1.6,
  },
};

export default SettingsPage;