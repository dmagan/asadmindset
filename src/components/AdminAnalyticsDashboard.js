import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Users, Activity, Clock, TrendingUp,
  BarChart2, RefreshCw, Loader2, Eye, Calendar,
  UserCheck, UserX, ChevronDown, ChevronUp,
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const TAB_LABELS = {
  home: 'خانه', profile: 'پروفایل', support: 'پشتیبانی',
  shop: 'اشتراک', alphaChannel: 'کانال آلفا', liveWatch: 'لایو',
  liveArchive: 'آرشیو لایو', adminChat: 'چت ادمین', adminTrial: 'تریال',
  adminUsers: 'کاربران', adminLive: 'مدیریت لایو', teamChat: 'چت تیم',
  settings: 'تنظیمات', aiChat: 'هوش مصنوعی', subscription: 'اشتراک‌ها',
};

const PERIOD_OPTIONS = [
  { label: 'امروز', value: 1 },
  { label: '۷ روز', value: 7 },
  { label: '۳۰ روز', value: 30 },
];

const tabColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];

const StatCard = ({ icon, label, value, sub, color = '#8b5cf6' }) => (
  <div style={{
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      background: color + '20',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{value ?? '—'}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>{sub}</div>}
    </div>
  </div>
);

const MiniBar = ({ value, max, color = '#8b5cf6' }) => {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  );
};

const DailyChart = ({ data }) => {
  if (!data || data.length === 0) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
      داده‌ای موجود نیست
    </div>
  );
  const maxUsers = Math.max(...data.map(d => d.users), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, paddingTop: 8 }}>
      {data.map((d, i) => {
        const h = Math.max((d.users / maxUsers) * 72, 4);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div title={d.date + ': ' + d.users + ' کاربر'} style={{
              width: '100%', height: h,
              background: 'linear-gradient(180deg, #8b5cf6, #6d28d9)',
              borderRadius: '3px 3px 0 0',
              transition: 'height 0.5s ease',
            }} />
          </div>
        );
      })}
    </div>
  );
};

const Section = ({ icon, title, iconColor, children }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: (iconColor || '#8b5cf6') + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: iconColor || '#8b5cf6', flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{title}</span>
    </div>
    {children}
  </div>
);

export default function AdminAnalyticsDashboard({ onBack }) {
  const [period, setPeriod] = useState(7);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [userReports, setUserReports] = useState({});
  const [userLoading, setUserLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const getHeaders = () => ({ Authorization: 'Bearer ' + authService.getToken() });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(API_URL + '/admin/analytics/overview?days=' + period, { headers: getHeaders() });
      if (r.ok) setOverview(await r.json());
    } catch (_) {}
    setLoading(false);
  }, [period]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const r = await fetch(API_URL + '/admin/users', { headers: getHeaders() });
      if (r.ok) {
        const data = await r.json();
        setUsers(Array.isArray(data) ? data : (data.users || []));
      }
    } catch (_) {}
    setUsersLoading(false);
  }, []);

  const fetchUserReport = async (uid) => {
    if (userReports[uid]) return;
    setUserLoading(true);
    try {
      const r = await fetch(API_URL + '/admin/analytics/user/' + uid + '?days=' + period, { headers: getHeaders() });
      if (r.ok) {
        const data = await r.json();
        setUserReports(prev => ({ ...prev, [uid]: data }));
      }
    } catch (_) {}
    setUserLoading(false);
  };

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setUserReports({}); setExpandedUserId(null); }, [period]);

  const handleUserToggle = (uid) => {
    if (expandedUserId === uid) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(uid);
      fetchUserReport(uid);
    }
  };

  const maxTabCount = overview && overview.popular_tabs && overview.popular_tabs[0] ? overview.popular_tabs[0].count : 1;

  return (
    <div className="support-chat-container">

      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">آنالیتیکس</span>
            <span className="chat-header-status">گزارش فعالیت کاربران</span>
          </div>
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(59,130,246,0.4))'
          }}>
            <BarChart2 size={20} />
          </div>
        </div>
      </div>

      <div className="alpha-content-area" style={{ direction: 'rtl', padding: '20px 16px', paddingBottom: '120px' }}>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)} style={{
              padding: '9px 16px', borderRadius: '10px', fontSize: '13px',
              fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
              border: period === opt.value ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: period === opt.value ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: period === opt.value ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
              transition: 'all 0.2s',
            }}>
              {opt.label}
            </button>
          ))}
          <button onClick={fetchOverview} style={{
            marginRight: 'auto',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 14px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.6)', fontSize: '13px',
            fontWeight: '500', fontFamily: 'inherit', cursor: 'pointer',
          }}>
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            <span>بروزرسانی</span>
          </button>
        </div>

        {loading && !overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '12px' }}>
            <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال بارگذاری...</span>
          </div>
        ) : overview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <StatCard icon={<UserCheck size={18} />} label="کاربران فعال" value={overview.active_users} sub={'در ' + period + ' روز گذشته'} color="#10b981" />
              <StatCard icon={<Activity size={18} />} label="کل session‌ها" value={overview.total_sessions} sub="ورود به اپ" color="#8b5cf6" />
              <StatCard icon={<UserX size={18} />} label="غیرفعال" value={overview.inactive_users} sub="۷+ روز نیومدن" color="#ef4444" />
              <StatCard icon={<TrendingUp size={18} />} label="روزهای فعال" value={overview.daily ? overview.daily.length : 0} sub="روز با فعالیت" color="#f59e0b" />
            </div>

            <Section icon={<BarChart2 size={15} />} title="فعالیت روزانه" iconColor="#8b5cf6">
              <DailyChart data={overview.daily} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {overview.daily && overview.daily.slice(0, 1).map(d => (
                  <span key={d.date} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{d.date}</span>
                ))}
                {overview.daily && overview.daily.slice(-1).map(d => (
                  <span key={d.date} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>{d.date}</span>
                ))}
              </div>
            </Section>

            {overview.popular_tabs && overview.popular_tabs.length > 0 && (
              <Section icon={<Eye size={15} />} title="پربازدیدترین بخش‌ها" iconColor="#3b82f6">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {overview.popular_tabs.map((t, i) => (
                    <div key={t.tab} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '90px', fontSize: '13px', color: 'rgba(255,255,255,0.7)', textAlign: 'right', flexShrink: 0 }}>
                        {TAB_LABELS[t.tab] || t.tab}
                      </span>
                      <MiniBar value={t.count} max={maxTabCount} color={tabColors[i % tabColors.length]} />
                      <span style={{ width: '30px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textAlign: 'left', flexShrink: 0 }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section icon={<Users size={15} />} title="گزارش کاربران" iconColor="#10b981">
              {usersLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '12px' }}>
                  <Loader2 size={24} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>در حال بارگذاری...</span>
                </div>
              ) : users.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px', gap: '12px' }}>
                  <Users size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>کاربری یافت نشد</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {users.slice(0, 20).map((u) => {
                    const isExpanded = expandedUserId === u.id;
                    const report = userReports[u.id];
                    const displayName = u.name || u.display_name || u.username || '?';

                    return (
                      <div
                        key={u.id}
                        onClick={() => handleUserToggle(u.id)}
                        style={{
                          padding: '14px',
                          background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(20px)',
                          WebkitBackdropFilter: 'blur(20px)',
                          border: isExpanded ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: '14px',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '600', fontSize: '15px', color: 'white', flexShrink: 0,
                          }}>
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '14px', fontWeight: '600', color: 'white',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {displayName}
                            </div>
                            <div style={{
                              fontSize: '11px', color: 'rgba(255,255,255,0.45)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {u.email || ('ID: ' + u.id)}
                            </div>
                          </div>
                          <div style={{ flexShrink: 0 }}>
                            {isExpanded
                              ? <ChevronUp size={16} style={{ color: '#60a5fa' }} />
                              : <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.35)' }} />
                            }
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            {(userLoading && !report) ? (
                              <div style={{ textAlign: 'center', padding: '16px' }}>
                                <Loader2 size={20} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                              </div>
                            ) : report ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                  {[
                                    { label: 'session', value: report.sessions, icon: <Activity size={13} />, color: '#8b5cf6' },
                                    { label: 'روز فعال', value: report.active_days, icon: <Calendar size={13} />, color: '#10b981' },
                                    { label: 'دقیقه', value: report.total_minutes, icon: <Clock size={13} />, color: '#3b82f6' },
                                  ].map(s => (
                                    <div key={s.label} style={{
                                      background: s.color + '15',
                                      border: '1px solid ' + s.color + '25',
                                      borderRadius: '10px',
                                      padding: '10px 8px',
                                      textAlign: 'center',
                                      display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center',
                                    }}>
                                      <div style={{ color: s.color }}>{s.icon}</div>
                                      <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{s.value != null ? s.value : '—'}</div>
                                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
                                    </div>
                                  ))}
                                </div>

                                {report.last_seen && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '8px 10px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '8px',
                                  }}>
                                    <Clock size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                                      آخرین فعالیت: {report.last_seen}
                                    </span>
                                  </div>
                                )}

                                {report.tab_views && report.tab_views.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>بخش‌های بازدیدشده:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {report.tab_views.map((t, i) => (
                                        <span key={t.tab} style={{
                                          padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                                          background: tabColors[i % tabColors.length] + '22',
                                          color: tabColors[i % tabColors.length],
                                          border: '1px solid ' + tabColors[i % tabColors.length] + '44',
                                        }}>
                                          {TAB_LABELS[t.tab] || t.tab} ({t.count})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '12px 0' }}>
                                داده‌ای یافت نشد
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', gap: '12px' }}>
            <BarChart2 size={44} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>داده‌ای یافت نشد</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .alpha-content-area {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .alpha-content-area::-webkit-scrollbar { display: none; }
        .alpha-content-area { scrollbar-width: none; }
      `}</style>
    </div>
  );
}