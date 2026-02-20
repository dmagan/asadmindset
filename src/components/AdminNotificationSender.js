import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Send, Bell, Users, Crown, UserX, UserMinus, Loader2, CheckCircle, AlertCircle, Search, X, User } from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AUDIENCES = [
  { id: 'all',             label: 'همه کاربران',     desc: 'تمامی کاربران ثبت‌نام شده',       icon: Users,     color: '#818cf8' },
  { id: 'subscribers',    label: 'مشترکین فعال',    desc: 'کاربرانی که اشتراک فعال دارند',   icon: Crown,     color: '#34d399' },
  { id: 'expired',        label: 'تمدید نکرده‌ها',  desc: 'اشتراک منقضی شده',                icon: UserMinus, color: '#fbbf24' },
  { id: 'non_subscribers',label: 'بدون اشتراک',     desc: 'هیچوقت اشتراک نخریدند',           icon: UserX,     color: '#f87171' },
  { id: 'team',           label: 'اعضای تیم',       desc: 'ادمین و ساب‌ادمین‌ها',            icon: Users,     color: '#60a5fa' },
  { id: 'specific',       label: 'کاربران خاص',     desc: 'جستجو و انتخاب دستی',             icon: User,      color: '#e879f9' },
];

// ── User Tag ──────────────────────────────────────────────────────────────────
const UserTag = ({ user, onRemove }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '5px 10px 5px 6px',
    background: 'rgba(232,121,249,0.12)',
    border: '1px solid rgba(232,121,249,0.3)',
    borderRadius: 20, fontSize: 13, color: '#e879f9',
    animation: 'tagPop 0.2s cubic-bezier(0.34,1.56,0.64,1)',
  }}>
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: 'rgba(232,121,249,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, flexShrink: 0,
    }}>
      {user.name?.[0]?.toUpperCase() || '?'}
    </div>
    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {user.name}
    </span>
    <button onClick={() => onRemove(user.id)} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: 'rgba(232,121,249,0.6)', display: 'flex', alignItems: 'center',
      transition: 'color 0.15s',
    }}>
      <X size={13} />
    </button>
  </div>
);

// ── Specific Users Panel ───────────────────────────────────────────────────────
const SpecificUsersPanel = ({ selectedUsers, onAdd, onRemove }) => {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef     = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback((q) => {
    setQuery(q);
    if (!q.trim() || q.length < 2) { setResults([]); setShowDrop(false); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = authService.getToken();
        const res = await fetch(`${API_URL}/push/search-users?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        // Filter out already selected
        const selected_ids = selectedUsers.map(u => u.id);
        setResults((data || []).filter(u => !selected_ids.includes(u.id)));
        setShowDrop(true);
      } catch (e) {
        setResults([]);
      }
      setSearching(false);
    }, 300);
  }, [selectedUsers]);

  const handleSelect = (user) => {
    onAdd(user);
    setQuery('');
    setResults([]);
    setShowDrop(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Tags */}
      {selectedUsers.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, marginBottom: 10,
          minHeight: 48,
        }}>
          {selectedUsers.map(u => (
            <UserTag key={u.id} user={u} onRemove={onRemove} />
          ))}
        </div>
      )}

      {/* Search input */}
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px',
          background: 'rgba(232,121,249,0.06)',
          border: '1px solid rgba(232,121,249,0.25)',
          borderRadius: 14, transition: 'border-color 0.2s',
        }}>
          {searching
            ? <Loader2 size={16} style={{ color: '#e879f9', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
            : <Search size={16} style={{ color: 'rgba(232,121,249,0.6)', flexShrink: 0 }} />
          }
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="نام یا ایمیل کاربر را بنویسید..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: 'white', fontSize: 14, direction: 'rtl',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDrop && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '110%', right: 0, left: 0, zIndex: 100,
            background: '#1a1a2e',
            border: '1px solid rgba(232,121,249,0.2)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            {results.map((user, i) => (
              <button
                key={user.id}
                onClick={() => handleSelect(user)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'right', direction: 'rtl',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,121,249,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                {/* Avatar */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(232,121,249,0.3), rgba(168,85,247,0.3))',
                  border: '1px solid rgba(232,121,249,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#e879f9', flexShrink: 0,
                }}>
                  {user.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: 'white', fontWeight: 500 }}>{user.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>
                    {user.email}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(232,121,249,0.5)',
                  padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(232,121,249,0.08)',
                }}>
                  افزودن
                </div>
              </button>
            ))}
          </div>
        )}

        {showDrop && results.length === 0 && query.length >= 2 && !searching && (
          <div style={{
            position: 'absolute', top: '110%', right: 0, left: 0, zIndex: 100,
            background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, padding: '14px 16px', textAlign: 'center',
            color: 'rgba(255,255,255,0.3)', fontSize: 13,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}>
            کاربری یافت نشد
          </div>
        )}
      </div>

      {selectedUsers.length > 0 && (
        <p style={{ fontSize: 12, color: 'rgba(232,121,249,0.5)', marginTop: 8, textAlign: 'right' }}>
          {selectedUsers.length} کاربر انتخاب شده
        </p>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminNotificationSender = ({ onBack }) => {
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');
  const [audience, setAudience]         = useState('all');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState(null);

  const handleAddUser = (user) => {
    setSelectedUsers(prev => prev.find(u => u.id === user.id) ? prev : [...prev, user]);
  };
  const handleRemoveUser = (id) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== id));
  };

  const canSend = body.trim() && (audience !== 'specific' || selectedUsers.length > 0);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);

    try {
      const token = authService.getToken();

      if (audience === 'specific') {
        // Send to specific users via /push/send-multiple
        const res = await fetch(`${API_URL}/push/send-multiple`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: title.trim() || 'AsadMindset',
            body: body.trim(),
            userIds: selectedUsers.map(u => u.id),
          }),
        });
        const data = await res.json();
        if (data.success) {
          setResult({ type: 'success', data });
          setTitle(''); setBody(''); setSelectedUsers([]);
        } else {
          setResult({ type: 'error', message: data.message || 'خطا در ارسال' });
        }
      } else {
        // Broadcast to group
        const res = await fetch(`${API_URL}/push/broadcast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: title.trim() || 'AsadMindset', body: body.trim(), audience }),
        });
        const data = await res.json();
        if (data.success) {
          setResult({ type: 'success', data });
          setTitle(''); setBody('');
        } else {
          setResult({ type: 'error', message: data.message || 'خطا در ارسال' });
        }
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

        {/* Audience */}
        <div style={styles.sectionTitle}><Users size={16} /><span>مخاطبان</span></div>
        <div style={styles.audienceGrid}>
          {AUDIENCES.map(a => {
            const Icon = a.icon;
            const selected = audience === a.id;
            return (
              <button key={a.id} onClick={() => setAudience(a.id)} style={{
                ...styles.audienceItem,
                border: selected ? `2px solid ${a.color}` : '1px solid rgba(255,255,255,0.1)',
                background: selected ? `${a.color}15` : 'rgba(255,255,255,0.06)',
              }}>
                <div style={{ ...styles.audienceIcon, background: `${a.color}20`, color: a.color }}>
                  <Icon size={20} />
                </div>
                <span style={{ ...styles.audienceLabel, color: selected ? a.color : 'white' }}>{a.label}</span>
                <span style={styles.audienceDesc}>{a.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Specific users search */}
        {audience === 'specific' && (
          <div style={{
            marginTop: 4, padding: '14px', marginBottom: 4,
            background: 'rgba(232,121,249,0.04)',
            border: '1px solid rgba(232,121,249,0.15)',
            borderRadius: 16,
          }}>
            <div style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 10, color: '#e879f9' }}>
              <User size={15} />
              <span>انتخاب کاربران</span>
            </div>
            <SpecificUsersPanel
              selectedUsers={selectedUsers}
              onAdd={handleAddUser}
              onRemove={handleRemoveUser}
            />
          </div>
        )}

        {/* Title */}
        <div style={styles.sectionTitle}><Bell size={16} /><span>عنوان (اختیاری)</span></div>
        <input
          type="text" value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="AsadMindset"
          style={styles.input} dir="rtl"
        />

        {/* Body */}
        <div style={styles.sectionTitle}><Send size={16} /><span>متن پیام</span></div>
        <textarea
          value={body} onChange={e => setBody(e.target.value)}
          placeholder="متن نوتیفیکیشن را بنویسید..."
          style={styles.textarea} dir="rtl" rows={4}
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

        {/* Send */}
        <button onClick={handleSend} disabled={!canSend || sending} style={{
          ...styles.sendBtn,
          opacity: (!canSend || sending) ? 0.5 : 1,
        }}>
          {sending
            ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            : <Send size={20} />
          }
          <span>{sending ? 'در حال ارسال...' : 'ارسال نوتیفیکیشن'}</span>
        </button>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes tagPop { from{transform:scale(0.7);opacity:0;} to{transform:scale(1);opacity:1;} }
      `}</style>
    </div>
  );
};

const styles = {
  container: { display:'flex', flexDirection:'column', height:'100%', color:'white', position:'relative', zIndex:10, background:'rgba(0,0,0,0.55)' },
  content: { flex:1, overflowY:'auto', padding:'20px 16px', direction:'rtl' },
  sectionTitle: { display:'flex', alignItems:'center', gap:8, fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:12, marginTop:16, padding:'0 4px' },
  audienceGrid: { display:'flex', flexDirection:'column', gap:8 },
  audienceItem: { display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, cursor:'pointer', transition:'all 0.2s', textAlign:'right', background:'none', color:'white', width:'100%' },
  audienceIcon: { width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  audienceLabel: { fontSize:14, fontWeight:500, flex:1 },
  audienceDesc: { fontSize:11, color:'rgba(255,255,255,0.35)', display:'none' },
  input: { width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:14, outline:'none', boxSizing:'border-box' },
  textarea: { width:'100%', padding:'12px 16px', borderRadius:14, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'white', fontSize:14, outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' },
  resultBox: { display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', borderRadius:12, border:'1px solid', marginTop:16, fontSize:13, lineHeight:1.6 },
  sendBtn: { display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:'14px', marginTop:20, borderRadius:14, border:'none', background:'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', color:'white', fontSize:15, fontWeight:600, cursor:'pointer', transition:'opacity 0.2s' },
};

export default AdminNotificationSender;