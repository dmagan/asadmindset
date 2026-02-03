import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Crown,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  X,
  RefreshCw,
  Search,
  Calendar,
  User,
  Mail,
  DollarSign,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Plus,
  UserPlus
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminSubscriptionManager = ({ onBack, onPendingCountChange }) => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  const [durationDays, setDurationDays] = useState(30);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const [editStatus, setEditStatus] = useState('');
  const [editCreatedAt, setEditCreatedAt] = useState('');

  // Manual subscription form
  const [manualEmail, setManualEmail] = useState('');
  const [manualPlanType, setManualPlanType] = useState('1_month');
  const [manualDuration, setManualDuration] = useState(30);
  const [manualAmount, setManualAmount] = useState('');
  const [manualExcludeRevenue, setManualExcludeRevenue] = useState(false);
  const [manualNote, setManualNote] = useState('');

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authService.getToken()}`
  });

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page, per_page: 20 });
      if (filter && filter !== 'all') params.append('status', filter);

      const response = await fetch(`${API_URL}/admin/subscriptions?${params}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/subscriptions/stats`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        onPendingCountChange?.(data.pending || 0);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    loadSubscriptions();
    loadStats();
  }, [loadSubscriptions, loadStats]);

  // ====== ACTIONS ======

  const handleApprove = async () => {
    if (!selectedSubscription) return;
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/approve`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ duration_days: durationDays, admin_note: adminNote })
      });
      if (!response.ok) throw new Error('Failed');
      setShowApproveModal(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در تایید اشتراک');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubscription) return;
    if (!adminNote.trim()) {
      alert('لطفا دلیل رد درخواست را بنویسید');
      return;
    }
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/reject`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ admin_note: adminNote })
      });

      // Send rejection message to user
      const rejectMessage = `❌ درخواست اشتراک شما رد شد\n\n📝 دلیل: ${adminNote}\n\nدر صورت نیاز به راهنمایی بیشتر، همینجا پیام دهید.`;
      try {
        await fetch(`${API_URL}/admin/conversations/user/${selectedSubscription.userId}/message`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({ content: rejectMessage, type: 'text' })
        });
      } catch (msgError) {
        console.error('Error sending rejection message:', msgError);
      }

      setShowRejectModal(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در رد درخواست');
    } finally {
      setProcessing(false);
    }
  };

  const handleEditStatus = async () => {
    if (!selectedSubscription) return;
    setProcessing(true);
    try {
      const data = {
        status: editStatus,
        duration_days: editStatus === 'approved' ? durationDays : undefined,
        admin_note: adminNote
      };
      if (editCreatedAt) {
        data.created_at = editCreatedAt.replace('T', ' ') + ':00';
      }
      await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/update-status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      setShowEditModal(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در بروزرسانی وضعیت');
    } finally {
      setProcessing(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!selectedSubscription) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/trash`, {
        method: 'PUT',
        headers: getHeaders()
      });
      setShowDeleteConfirm(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در انتقال به سطل آشغال');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedSubscription) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/restore`, {
        method: 'PUT',
        headers: getHeaders()
      });
      setShowRestoreConfirm(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در بازیابی');
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedSubscription) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/subscriptions/${selectedSubscription.id}/permanent-delete`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      setShowPermanentDeleteConfirm(false);
      resetModals();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert('خطا در حذف دائم');
    } finally {
      setProcessing(false);
    }
  };

  const resetModals = () => {
    setSelectedSubscription(null);
    setDurationDays(30);
    setAdminNote('');
    setEditStatus('');
    setEditCreatedAt('');
  };

  const resetManualForm = () => {
    setManualEmail('');
    setManualPlanType('1_month');
    setManualDuration(30);
    setManualAmount('');
    setManualExcludeRevenue(false);
    setManualNote('');
  };

  const handleManualSubscription = async () => {
    if (!manualEmail.trim()) {
      alert('لطفا ایمیل کاربر را وارد کنید');
      return;
    }
    setProcessing(true);
    try {
      const response = await fetch(`${API_URL}/admin/subscriptions/manual`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          email: manualEmail.trim(),
          plan_type: manualPlanType,
          duration_days: manualDuration,
          amount: manualAmount || '0',
          exclude_from_revenue: manualExcludeRevenue,
          admin_note: manualNote,
          is_manual: true
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'خطا در ایجاد اشتراک');
      }
      setShowManualModal(false);
      resetManualForm();
      loadSubscriptions();
      loadStats();
    } catch (error) {
      alert(error.message || 'خطا در ایجاد اشتراک دستی');
    } finally {
      setProcessing(false);
    }
  };

  // ====== HELPERS ======

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatPrice = (amount) => {
    if (!amount) return '0$';
    return amount + '$';
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { icon: <Clock size={14} />, label: 'در انتظار', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
      case 'approved':
        return { icon: <CheckCircle size={14} />, label: 'تایید شده', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
      case 'rejected':
        return { icon: <XCircle size={14} />, label: 'رد شده', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default:
        return { icon: <Clock size={14} />, label: status, color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' };
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    // وقتی فیلتر سطل آشغال هست، فقط trashed رو نشون بده
    if (filter === 'trashed') {
      if (sub.status !== 'trashed') return false;
    } else if (filter === 'manual') {
      // فقط اشتراک‌های دستی رو نشون بده
      if (!sub.isManual) return false;
      if (sub.status === 'trashed') return false;
    } else {
      // در بقیه فیلترها، trashed رو مخفی کن
      if (sub.status === 'trashed') return false;
      if (filter !== 'all' && sub.status !== filter) return false;
    }
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return sub.userName?.toLowerCase().includes(query) || sub.userEmail?.toLowerCase().includes(query);
  });

  // ====== RENDER ======

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">مدیریت اشتراک‌ها</span>
            <span className="chat-header-status">
              {stats?.pending ? `${stats.pending} در انتظار بررسی` : 'بررسی و تایید درخواست‌ها'}
            </span>
          </div>
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3))'
          }}>
            <Crown size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="alpha-content-area" style={{ direction: 'rtl' }}>

        {/* Stats + Manual Add */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'stretch' }}>
          {stats && (
            <div style={{ flex: 1 }}>
              <StatCard icon={<DollarSign size={18} />} value={stats.monthRevenue ? `${stats.monthRevenue}$` : '0'} label="درآمد ماه" color="#3b82f6" />
            </div>
          )}
          <button
            onClick={() => { resetManualForm(); setShowManualModal(true); }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '14px 18px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '14px',
              color: '#10b981',
              fontSize: '11px',
              fontWeight: '600',
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '80px'
            }}
          >
            <Plus size={20} />
            <span>خرید دستی</span>
          </button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          marginBottom: '12px'
        }}>
          <Search size={18} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="جستجو نام یا ایمیل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '14px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}>
          {[
            { key: 'all', label: 'همه', count: null },
            { key: 'pending', label: 'در انتظار', count: stats?.pending },
            { key: 'approved', label: 'تایید شده', count: null },
            { key: 'rejected', label: 'رد شده', count: null },
            { key: 'manual', label: null, icon: <UserPlus size={14} />, count: null },
            { key: 'trashed', label: null, icon: <Trash2 size={14} />, count: null }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: f.icon && !f.label ? '8px 10px' : '8px 14px',
                borderRadius: '10px',
                border: filter === f.key 
                  ? f.key === 'trashed' ? '1px solid rgba(239, 68, 68, 0.4)' 
                    : f.key === 'manual' ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(139, 92, 246, 0.5)' 
                  : '1px solid rgba(255,255,255,0.1)',
                background: filter === f.key 
                  ? f.key === 'trashed' ? 'rgba(239, 68, 68, 0.15)' 
                    : f.key === 'manual' ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(139, 92, 246, 0.2)' 
                  : 'rgba(255,255,255,0.05)',
                color: filter === f.key 
                  ? f.key === 'trashed' ? '#f87171' 
                    : f.key === 'manual' ? '#34d399'
                    : '#c4b5fd' 
                  : 'rgba(255,255,255,0.6)',
                fontSize: '13px',
                fontWeight: '500',
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {f.icon || null}
              {f.label && <span>{f.label}</span>}
              {f.count > 0 && (
                <span style={{
                  padding: '1px 7px',
                  borderRadius: '8px',
                  background: 'rgba(249, 115, 22, 0.3)',
                  color: '#f97316',
                  fontSize: '11px',
                  fontWeight: '700'
                }}>
                  {f.count}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => { loadSubscriptions(); loadStats(); }}
            style={{
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginRight: 'auto',
              flexShrink: 0
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Subscriptions List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '12px' }}>
            <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال بارگذاری...</span>
          </div>
        ) : filteredSubscriptions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '50px 20px', gap: '16px' }}>
            <Crown size={44} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>هیچ درخواستی یافت نشد</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredSubscriptions.map((sub) => {
              const statusInfo = getStatusInfo(sub.status);
              return (
                <div
                  key={sub.id}
                  style={{
                    padding: '14px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '14px',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Top Row: User info + Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '600',
                      fontSize: '15px',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {sub.userName?.charAt(0) || 'U'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sub.userName || 'کاربر'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {sub.userEmail}
                      </div>
                    </div>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: statusInfo.bg,
                      color: statusInfo.color,
                      fontSize: '11px',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Middle Row: Plan + Amount + Date */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.55)',
                    marginBottom: '12px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      background: 'rgba(251, 191, 36, 0.12)',
                      borderRadius: '6px',
                      color: '#fbbf24',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      <Crown size={12} />
                      {sub.planType === 'monthly' ? 'ماهانه' : sub.planType}
                    </span>
                    {sub.isManual && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 7px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        borderRadius: '6px',
                        color: '#34d399',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        <UserPlus size={10} />
                        دستی
                      </span>
                    )}
                    {sub.excludeFromRevenue && (
                      <span style={{
                        padding: '3px 7px',
                        background: 'rgba(156, 163, 175, 0.12)',
                        borderRadius: '6px',
                        color: '#9ca3af',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        بدون درآمد
                      </span>
                    )}
                    <span>{formatPrice(sub.amount)}</span>
                    <span style={{ marginRight: 'auto' }}>{formatDate(sub.createdAt)}</span>
                  </div>

                  {/* Bottom Row: Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <ActionBtn
                      icon={<Eye size={16} />}
                      color="#6366f1"
                      bg="rgba(99, 102, 241, 0.15)"
                      onClick={() => { setSelectedSubscription(sub); setShowDetailModal(true); }}
                    />
                    {sub.status === 'trashed' ? (
                      <>
                        <ActionBtn
                          icon={<RefreshCw size={16} />}
                          color="#22c55e"
                          bg="rgba(34, 197, 94, 0.15)"
                          label="بازیابی"
                          onClick={() => { setSelectedSubscription(sub); setShowRestoreConfirm(true); }}
                        />
                        <ActionBtn
                          icon={<Trash2 size={16} />}
                          color="#ef4444"
                          bg="rgba(239, 68, 68, 0.1)"
                          label="حذف دائم"
                          onClick={() => { setSelectedSubscription(sub); setShowPermanentDeleteConfirm(true); }}
                          style={{ marginRight: 'auto' }}
                        />
                      </>
                    ) : (
                      <>
                        {sub.status === 'pending' && (
                          <>
                            <ActionBtn
                              icon={<CheckCircle size={16} />}
                              color="#22c55e"
                              bg="rgba(34, 197, 94, 0.15)"
                              label="تایید"
                              onClick={() => { setSelectedSubscription(sub); setDurationDays(30); setAdminNote(''); setShowApproveModal(true); }}
                            />
                            <ActionBtn
                              icon={<XCircle size={16} />}
                              color="#ef4444"
                              bg="rgba(239, 68, 68, 0.15)"
                              label="رد"
                              onClick={() => { setSelectedSubscription(sub); setAdminNote(''); setShowRejectModal(true); }}
                            />
                          </>
                        )}
                        <ActionBtn
                          icon={<Edit3 size={16} />}
                          color="#fbbf24"
                          bg="rgba(251, 191, 36, 0.15)"
                          onClick={() => {
                            setSelectedSubscription(sub);
                            setEditStatus(sub.status);
                            setDurationDays(30);
                            setAdminNote('');
                            const created = sub.createdAt ? sub.createdAt.replace(' ', 'T').slice(0, 16) : '';
                            setEditCreatedAt(created);
                            setShowEditModal(true);
                          }}
                        />
                        <ActionBtn
                          icon={<Trash2 size={16} />}
                          color="#ef4444"
                          bg="rgba(239, 68, 68, 0.1)"
                          onClick={() => { setSelectedSubscription(sub); setShowDeleteConfirm(true); }}
                          style={{ marginRight: 'auto' }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '14px',
                padding: '16px 0'
              }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    opacity: page === 1 ? 0.4 : 1
                  }}
                >
                  <ChevronRight size={18} />
                </button>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                  صفحه {page} از {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    opacity: page === totalPages ? 0.4 : 1
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== MODALS ====== */}

      {/* Detail Modal */}
      {showDetailModal && selectedSubscription && (
        <BottomSheet onClose={() => setShowDetailModal(false)}>
          <ModalHeader title="جزئیات درخواست" onClose={() => setShowDetailModal(false)} />
          <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(85vh - 130px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <DetailRow icon={<User size={16} />} label="کاربر" value={selectedSubscription.userName} />
              <DetailRow icon={<Mail size={16} />} label="ایمیل" value={selectedSubscription.userEmail} />
              <DetailRow icon={<Crown size={16} />} label="پلن" value={selectedSubscription.planType === 'monthly' ? 'ماهانه' : selectedSubscription.planType} />
              <DetailRow icon={<DollarSign size={16} />} label="مبلغ" value={formatPrice(selectedSubscription.amount)} />
              <DetailRow icon={<Calendar size={16} />} label="تاریخ" value={formatDate(selectedSubscription.createdAt)} />
              <DetailRow icon={<AlertCircle size={16} />} label="وضعیت" badge={getStatusInfo(selectedSubscription.status)} />
              {selectedSubscription.status === 'approved' && (
                <>
                  <DetailRow icon={<Calendar size={16} />} label="شروع" value={formatDate(selectedSubscription.startedAt)} />
                  <DetailRow icon={<Calendar size={16} />} label="انقضا" value={formatDate(selectedSubscription.expiresAt)} />
                </>
              )}
              {selectedSubscription.adminNote && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '10px',
                  marginTop: '4px'
                }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '6px' }}>
                    یادداشت ادمین:
                  </span>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                    {selectedSubscription.adminNote}
                  </span>
                </div>
              )}
            </div>

            {/* Payment Proof */}
            {selectedSubscription.paymentProof && (
              <div style={{ marginTop: '20px' }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', display: 'block', marginBottom: '10px' }}>
                  رسید پرداخت
                </span>
                <div style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <img
                    src={selectedSubscription.paymentProof}
                    alt="رسید پرداخت"
                    onClick={() => window.open(selectedSubscription.paymentProof, '_blank')}
                    style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', cursor: 'pointer' }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
              {selectedSubscription.status === 'pending' && (
                <>
                  <ModalActionBtn
                    icon={<CheckCircle size={18} />}
                    label="تایید"
                    gradient="linear-gradient(135deg, #22c55e, #16a34a)"
                    onClick={() => { setShowDetailModal(false); setDurationDays(30); setAdminNote(''); setShowApproveModal(true); }}
                  />
                  <ModalActionBtn
                    icon={<XCircle size={18} />}
                    label="رد"
                    gradient="linear-gradient(135deg, #ef4444, #dc2626)"
                    onClick={() => { setShowDetailModal(false); setAdminNote(''); setShowRejectModal(true); }}
                  />
                </>
              )}
              <ModalActionBtn
                icon={<Edit3 size={16} />}
                label="ویرایش"
                bg="rgba(251, 191, 36, 0.2)"
                borderColor="rgba(251, 191, 36, 0.4)"
                color="#fbbf24"
                onClick={() => {
                  setShowDetailModal(false);
                  setEditStatus(selectedSubscription.status);
                  setDurationDays(30);
                  setAdminNote('');
                  const created = selectedSubscription.createdAt ? selectedSubscription.createdAt.replace(' ', 'T').slice(0, 16) : '';
                  setEditCreatedAt(created);
                  setShowEditModal(true);
                }}
              />
              <ModalActionBtn
                icon={<Trash2 size={16} />}
                label="حذف"
                bg="rgba(239, 68, 68, 0.15)"
                borderColor="rgba(239, 68, 68, 0.3)"
                color="#ef4444"
                onClick={() => { setShowDetailModal(false); setShowDeleteConfirm(true); }}
              />
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedSubscription && (
        <BottomSheet onClose={() => setShowApproveModal(false)}>
          <ModalHeader title="تایید اشتراک" onClose={() => setShowApproveModal(false)} />
          <div style={{ padding: '20px', overflowY: 'auto' }}>
            <UserSummary sub={selectedSubscription} />

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>مدت اشتراک (روز)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                {[30, 60, 90, 180, 365].map(days => (
                  <button
                    key={days}
                    onClick={() => setDurationDays(days)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      border: durationDays === days ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      background: durationDays === days ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: durationDays === days ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {days} روز
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
                min="1"
                max="365"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>یادداشت (اختیاری)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="یادداشتی برای این تایید..."
                rows={3}
                style={textareaStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowApproveModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleApprove} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><CheckCircle size={18} /><span>تایید اشتراک</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedSubscription && (
        <BottomSheet onClose={() => setShowRejectModal(false)}>
          <ModalHeader title="رد درخواست" onClose={() => setShowRejectModal(false)} />
          <div style={{ padding: '20px', overflowY: 'auto' }}>
            <UserSummary sub={selectedSubscription} />

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>دلیل رد (به کاربر نمایش داده می‌شود)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="دلیل رد درخواست را بنویسید..."
                rows={4}
                style={textareaStyle}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: 'rgba(249, 115, 22, 0.1)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              borderRadius: '10px',
              color: '#f97316',
              fontSize: '12px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>این پیام به کاربر نمایش داده خواهد شد.</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowRejectModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleReject} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><XCircle size={18} /><span>رد درخواست</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Edit Status Modal */}
      {showEditModal && selectedSubscription && (
        <BottomSheet onClose={() => setShowEditModal(false)}>
          <ModalHeader title="ویرایش وضعیت" onClose={() => setShowEditModal(false)} />
          <div style={{ padding: '20px', overflowY: 'auto' }}>
            <UserSummary sub={selectedSubscription} />

            {/* Current status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>وضعیت فعلی:</span>
              {(() => {
                const info = getStatusInfo(selectedSubscription.status);
                return (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '4px 10px', borderRadius: '8px',
                    background: info.bg, color: info.color, fontSize: '12px', fontWeight: '600'
                  }}>
                    {info.icon} {info.label}
                  </span>
                );
              })()}
            </div>

            {/* Status Options */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>وضعیت جدید</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['pending', 'approved', 'rejected'].map(s => {
                  const info = getStatusInfo(s);
                  return (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: editStatus === s ? `2px solid ${info.color}` : '2px solid rgba(255,255,255,0.08)',
                        background: editStatus === s ? info.bg : 'rgba(255,255,255,0.03)',
                        color: editStatus === s ? info.color : 'rgba(255,255,255,0.6)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {info.icon}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {editStatus === 'approved' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>مدت اشتراک (روز)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {[30, 60, 90, 180, 365].map(days => (
                    <button
                      key={days}
                      onClick={() => setDurationDays(days)}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '10px',
                        border: durationDays === days ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                        background: durationDays === days ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: durationDays === days ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
                        fontSize: '13px',
                        fontFamily: 'inherit',
                        cursor: 'pointer'
                      }}
                    >
                      {days} روز
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value) || 30)}
                  min="1"
                  max="3650"
                  placeholder="تعداد روز دلخواه..."
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>تاریخ و ساعت خرید</label>
              <input
                type="datetime-local"
                value={editCreatedAt}
                onChange={(e) => setEditCreatedAt(e.target.value)}
                style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>یادداشت ادمین (اختیاری)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="یادداشت..."
                rows={3}
                style={textareaStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowEditModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleEditStatus} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Edit3 size={18} /><span>ذخیره تغییرات</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && selectedSubscription && (
        <BottomSheet onClose={() => setShowDeleteConfirm(false)}>
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(249, 115, 22, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#f97316'
            }}>
              <Trash2 size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: 'white' }}>
              انتقال به سطل آشغال
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6', marginBottom: '6px' }}>
              آیا از انتقال درخواست <strong style={{ color: 'white' }}>{selectedSubscription.userName}</strong> مطمئنید؟
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '24px' }}>
              می‌توانید بعداً از سطل آشغال بازیابی کنید.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleSoftDelete} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={16} /><span>انتقال</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Restore Confirm Modal */}
      {showRestoreConfirm && selectedSubscription && (
        <BottomSheet onClose={() => setShowRestoreConfirm(false)}>
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#22c55e'
            }}>
              <RefreshCw size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: 'white' }}>
              بازیابی درخواست
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6', marginBottom: '6px' }}>
              آیا از بازیابی درخواست <strong style={{ color: 'white' }}>{selectedSubscription.userName}</strong> مطمئنید؟
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '24px' }}>
              درخواست به وضعیت قبلی بازگردانده می‌شود.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowRestoreConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleRestore} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><RefreshCw size={16} /><span>بازیابی</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Permanent Delete Confirm Modal */}
      {showPermanentDeleteConfirm && selectedSubscription && (
        <BottomSheet onClose={() => setShowPermanentDeleteConfirm(false)}>
          <div style={{ padding: '30px 20px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#ef4444'
            }}>
              <Trash2 size={28} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>
              حذف دائم
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.6', marginBottom: '6px' }}>
              آیا از حذف دائم درخواست <strong style={{ color: 'white' }}>{selectedSubscription.userName}</strong> مطمئنید؟
            </p>
            <p style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginBottom: '24px' }}>
              ⚠️ این عملیات قابل بازگشت نیست!
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setShowPermanentDeleteConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handlePermanentDelete} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={16} /><span>حذف دائم</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* Manual Subscription Modal */}
      {showManualModal && (
        <BottomSheet onClose={() => setShowManualModal(false)}>
          <ModalHeader title="خرید دستی اشتراک" onClose={() => setShowManualModal(false)} />
          <div style={{ padding: '20px', overflowY: 'auto' }}>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>ایمیل کاربر</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                ...inputStyle,
                padding: 0
              }}>
                <Mail size={16} style={{ color: 'rgba(255,255,255,0.35)', marginRight: '12px', flexShrink: 0 }} />
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                    padding: '11px 14px 11px 0',
                    direction: 'ltr',
                    textAlign: 'right'
                  }}
                />
              </div>
            </div>

            {/* Plan Type */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>نوع اشتراک</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {[
                  { key: '1_month', label: '۱ ماهه', days: 30 },
                  { key: '2_month', label: '۲ ماهه', days: 60 },
                  { key: '3_month', label: '۳ ماهه', days: 90 },
                  { key: '6_month', label: '۶ ماهه', days: 180 },
                  { key: '12_month', label: '۱۲ ماهه', days: 365 }
                ].map(plan => (
                  <button
                    key={plan.key}
                    onClick={() => { setManualPlanType(plan.key); setManualDuration(plan.days); }}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '10px',
                      border: manualPlanType === plan.key ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                      background: manualPlanType === plan.key ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                      color: manualPlanType === plan.key ? '#34d399' : 'rgba(255,255,255,0.6)',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {plan.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Days */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>مدت اشتراک (روز)</label>
              <input
                type="number"
                value={manualDuration}
                onChange={(e) => setManualDuration(parseInt(e.target.value) || 30)}
                min="1"
                max="3650"
                placeholder="تعداد روز..."
                style={inputStyle}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>مبلغ (دلار)</label>
              <input
                type="text"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="مثلاً 50 — خالی بگذارید برای رایگان"
                style={inputStyle}
              />
            </div>

            {/* Exclude from Revenue Checkbox */}
            <div
              onClick={() => setManualExcludeRevenue(!manualExcludeRevenue)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: manualExcludeRevenue ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255,255,255,0.03)',
                border: manualExcludeRevenue ? '1px solid rgba(249, 115, 22, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                marginBottom: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                border: manualExcludeRevenue ? '2px solid #f97316' : '2px solid rgba(255,255,255,0.25)',
                background: manualExcludeRevenue ? '#f97316' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0
              }}>
                {manualExcludeRevenue && <CheckCircle size={14} style={{ color: 'white' }} />}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: manualExcludeRevenue ? '#fb923c' : 'rgba(255,255,255,0.7)' }}>
                  جزو درآمد حساب نشود
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  مثلاً کاربران داخلی تیم
                </div>
              </div>
            </div>

            {/* Admin Note */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>یادداشت (اختیاری)</label>
              <textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="توضیحات..."
                rows={3}
                style={textareaStyle}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowManualModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button onClick={handleManualSubscription} disabled={processing} style={{
                ...confirmBtnStyle,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                opacity: processing ? 0.6 : 1
              }}>
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={18} /><span>ایجاد اشتراک</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
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
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

// ====== SUB-COMPONENTS ======

const BottomSheet = ({ children, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 9999,
      paddingBottom: '0'
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        maxWidth: '500px',
        maxHeight: '95vh',
        background: 'rgba(20, 20, 35, 0.98)',
        backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px 24px 0 0',
        overflow: 'auto',
        direction: 'rtl',
        animation: 'slideUp 0.3s ease',
        paddingBottom: '100px'
      }}
    >
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  }}>
    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white' }}>{title}</h3>
    <button
      onClick={onClose}
      style={{
        width: '34px', height: '34px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.08)', border: 'none',
        color: 'rgba(255,255,255,0.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
      }}
    >
      <X size={18} />
    </button>
  </div>
);

const UserSummary = ({ sub }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '12px',
    marginBottom: '20px'
  }}>
    <div style={{
      width: '44px', height: '44px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: '600', fontSize: '18px', color: 'white', flexShrink: 0
    }}>
      {sub.userName?.charAt(0) || 'U'}
    </div>
    <div>
      <div style={{ fontSize: '15px', fontWeight: '600', color: 'white', marginBottom: '2px' }}>
        {sub.userName}
      </div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
        {sub.userEmail}
      </div>
    </div>
  </div>
);

const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      background: `${color}20`, display: 'flex',
      alignItems: 'center', justifyContent: 'center', color, flexShrink: 0
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
    </div>
  </div>
);

const ActionBtn = ({ icon, color, bg, label, onClick, style = {} }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: label ? '7px 12px' : '7px 10px',
      borderRadius: '8px',
      background: bg,
      border: 'none',
      color: color,
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'all 0.2s',
      ...style
    }}
  >
    {icon}
    {label && <span>{label}</span>}
  </button>
);

const ModalActionBtn = ({ icon, label, gradient, bg, borderColor, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 16px',
      borderRadius: '10px',
      background: gradient || bg,
      border: borderColor ? `1px solid ${borderColor}` : 'none',
      color: color || 'white',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: 'inherit',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const DetailRow = ({ icon, label, value, badge }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <div style={{ color: 'rgba(255,255,255,0.35)' }}>{icon}</div>
    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', minWidth: '70px' }}>{label}:</span>
    {badge ? (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '6px',
        background: badge.bg, color: badge.color,
        fontSize: '12px', fontWeight: '600'
      }}>
        {badge.icon} {badge.label}
      </span>
    ) : (
      <span style={{ color: 'white', fontSize: '13px', fontWeight: '500', wordBreak: 'break-all' }}>{value || '-'}</span>
    )}
  </div>
);

// ====== STYLES ======

const labelStyle = {
  display: 'block',
  color: 'rgba(255,255,255,0.6)',
  fontSize: '13px',
  marginBottom: '8px'
};

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box'
};

const textareaStyle = {
  width: '100%',
  padding: '11px 14px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '10px',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'inherit',
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box'
};

const cancelBtnStyle = {
  flex: 1,
  padding: '12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'inherit',
  cursor: 'pointer'
};

const confirmBtnStyle = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px',
  border: 'none',
  borderRadius: '10px',
  color: 'white',
  fontSize: '14px',
  fontWeight: '600',
  fontFamily: 'inherit',
  cursor: 'pointer'
};

export default AdminSubscriptionManager;