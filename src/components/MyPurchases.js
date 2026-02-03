import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  ShoppingBag,
  Crown,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Eye,
  X,
  DollarSign,
  Headphones
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const MyPurchases = ({ onBack, onNavigateToSubscription, onNavigateToSupport }) => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchPurchases = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const token = authService.getToken();
      const response = await fetch(`${API_URL}/subscription/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPurchases(data.purchases || data || []);
      }
    } catch (error) {
      console.error('Error fetching purchases:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPlanType = (planType) => {
    if (!planType) return '';
    const match = planType.match(/(\d+)/);
    if (match) {
      const months = match[1];
      const persianNumbers = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹','۱۰','۱۱','۱۲'];
      const persianMonth = parseInt(months) <= 12 ? persianNumbers[parseInt(months)] : months;
      return `${persianMonth} ماهه`;
    }
    if (planType === 'monthly') return '۱ ماهه';
    return planType;
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'pending':
        return { icon: <Clock size={16} />, label: 'در انتظار بررسی', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
      case 'approved':
        return { icon: <CheckCircle size={16} />, label: 'تایید شده', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
      case 'rejected':
        return { icon: <XCircle size={16} />, label: 'رد شده', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
      default:
        return { icon: <Clock size={16} />, label: status, color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)' };
    }
  };

  const displayPurchases = (() => {
    const result = [];
    
    // 1. All active subscriptions (approved + not expired)
    const actives = purchases.filter(p => {
      if (p.status !== 'approved') return false;
      const expiresAt = p.expiresAt || p.expires_at;
      if (!expiresAt) return false;
      return new Date(expiresAt) > new Date();
    });
    result.push(...actives);
    
    // 2. Last pending (only one)
    const lastPending = purchases.find(p => p.status === 'pending');
    if (lastPending) result.push(lastPending);
    
    // 3. Last rejected (only one)
    const lastRejected = purchases.find(p => p.status === 'rejected');
    if (lastRejected) result.push(lastRejected);
    
    return result;
  })();

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">خریدهای من</span>
            <span className="chat-header-status">تاریخچه اشتراک‌ها</span>
          </div>
          <div className="chat-avatar-glass" style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))'
          }}>
            <ShoppingBag size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="alpha-content-area" style={{ direction: 'rtl' }}>

        {/* Header Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            اشتراک‌های فعال
          </span>
          {/* Refresh Button */}
          <button
            onClick={() => fetchPurchases(true)}
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Purchases List */}
        {loading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: '12px'
          }}>
            <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال بارگذاری...</span>
          </div>
        ) : displayPurchases.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            gap: '16px'
          }}>
            <ShoppingBag size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
              اشتراک فعالی ندارید
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayPurchases.map((purchase) => {
              const expiresAt = purchase.expiresAt || purchase.expires_at;
              const isActive = purchase.status === 'approved' && expiresAt && new Date(expiresAt) > new Date();
              const daysRemaining = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt) - new Date()) / 86400000)) : 0;
              const statusInfo = getStatusInfo(purchase.status);

              // Card border color based on status
              const borderColor = purchase.status === 'approved' 
                ? 'rgba(34, 197, 94, 0.15)' 
                : purchase.status === 'pending' 
                  ? 'rgba(249, 115, 22, 0.15)' 
                  : 'rgba(239, 68, 68, 0.15)';

              // Icon color
              const iconBg = purchase.status === 'approved'
                ? 'rgba(34, 197, 94, 0.15)'
                : purchase.status === 'pending'
                  ? 'rgba(249, 115, 22, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)';
              const iconColor = purchase.status === 'approved'
                ? '#22c55e'
                : purchase.status === 'pending'
                  ? '#f97316'
                  : '#ef4444';

              return (
                <div
                  key={purchase.id}
                  onClick={() => {
                    setSelectedPurchase(purchase);
                    setShowDetail(true);
                  }}
                  style={{
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Icon */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: iconColor,
                      flexShrink: 0
                    }}>
                      <Crown size={20} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '4px'
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                          اشتراک {formatPlanType(purchase.planType || purchase.plan_type)}
                        </span>
                        {isActive ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: daysRemaining <= 3 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            color: daysRemaining <= 3 ? '#ef4444' : '#22c55e',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            <Calendar size={12} />
                            {daysRemaining} روز مانده
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: statusInfo.bg,
                            color: statusInfo.color,
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        )}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.5)'
                      }}>
                        <span>
                          {isActive 
                            ? `انقضا: ${formatDate(expiresAt)}` 
                            : formatDate(purchase.createdAt || purchase.created_at)
                          }
                        </span>
                        <span style={{ fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                          {purchase.amount}$
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedPurchase && (
        <div
          onClick={() => setShowDetail(false)}
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
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white' }}>
                جزئیات خرید
              </h3>
              <button
                onClick={() => setShowDetail(false)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  color: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: 'calc(85vh - 70px)' }}>
              {/* Status Banner */}
              {(() => {
                const statusInfo = getStatusInfo(selectedPurchase.status);
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '14px 16px',
                    background: statusInfo.bg,
                    borderRadius: '14px',
                    marginBottom: '20px'
                  }}>
                    <div style={{ color: statusInfo.color }}>{statusInfo.icon}</div>
                    <span style={{ color: statusInfo.color, fontSize: '14px', fontWeight: '600' }}>
                      {statusInfo.label}
                    </span>
                  </div>
                );
              })()}

              {/* Detail Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <DetailRow icon={<Crown size={18} />} label="نوع اشتراک" value={formatPlanType(selectedPurchase.planType || selectedPurchase.plan_type)} />
                <DetailRow icon={<DollarSign size={18} />} label="مبلغ" value={`${selectedPurchase.amount}$`} />
                <DetailRow icon={<Calendar size={18} />} label="تاریخ درخواست" value={formatDate(selectedPurchase.createdAt || selectedPurchase.created_at)} />
                
                {selectedPurchase.status === 'approved' && (
                  <>
                    <DetailRow icon={<Calendar size={18} />} label="شروع اشتراک" value={formatDate(selectedPurchase.startedAt || selectedPurchase.started_at)} />
                    <DetailRow icon={<Calendar size={18} />} label="انقضا" value={formatDate(selectedPurchase.expiresAt || selectedPurchase.expires_at)} />
                  </>
                )}

                {selectedPurchase.status === 'rejected' && selectedPurchase.adminNote && (
                  <div style={{
                    padding: '14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    marginTop: '4px'
                  }}>
                    <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                      دلیل رد:
                    </span>
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                      {selectedPurchase.adminNote || selectedPurchase.admin_note}
                    </span>
                  </div>
                )}

                {selectedPurchase.txHash && (
                  <DetailRow icon={<Eye size={18} />} label="هش تراکنش" value={selectedPurchase.txHash || selectedPurchase.tx_hash} />
                )}
              </div>

              {/* Actions */}
              {selectedPurchase.status === 'rejected' && (
                <button
                  onClick={() => {
                    setShowDetail(false);
                    onNavigateToSupport?.();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '14px',
                    marginTop: '20px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    color: '#f87171',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'inherit',
                    cursor: 'pointer'
                  }}
                >
                  <Headphones size={18} />
                  <span>پشتیبانی</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
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
      `}</style>
    </div>
  );
};

const DetailRow = ({ icon, label, value }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }}>
    <div style={{ color: 'rgba(255,255,255,0.4)' }}>{icon}</div>
    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', minWidth: '90px' }}>{label}:</span>
    <span style={{ color: 'white', fontSize: '13px', fontWeight: '500', wordBreak: 'break-all' }}>{value}</span>
  </div>
);

export default MyPurchases;