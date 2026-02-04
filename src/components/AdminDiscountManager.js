import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Tag,
  Plus,
  Edit3,
  Trash2,
  X,
  RefreshCw,
  Search,
  Calendar,
  User,
  DollarSign,
  Loader2,
  CheckCircle,
  Percent,
  Copy,
  BarChart3,
  Clock,
  Users,
  ToggleLeft,
  ToggleRight,
  Hash,
  Gift,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const AdminDiscountManager = ({ onBack }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCode, setSelectedCode] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Create/Edit form
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState('percent');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMaxUses, setFormMaxUses] = useState('0');
  const [formPerUserLimit, setFormPerUserLimit] = useState('1');
  const [formMinMonths, setFormMinMonths] = useState('1');
  const [formMaxMonths, setFormMaxMonths] = useState('12');
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Stats
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalCodes: 0,
    activeCodes: 0,
    totalUsage: 0
  });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authService.getToken()}`
  });

  const loadCodes = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = filterActive === 'trashed' ? '?status=trashed' : '';
      const response = await fetch(`${API_URL}/admin/discount-codes${statusParam}`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setCodes(data || []);
        if (filterActive !== 'trashed') {
          const active = data.filter(c => c.isActive);
          const totalUsage = data.reduce((s, c) => s + (c.usedCount || 0), 0);
          setSummaryStats({
            totalCodes: data.length,
            activeCodes: active.length,
            totalUsage
          });
        }
      }
    } catch (error) {
      console.error('Error loading discount codes:', error);
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  // Filter & Search
  const filteredCodes = codes.filter(c => {
    if (filterActive === 'active' && !c.isActive) return false;
    if (filterActive === 'inactive' && c.isActive) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const resetForm = () => {
    setFormCode('');
    setFormDescription('');
    setFormDiscountType('percent');
    setFormDiscountValue('');
    setFormMaxUses('0');
    setFormPerUserLimit('1');
    setFormMinMonths('1');
    setFormMaxMonths('12');
    setFormValidFrom('');
    setFormValidUntil('');
    setFormIsActive(true);
  };

  const openEdit = (code) => {
    setSelectedCode(code);
    setFormDescription(code.description || '');
    setFormDiscountType(code.discountType || 'percent');
    setFormDiscountValue(String(code.discountValue || ''));
    setFormMaxUses(String(code.maxUses || 0));
    setFormPerUserLimit(String(code.perUserLimit || 1));
    setFormMinMonths(String(code.minMonths || 1));
    setFormMaxMonths(String(code.maxMonths || 12));
    setFormValidFrom(code.validFrom ? code.validFrom.slice(0, 16) : '');
    setFormValidUntil(code.validUntil ? code.validUntil.slice(0, 16) : '');
    setFormIsActive(code.isActive);
    setShowEditModal(true);
  };

  // Create
  const handleCreate = async () => {
    if (!formCode || formCode.length < 3) {
      alert('کد تخفیف باید حداقل ۳ کاراکتر باشد');
      return;
    }
    if (!formDiscountValue || parseFloat(formDiscountValue) <= 0) {
      alert('مقدار تخفیف را وارد کنید');
      return;
    }
    if (formDiscountType === 'percent' && parseFloat(formDiscountValue) > 100) {
      alert('درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد');
      return;
    }
    setProcessing(true);
    try {
      const body = {
        code: formCode.toUpperCase(),
        description: formDescription,
        discount_type: formDiscountType,
        discount_value: parseFloat(formDiscountValue),
        max_uses: parseInt(formMaxUses) || 0,
        per_user_limit: parseInt(formPerUserLimit) || 1,
        min_months: parseInt(formMinMonths) || 1,
        max_months: parseInt(formMaxMonths) || 12,
        valid_from: formValidFrom || null,
        valid_until: formValidUntil || null
      };
      const response = await fetch(`${API_URL}/admin/discount-codes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.message || 'خطا در ایجاد کد تخفیف');
        return;
      }
      setShowCreateModal(false);
      resetForm();
      loadCodes();
    } catch (error) {
      alert('خطا در ایجاد کد تخفیف');
    } finally {
      setProcessing(false);
    }
  };

  // Update
  const handleUpdate = async () => {
    if (!selectedCode) return;
    setProcessing(true);
    try {
      const body = {
        description: formDescription,
        discount_type: formDiscountType,
        discount_value: parseFloat(formDiscountValue),
        max_uses: parseInt(formMaxUses) || 0,
        per_user_limit: parseInt(formPerUserLimit) || 1,
        min_months: parseInt(formMinMonths) || 1,
        max_months: parseInt(formMaxMonths) || 12,
        valid_from: formValidFrom || null,
        valid_until: formValidUntil || null,
        is_active: formIsActive
      };
      const response = await fetch(`${API_URL}/admin/discount-codes/${selectedCode.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const err = await response.json();
        alert(err.message || 'خطا در بروزرسانی');
        return;
      }
      setShowEditModal(false);
      setSelectedCode(null);
      resetForm();
      loadCodes();
    } catch (error) {
      alert('خطا در بروزرسانی');
    } finally {
      setProcessing(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!selectedCode) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/discount-codes/${selectedCode.id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      setShowDeleteConfirm(false);
      setSelectedCode(null);
      loadCodes();
    } catch (error) {
      alert('خطا در حذف');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedCode) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/discount-codes/${selectedCode.id}/restore`, {
        method: 'PUT',
        headers: getHeaders()
      });
      setShowRestoreConfirm(false);
      setSelectedCode(null);
      loadCodes();
    } catch (error) {
      alert('خطا در بازیابی');
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedCode) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/discount-codes/${selectedCode.id}/permanent-delete`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      setShowPermanentDeleteConfirm(false);
      setSelectedCode(null);
      loadCodes();
    } catch (error) {
      alert('خطا در حذف دائمی');
    } finally {
      setProcessing(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (code) => {
    try {
      await fetch(`${API_URL}/admin/discount-codes/${code.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !code.isActive })
      });
      loadCodes();
    } catch (error) {
      alert('خطا در تغییر وضعیت');
    }
  };

  // Load stats
  const openStats = async (code) => {
    setSelectedCode(code);
    setStatsLoading(true);
    setShowStatsModal(true);
    try {
      const response = await fetch(`${API_URL}/admin/discount-codes/${code.id}/stats`, {
        headers: getHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setStatsData(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getCodeStatusInfo = (code) => {
    if (!code.isActive) return { label: 'غیرفعال', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    const now = new Date();
    if (code.validUntil && new Date(code.validUntil) < now) return { label: 'منقضی', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    if (code.validFrom && new Date(code.validFrom) > now) return { label: 'شروع نشده', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
    if (code.maxUses > 0 && code.usedCount >= code.maxUses) return { label: 'تمام شده', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { label: 'فعال', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
  };

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
            <span className="chat-header-title">کدهای تخفیف</span>
            <span className="chat-header-status">
              {summaryStats.totalCodes} کد • {summaryStats.activeCodes} فعال
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={loadCodes} style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              color: 'rgba(255,255,255,0.6)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <RefreshCw size={17} />
            </button>
            <button onClick={() => { resetForm(); setShowCreateModal(true); }} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '0 14px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none', color: 'white', fontSize: '13px',
              fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer'
            }}>
              <Plus size={16} />
              <span>کد جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="alpha-content-area" style={{ direction: 'rtl' }}>
        {/* Summary Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <StatCard icon={<Tag size={17} />} value={summaryStats.totalCodes} label="کل کدها" color="#8b5cf6" />
          <StatCard icon={<CheckCircle size={17} />} value={summaryStats.activeCodes} label="فعال" color="#10b981" />
          <StatCard icon={<Users size={17} />} value={summaryStats.totalUsage} label="کل استفاده" color="#3b82f6" />
          <StatCard icon={<Gift size={17} />} value={codes.filter(c => c.usedCount > 0).length} label="استفاده شده" color="#f59e0b" />
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{
              position: 'absolute', right: '12px', top: '50%',
              transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)'
            }} />
            <input
              type="text"
              placeholder="جستجوی کد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 38px 10px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '10px', color: 'white', fontSize: '13px',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
          {[
            { key: 'all', label: 'همه' },
            { key: 'active', label: 'فعال' },
            { key: 'inactive', label: 'غیرفعال' },
            { key: 'trashed', label: '🗑️ سطل آشغال' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterActive(f.key)}
              style={{
                padding: '7px 14px', borderRadius: '8px',
                background: filterActive === f.key ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                border: filterActive === f.key ? '1px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.06)',
                color: filterActive === f.key ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                fontSize: '12px', fontWeight: '600', fontFamily: 'inherit',
                cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Codes List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6' }} />
          </div>
        ) : filteredCodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Tag size={40} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>کد تخفیفی یافت نشد</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredCodes.map(code => {
              const status = getCodeStatusInfo(code);
              return (
                <div key={code.id} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '14px',
                  padding: '14px',
                  transition: 'all 0.2s'
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: 'rgba(139,92,246,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#a78bfa', flexShrink: 0
                      }}>
                        <Tag size={17} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '15px', fontWeight: '700', color: 'white',
                            letterSpacing: '1px', fontFamily: 'monospace'
                          }}>
                            {code.code}
                          </span>
                          <button onClick={() => copyCode(code.code)} style={{
                            background: 'none', border: 'none', padding: '2px',
                            color: 'rgba(255,255,255,0.3)', cursor: 'pointer'
                          }}>
                            <Copy size={13} />
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                          {code.discountType === 'percent'
                            ? `${code.discountValue}% تخفیف`
                            : `$${code.discountValue} تخفیف ثابت`
                          }
                          {code.description ? ` • ${code.description}` : ''}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 8px', borderRadius: '6px',
                      background: status.bg, color: status.color,
                      fontSize: '11px', fontWeight: '600'
                    }}>
                      {status.label}
                    </span>
                  </div>

                  {/* Info row */}
                  <div style={{
                    display: 'flex', gap: '12px', flexWrap: 'wrap',
                    marginBottom: '10px', fontSize: '11px', color: 'rgba(255,255,255,0.45)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} />
                      {code.usedCount}{code.maxUses > 0 ? `/${code.maxUses}` : ''} استفاده
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={12} />
                      {code.perUserLimit > 0 ? `هر کاربر ${code.perUserLimit} بار` : 'نامحدود'}
                    </span>
                    {code.validUntil && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        تا {formatDate(code.validUntil)}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {code.minMonths}-{code.maxMonths} ماهه
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(code.status || 'active') !== 'trashed' ? (
                      <>
                        <ActionBtn
                          icon={<BarChart3 size={14} />}
                          label="آمار"
                          color="#3b82f6"
                          bg="rgba(59,130,246,0.12)"
                          onClick={() => openStats(code)}
                        />
                        <ActionBtn
                          icon={<Edit3 size={14} />}
                          label="ویرایش"
                          color="#f59e0b"
                          bg="rgba(245,158,11,0.12)"
                          onClick={() => openEdit(code)}
                        />
                        <ActionBtn
                          icon={code.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          label={code.isActive ? 'غیرفعال' : 'فعال'}
                          color={code.isActive ? '#ef4444' : '#10b981'}
                          bg={code.isActive ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'}
                          onClick={() => handleToggleActive(code)}
                        />
                        <ActionBtn
                          icon={<Trash2 size={14} />}
                          color="#ef4444"
                          bg="rgba(239,68,68,0.12)"
                          onClick={() => { setSelectedCode(code); setShowDeleteConfirm(true); }}
                        />
                      </>
                    ) : (
                      <>
                        <ActionBtn
                          icon={<RefreshCw size={14} />}
                          label="بازیابی"
                          color="#10b981"
                          bg="rgba(16,185,129,0.12)"
                          onClick={() => { setSelectedCode(code); setShowRestoreConfirm(true); }}
                        />
                        <ActionBtn
                          icon={<Trash2 size={14} />}
                          label="حذف دائمی"
                          color="#ef4444"
                          bg="rgba(239,68,68,0.12)"
                          onClick={() => { setSelectedCode(code); setShowPermanentDeleteConfirm(true); }}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ====== CREATE MODAL ====== */}
      {showCreateModal && (
        <BottomSheet onClose={() => setShowCreateModal(false)}>
          <ModalHeader title="ایجاد کد تخفیف" onClose={() => setShowCreateModal(false)} />
          <div style={{ padding: '20px' }}>
            <DiscountForm
              formCode={formCode} setFormCode={setFormCode}
              formDescription={formDescription} setFormDescription={setFormDescription}
              formDiscountType={formDiscountType} setFormDiscountType={setFormDiscountType}
              formDiscountValue={formDiscountValue} setFormDiscountValue={setFormDiscountValue}
              formMaxUses={formMaxUses} setFormMaxUses={setFormMaxUses}
              formPerUserLimit={formPerUserLimit} setFormPerUserLimit={setFormPerUserLimit}
              formMinMonths={formMinMonths} setFormMinMonths={setFormMinMonths}
              formMaxMonths={formMaxMonths} setFormMaxMonths={setFormMaxMonths}
              formValidFrom={formValidFrom} setFormValidFrom={setFormValidFrom}
              formValidUntil={formValidUntil} setFormValidUntil={setFormValidUntil}
              formIsActive={formIsActive} setFormIsActive={setFormIsActive}
              showCodeField={true}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleCreate}
                disabled={processing}
                style={{
                  ...confirmBtnStyle,
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  opacity: processing ? 0.6 : 1
                }}
              >
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Plus size={18} /><span>ایجاد کد</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ====== EDIT MODAL ====== */}
      {showEditModal && selectedCode && (
        <BottomSheet onClose={() => setShowEditModal(false)}>
          <ModalHeader title={`ویرایش ${selectedCode.code}`} onClose={() => setShowEditModal(false)} />
          <div style={{ padding: '20px' }}>
            <DiscountForm
              formCode={selectedCode.code} setFormCode={() => {}}
              formDescription={formDescription} setFormDescription={setFormDescription}
              formDiscountType={formDiscountType} setFormDiscountType={setFormDiscountType}
              formDiscountValue={formDiscountValue} setFormDiscountValue={setFormDiscountValue}
              formMaxUses={formMaxUses} setFormMaxUses={setFormMaxUses}
              formPerUserLimit={formPerUserLimit} setFormPerUserLimit={setFormPerUserLimit}
              formMinMonths={formMinMonths} setFormMinMonths={setFormMinMonths}
              formMaxMonths={formMaxMonths} setFormMaxMonths={setFormMaxMonths}
              formValidFrom={formValidFrom} setFormValidFrom={setFormValidFrom}
              formValidUntil={formValidUntil} setFormValidUntil={setFormValidUntil}
              formIsActive={formIsActive} setFormIsActive={setFormIsActive}
              showCodeField={false}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowEditModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleUpdate}
                disabled={processing}
                style={{
                  ...confirmBtnStyle,
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  opacity: processing ? 0.6 : 1
                }}
              >
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Edit3 size={18} /><span>بروزرسانی</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ====== STATS MODAL ====== */}
      {showStatsModal && selectedCode && (
        <BottomSheet onClose={() => { setShowStatsModal(false); setStatsData(null); }}>
          <ModalHeader title={`آمار ${selectedCode.code}`} onClose={() => { setShowStatsModal(false); setStatsData(null); }} />
          <div style={{ padding: '20px' }}>
            {statsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6' }} />
              </div>
            ) : statsData ? (
              <>
                {/* Code info */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px', background: 'rgba(139,92,246,0.08)',
                  borderRadius: '12px', marginBottom: '16px'
                }}>
                  <Tag size={20} style={{ color: '#a78bfa' }} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: 'white', fontFamily: 'monospace' }}>
                      {selectedCode.code}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                      {selectedCode.discountType === 'percent' ? `${selectedCode.discountValue}%` : `$${selectedCode.discountValue}`} تخفیف
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                  <StatCard icon={<Hash size={17} />} value={statsData.totalUses} label="کل استفاده" color="#8b5cf6" />
                  <StatCard icon={<Users size={17} />} value={statsData.uniqueUsers} label="کاربران یکتا" color="#3b82f6" />
                  <StatCard icon={<Gift size={17} />} value={`$${statsData.totalDiscount?.toFixed(1) || 0}`} label="تخفیف داده شده" color="#ef4444" />
                  <StatCard icon={<TrendingUp size={17} />} value={`$${statsData.totalRevenue?.toFixed(1) || 0}`} label="درآمد با تخفیف" color="#10b981" />
                </div>

                {/* Capacity bar */}
                {statsData.totalUses > 0 && selectedCode.maxUses > 0 && (
                  <div style={{
                    padding: '12px', background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px', marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>مصرف ظرفیت</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'white' }}>
                        {statsData.totalUses}/{selectedCode.maxUses}
                      </span>
                    </div>
                    <div style={{
                      height: '6px', background: 'rgba(255,255,255,0.08)',
                      borderRadius: '3px', overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(100, (statsData.totalUses / selectedCode.maxUses) * 100)}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                        borderRadius: '3px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                )}

                {/* Recent usage */}
                <div style={{ marginTop: '4px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '12px' }}>
                    آخرین استفاده‌ها
                  </h4>
                  {statsData.recentUsage && statsData.recentUsage.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {statsData.recentUsage.map((u, i) => (
                        <div key={i} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', background: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'white' }}>
                              {u.userName || 'کاربر'}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                              {u.userEmail}
                            </div>
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>
                              -${u.discountAmount?.toFixed(1)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                              {formatDate(u.usedAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                      هنوز استفاده‌ای ثبت نشده
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>
                خطا در بارگذاری آمار
              </div>
            )}
          </div>
        </BottomSheet>
      )}

      {/* ====== DELETE CONFIRM (Trash) ====== */}
      {showDeleteConfirm && selectedCode && (
        <BottomSheet onClose={() => setShowDeleteConfirm(false)}>
          <ModalHeader title="حذف کد تخفیف" onClose={() => setShowDeleteConfirm(false)} />
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', background: 'rgba(239,68,68,0.08)',
              borderRadius: '12px', marginBottom: '20px'
            }}>
              <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                  آیا از حذف مطمئن هستید؟
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  کد <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>{selectedCode.code}</span> به سطل آشغال منتقل خواهد شد.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleDelete}
                disabled={processing}
                style={{
                  ...confirmBtnStyle,
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  opacity: processing ? 0.6 : 1
                }}
              >
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={18} /><span>حذف</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ====== RESTORE CONFIRM ====== */}
      {showRestoreConfirm && selectedCode && (
        <BottomSheet onClose={() => setShowRestoreConfirm(false)}>
          <ModalHeader title="بازیابی کد تخفیف" onClose={() => setShowRestoreConfirm(false)} />
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', background: 'rgba(16,185,129,0.08)',
              borderRadius: '12px', marginBottom: '20px'
            }}>
              <CheckCircle size={22} style={{ color: '#10b981', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                  بازیابی کد تخفیف
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  کد <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{selectedCode.code}</span> بازیابی و فعال خواهد شد.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowRestoreConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleRestore}
                disabled={processing}
                style={{
                  ...confirmBtnStyle,
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  opacity: processing ? 0.6 : 1
                }}
              >
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><RefreshCw size={18} /><span>بازیابی</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ====== PERMANENT DELETE CONFIRM ====== */}
      {showPermanentDeleteConfirm && selectedCode && (
        <BottomSheet onClose={() => setShowPermanentDeleteConfirm(false)}>
          <ModalHeader title="حذف دائمی" onClose={() => setShowPermanentDeleteConfirm(false)} />
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', background: 'rgba(239,68,68,0.12)',
              borderRadius: '12px', marginBottom: '20px'
            }}>
              <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444', marginBottom: '4px' }}>
                  ⚠️ حذف دائمی
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  کد <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>{selectedCode.code}</span> و تمام سوابق استفاده آن برای همیشه حذف خواهد شد. این عمل قابل بازگشت نیست.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowPermanentDeleteConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handlePermanentDelete}
                disabled={processing}
                style={{
                  ...confirmBtnStyle,
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  opacity: processing ? 0.6 : 1
                }}
              >
                {processing ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Trash2 size={18} /><span>حذف دائمی</span></>}
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
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
        input[type="date"] {
          -webkit-appearance: none;
          appearance: none;
        }
      `}</style>
    </div>
  );
};

// ====== DISCOUNT FORM ======
const DiscountForm = ({
  formCode, setFormCode,
  formDescription, setFormDescription,
  formDiscountType, setFormDiscountType,
  formDiscountValue, setFormDiscountValue,
  formMaxUses, setFormMaxUses,
  formPerUserLimit, setFormPerUserLimit,
  formMinMonths, setFormMinMonths,
  formMaxMonths, setFormMaxMonths,
  formValidFrom, setFormValidFrom,
  formValidUntil, setFormValidUntil,
  formIsActive, setFormIsActive,
  showCodeField
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    {/* Code */}
    {showCodeField && (
      <div>
        <label style={labelStyle}>کد تخفیف *</label>
        <input
          type="text"
          value={formCode}
          onChange={e => setFormCode(e.target.value.toUpperCase())}
          placeholder="مثال: SAVE20"
          style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '2px', textAlign: 'left', direction: 'ltr' }}
        />
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
          حداقل ۳ کاراکتر • به صورت خودکار به حروف بزرگ تبدیل می‌شود
        </div>
      </div>
    )}

    {/* Description */}
    <div>
      <label style={labelStyle}>توضیحات</label>
      <input
        type="text"
        value={formDescription}
        onChange={e => setFormDescription(e.target.value)}
        placeholder="توضیح کوتاه..."
        style={inputStyle}
      />
    </div>

    {/* Discount Type & Value */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div>
        <label style={labelStyle}>نوع تخفیف</label>
        <div style={{ display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setFormDiscountType('percent')}
            style={{
              flex: 1, padding: '10px', border: 'none',
              background: formDiscountType === 'percent' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: formDiscountType === 'percent' ? '#a78bfa' : 'rgba(255,255,255,0.5)',
              fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '4px'
            }}
          >
            <Percent size={14} /> درصدی
          </button>
          <button
            onClick={() => setFormDiscountType('fixed')}
            style={{
              flex: 1, padding: '10px', border: 'none',
              borderRight: '1px solid rgba(255,255,255,0.1)',
              background: formDiscountType === 'fixed' ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
              color: formDiscountType === 'fixed' ? '#a78bfa' : 'rgba(255,255,255,0.5)',
              fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '4px'
            }}
          >
            <DollarSign size={14} /> مبلغ ثابت
          </button>
        </div>
      </div>
      <div>
        <label style={labelStyle}>مقدار تخفیف *</label>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            value={formDiscountValue}
            onChange={e => setFormDiscountValue(e.target.value)}
            placeholder={formDiscountType === 'percent' ? '۱ تا ۱۰۰' : 'مبلغ'}
            style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', paddingLeft: '40px' }}
          />
          <span style={{
            position: 'absolute', left: '12px', top: '50%',
            transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)',
            fontSize: '13px'
          }}>
            {formDiscountType === 'percent' ? '%' : '$'}
          </span>
        </div>
      </div>
    </div>

    {/* Usage limits */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div>
        <label style={labelStyle}>حداکثر استفاده کل</label>
        <input
          type="number"
          value={formMaxUses}
          onChange={e => setFormMaxUses(e.target.value)}
          placeholder="۰ = نامحدود"
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr' }}
        />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
          ۰ = نامحدود
        </div>
      </div>
      <div>
        <label style={labelStyle}>محدودیت هر کاربر</label>
        <input
          type="number"
          value={formPerUserLimit}
          onChange={e => setFormPerUserLimit(e.target.value)}
          placeholder="۱"
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr' }}
        />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
          ۰ = نامحدود
        </div>
      </div>
    </div>

    {/* Month range */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div>
        <label style={labelStyle}>حداقل ماه اشتراک</label>
        <input
          type="number"
          value={formMinMonths}
          onChange={e => setFormMinMonths(e.target.value)}
          min="1" max="12"
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr' }}
        />
      </div>
      <div>
        <label style={labelStyle}>حداکثر ماه اشتراک</label>
        <input
          type="number"
          value={formMaxMonths}
          onChange={e => setFormMaxMonths(e.target.value)}
          min="1" max="12"
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr' }}
        />
      </div>
    </div>

    {/* Date range */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <div>
        <label style={labelStyle}>شروع اعتبار</label>
        <input
          type="date"
          value={formValidFrom}
          onChange={e => setFormValidFrom(e.target.value)}
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
        />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
          خالی = همین الان
        </div>
      </div>
      <div>
        <label style={labelStyle}>پایان اعتبار</label>
        <input
          type="date"
          value={formValidUntil}
          onChange={e => setFormValidUntil(e.target.value)}
          style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
        />
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
          خالی = بدون محدودیت
        </div>
      </div>
    </div>

    {/* Active toggle (edit only) */}
    {!showCodeField && (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px', background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>وضعیت کد</span>
        <button
          onClick={() => setFormIsActive(!formIsActive)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px',
            background: formIsActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: 'none', color: formIsActive ? '#10b981' : '#ef4444',
            fontSize: '12px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer'
          }}
        >
          {formIsActive ? <><ToggleRight size={16} /> فعال</> : <><ToggleLeft size={16} /> غیرفعال</>}
        </button>
      </div>
    )}
  </div>
);

// ====== SUB-COMPONENTS ======

const BottomSheet = ({ children, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
      justifyContent: 'center', zIndex: 9999
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', maxWidth: '500px', maxHeight: '95vh',
        background: 'rgba(20, 20, 35, 0.98)',
        backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px 24px 0 0',
        overflow: 'auto', direction: 'rtl',
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
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)'
  }}>
    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white' }}>{title}</h3>
    <button onClick={onClose} style={{
      width: '34px', height: '34px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.08)', border: 'none',
      color: 'rgba(255,255,255,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
    }}>
      <X size={18} />
    </button>
  </div>
);

const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '14px',
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
      <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
    </div>
  </div>
);

const ActionBtn = ({ icon, color, bg, label, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: label ? '7px 12px' : '7px 10px',
    borderRadius: '8px', background: bg, border: 'none',
    color, fontSize: '12px', fontWeight: '600',
    fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s'
  }}>
    {icon}
    {label && <span>{label}</span>}
  </button>
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

export default AdminDiscountManager;