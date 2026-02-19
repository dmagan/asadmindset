import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  FlaskConical,
  Plus,
  Edit3,
  Trash2,
  X,
  RefreshCw,
  Calendar,
  Loader2,
  CheckCircle,
  Clock,
  Rocket,
  GraduationCap,
  Brain,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const PRODUCTS = [
  { id: 'alpha_channel', label: 'کانال آلفا',  icon: <Rocket size={15} />,       color: '#8b5cf6', available: true  },
  { id: 'academy',       label: 'آکادمی',       icon: <GraduationCap size={15} />, color: '#3b82f6', available: false },
  { id: 'ai_chat',       label: 'هوش مصنوعی',  icon: <Brain size={15} />,         color: '#10b981', available: false },
];

const PRESET_DURATIONS = [
  { label: '۱ هفته',  days: 7  },
  { label: '۲ هفته', days: 14 },
  { label: '۳ هفته', days: 21 },
  { label: '۱ ماه',  days: 30 },
];

const EMPTY_FORM = {
  name:        '',
  product:     'alpha_channel',
  durationDays: 7,
  customDays:  '',
  usePreset:   true,
  validFrom:   '',
  validUntil:  '',
  userRegFrom:  '',
  userRegUntil: '',
  maxUsers:    '',
  nameManuallyEdited: false,
};

const AdminTrialManager = ({ onBack, isMainAdmin }) => {
  const [plans,      setPlans]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [processing, setProcessing] = useState(false);

  const [showCreateModal,   setShowCreateModal]   = useState(false);
  const [showEditModal,     setShowEditModal]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPlan,      setSelectedPlan]      = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [summaryStats, setSummaryStats] = useState({ total: 0, active: 0 });

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authService.getToken()}`,
  });

  const getPlanStatus = (plan) => {
    if (!plan.isActive)
      return { key: 'inactive', label: 'غیرفعال', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
    const now = new Date();
    if (plan.validFrom && new Date(plan.validFrom) > now)
      return { key: 'pending', label: 'شروع نشده', color: '#6366f1', bg: 'rgba(99,102,241,0.12)' };
    if (plan.validUntil && new Date(plan.validUntil) < now)
      return { key: 'expired', label: 'منقضی', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
    return { key: 'active', label: 'فعال', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  };

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/trial/plans`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPlans(data || []);
        const active = (data || []).filter(p => getPlanStatus(p).key === 'active');
        setSummaryStats({ total: (data || []).length, active: active.length });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const resetForm = () => setForm(EMPTY_FORM);

  const getFormDays = (f = form) => {
    if (!f.usePreset && f.customDays && parseInt(f.customDays) > 0)
      return parseInt(f.customDays);
    return f.durationDays || 7;
  };

  const openEdit = (plan) => {
    const preset = PRESET_DURATIONS.find(p => p.days === plan.durationDays);
    setForm({
      name:        plan.name || '',
      product:     plan.product || 'alpha_channel',
      durationDays: plan.durationDays || 7,
      customDays:  preset ? '' : String(plan.durationDays),
      usePreset:   !!preset,
      validFrom:   plan.validFrom   ? plan.validFrom.slice(0, 10)   : '',
      validUntil:  plan.validUntil  ? plan.validUntil.slice(0, 10)  : '',
      userRegFrom:  plan.userRegFrom  ? plan.userRegFrom.slice(0, 10)  : '',
      userRegUntil: plan.userRegUntil ? plan.userRegUntil.slice(0, 10) : '',
      maxUsers:    plan.maxUsers != null ? String(plan.maxUsers) : '',
      nameManuallyEdited: true,
    });
    setSelectedPlan(plan);
    setShowEditModal(true);
  };

  // ── CREATE ──
  const handleCreate = async () => {
    if (!form.name.trim()) { alert('نام پلن را وارد کنید'); return; }
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/admin/trial/plans`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({
          name:           form.name.trim(),
          product:        form.product,
          duration_days:  getFormDays(),
          max_users:      form.maxUsers !== '' ? parseInt(form.maxUsers) : null,
          valid_from:     form.validFrom    || null,
          valid_until:    form.validUntil   || null,
          user_reg_from:  form.userRegFrom  || null,
          user_reg_until: form.userRegUntil || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.message || 'خطا در ایجاد'); return; }
      setShowCreateModal(false);
      resetForm();
      loadPlans();
    } catch { alert('خطا در ایجاد پلن'); }
    finally { setProcessing(false); }
  };

  // ── UPDATE ──
  const handleUpdate = async () => {
    if (!selectedPlan) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/admin/trial/plans/${selectedPlan.id}`, {
        method: 'PUT', headers: getHeaders(),
        body: JSON.stringify({
          name:           form.name.trim(),
          product:        form.product,
          duration_days:  getFormDays(),
          max_users:      form.maxUsers !== '' ? parseInt(form.maxUsers) : null,
          valid_from:     form.validFrom    || null,
          valid_until:    form.validUntil   || null,
          user_reg_from:  form.userRegFrom  || null,
          user_reg_until: form.userRegUntil || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.message || 'خطا'); return; }
      setShowEditModal(false);
      setSelectedPlan(null);
      resetForm();
      loadPlans();
    } catch { alert('خطا در ویرایش'); }
    finally { setProcessing(false); }
  };

  // ── TOGGLE ──
  const handleToggle = async (plan) => {
    try {
      await fetch(`${API_URL}/admin/trial/plans/${plan.id}`, {
        method: 'PUT', headers: getHeaders(),
        body: JSON.stringify({ is_active: !plan.isActive }),
      });
      loadPlans();
    } catch { alert('خطا در تغییر وضعیت'); }
  };

  // ── DELETE ──
  const handleDelete = async () => {
    if (!selectedPlan) return;
    setProcessing(true);
    try {
      await fetch(`${API_URL}/admin/trial/plans/${selectedPlan.id}`, {
        method: 'DELETE', headers: getHeaders(),
      });
      setShowDeleteConfirm(false);
      setSelectedPlan(null);
      loadPlans();
    } catch { alert('خطا در حذف'); }
    finally { setProcessing(false); }
  };

  const getProductInfo = (id) => PRODUCTS.find(p => p.id === id) || PRODUCTS[0];

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">پلن‌های تریال</span>
            <span className="chat-header-status">
              {summaryStats.total} پلن • {summaryStats.active} فعال
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={loadPlans} style={iconBtnStyle}>
              <RefreshCw size={17} />
            </button>
            {isMainAdmin && (
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '0 14px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: 'white', fontSize: '13px',
                  fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <Plus size={16} /><span>پلن جدید</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="alpha-content-area" style={{ direction: 'rtl' }}>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          <StatCard icon={<FlaskConical size={17} />} value={summaryStats.total} label="کل پلن‌ها"  color="#10b981" />
          <StatCard icon={<CheckCircle size={17} />}  value={summaryStats.active} label="فعال"      color="#8b5cf6" />
        </div>

        {/* Read-only notice for non-admins */}
        {!isMainAdmin && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 14px', marginBottom: '16px',
            background: 'rgba(107,114,128,0.08)', borderRadius: '12px',
            border: '1px solid rgba(107,114,128,0.2)',
          }}>
            <span style={{ fontSize: '16px' }}>🔒</span>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.5' }}>
              فقط مشاهده — برای ویرایش با مدیر اصلی تماس بگیرید
            </span>
          </div>
        )}

        {/* Plan list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#10b981' }} />
          </div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <FlaskConical size={40} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: '0 0 16px' }}>
              هنوز پلن تریالی ایجاد نشده
            </p>
            {isMainAdmin && (
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                style={{
                  padding: '10px 20px', borderRadius: '10px',
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10b981', fontSize: '13px', fontWeight: '600',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                + ایجاد اولین پلن
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {plans.map(plan => {
              const status  = getPlanStatus(plan);
              const product = getProductInfo(plan.product);
              return (
                <div key={plan.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '14px', padding: '14px',
                }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: `${product.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: product.color, flexShrink: 0,
                      }}>
                        <FlaskConical size={18} />
                      </div>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>
                          {plan.name}
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          marginTop: '3px', fontSize: '12px', color: 'rgba(255,255,255,0.4)',
                        }}>
                          <span style={{ color: product.color, display: 'flex', alignItems: 'center' }}>
                            {product.icon}
                          </span>
                          <span>{product.label}</span>
                          <span>•</span>
                          <Clock size={11} />
                          <span>{plan.durationDays} روز</span>
                        </div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 8px', borderRadius: '6px',
                      background: status.bg, color: status.color,
                      fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
                    }}>
                      {status.label}
                    </span>
                  </div>

                  {/* Date range row — بازه فعال بودن پلن */}
                  {(plan.validFrom || plan.validUntil) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px', color: 'rgba(255,255,255,0.35)',
                      marginBottom: '6px', padding: '6px 10px',
                      background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                    }}>
                      <Calendar size={11} />
                      <span>فعال: {plan.validFrom ? formatDate(plan.validFrom) : 'هم‌اکنون'} تا {plan.validUntil ? formatDate(plan.validUntil) : 'همیشه'}</span>
                    </div>
                  )}

                  {/* بازه کاربران هدف */}
                  {(plan.userRegFrom || plan.userRegUntil) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px', color: 'rgba(165,180,252,0.6)',
                      marginBottom: '6px', padding: '6px 10px',
                      background: 'rgba(99,102,241,0.06)', borderRadius: '8px',
                      border: '1px solid rgba(99,102,241,0.12)',
                    }}>
                      <span>👤</span>
                      <span>ثبت‌نام: {plan.userRegFrom ? formatDate(plan.userRegFrom) : 'از ابتدا'} تا {plan.userRegUntil ? formatDate(plan.userRegUntil) : 'بی‌نهایت'}</span>
                    </div>
                  )}

                  {/* Max Users */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '11px', color: 'rgba(165,180,252,0.6)',
                    marginBottom: '6px', padding: '6px 10px',
                    background: 'rgba(99,102,241,0.06)', borderRadius: '8px',
                    border: '1px solid rgba(99,102,241,0.12)',
                  }}>
                    <span>👥</span>
                    <span>ظرفیت: {plan.maxUsers != null ? `${plan.maxUsers} کاربر` : 'بی‌نهایت'}</span>
                  </div>

                  {/* Actions */}
                  {isMainAdmin && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <ActionBtn
                        icon={<Edit3 size={14} />} label="ویرایش"
                        color="#f59e0b" bg="rgba(245,158,11,0.12)"
                        onClick={() => openEdit(plan)}
                      />
                      {/* Toggle Switch */}
                      <button
                        onClick={() => handleToggle(plan)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '7px',
                          padding: '7px 12px', borderRadius: '8px', border: 'none',
                          background: plan.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {/* Visual toggle track */}
                        <div style={{
                          width: '32px', height: '18px', borderRadius: '9px',
                          background: plan.isActive ? '#10b981' : '#ef4444',
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                        }}>
                          <div style={{
                            position: 'absolute', top: '3px',
                            left: plan.isActive ? '17px' : '3px',
                            width: '12px', height: '12px', borderRadius: '50%',
                            background: 'white', transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: '600',
                          color: plan.isActive ? '#10b981' : '#ef4444',
                        }}>
                          {plan.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </button>
                      <ActionBtn
                        icon={<Trash2 size={14} />}
                        color="#ef4444" bg="rgba(239,68,68,0.10)"
                        onClick={() => { setSelectedPlan(plan); setShowDeleteConfirm(true); }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ CREATE MODAL ══ */}
      {showCreateModal && (
        <BottomSheet onClose={() => setShowCreateModal(false)}>
          <ModalHeader title="پلن تریال جدید" onClose={() => setShowCreateModal(false)} />
          <div style={{ padding: '20px' }}>
            <TrialForm form={form} setForm={setForm} getFormDays={getFormDays} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleCreate} disabled={processing}
                style={{ ...confirmBtnStyle, background: 'linear-gradient(135deg,#10b981,#059669)', opacity: processing ? 0.6 : 1 }}
              >
                {processing
                  ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <><Plus size={18} /><span>ایجاد پلن</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ══ EDIT MODAL ══ */}
      {showEditModal && selectedPlan && (
        <BottomSheet onClose={() => setShowEditModal(false)}>
          <ModalHeader title={`ویرایش: ${selectedPlan.name}`} onClose={() => setShowEditModal(false)} />
          <div style={{ padding: '20px' }}>
            <TrialForm form={form} setForm={setForm} getFormDays={getFormDays} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowEditModal(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleUpdate} disabled={processing}
                style={{ ...confirmBtnStyle, background: 'linear-gradient(135deg,#f59e0b,#d97706)', opacity: processing ? 0.6 : 1 }}
              >
                {processing
                  ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <><Edit3 size={18} /><span>بروزرسانی</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ══ DELETE CONFIRM ══ */}
      {showDeleteConfirm && selectedPlan && (
        <BottomSheet onClose={() => setShowDeleteConfirm(false)}>
          <ModalHeader title="حذف پلن تریال" onClose={() => setShowDeleteConfirm(false)} />
          <div style={{ padding: '20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', background: 'rgba(239,68,68,0.08)',
              borderRadius: '12px', marginBottom: '20px',
            }}>
              <AlertCircle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                  آیا از حذف مطمئن هستید؟
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                  پلن <span style={{ color: '#ef4444' }}>{selectedPlan.name}</span> برای همیشه حذف می‌شود.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={cancelBtnStyle}>انصراف</button>
              <button
                onClick={handleDelete} disabled={processing}
                style={{ ...confirmBtnStyle, background: 'linear-gradient(135deg,#ef4444,#dc2626)', opacity: processing ? 0.6 : 1 }}
              >
                {processing
                  ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  : <><Trash2 size={18} /><span>حذف</span></>}
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .alpha-content-area {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 20px 16px; padding-bottom: 120px;
          -webkit-overflow-scrolling: touch;
        }
        .alpha-content-area::-webkit-scrollbar { display: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
        input[type="date"] { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
};

// ══ TRIAL FORM (used in create & edit modals) ══
const TrialForm = ({ form, setForm, getFormDays }) => {
  const upd = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const PRODUCT_LABELS = {
    alpha_channel: 'کانال آلفا',
    academy: 'آکادمی',
    ai_chat: 'هوش مصنوعی',
  };

  const getDurationLabel = (days) => {
    if (days === 7)  return '۱ هفته‌ای';
    if (days === 14) return '۲ هفته‌ای';
    if (days === 21) return '۳ هفته‌ای';
    if (days === 30) return '۱ ماهه';
    return `${days} روزه`;
  };

  // آیا نام auto-generated هست (کاربر دستی تغییر نداده)
  const isAutoName = (name, days, product) => {
    if (!name) return true;
    const productLabel = PRODUCT_LABELS[product] || product;
    return name === `پلن ${getDurationLabel(days)} ${productLabel}`;
  };

  const autoSetName = (days, product) => {
    setForm(f => {
      if (!f.nameManuallyEdited) {
        const productLabel = PRODUCT_LABELS[product] || product;
        return { ...f, name: `پلن ${getDurationLabel(days)} ${productLabel}` };
      }
      return f;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Name */}
      <div>
        <label style={labelStyle}>نام پلن *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value, nameManuallyEdited: !!e.target.value }))}
          placeholder="مثال: تریال آلفا ۷ روزه"
          style={inputStyle}
        />
      </div>

      {/* Product selector */}
      <div>
        <label style={labelStyle}>محصول</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {PRODUCTS.map(p => {
            const isSelected = form.product === p.id && p.available;
            return (
              <button
                key={p.id}
                onClick={() => {
                  if (!p.available) return;
                  setForm(f => {
                    const days = getFormDays(f);
                    const productLabel = PRODUCT_LABELS[p.id] || p.id;
                    const newName = f.nameManuallyEdited ? f.name : `پلن ${getDurationLabel(days)} ${productLabel}`;
                    return { ...f, product: p.id, name: newName };
                  });
                }}
                disabled={!p.available}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: isSelected ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? p.color + '50' : 'rgba(255,255,255,0.07)'}`,
                  cursor: p.available ? 'pointer' : 'not-allowed',
                  opacity: p.available ? 1 : 0.4,
                  fontFamily: 'inherit', width: '100%', textAlign: 'right',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: isSelected ? `${p.color}25` : 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isSelected ? p.color : 'rgba(255,255,255,0.3)', flexShrink: 0,
                }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: isSelected ? 'white' : 'rgba(255,255,255,0.45)' }}>
                    {p.label}
                  </div>
                  {!p.available && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>
                      Coming Soon
                    </div>
                  )}
                </div>
                {/* Radio circle */}
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${isSelected ? p.color : 'rgba(255,255,255,0.15)'}`,
                  background: isSelected ? p.color : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label style={labelStyle}>مدت تریال</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
          {PRESET_DURATIONS.map(p => {
            const isActive = form.usePreset && form.durationDays === p.days;
            return (
              <button
                key={p.days}
                onClick={() => {
                  const days = p.days;
                  setForm(f => {
                    const productLabel = PRODUCT_LABELS[f.product] || f.product;
                    const newName = f.nameManuallyEdited ? f.name : `پلن ${getDurationLabel(days)} ${productLabel}`;
                    return { ...f, usePreset: true, durationDays: days, customDays: '', name: newName };
                  });
                }}
                style={{
                  padding: '11px', borderRadius: '10px', textAlign: 'center',
                  background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isActive ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  color: isActive ? '#10b981' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px', fontWeight: '700', fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        {/* Number input + Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={form.customDays}
              onChange={e => {
              const days = parseInt(e.target.value) || 1;
              setForm(f => {
                const productLabel = PRODUCT_LABELS[f.product] || f.product;
                const newName = f.nameManuallyEdited ? f.name : `پلن ${getDurationLabel(days)} ${productLabel}`;
                return { ...f, customDays: e.target.value, usePreset: false, name: newName };
              });
            }}
              placeholder="یا تعداد روز دلخواه..."
              min="1"
              max="365"
              style={{
                ...inputStyle, textAlign: 'left', direction: 'ltr', paddingLeft: '46px',
                border: !form.usePreset && form.customDays
                  ? '1px solid rgba(16,185,129,0.4)'
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            />
            <span style={{
              position: 'absolute', left: '14px', top: '50%',
              transform: 'translateY(-50%)', fontSize: '12px', color: 'rgba(255,255,255,0.3)',
            }}>روز</span>
          </div>

          {/* Slider */}
          <div style={{ padding: '2px 0' }}>
            <input
              type="range"
              min="1"
              max="365"
              value={form.customDays ? parseInt(form.customDays) : (form.usePreset ? form.durationDays : 7)}
              onChange={e => {
              const days = parseInt(e.target.value) || 1;
              setForm(f => {
                const productLabel = PRODUCT_LABELS[f.product] || f.product;
                const newName = f.nameManuallyEdited ? f.name : `پلن ${getDurationLabel(days)} ${productLabel}`;
                return { ...f, customDays: e.target.value, usePreset: false, name: newName };
              });
            }}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#10b981', direction: 'ltr' }}
            />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '2px',
              direction: 'ltr',
            }}>
              <span>1</span><span>30</span><span>90</span><span>180</span><span>365</span>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: '2px', padding: '8px 12px', textAlign: 'center',
          background: 'rgba(16,185,129,0.07)', borderRadius: '8px',
          border: '1px solid rgba(16,185,129,0.15)',
          fontSize: '12px', color: '#6ee7b7', fontWeight: '600',
        }}>
          مدت: {getFormDays()} روز
        </div>
      </div>

      {/* Date range — بازه فعال بودن پلن */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>شروع فعالیت پلن</label>
          <input
            type="date" value={form.validFrom}
            onChange={e => upd('validFrom', e.target.value)}
            style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
          />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>خالی = همین الان</div>
        </div>
        <div>
          <label style={labelStyle}>پایان فعالیت پلن</label>
          <input
            type="date" value={form.validUntil}
            onChange={e => upd('validUntil', e.target.value)}
            style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
          />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>خالی = همیشه</div>
        </div>
      </div>

      {/* بازه ثبت‌نام کاربران */}
      <div style={{
        padding: '14px', borderRadius: '12px',
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.15)',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#a5b4fc', marginBottom: '4px' }}>
          محدوده کاربران هدف
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px', lineHeight: '1.5' }}>
          این پلن فقط برای کاربرانی اعمال می‌شود که در بازه زمانی زیر ثبت‌نام کرده باشند.
          هر دو خالی = همه کاربران جدید
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>ثبت‌نام از تاریخ</label>
            <input
              type="date" value={form.userRegFrom}
              onChange={e => upd('userRegFrom', e.target.value)}
              style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
            />
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>خالی = از ابتدا</div>
          </div>
          <div>
            <label style={labelStyle}>ثبت‌نام تا تاریخ</label>
            <input
              type="date" value={form.userRegUntil}
              onChange={e => upd('userRegUntil', e.target.value)}
              style={{ ...inputStyle, textAlign: 'left', direction: 'ltr', fontSize: '13px', minHeight: '44px' }}
            />
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>خالی = بی‌نهایت</div>
          </div>
        </div>

        {/* حداکثر کاربران */}
        <div>
          <label style={labelStyle}>حداکثر تعداد کاربران</label>
          <input
            type="number" min="1" value={form.maxUsers}
            onChange={e => upd('maxUsers', e.target.value)}
            placeholder="خالی = بی‌نهایت"
            style={{ ...inputStyle, textAlign: 'left', direction: 'ltr' }}
          />
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '3px' }}>
            خالی = بی‌نهایت کاربر می‌تونن از این پلن استفاده کنن
          </div>
        </div>
      </div>
    </div>
  );
};

// ══ SUB-COMPONENTS ══
const BottomSheet = ({ children, onClose }) => (
  <div onClick={onClose} style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0)',
    backdropFilter: 'blur(8px)', display: 'flex',
    alignItems: 'flex-end', justifyContent: 'center', zIndex: 9999,
  }}>
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: '500px', maxHeight: '95vh',
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(40px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '24px 24px 0 0', overflow: 'auto',
      direction: 'rtl', animation: 'slideUp 0.3s ease', paddingBottom: '100px',
    }}>
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  }}>
    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'white' }}>{title}</h3>
    <button onClick={onClose} style={{
      width: '34px', height: '34px', borderRadius: '10px',
      background: 'rgba(255,255,255,0.08)', border: 'none',
      color: 'rgba(255,255,255,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    }}>
      <X size={18} />
    </button>
  </div>
);

const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    padding: '14px', background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px',
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      background: `${color}20`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', color, flexShrink: 0,
    }}>{icon}</div>
    <div>
      <div style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>{label}</div>
    </div>
  </div>
);

const ActionBtn = ({ icon, label, color, bg, onClick }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: label ? '7px 12px' : '7px 10px',
    borderRadius: '8px', background: bg, border: 'none',
    color, fontSize: '12px', fontWeight: '600',
    fontFamily: 'inherit', cursor: 'pointer',
  }}>
    {icon}{label && <span>{label}</span>}
  </button>
);

// ══ STYLES ══
const iconBtnStyle = {
  width: '36px', height: '36px', borderRadius: '10px',
  background: 'rgba(255,255,255,0.06)', border: 'none',
  color: 'rgba(255,255,255,0.6)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

const labelStyle = {
  display: 'block', color: 'rgba(255,255,255,0.6)',
  fontSize: '13px', marginBottom: '8px',
};

const inputStyle = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px', color: 'white', fontSize: '14px',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const cancelBtnStyle = {
  flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
  color: 'white', fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer',
};

const confirmBtnStyle = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: '8px', padding: '12px', border: 'none', borderRadius: '10px',
  color: 'white', fontSize: '14px', fontWeight: '600',
  fontFamily: 'inherit', cursor: 'pointer',
};

export default AdminTrialManager;