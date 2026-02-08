import React, { useEffect, useState, useRef } from 'react';
import { 
  Check,
  Crown,
  Star,
  ArrowLeft,
  Copy,
  Upload,
  X,
  Loader,
  CheckCircle,
  ExternalLink,
  Clipboard,
  Clock,
  XCircle,
  Headphones
} from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from './Toast';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PRICE_PER_MONTH = 25;

// آدرس کیف پول برای هر شبکه
const WALLET_ADDRESSES = {
  TRC20: 'TRJ8KcHydFr3UDytiYmXiBPc1d4df5zGf6',
  Ethereum: 'f0c232e8b0424a1c832102ce2a206c9fbfdf62e',
  Solana: 'H8Ms4Ls4FxFiSpDsNwALxsDQtoboH4TvYJ5NPLDkWvyN'
};

const SubscriptionPage = ({ onBack, onNavigateToSupport, isRenewal = false, renewedFrom = null }) => {
  const toast = useToast();
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [selectedNetwork, setSelectedNetwork] = useState('TRC20');
  const [txHash, setTxHash] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [discountCode, setDiscountCode] = useState('');
  const [discountResult, setDiscountResult] = useState(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const fileInputRef = useRef(null);
  const txHashInputRef = useRef(null);

  // Fetch subscription status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const token = authService.getToken();
        const response = await fetch(`${API_URL}/subscription/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setSubscriptionStatus(data);
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      } finally {
        setLoadingStatus(false);
      }
    };
    fetchStatus();
  }, []);

  // تبدیل plan_type به متن فارسی
  const formatPlanType = (planType) => {
    if (!planType) return '';
    const match = planType.match(/(\d+)/);
    if (match) {
      const months = match[1];
      const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲'];
      const persianMonth = parseInt(months) <= 12 ? persianNumbers[parseInt(months)] : months;
      return `${persianMonth} ماهه`;
    }
    if (planType === 'monthly') return '۱ ماهه';
    return planType;
  };

  const planOptions = [
    { value: 1, label: '۱ ماهه', subtitle: '1 Month' },
    { value: 3, label: '۳ ماهه', subtitle: '3 Months' },
    { value: 6, label: '۶ ماهه', subtitle: '6 Months' },
    { value: 12, label: '۱ ساله', subtitle: '12 Months' },
  ];

  const networkOptions = [
    { value: 'TRC20', label: 'Tron', subtitle: 'TRC20', color: '#ef4444', textColor: '#ffffff' },
    { value: 'Ethereum', label: 'Ethereum', subtitle: 'ERC20', color: '#627eea' },
    { value: 'Solana', label: 'Solana', subtitle: '', color: '#14f195' },
  ];

  const totalPrice = selectedMonths * PRICE_PER_MONTH;
  const finalPrice = discountResult ? discountResult.finalAmount : totalPrice;
  const currentWalletAddress = WALLET_ADDRESSES[selectedNetwork];

  // Validate discount code
  const validateDiscount = async () => {
    if (!discountCode.trim()) return;
    setValidatingDiscount(true);
    setDiscountResult(null);
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/subscription/validate-discount`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), plan_type: `${selectedMonths}_month`, amount: totalPrice })
      });
      const data = await response.json();
      if (response.ok && data.valid) {
        setDiscountResult(data);
        const msg = data.discountPercent > 0 
          ? `کد تخفیف اعمال شد! ${data.discountPercent}% تخفیف`
          : `کد تخفیف اعمال شد! ${data.discountAmount}$ تخفیف`;
        toast.success(msg);
      } else {
        toast.error(data.message || 'کد تخفیف نامعتبر است');
        setDiscountResult(null);
      }
    } catch (error) {
      toast.error('خطا در بررسی کد تخفیف');
    } finally {
      setValidatingDiscount(false);
    }
  };

  // Reset discount when months change
  useEffect(() => {
    setDiscountResult(null);
  }, [selectedMonths]);

  // فیکس iOS scroll
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }
    return () => {
      if (isMobile) {
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      }
    };
  }, []);

  const copyAddress = () => {
    navigator.clipboard.writeText(currentWalletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('لطفا یک فایل تصویری انتخاب کنید');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم فایل نباید بیشتر از ۵ مگابایت باشد');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const token = authService.getToken();
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setReceiptImage(data.url);
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      toast.error('خطا در آپلود تصویر');
      setReceiptPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    setReceiptImage(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!txHash && !receiptImage) {
      toast.error('لطفا هش تراکنش یا تصویر رسید را وارد کنید');
      return;
    }

    setSubmitting(true);

    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/subscription/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan_type: `${selectedMonths}_month`,
          months: selectedMonths,
          amount: totalPrice,
          payment_proof: receiptImage || '',
          tx_hash: txHash || '',
          network: selectedNetwork,
          discount_code: discountCode.trim() || '',
          is_renewal: isRenewal || (subscriptionStatus?.hasActiveSubscription || false),
          renewed_from: renewedFrom || (subscriptionStatus?.activeSubscription?.id || null)
        })
      });

      const data = await response.json();

      if (response.ok) {
        const isRenewing = isRenewal || subscriptionStatus?.hasActiveSubscription;
        toast.success(isRenewing 
          ? 'درخواست تمدید شما ثبت شد و در حال بررسی است' 
          : 'درخواست شما ثبت شد و در حال بررسی است'
        );
        setTxHash('');
        setReceiptImage(null);
        setReceiptPreview(null);
        setDiscountCode('');
        setDiscountResult(null);
      } else {
        throw new Error(data.message || 'خطا در ثبت درخواست');
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNetworkInfo = networkOptions.find(n => n.value === selectedNetwork);

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">Alfa Group</span>
            <span className="chat-header-status">Premium Trading</span>
          </div>
          <div className="chat-avatar-glass channel-avatar-img-container">
            <img src="/channel-avatar.jpg" alt="Alfa Group" className="channel-avatar-img" />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="alpha-content-area">
        <div style={{ direction: 'rtl' }}>

          {/* Renewal Banner */}
          {(isRenewal || subscriptionStatus?.hasActiveSubscription) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '14px 16px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '14px',
              marginBottom: '14px'
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#10b981', flexShrink: 0
              }}>
                <Crown size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981', marginBottom: '3px' }}>
                  تمدید اشتراک
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                  مدت جدید به انتهای اشتراک فعلی شما اضافه خواهد شد.
                  {subscriptionStatus?.activeSubscription?.daysRemaining != null && (
                    <span> ({subscriptionStatus.activeSubscription.daysRemaining} روز باقی‌مانده)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pending Status Card */}
          {subscriptionStatus?.hasPendingRequest && (
            <div style={styles.statusCard}>
              <div style={styles.statusIconPending}>
                <Clock size={24} />
              </div>
              <div style={styles.statusContent}>
                <h3 style={styles.statusTitle}>در انتظار تایید</h3>
                <p style={styles.statusText}>
                  شما اشتراک <span style={styles.planTypeBold}>{formatPlanType(subscriptionStatus.pendingRequest?.planType)}</span> خریداری کرده‌اید و در انتظار تایید است.
                </p>
              </div>
            </div>
          )}

          {/* Rejected Status Card */}
          {subscriptionStatus?.lastRejected && !subscriptionStatus?.hasPendingRequest && (
            <div style={styles.statusCardRejected}>
              <div style={styles.statusIconRejected}>
                <XCircle size={24} />
              </div>
              <div style={styles.statusContent}>
                <h3 style={styles.statusTitleRejected}>درخواست رد شد</h3>
                <p style={styles.statusText}>
                  خرید شما توسط کارشناسان رد شده است. علت آن در بخش پشتیبانی برای شما ارسال شده است.
                </p>
                <button 
                  style={styles.supportButton}
                  onClick={onNavigateToSupport}
                >
                  <Headphones size={18} />
                  <span>پشتیبانی</span>
                </button>
              </div>
            </div>
          )}

          {/* Payment Card */}
          <div className="quick-edit-card-glass" style={styles.pricingCard}>
            

            {/* Plan Selector - 4 Cards */}
            <div style={styles.planGrid}>
              {planOptions.map((option) => {
                const isSelected = selectedMonths === option.value;
                return (
                  <div
                    key={option.value}
                    onClick={() => setSelectedMonths(option.value)}
                    style={{
                      ...styles.planCard,
                      border: isSelected 
                        ? '2px solid rgba(16, 185, 129, 0.8)' 
                        : '1.5px solid rgba(255, 255, 255, 0.1)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.05))'
                        : 'rgba(255, 255, 255, 0.04)',
                      boxShadow: isSelected
                        ? '0 4px 20px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(16, 185, 129, 0.15)'
                        : 'none'
                    }}
                  >
                    {isSelected && (
                      <div style={styles.planCheckMark}>
                        <Check size={12} />
                      </div>
                    )}
                    <span style={{
                      ...styles.planCardLabel,
                      color: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.8)'
                    }}>
                      {option.label}
                    </span>
                    <span style={{
                      ...styles.planCardPrice,
                      color: isSelected ? '#10b981' : 'rgba(255, 255, 255, 0.45)'
                    }}>
                      {option.value * PRICE_PER_MONTH}$
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Price */}
            <div style={styles.priceSection}>
              {discountResult ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', textDecoration: 'line-through' }}>{totalPrice}$</span>
                  <span style={styles.priceValue}>{discountResult.finalAmount}$</span>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>
                    {discountResult.discountPercent > 0 ? `${discountResult.discountPercent}% تخفیف` : `${discountResult.discountAmount}$ تخفیف`}
                  </span>
                  {discountResult.description && (
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{discountResult.description}</span>
                  )}
                </div>
              ) : (
                <span style={styles.priceValue}>{totalPrice}$</span>
              )}
            </div>

            {/* Discount Code */}
            <div style={{
              display: 'flex', gap: '8px', marginBottom: '16px'
            }}>
              <input
                type="text"
                placeholder="کد تخفیف"
                value={discountCode}
                onChange={(e) => { setDiscountCode(e.target.value); setDiscountResult(null); }}
                style={{
                  flex: 1, padding: '12px 14px', borderRadius: '12px',
                  border: discountResult ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                  background: discountResult ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: 'white', fontSize: '14px', fontFamily: 'inherit',
                  outline: 'none', direction: 'ltr', textAlign: 'center'
                }}
              />
              <button
                onClick={validateDiscount}
                disabled={validatingDiscount || !discountCode.trim()}
                style={{
                  padding: '12px 20px', borderRadius: '12px', border: 'none',
                  background: discountResult ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)',
                  color: discountResult ? '#10b981' : '#a5b4fc',
                  fontSize: '13px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer',
                  opacity: validatingDiscount || !discountCode.trim() ? 0.5 : 1
                }}
              >
                {validatingDiscount ? '...' : discountResult ? '✓' : 'اعمال'}
              </button>
            </div>

            {/* Network Selector */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontSize: '13px', 
                color: 'rgba(255,255,255,0.6)', 
                marginBottom: '10px',
                textAlign: 'center'
              }}>
                شبکه انتقال را انتخاب کنید
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px'
              }}>
                {networkOptions.map((network) => {
                  const isSelected = selectedNetwork === network.value;
                  return (
                    <div
                      key={network.value}
                      onClick={() => setSelectedNetwork(network.value)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        padding: '14px 8px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        border: isSelected 
                          ? `2px solid ${network.color}` 
                          : '1.5px solid rgba(255, 255, 255, 0.1)',
                        background: isSelected
                          ? `${network.color}20`
                          : 'rgba(255, 255, 255, 0.04)',
                        position: 'relative'
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '-8px',
                          left: '-8px',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: network.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Check size={10} color="white" />
                        </div>
                      )}
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: isSelected ? (network.textColor || network.color) : 'rgba(255, 255, 255, 0.7)'
                      }}>
                        {network.label}
                      </span>
                      {network.subtitle && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '500',
                          color: isSelected ? `${network.textColor || network.color}99` : 'rgba(255, 255, 255, 0.4)'
                        }}>
                          {network.subtitle}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wallet Address */}
            <div style={styles.addressBox} onClick={copyAddress}>
              <div style={styles.copyIcon}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </div>
              <span style={styles.addressText}>{currentWalletAddress}</span>
            </div>

            {/* Tutorial Button */}
            <button style={styles.tutorialButton}>
              <ExternalLink size={16} />
              <span>آموزش پرداخت آسان</span>
            </button>

            {/* TX Hash Input */}
            <div style={styles.inputBox}>
              <input
                ref={txHashInputRef}
                type="text"
                placeholder="هش تراکنش را وارد کنید"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                style={styles.input}
              />
              <button 
                style={styles.pasteBtn}
                onClick={() => {
                  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
                  
                  if (isIOS) {
                    if (txHashInputRef.current) {
                      txHashInputRef.current.focus();
                      txHashInputRef.current.select();
                      document.execCommand('selectAll');
                    }
                  } else {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                      navigator.clipboard.readText().then(text => {
                        setTxHash(text);
                      }).catch(err => {
                        console.error('Paste failed:', err);
                      });
                    }
                  }
                }}
              >
                <Clipboard size={18} />
              </button>
            </div>

            {/* Divider */}
            <div style={styles.divider}>
              <span>یا</span>
            </div>

            {/* Upload Section */}
            {receiptPreview ? (
              <div style={styles.previewContainer}>
                <img src={receiptPreview} alt="رسید" style={styles.previewImage} />
                <button style={styles.removeBtn} onClick={removeImage}>
                  <X size={18} />
                </button>
                {uploading && (
                  <div style={styles.uploadingOverlay}>
                    <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
              </div>
            ) : (
              <div style={styles.uploadBox} onClick={() => fileInputRef.current?.click()}>
                <Upload size={24} style={{ color: 'rgba(255,255,255,0.5)' }} />
                <span style={styles.uploadText}>آپلود تصویر رسید</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />

            {/* Submit Button */}
            <button 
              style={{
                ...styles.submitButton,
                opacity: submitting ? 0.7 : 1
              }} 
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <span>{(isRenewal || subscriptionStatus?.hasActiveSubscription) ? 'ارسال درخواست تمدید' : 'ارسال'}</span>
              )}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        .channel-avatar-img-container {
          overflow: hidden;
          padding: 0 !important;
        }
        
        .channel-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
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
        
        .alpha-content-area .quick-edit-card-glass {
          margin-bottom: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  statusCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '16px',
    marginBottom: '16px'
  },

  statusCardRejected: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
    padding: '16px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '16px',
    marginBottom: '16px'
  },

  statusIconPending: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(251, 191, 36, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fbbf24',
    flexShrink: 0
  },

  statusIconRejected: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(239, 68, 68, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ef4444',
    flexShrink: 0
  },

  statusContent: {
    flex: 1
  },

  statusTitle: {
    margin: '0 0 6px 0',
    fontSize: '15px',
    fontWeight: '700',
    color: '#fbbf24'
  },

  statusTitleRejected: {
    margin: '0 0 6px 0',
    fontSize: '15px',
    fontWeight: '700',
    color: '#ef4444'
  },

  statusText: {
    margin: 0,
    fontSize: '13px',
    lineHeight: '1.6',
    color: 'rgba(255, 255, 255, 0.8)'
  },

  planTypeBold: {
    fontWeight: '700',
    fontSize: '15px',
    color: '#fbbf24'
  },

  supportButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '10px 16px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: '10px',
    color: '#f87171',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },

  pricingCard: {
    padding: '24px 20px',
    paddingTop: '30px',
    background: 'linear-gradient(333deg, rgba(0, 0, 0, 0.81), rgba(16, 185, 129, 0))',
    position: 'relative',
    overflow: 'visible'
  },

  planGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
    marginBottom: '20px'
  },

  planCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '16px 8px',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    minHeight: '80px'
  },

  planCheckMark: {
    position: 'absolute',
    top: '-10px',
    left: '-5px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white'
  },

  planCardLabel: {
    fontSize: '15px',
    fontWeight: '700',
    transition: 'color 0.2s'
  },

  planCardPrice: {
    fontSize: '13px',
    fontWeight: '600',
    transition: 'color 0.2s'
  },

  priceSection: {
    textAlign: 'center',
    marginBottom: '16px'
  },

  priceValue: {
    color: '#10b981',
    fontSize: '48px',
    fontWeight: '800'
  },

  paymentInfo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px'
  },

  usdtText: {
    color: 'white',
    fontSize: '16px',
    fontWeight: '700'
  },

  networkText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '14px'
  },

  networkBadge: {
    background: '#ef4444',
    color: 'white',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600'
  },

  addressBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '2px solid rgba(251, 191, 36, 0.5)',
    borderRadius: '12px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  copyIcon: {
    color: '#10b981',
    flexShrink: 0
  },

  addressText: {
    color: '#10b981',
    fontSize: '13px',
    fontWeight: '600',
    wordBreak: 'break-all',
    direction: 'ltr',
    textAlign: 'left'
  },

  tutorialButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    background: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.4)',
    borderRadius: '12px',
    color: '#60a5fa',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '16px',
    transition: 'all 0.2s'
  },

  inputBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '4px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '12px',
    marginBottom: '16px'
  },

  input: {
    flex: 1,
    padding: '12px',
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '14px',
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'right'
  },

  inputIcon: {
    padding: '10px',
    color: 'rgba(255, 255, 255, 0.4)'
  },

  pasteBtn: {
    padding: '10px',
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '8px',
    color: '#10b981',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '8px'
  },

  divider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '14px'
  },

  uploadBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '30px 20px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '16px',
    transition: 'all 0.2s'
  },

  uploadText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px'
  },

  previewContainer: {
    position: 'relative',
    marginBottom: '16px',
    borderRadius: '12px',
    overflow: 'hidden'
  },

  previewImage: {
    width: '100%',
    maxHeight: '200px',
    objectFit: 'cover',
    borderRadius: '12px'
  },

  removeBtn: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.6)',
    border: 'none',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },

  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white'
  },

  submitButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#0a0a0f',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 30px rgba(251, 191, 36, 0.3)',
    transition: 'all 0.3s'
  }
};

export default SubscriptionPage;