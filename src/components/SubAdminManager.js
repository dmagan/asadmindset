import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  UserPlus,
  Shield,
  ShieldCheck,
  ShieldClose,
  Search,
  Loader2,
  X,
  Check,
  Trash2,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Mail,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  Headphones,
  Radio,
  CreditCard,
  Tag,
  FileText,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const PERMISSION_META = {
  support:       { label: 'پشتیبانی', icon: Headphones, color: '#3b82f6', desc: 'پاسخ به تیکت‌های پشتیبانی' },
  channel:       { label: 'کانال آلفا', icon: Radio, color: '#8b5cf6', desc: 'ارسال پیام و مدیریت کانال' },
  subscriptions: { label: 'اشتراک‌ها', icon: CreditCard, color: '#10b981', desc: 'تایید و رد درخواست‌های اشتراک' },
  discounts:     { label: 'تخفیف‌ها', icon: Tag, color: '#f59e0b', desc: 'ساخت و مدیریت کدهای تخفیف' },
  manual_order:  { label: 'ثبت سفارش', icon: FileText, color: '#ec4899', desc: 'ثبت سفارش دستی برای کاربران' },
  view_only:     { label: 'فقط مشاهده', icon: Eye, color: '#6b7280', desc: 'مشاهده بدون امکان تغییر' },
};

const ACTION_LABELS = {
  add_sub_admin: 'افزودن کاربر ارشد',
  update_sub_admin: 'ویرایش دسترسی',
  activate_sub_admin: 'فعال‌سازی',
  deactivate_sub_admin: 'غیرفعال‌سازی',
  delete_sub_admin: 'حذف کاربر ارشد',
};

const SubAdminManager = ({ onBack }) => {
  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('list'); // list | logs
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [addPermissions, setAddPermissions] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  // Edit modal
  const [editItem, setEditItem] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);
  const [editLabel, setEditLabel] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Logs
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);

  // Expanded card
  const [expandedId, setExpandedId] = useState(null);

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authService.getToken()}`
  });

  // ─── Load Data ──────────────────────────────────────────

  const loadSubAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/sub-admins`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSubAdmins(data);
      }
    } catch (e) {
      console.error('Error loading sub-admins:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    try {
      setLogsLoading(true);
      const res = await fetch(`${API_URL}/sub-admins/logs?page=${page}&per_page=20`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setLogsTotalPages(data.pages);
        setLogsPage(data.page);
      }
    } catch (e) {
      console.error('Error loading logs:', e);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubAdmins();
  }, [loadSubAdmins]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(1);
    }
  }, [activeTab, loadLogs]);

  // ─── Add Sub-Admin ─────────────────────────────────────

  const handleAdd = async () => {
    if (!addEmail.trim()) {
      setAddError('ایمیل را وارد کنید');
      return;
    }
    if (addPermissions.length === 0) {
      setAddError('حداقل یک دسترسی انتخاب کنید');
      return;
    }

    setAddLoading(true);
    setAddError('');

    try {
      const res = await fetch(`${API_URL}/sub-admins`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          email: addEmail.trim(),
          permissions: addPermissions,
          label: addLabel.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSubAdmins(prev => [{
          id: data.id,
          user_id: data.user_id,
          email: data.email,
          name: data.name,
          permissions: data.permissions,
          is_active: true,
          label: data.label,
          created_at: new Date().toISOString(),
        }, ...prev]);
        setShowAddForm(false);
        setAddEmail('');
        setAddLabel('');
        setAddPermissions([]);
      } else {
        setAddError(data.message || 'خطایی رخ داد');
      }
    } catch (e) {
      setAddError('خطا در ارتباط با سرور');
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Edit ───────────────────────────────────────────────

  const openEdit = (item) => {
    setEditItem(item);
    setEditPermissions([...item.permissions]);
    setEditLabel(item.label || '');
  };

  const handleEdit = async () => {
    if (!editItem) return;
    if (editPermissions.length === 0) return;

    setEditLoading(true);
    try {
      const res = await fetch(`${API_URL}/sub-admins/${editItem.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          permissions: editPermissions,
          label: editLabel.trim(),
        }),
      });

      if (res.ok) {
        setSubAdmins(prev => prev.map(sa =>
          sa.id === editItem.id
            ? { ...sa, permissions: editPermissions, label: editLabel.trim() }
            : sa
        ));
        setEditItem(null);
      }
    } catch (e) {
      console.error('Edit error:', e);
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Toggle Active ─────────────────────────────────────

  const handleToggle = async (item) => {
    try {
      const res = await fetch(`${API_URL}/sub-admins/${item.id}/toggle`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (res.ok) {
        const data = await res.json();
        setSubAdmins(prev => prev.map(sa =>
          sa.id === item.id ? { ...sa, is_active: data.is_active } : sa
        ));
      }
    } catch (e) {
      console.error('Toggle error:', e);
    }
  };

  // ─── Delete ─────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`${API_URL}/sub-admins/${deleteItem.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (res.ok) {
        setSubAdmins(prev => prev.filter(sa => sa.id !== deleteItem.id));
        setDeleteItem(null);
      }
    } catch (e) {
      console.error('Delete error:', e);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Toggle permission in array ─────────────────────────

  const togglePermission = (perms, setPerms, key) => {
    if (perms.includes(key)) {
      setPerms(perms.filter(p => p !== key));
    } else {
      setPerms([...perms, key]);
    }
  };

  // ─── Filter ─────────────────────────────────────────────

  const filteredAdmins = subAdmins.filter(sa => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (sa.email && sa.email.toLowerCase().includes(q)) ||
      (sa.name && sa.name.toLowerCase().includes(q)) ||
      (sa.label && sa.label.toLowerCase().includes(q))
    );
  });

  // ─── Permission Chip ───────────────────────────────────

  const PermissionChip = ({ permKey, small = false }) => {
    const meta = PERMISSION_META[permKey];
    if (!meta) return null;
    const Icon = meta.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: small ? '4px' : '6px',
        padding: small ? '3px 8px' : '5px 10px',
        background: `${meta.color}20`,
        border: `1px solid ${meta.color}40`,
        borderRadius: '8px',
        fontSize: small ? '10px' : '12px',
        fontWeight: '600',
        color: meta.color,
        whiteSpace: 'nowrap',
      }}>
        <Icon size={small ? 10 : 13} />
        {meta.label}
      </span>
    );
  };

  // ─── Permission Selector ────────────────────────────────

  const PermissionSelector = ({ selected, setSelected }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Object.entries(PERMISSION_META).map(([key, meta]) => {
        const isOn = selected.includes(key);
        const Icon = meta.icon;
        return (
          <div
            key={key}
            onClick={() => togglePermission(selected, setSelected, key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 14px',
              background: isOn ? `${meta.color}15` : 'rgba(255,255,255,0.03)',
              border: isOn ? `1.5px solid ${meta.color}50` : '1.5px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: isOn ? `${meta.color}25` : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isOn ? meta.color : 'rgba(255,255,255,0.3)',
              transition: 'all 0.2s', flexShrink: 0,
            }}>
              <Icon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '14px', fontWeight: '600',
                color: isOn ? 'white' : 'rgba(255,255,255,0.7)',
              }}>{meta.label}</div>
              <div style={{
                fontSize: '11px',
                color: isOn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
              }}>{meta.desc}</div>
            </div>
            <div style={{
              width: '22px', height: '22px', borderRadius: '6px',
              background: isOn ? meta.color : 'rgba(255,255,255,0.08)',
              border: isOn ? 'none' : '1.5px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', flexShrink: 0,
            }}>
              {isOn && <Check size={13} color="white" />}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ─── Render Header ──────────────────────────────────────

  const renderHeader = () => (
    <div className="chat-header-glass">
      <button className="chat-back-btn" onClick={onBack}>
        <ArrowLeft size={22} />
      </button>
      <div className="chat-header-info">
        <div className="chat-header-text">
          <span className="chat-header-title">مدیریت کاربران ارشد</span>
          <span className="chat-header-status">
            {subAdmins.filter(s => s.is_active).length} کاربر فعال
          </span>
        </div>
        <div className="chat-avatar-glass" style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.2))',
          color: '#a78bfa',
        }}>
          <Shield size={22} />
        </div>
      </div>
    </div>
  );

  // ─── Render Tabs ────────────────────────────────────────

  const renderTabs = () => (
    <div style={{
      display: 'flex', gap: '8px', marginBottom: '14px',
    }}>
      {[
        { key: 'list', label: 'کاربران ارشد', icon: Shield },
        { key: 'logs', label: 'لاگ فعالیت', icon: Activity },
      ].map(tab => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '8px', padding: '11px 14px',
              background: isActive ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.04)',
              border: isActive ? '1.5px solid rgba(139, 92, 246, 0.5)' : '1.5px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', cursor: 'pointer',
              color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.5)',
              fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <Icon size={16} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  // ─── Render Add Form ────────────────────────────────────

  const renderAddForm = () => {
    if (!showAddForm) return null;

    return (
      <div style={styles.overlay} onClick={() => setShowAddForm(false)}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <span style={styles.modalTitle}>افزودن کاربر ارشد</span>
            <button style={styles.closeBtn} onClick={() => setShowAddForm(false)}>
              <X size={20} />
            </button>
          </div>

          <div style={styles.modalBody}>
            {addError && (
              <div style={styles.errorBox}>
                <AlertCircle size={16} />
                <span>{addError}</span>
              </div>
            )}

            {/* Email */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>ایمیل کاربر</label>
              <div style={styles.inputWrapper}>
                <Mail size={18} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  style={styles.inputField}
                />
              </div>
            </div>

            {/* Label */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>عنوان / نقش (اختیاری)</label>
              <div style={styles.inputWrapper}>
                <User size={18} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="مثلا: پشتیبان ارشد"
                  value={addLabel}
                  onChange={e => setAddLabel(e.target.value)}
                  style={styles.inputField}
                />
              </div>
            </div>

            {/* Permissions */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>دسترسی‌ها</label>
              <PermissionSelector selected={addPermissions} setSelected={setAddPermissions} />
            </div>

            <button
              onClick={handleAdd}
              disabled={addLoading}
              style={{
                ...styles.primaryBtn,
                opacity: addLoading ? 0.6 : 1,
              }}
            >
              {addLoading ? (
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>افزودن</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Edit Modal ──────────────────────────────────

  const renderEditModal = () => {
    if (!editItem) return null;

    return (
      <div style={styles.overlay} onClick={() => setEditItem(null)}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <div style={styles.modalHeader}>
            <span style={styles.modalTitle}>ویرایش دسترسی</span>
            <button style={styles.closeBtn} onClick={() => setEditItem(null)}>
              <X size={20} />
            </button>
          </div>

          <div style={styles.modalBody}>
            {/* User Info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px', background: 'rgba(255,255,255,0.04)',
              borderRadius: '12px', marginBottom: '16px',
            }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a78bfa', flexShrink: 0,
              }}>
                <User size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>
                  {editItem.name}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', direction: 'ltr', textAlign: 'left' }}>
                  {editItem.email}
                </div>
              </div>
            </div>

            {/* Label */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>عنوان / نقش</label>
              <div style={styles.inputWrapper}>
                <User size={18} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="مثلا: پشتیبان ارشد"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  style={styles.inputField}
                />
              </div>
            </div>

            {/* Permissions */}
            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>دسترسی‌ها</label>
              <PermissionSelector selected={editPermissions} setSelected={setEditPermissions} />
            </div>

            <button
              onClick={handleEdit}
              disabled={editLoading || editPermissions.length === 0}
              style={{
                ...styles.primaryBtn,
                opacity: (editLoading || editPermissions.length === 0) ? 0.6 : 1,
              }}
            >
              {editLoading ? (
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <>
                  <Check size={18} />
                  <span>ذخیره تغییرات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Delete Confirm ──────────────────────────────

  const renderDeleteConfirm = () => {
    if (!deleteItem) return null;

    return (
      <div style={styles.overlay} onClick={() => setDeleteItem(null)}>
        <div style={{ ...styles.modal, maxHeight: 'auto' }} onClick={e => e.stopPropagation()}>
          <div style={styles.modalBody}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '16px', padding: '10px 0',
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ef4444',
              }}>
                <Trash2 size={26} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>
                  حذف کاربر ارشد
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
                  آیا از حذف <span style={{ color: '#f87171', fontWeight: '600' }}>{deleteItem.name || deleteItem.email}</span> مطمئن هستید؟
                  <br />تمام دسترسی‌های این کاربر حذف خواهد شد.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                <button
                  onClick={() => setDeleteItem(null)}
                  style={styles.cancelBtn}
                >
                  انصراف
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  style={{
                    ...styles.dangerBtn,
                    opacity: deleteLoading ? 0.6 : 1,
                  }}
                >
                  {deleteLoading ? (
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    'حذف'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Sub-Admin Card ──────────────────────────────

  const renderCard = (item) => {
    const isExpanded = expandedId === item.id;

    return (
      <div
        key={item.id}
        style={{
          background: item.is_active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
          border: item.is_active
            ? '1px solid rgba(255,255,255,0.1)'
            : '1px solid rgba(255,255,255,0.05)',
          borderRadius: '16px',
          overflow: 'hidden',
          opacity: item.is_active ? 1 : 0.6,
          transition: 'all 0.25s',
        }}
      >
        {/* Card Header */}
        <div
          onClick={() => setExpandedId(isExpanded ? null : item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', cursor: 'pointer',
          }}
        >
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: item.is_active
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.15))'
              : 'rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: item.is_active ? '#a78bfa' : 'rgba(255,255,255,0.25)',
            flexShrink: 0,
          }}>
            {item.is_active ? <ShieldCheck size={20} /> : <ShieldClose size={20} />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '14px', fontWeight: '600', color: 'white',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.name || '—'}
              </span>
              {item.label && (
                <span style={{
                  fontSize: '10px', padding: '2px 7px',
                  background: 'rgba(139, 92, 246, 0.2)',
                  borderRadius: '6px', color: '#a78bfa',
                  fontWeight: '600', whiteSpace: 'nowrap',
                }}>
                  {item.label}
                </span>
              )}
            </div>
            <div style={{
              fontSize: '12px', color: 'rgba(255,255,255,0.4)',
              direction: 'ltr', textAlign: 'left',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.email}
            </div>
          </div>

          <div style={{
            color: 'rgba(255,255,255,0.3)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }}>
            <ChevronDown size={20} />
          </div>
        </div>

        {/* Permissions Row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px',
          padding: '0 16px 12px 16px',
        }}>
          {(item.permissions || []).map(p => (
            <PermissionChip key={p} permKey={p} small />
          ))}
        </div>

        {/* Expanded Actions */}
        {isExpanded && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: '8px',
          }}>
            <button onClick={() => openEdit(item)} style={styles.actionBtn}>
              <Edit3 size={15} />
              <span>ویرایش</span>
            </button>
            <button onClick={() => handleToggle(item)} style={{
              ...styles.actionBtn,
              background: item.is_active ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              borderColor: item.is_active ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)',
              color: item.is_active ? '#fbbf24' : '#10b981',
            }}>
              {item.is_active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              <span>{item.is_active ? 'غیرفعال' : 'فعال'}</span>
            </button>
            <button onClick={() => setDeleteItem(item)} style={{
              ...styles.actionBtn,
              background: 'rgba(239, 68, 68, 0.12)',
              borderColor: 'rgba(239, 68, 68, 0.25)',
              color: '#f87171',
            }}>
              <Trash2 size={15} />
              <span>حذف</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Render List Tab ────────────────────────────────────

  const renderListTab = () => (
    <>
      {/* Search + Add Button */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
        }}>
          <Search size={18} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="جستجو..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'white', fontSize: '14px', fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => { setShowAddForm(true); setAddError(''); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '6px', padding: '10px 16px',
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1.5px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '12px', cursor: 'pointer',
            color: '#a78bfa', fontSize: '13px', fontWeight: '600',
            fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          <UserPlus size={18} />
          افزودن
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={styles.emptyState}>
          <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>در حال بارگذاری...</span>
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div style={styles.emptyState}>
          <Shield size={44} style={{ color: 'rgba(255,255,255,0.12)' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
            {searchQuery ? 'نتیجه‌ای یافت نشد' : 'هنوز کاربر ارشدی اضافه نشده'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredAdmins.map(renderCard)}
        </div>
      )}
    </>
  );

  // ─── Render Logs Tab ────────────────────────────────────

  const renderLogsTab = () => (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
          آخرین فعالیت‌ها
        </span>
        <button
          onClick={() => loadLogs(logsPage)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            fontSize: '12px', fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={14} />
          بروزرسانی
        </button>
      </div>

      {logsLoading ? (
        <div style={styles.emptyState}>
          <Loader2 size={28} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : logs.length === 0 ? (
        <div style={styles.emptyState}>
          <Activity size={44} style={{ color: 'rgba(255,255,255,0.12)' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>هنوز فعالیتی ثبت نشده</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map(log => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
              }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a78bfa', flexShrink: 0, marginTop: '2px',
                }}>
                  <Activity size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: 'white', marginBottom: '4px' }}>
                    {ACTION_LABELS[log.action] || log.action}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginBottom: '4px' }}>
                    توسط: {log.user_name}
                    {log.details?.email && (
                      <span style={{ direction: 'ltr', display: 'inline' }}> — {log.details.email}</span>
                    )}
                    {log.details?.target_user && !log.details?.email && (
                      <span> — کاربر #{log.details.target_user}</span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontSize: '11px', color: 'rgba(255,255,255,0.3)',
                  }}>
                    <Clock size={11} />
                    {new Date(log.created_at).toLocaleDateString('en-US')}
                    {' '}
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {logsTotalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: '16px', marginTop: '16px',
            }}>
              <button
                onClick={() => loadLogs(logsPage - 1)}
                disabled={logsPage <= 1}
                style={{
                  ...styles.pageBtn,
                  opacity: logsPage <= 1 ? 0.3 : 1,
                }}
              >
                <ChevronRight size={18} />
              </button>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                {logsPage} / {logsTotalPages}
              </span>
              <button
                onClick={() => loadLogs(logsPage + 1)}
                disabled={logsPage >= logsTotalPages}
                style={{
                  ...styles.pageBtn,
                  opacity: logsPage >= logsTotalPages ? 0.3 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );

  // ─── Main Render ────────────────────────────────────────

  return (
    <div className="support-chat-container">
      {renderHeader()}

      <div className="alpha-content-area" style={{ direction: 'rtl', paddingTop: '20px' }}>
        {renderTabs()}
        {activeTab === 'list' && renderListTab()}
        {activeTab === 'logs' && renderLogsTab()}
      </div>

      {/* Modals */}
      {renderAddForm()}
      {renderEditModal()}
      {renderDeleteConfirm()}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ─── Styles ─────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '0',
  },

  modal: {
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    background: 'rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px 20px 0 0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },

  modalTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'white',
  },

  closeBtn: {
    width: '34px', height: '34px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },

  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    direction: 'rtl',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  fieldLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },

  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
  },

  inputField: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    direction: 'ltr',
    textAlign: 'left',
  },

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    color: '#f87171',
    fontSize: '13px',
  },

  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    border: 'none',
    borderRadius: '14px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 6px 20px rgba(139, 92, 246, 0.3)',
    transition: 'all 0.2s',
    marginTop: '4px',
  },

  cancelBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },

  dangerBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '12px',
    color: '#f87171',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 10px',
    background: 'rgba(139, 92, 246, 0.12)',
    border: '1px solid rgba(139, 92, 246, 0.25)',
    borderRadius: '10px',
    color: '#a78bfa',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '50px 20px',
    gap: '16px',
  },

  pageBtn: {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
};

export default SubAdminManager;