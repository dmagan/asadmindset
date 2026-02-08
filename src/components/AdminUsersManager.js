import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Users,
  Search,
  Crown,
  Clock,
  Mail,
  User,
  RefreshCw,
  Loader2,
  Calendar,
  AtSign,
  AlertCircle
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminUsersManager = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedUser, setExpandedUser] = useState(null);
  const searchTimer = useRef(null);

  const getHeaders = () => ({
    'Authorization': `Bearer ${authService.getToken()}`
  });

  const fetchUsers = useCallback(async (pageNum = 1, search = '') => {
    try {
      setError('');
      setLoading(true);
      const params = new URLSearchParams({ page: pageNum, per_page: 50 });
      if (search) params.append('search', search);

      const res = await fetch(`${API_URL}/admin/users?${params}`, { headers: getHeaders() });

      if (!res.ok) {
        if (res.status === 404) throw new Error('API یافت نشد. پلاگین را بروزرسانی کنید.');
        if (res.status === 401 || res.status === 403) throw new Error('دسترسی رد شد.');
        throw new Error(`خطای سرور: ${res.status}`);
      }

      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchUsers(1, value);
    }, 500);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const getTimeSince = (dateStr) => {
    if (!dateStr) return '';
    const diffDays = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'دیروز';
    if (diffDays < 7) return `${diffDays} روز پیش`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} هفته پیش`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ماه پیش`;
    return `${Math.floor(diffDays / 365)} سال پیش`;
  };

  const getSubStatusInfo = (status) => {
    switch (status) {
      case 'active': return { label: 'فعال', color: '#34d399', bg: 'rgba(52,211,153,0.15)' };
      case 'pending': return { label: 'در انتظار', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };
      case 'expired': return { label: 'منقضی', color: '#f87171', bg: 'rgba(248,113,113,0.15)' };
      default: return { label: status || '—', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)' };
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q) ||
           (u.username || '').toLowerCase().includes(q);
  });

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">کاربران</span>
            <span className="chat-header-status">{total} کاربر ثبت‌نام شده</span>
          </div>
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.3))'
          }}>
            <Users size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="alpha-content-area" style={{ direction: 'rtl', padding: '20px 16px', paddingBottom: '120px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px', marginBottom: '12px'
        }}>
          <Search size={18} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="جستجو نام یا ایمیل..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: 'white', fontSize: '14px', fontFamily: 'inherit',
              outline: 'none', direction: 'rtl'
            }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); fetchUsers(1, ''); }}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                width: '22px', height: '22px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontSize: '14px'
              }}>×</button>
          )}
        </div>

        {/* Refresh */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
          <button
            onClick={() => fetchUsers(page, searchQuery)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.6)', fontSize: '13px',
              fontWeight: '500', fontFamily: 'inherit',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} />
            <span>بروزرسانی</span>
          </button>
        </div>

        {/* List */}
        {error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '16px' }}>
            <AlertCircle size={44} style={{ color: '#f87171' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', textAlign: 'center' }}>{error}</span>
            <button onClick={() => { setError(''); fetchUsers(); }}
              style={{
                padding: '8px 20px', borderRadius: '10px',
                background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                color: '#60a5fa', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer'
              }}>تلاش مجدد</button>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '12px' }}>
            <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال بارگذاری...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '16px' }}>
            <Users size={44} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>کاربری یافت نشد</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredUsers.map((u) => {
              const isExpanded = expandedUser === u.id;
              const hasSub = u.subscription && u.subscription.status;
              const subInfo = hasSub ? getSubStatusInfo(u.subscription.status) : null;

              return (
                <div
                  key={u.id}
                  onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                  style={{
                    padding: '14px',
                    background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.04)',
                    backdropFilter: 'blur(20px)',
                    border: isExpanded ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '14px', transition: 'all 0.2s', cursor: 'pointer'
                  }}
                >
                  {/* Top Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '600', fontSize: '15px', color: 'white', flexShrink: 0
                    }}>
                      {(u.displayName || u.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '14px', fontWeight: '600', color: 'white',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {u.displayName || u.username}
                        </span>
                        {hasSub && u.subscription.status === 'active' && (
                          <Crown size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.email}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: '#60a5fa', fontSize: '10px', fontWeight: '500'
                      }}>
                        <Clock size={10} />
                        {getTimeSince(u.registeredAt)}
                      </span>
                      {hasSub && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '6px',
                          background: subInfo.bg, color: subInfo.color,
                          fontSize: '10px', fontWeight: '600'
                        }}>
                          <Crown size={10} />
                          {subInfo.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded */}
                  {isExpanded && (
                    <div style={{
                      marginTop: '12px', paddingTop: '12px',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: '10px'
                    }}>
                      <DetailRow icon={<Mail size={14} />} label="ایمیل" value={u.email} />
                      <DetailRow icon={<AtSign size={14} />} label="نام کاربری" value={u.username} />
                      <DetailRow icon={<Calendar size={14} />} label="تاریخ ثبت‌نام" value={formatDate(u.registeredAt)} />
                      {hasSub && (
                        <>
                          <DetailRow icon={<Crown size={14} />} label="اشتراک"
                            value={
                              <span style={{
                                padding: '3px 10px', borderRadius: '8px',
                                background: subInfo.bg, color: subInfo.color,
                                fontSize: '12px', fontWeight: '500',
                                border: `1px solid ${subInfo.color}30`
                              }}>
                                {u.subscription.plan} — {subInfo.label}
                              </span>
                            }
                          />
                          {u.subscription.expiresAt && (
                            <DetailRow icon={<Clock size={14} />} label="انقضا" value={formatDate(u.subscription.expiresAt)} />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '20px', padding: '12px' }}>
            <PagBtn label="قبلی" disabled={page <= 1} onClick={() => fetchUsers(page - 1, searchQuery)} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{page} / {totalPages}</span>
            <PagBtn label="بعدی" disabled={page >= totalPages} onClick={() => fetchUsers(page + 1, searchQuery)} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .alpha-content-area::-webkit-scrollbar { display: none; }
        .alpha-content-area { scrollbar-width: none; }
      `}</style>
    </div>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{label}:</span>
    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

const PagBtn = ({ label, disabled, onClick }) => (
  <button disabled={disabled} onClick={onClick}
    style={{
      padding: '8px 16px', borderRadius: '10px',
      background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
      fontSize: '13px', fontWeight: '500', fontFamily: 'inherit',
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
    }}>{label}</button>
);

export default AdminUsersManager;