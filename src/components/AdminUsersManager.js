import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  AlertCircle,
  TrendingUp,
  UserPlus,
  UserCheck,
  BarChart3,
  Filter,
  ChevronDown,
  ChevronUp,
  Bell,
  BellOff,
  Copy,
  Check as CheckIcon
} from 'lucide-react';
import { authService } from '../services/authService';
import { DEVICE_INFO, BROWSER_INFO } from '../services/deviceService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminUsersManager = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('list'); // list | stats
  const [userDevices, setUserDevices] = useState({}); // { userId: [{deviceType, useCount, lastSeen}] }
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // all users for stats calculations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedUser, setExpandedUser] = useState(null);
  const searchTimer = useRef(null);

  // Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateFilterUsers, setDateFilterUsers] = useState(null);
  const [showDateUsers, setShowDateUsers] = useState(false);

  const getHeaders = () => ({
    'Authorization': `Bearer ${authService.getToken()}`
  });

  // Fetch paginated users for list tab
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

      // Also store all users for stats (first load)
      if (pageNum === 1 && !search) {
        setAllUsers(data.users || []);
        // If there are more pages, fetch all for stats
        if (data.totalPages > 1) {
          fetchAllUsersForStats(data.totalPages);
        }
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all users for accurate stats
  const fetchAllUsersForStats = async (totalPgs) => {
    try {
      let all = [...allUsers];
      for (let p = 2; p <= totalPgs; p++) {
        const params = new URLSearchParams({ page: p, per_page: 50 });
        const res = await fetch(`${API_URL}/admin/users?${params}`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          all = [...all, ...(data.users || [])];
        }
      }
      setAllUsers(all);
    } catch (e) {
      console.error('Error fetching all users for stats:', e);
    }
  };

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

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
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
      case 'active':
      case 'approved': return { label: 'فعال', color: '#34d399', bg: 'rgba(52,211,153,0.15)' };
      case 'pending': return { label: 'در انتظار', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };
      case 'expired': return { label: 'منقضی', color: '#f87171', bg: 'rgba(248,113,113,0.15)' };
      case 'rejected': return { label: 'رد شده', color: '#f87171', bg: 'rgba(248,113,113,0.15)' };
      default: return { label: status || '—', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.05)' };
    }
  };

  // ============ STATS CALCULATIONS ============
  const stats = useMemo(() => {
    if (!allUsers.length) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today); monthAgo.setMonth(monthAgo.getMonth() - 1);
    const threeMonthsAgo = new Date(today); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const usersWithDate = allUsers.map(u => ({ ...u, regDate: new Date(u.registeredAt) }));

    const todayUsers = usersWithDate.filter(u => u.regDate >= today);
    const yesterdayUsers = usersWithDate.filter(u => u.regDate >= yesterday && u.regDate < today);
    const weekUsers = usersWithDate.filter(u => u.regDate >= weekAgo);
    const monthUsers = usersWithDate.filter(u => u.regDate >= monthAgo);
    const threeMonthUsers = usersWithDate.filter(u => u.regDate >= threeMonthsAgo);

    const activeSubUsers = allUsers.filter(u => u.subscription && (u.subscription.status === 'active' || u.subscription.status === 'approved'));
    const expiredSubUsers = allUsers.filter(u => u.subscription && u.subscription.status === 'expired');
    const pendingSubUsers = allUsers.filter(u => u.subscription && u.subscription.status === 'pending');
    const noSubUsers = allUsers.filter(u => !u.subscription);

    // Daily registrations for last 14 days (for chart)
    const dailyData = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(day.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const count = usersWithDate.filter(u => u.regDate >= day && u.regDate < nextDay).length;
      dailyData.push({
        date: day,
        label: `${day.getMonth() + 1}/${day.getDate()}`,
        count
      });
    }

    // Growth rate (this week vs last week)
    const lastWeekStart = new Date(weekAgo); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekUsers = usersWithDate.filter(u => u.regDate >= lastWeekStart && u.regDate < weekAgo);
    const growthRate = lastWeekUsers.length > 0
      ? Math.round(((weekUsers.length - lastWeekUsers.length) / lastWeekUsers.length) * 100)
      : weekUsers.length > 0 ? 100 : 0;

    // Average daily registrations (last 30 days)
    const avgDaily = monthUsers.length > 0 ? (monthUsers.length / 30).toFixed(1) : '0';

    // Peak registration day
    const peakDay = dailyData.reduce((max, d) => d.count > max.count ? d : max, dailyData[0]);

    return {
      total: allUsers.length,
      today: todayUsers.length,
      yesterday: yesterdayUsers.length,
      week: weekUsers.length,
      month: monthUsers.length,
      threeMonth: threeMonthUsers.length,
      activeSub: activeSubUsers.length,
      expiredSub: expiredSubUsers.length,
      noSub: noSubUsers.length,
      subRate: allUsers.length > 0 ? Math.round((activeSubUsers.length / allUsers.length) * 100) : 0,
      dailyData,
      growthRate,
      avgDaily,
      peakDay,
      todayUsers,
      weekUsers,
      monthUsers
    };
  }, [allUsers]);

  // Date range filter
  const handleDateFilter = () => {
    if (!dateFrom || !dateTo) return;
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59);

    const filtered = allUsers.filter(u => {
      const d = new Date(u.registeredAt);
      return d >= from && d <= to;
    });
    setDateFilterUsers(filtered);
    setShowDateUsers(true);
  };

  const clearDateFilter = () => {
    setDateFrom('');
    setDateTo('');
    setDateFilterUsers(null);
    setShowDateUsers(false);
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.displayName || '').toLowerCase().includes(q) ||
           (u.email || '').toLowerCase().includes(q) ||
           (u.username || '').toLowerCase().includes(q);
  });

  // ============ MINI BAR CHART ============
  const MiniChart = ({ data }) => {
    if (!data || !data.length) return null;
    const maxCount = Math.max(...data.map(d => d.count), 1);
    return (
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: '3px',
        height: '80px', padding: '0 4px', direction: 'ltr'
      }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontSize: '8px', color: d.count > 0 ? '#60a5fa' : 'rgba(255,255,255,0.2)',
              fontWeight: '600'
            }}>
              {d.count > 0 ? d.count : ''}
            </span>
            <div style={{
              width: '100%', minHeight: '4px',
              height: `${Math.max((d.count / maxCount) * 60, 4)}px`,
              background: d.count > 0
                ? 'linear-gradient(180deg, #60a5fa, #3b82f6)'
                : 'rgba(255,255,255,0.06)',
              borderRadius: '3px 3px 1px 1px',
              transition: 'height 0.3s'
            }} />
            <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
              {i % 2 === 0 ? d.label : ''}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // ============ RENDER STATS TAB ============
  const renderStats = () => {
    if (!stats) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '12px' }}>
          <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال محاسبه آمار...</span>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <StatCard icon={<Users size={18} />} value={stats.total} label="کل کاربران" color="#8b5cf6" />
          <StatCard icon={<UserPlus size={18} />} value={stats.today} label="امروز" color="#3b82f6" />
          <StatCard icon={<UserPlus size={18} />} value={stats.yesterday} label="دیروز" color="#6366f1" />
          <StatCard icon={<UserPlus size={18} />} value={stats.week} label="هفته اخیر" color="#10b981" />
          <StatCard icon={<UserPlus size={18} />} value={stats.month} label="ماه اخیر" color="#f59e0b" />
          <StatCard icon={<UserPlus size={18} />} value={stats.threeMonth} label="۳ ماه اخیر" color="#ef4444" />
        </div>

        {/* Growth & Average */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{
            padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <TrendingUp size={14} style={{ color: stats.growthRate >= 0 ? '#34d399' : '#f87171' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>رشد هفتگی</span>
            </div>
            <div style={{
              fontSize: '20px', fontWeight: '700',
              color: stats.growthRate >= 0 ? '#34d399' : '#f87171'
            }}>
              {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate}%
            </div>
          </div>
          <div style={{
            padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <BarChart3 size={14} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>میانگین روزانه</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#60a5fa' }}>
              {stats.avgDaily}
            </div>
          </div>
        </div>

        {/* Subscription Stats */}
        <div style={{
          padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Crown size={16} style={{ color: '#fbbf24' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>وضعیت اشتراک‌ها</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SubStatBadge label="فعال" count={stats.activeSub} color="#34d399" />
            <SubStatBadge label="منقضی" count={stats.expiredSub} color="#f87171" />
            <SubStatBadge label="بدون اشتراک" count={stats.noSub} color="#94a3b8" />
          </div>
          {/* Subscription rate bar */}
          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>نرخ اشتراک</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#fbbf24' }}>{stats.subRate}%</span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${stats.subRate}%`,
                background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                borderRadius: '3px', transition: 'width 0.5s'
              }} />
            </div>
          </div>
        </div>

        {/* 14-day Chart */}
        <div style={{
          padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={16} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>ثبت‌نام ۱۴ روز اخیر</span>
            </div>
            {stats.peakDay && stats.peakDay.count > 0 && (
              <span style={{
                fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa'
              }}>
                بیشترین: {stats.peakDay.label} ({stats.peakDay.count} نفر)
              </span>
            )}
          </div>
          <MiniChart data={stats.dailyData} />
        </div>

        {/* Date Range Filter */}
        <div style={{
          padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px',
          overflow: 'hidden', boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Filter size={16} style={{ color: '#a78bfa' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>فیلتر بازه زمانی</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', direction: 'ltr', overflow: 'hidden' }}>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px', direction: 'rtl' }}>از تاریخ</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  width: '90%', padding: '9px 8px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', fontSize: '11px', fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box', colorScheme: 'dark', maxWidth: '100%'
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px', direction: 'rtl' }}>تا تاریخ</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  width: '90%', padding: '9px 8px', borderRadius: '10px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white', fontSize: '11px', fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box', colorScheme: 'dark', maxWidth: '100%'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDateFilter}
              disabled={!dateFrom || !dateTo}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                background: dateFrom && dateTo ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.03)',
                border: dateFrom && dateTo ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: dateFrom && dateTo ? '#c4b5fd' : 'rgba(255,255,255,0.2)',
                fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
                cursor: dateFrom && dateTo ? 'pointer' : 'not-allowed', transition: 'all 0.2s'
              }}
            >
              نمایش نتایج
            </button>
            {dateFilterUsers !== null && (
              <button
                onClick={clearDateFilter}
                style={{
                  padding: '10px 14px', borderRadius: '10px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer'
                }}
              >پاک کردن</button>
            )}
          </div>

          {/* Date Filter Results */}
          {dateFilterUsers !== null && (
            <div style={{ marginTop: '14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)', borderRadius: '10px',
                marginBottom: '10px'
              }}>
                <span style={{ fontSize: '13px', color: '#c4b5fd' }}>
                  {dateFilterUsers.length} کاربر جدید
                </span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  {formatDateShort(dateFrom)} — {formatDateShort(dateTo)}
                </span>
              </div>

              {dateFilterUsers.length > 0 && (
                <>
                  <button
                    onClick={() => setShowDateUsers(!showDateUsers)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      width: '100%', padding: '8px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontFamily: 'inherit',
                      cursor: 'pointer', marginBottom: '8px'
                    }}
                  >
                    {showDateUsers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {showDateUsers ? 'بستن لیست' : 'نمایش لیست کاربران'}
                  </button>

                  {showDateUsers && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {dateFilterUsers.map(u => (
                        <div key={u.id} style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                          border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px'
                        }}>
                          <div style={{
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '600', fontSize: '12px', color: 'white', flexShrink: 0
                          }}>
                            {(u.displayName || u.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.displayName || u.username}
                            </div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{u.email}</div>
                          </div>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                            {formatDateShort(u.registeredAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Recent Registrations */}
        <div style={{
          padding: '14px', background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <UserPlus size={16} style={{ color: '#34d399' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>آخرین ثبت‌نام‌ها</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allUsers.slice(0, 5).map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px'
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '600', fontSize: '12px', color: 'white', flexShrink: 0
                }}>
                  {(u.displayName || u.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: '500', color: 'white',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {u.displayName || u.username}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{u.email}</div>
                </div>
                <span style={{
                  fontSize: '10px', padding: '3px 7px', borderRadius: '6px',
                  background: 'rgba(16,185,129,0.1)', color: '#34d399', whiteSpace: 'nowrap'
                }}>
                  {getTimeSince(u.registeredAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ============ RENDER USER LIST ============
  const renderUserList = () => (
    <>
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <button onClick={() => fetchUsers(page, searchQuery)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.6)', fontSize: '13px',
            fontWeight: '500', fontFamily: 'inherit',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
          }}>
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
              <div key={u.id} onClick={async () => {
                const newId = isExpanded ? null : u.id;
                setExpandedUser(newId);
                if (newId && !userDevices[newId]) {
                  try {
                    const res = await fetch(`${API_URL}/admin/users/${newId}/devices`, {
                      headers: { Authorization: `Bearer ${authService.getToken()}` }
                    });
                    const devices = res.ok ? await res.json() : [];
                    setUserDevices(prev => ({ ...prev, [newId]: Array.isArray(devices) ? devices : [] }));
                  } catch(e) {
                    setUserDevices(prev => ({ ...prev, [newId]: [] }));
                  }
                }
              }}
                style={{
                  padding: '14px',
                  background: isExpanded ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(20px)',
                  border: isExpanded ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px', transition: 'all 0.2s', cursor: 'pointer'
                }}>
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
                      {hasSub && (u.subscription.status === 'active' || u.subscription.status === 'approved') && (
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
                    <DetailRow icon={<Mail size={14} />} label="ایمیل" value={
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ wordBreak: 'break-all' }}>{u.email}</span>
                        <CopyBtn text={u.email} />
                      </span>
                    } />
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

                    {/* Notification Preferences */}
                    <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <Bell size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>نوتیفیکیشن‌ها</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <NotifTag label="کلی" active={u.notificationPrefs?.enabled !== false} />
                        <NotifTag label="کانال" active={u.notificationPrefs?.alpha_channel !== false} />
                        <NotifTag label="پشتیبانی" active={u.notificationPrefs?.support !== false} />
                        <NotifTag label="تیم" active={u.notificationPrefs?.team_chat !== false} />
                      </div>
                    </div>

                    {/* دستگاه‌های کاربر */}
                    {(() => {
                      const devices = userDevices[u.id];
                      if (!devices) return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <Loader2 size={13} style={{ color: 'rgba(255,255,255,0.3)', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>در حال دریافت...</span>
                        </div>
                      );
                      if (!devices.length) return (
                        <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px' }}>📱</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>هنوز اطلاعات دستگاهی ثبت نشده</span>
                          </div>
                        </div>
                      );

                      const lastSeen = devices.reduce((a, b) => a.lastSeen > b.lastSeen ? a : b);

                      return (
                        <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '13px' }}>📱</span>
                              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>دستگاه‌ها</span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', direction: 'ltr' }}>
                              آخرین آنلاین: {formatDate(lastSeen.lastSeen)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {devices.map(d => {
                              const devInfo = DEVICE_INFO[d.deviceType] || DEVICE_INFO.unknown;
                              const brInfo  = BROWSER_INFO[d.browser]   || BROWSER_INFO.unknown;
                              return (
                                <div key={`${d.deviceType}-${d.browser}`} style={{
                                  display: 'flex', alignItems: 'center', gap: '8px',
                                  padding: '7px 10px', borderRadius: '10px',
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.07)',
                                }}>
                                  {/* Device */}
                                  <span style={{ fontSize: '15px' }}>{devInfo.icon}</span>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: devInfo.color, minWidth: '52px' }}>
                                    {devInfo.label}
                                  </span>
                                  {/* Divider */}
                                  <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '14px' }}>|</span>
                                  {/* Browser */}
                                  <span style={{ fontSize: '13px' }}>{brInfo.icon}</span>
                                  <span style={{ fontSize: '12px', color: brInfo.color, flex: 1 }}>
                                    {d.browser}{d.browserVer ? ` ${d.browserVer}` : ''}
                                  </span>
                                  {/* PWA badge for iOS */}
                                  {d.deviceType === 'ios' && (
                                    <span style={{
                                      fontSize: '10px', fontWeight: '600',
                                      padding: '2px 6px', borderRadius: '5px',
                                      background: d.pwaInstalled ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                                      color: d.pwaInstalled ? '#10b981' : '#ef4444',
                                      border: `1px solid ${d.pwaInstalled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)'}`,
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {d.pwaInstalled ? '📲 A2HS' : '🌐 Browser'}
                                    </span>
                                  )}
                                  {/* Count */}
                                  <span style={{
                                    fontSize: '10px', color: 'rgba(255,255,255,0.35)',
                                    background: 'rgba(255,255,255,0.06)',
                                    padding: '2px 6px', borderRadius: '5px',
                                  }}>×{d.useCount}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
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
    </>
  );

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

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[
            { key: 'list', label: 'لیست کاربران', icon: <Users size={14} /> },
            { key: 'stats', label: 'آمار', icon: <BarChart3 size={14} /> }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 16px', borderRadius: '10px',
                border: activeTab === tab.key ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                background: activeTab === tab.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.key ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                fontSize: '13px', fontWeight: '500', fontFamily: 'inherit',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'list' ? renderUserList() : renderStats()}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .alpha-content-area::-webkit-scrollbar { display: none; }
        .alpha-content-area { scrollbar-width: none; }
      `}</style>
    </div>
  );
};

// ============ HELPER COMPONENTS ============
const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    padding: '14px', background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)', borderRadius: '14px',
    display: 'flex', alignItems: 'center', gap: '10px'
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      background: `${color}20`, display: 'flex',
      alignItems: 'center', justifyContent: 'center', color, flexShrink: 0
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
    </div>
  </div>
);

const SubStatBadge = ({ label, count, color }) => (
  <div style={{
    flex: 1, padding: '10px 8px', borderRadius: '10px',
    background: `${color}15`, border: `1px solid ${color}30`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
  }}>
    <span style={{ fontSize: '16px', fontWeight: '700', color }}>{count}</span>
    <span style={{ fontSize: '10px', color, opacity: 0.85, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const CopyBtn = ({ text }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={handleCopy} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
      color: copied ? '#34d399' : 'rgba(255,255,255,0.3)', display: 'flex',
      flexShrink: 0, transition: 'color 0.2s'
    }}>
      {copied ? <CheckIcon size={13} /> : <Copy size={13} />}
    </button>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ color: 'rgba(255,255,255,0.3)', display: 'flex', flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{label}:</span>
    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

const NotifTag = ({ label, active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '500',
    background: active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
    color: active ? '#34d399' : '#f87171',
    border: `1px solid ${active ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}`,
  }}>
    {label}
    <span>{active ? '✓' : '✗'}</span>
  </span>
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