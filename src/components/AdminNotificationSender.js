import React, { useState } from 'react';
import { ArrowLeft, Send, Bell, Users, Crown, UserX, UserMinus, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AUDIENCES = [
  { id: 'all', label: 'همه کاربران', desc: 'ارسال به تمامی کاربران ثبت‌نام شده', icon: Users, color: '#818cf8' },
  { id: 'subscribers', label: 'مشترکین فعال', desc: 'کاربرانی که اشتراک فعال دارند', icon: Crown, color: '#34d399' },
  { id: 'expired', label: 'تمدید نکرده‌ها', desc: 'کاربرانی که اشتراکشان منقضی شده', icon: UserMinus, color: '#fbbf24' },
  { id: 'non_subscribers', label: 'بدون اشتراک', desc: 'کاربرانی که هیچوقت اشتراک نخریدند', icon: UserX, color: '#f87171' },
  { id: 'team', label: 'اعضای تیم', desc: 'ادمین و ساب‌ادمین‌ها', icon: Users, color: '#60a5fa' },
];

const AdminNotificationSender = ({ onBack }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    if (!body.trim()) return;
    
    setSending(true);
    setResult(null);
    
    try {
      const token = authService.getToken();
      const res = await fetch(`${API_URL}/push/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          title: title.trim() || 'AsadMindset',
          body: body.trim(),
          audience
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setResult({ type: 'success', data });
        setTitle('');
        setBody('');
      } else {
        setResult({ type: 'error', message: data.message || 'خطا در ارسال' });
      }
    } catch (e) {
      setResult({ type: 'error', message: 'خطا در اتصال به سرور' });
    }
    
    setSending(false);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">ارسال نوتیفیکیشن</span>
          </div>
          <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' }}>
            <Bell size={20} />
          </div>
        </div>
      </div>

      <div style={styles.content}>
        {/* Audience Selection */}
        <div style={styles.sectionTitle}>
          <Users size={16} />
          <span>مخاطبان</span>
        </div>

        <div style={styles.audienceGrid}>
          {AUDIENCES.map(a => {
            const Icon = a.icon;
            const selected = audience === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setAudience(a.id)}
                style={{
                  ...styles.audienceItem,
                  border: selected ? `2px solid ${a.color}` : '1px solid rgba(255,255,255,0.1)',
                  background: selected ? `${a.color}15` : 'rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ ...styles.audienceIcon, background: `${a.color}20`, color: a.color }}>
                  <Icon size={20} />
                </div>
                <span style={{ ...styles.audienceLabel, color: selected ? a.color : 'white' }}>{a.label}</span>
                <span style={styles.audienceDesc}>{a.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div style={styles.sectionTitle}>
          <Bell size={16} />
          <span>عنوان (اختیاری)</span>
        </div>

        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="AsadMindset"
          style={styles.input}
          dir="rtl"
        />

        {/* Body */}
        <div style={styles.sectionTitle}>
          <Send size={16} />
          <span>متن پیام</span>
        </div>

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="متن نوتیفیکیشن را بنویسید..."
          style={styles.textarea}
          dir="rtl"
          rows={4}
        />

        {/* Result */}
        {result && (
          <div style={{
            ...styles.resultBox,
            background: result.type === 'success' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
            borderColor: result.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
          }}>
            {result.type === 'success' ? (
              <>
                <CheckCircle size={18} style={{ color: '#34d399', flexShrink: 0 }} />
                <div>
                  <span style={{ color: '#34d399', fontWeight: 500 }}>ارسال موفق!</span>
                  <span style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                    کل: {result.data.total} | ارسال شده: {result.data.sent} | رد شده: {result.data.skipped} | ناموفق: {result.data.failed}
                  </span>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={18} style={{ color: '#f87171', flexShrink: 0 }} />
                <span style={{ color: '#f87171' }}>{result.message}</span>
              </>
            )}
          </div>
        )}

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          style={{
            ...styles.sendBtn,
            opacity: (!body.trim() || sending) ? 0.5 : 1,
          }}
        >
          {sending ? (
            <Loader2 size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={20} />
          )}
          <span>{sending ? 'در حال ارسال...' : 'ارسال نوتیفیکیشن'}</span>
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

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
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
    direction: 'rtl',
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 12,
    marginTop: 16,
    padding: '0 4px',
  },
  audienceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  audienceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'right',
    background: 'none',
    color: 'white',
    width: '100%',
  },
  audienceIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  audienceLabel: {
    fontSize: 14,
    fontWeight: 500,
    flex: 1,
  },
  audienceDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    display: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.6,
    boxSizing: 'border-box',
  },
  resultBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid',
    marginTop: 16,
    fontSize: 13,
    lineHeight: 1.6,
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '14px',
    marginTop: 20,
    borderRadius: 14,
    border: 'none',
    background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
};

export default AdminNotificationSender;