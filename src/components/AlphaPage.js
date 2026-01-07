import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Rocket,
  Copy, 
  Gift,
  Check,
  Crown,
  Star,
  ArrowLeft,
  TrendingDown
} from 'lucide-react';

const AlphaPage = ({ onBack, onOpenChannel }) => {
  const { t } = useTranslation();

  // فیکس iOS scroll - مثل SupportChat
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

  const includedFeatures = [
    'سیگنال اسپات ( معرفی  آلت‌ کوین های پامپی برای آلت سیزن )',
    'میم‌کوین‌های پامپی', 
    'کپی‌ترید',
    'ایردراپ‌',
    'سیگنال‌های فیوچرز برای درآمد ماهانه',
  ];

  return (
    <div className="support-chat-container">
      {/* Header */}
      <div className="chat-header-glass">
        <button className="chat-back-btn" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <div className="chat-header-info">
          <div className="chat-header-text">
            <span className="chat-header-title">گروه آلفا</span>
            <span className="chat-header-status">Premium Trading</span>
          </div>
          <div className="chat-avatar-glass" style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
            <Crown size={20} />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="alpha-content-area">
        <div style={{ direction: 'rtl' }}>

          {/* Hero Section */}
          <div className="quick-edit-card-glass" style={styles.heroCard}>
            <div style={styles.heroContent}>
              <div style={styles.alphaLogo}>همه چیز برای موفقیت در کریپتو</div>
                            <div style={styles.alphaLogo}>یکــجـــا</div>

              <p style={styles.heroText}></p>
            </div>
          </div>

          {/* Spot Signals Card */}
          <div className="quick-edit-card-glass" style={styles.spotCard}>
            <div style={styles.spotHeader}>
              <div style={styles.spotIcon}>
                <TrendingUp size={24} />
              </div>
              <span style={styles.spotTitle}>سیگنال‌های اسپات (سبد آلت‌سیزن)</span>
            </div>
            
            {/* Features Grid */}
            <div style={styles.featuresGrid}>
              <div style={styles.featureRow}>
                <div style={styles.featureBox}>
                  <Zap size={28} style={{ color: '#ffffff' }} />
                  <span>میم‌کوین‌های پامپی</span>
                </div>
                <div style={styles.featureBox}>
                  <TrendingUp size={28} style={{ color: '#ffffff' }} />
                  <span>سیگنال‌های کوتاه‌مدت و بلندمدت</span>
                </div>
              </div>
              
              <div style={styles.featureRow}>
                <div style={styles.featureBox}>
                  <Rocket size={28} style={{ color: '#ffffff' }} />
                  <span>سیگنال‌های فیوچرز</span>
                </div>
                <div style={styles.featureBox}>
                  <Copy size={28} style={{ color: '#ffffff' }} />
                  <span>کپی‌ترید</span>
                </div>
              </div>
              
              <div style={styles.featureRowSingle}>
                <div style={styles.featureBox}>
                  <Gift size={28} style={{ color: '#ffffff' }} />
                  <span>ایردراپ‌ها</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="quick-edit-card-glass" style={styles.infoCard}>
            <div style={styles.infoIcon}>
              <Rocket size={28} />
            </div>
            <p style={styles.infoText}>
              سیگنال‌ فیوچرز ما به‌صورت <strong>مداوم</strong> داده می‌شود تا آلفاها بتوانند 
              کنار هم، با مدیریت سرمایه درست به یک <strong>درآمد ماهانه پایدار</strong> برسند.
            </p>
          </div>

       {/* Old Pricing */}
          <div className="quick-edit-card-glass" style={styles.oldPriceCard}>
            <div style={styles.oldPriceHeader}>
              <div style={styles.oldPriceIcon}>
                <TrendingDown size={28} />
              </div>
              <span style={styles.oldPriceTitle}>قبلاً هر بخش جدا بود:</span>
            </div>
            <div style={styles.oldPriceList}>
              <div style={styles.oldPriceItem}>
                <span>VIP</span>
                <span style={styles.strikePrice}>199$</span>
              </div>
              <div style={styles.oldPriceItem}>
                <span>میم‌کوین باز</span>
                <span style={styles.strikePrice}>15$</span>
              </div>
            </div>
          </div>

          {/* New Pricing Card */}
          <div className="quick-edit-card-glass" style={styles.pricingCard}>
            <div style={styles.discountBadge}>
              <Star size={14} />
              <span>تخفیف ویژه</span>
            </div>

            <div style={styles.priceHeader}>
              <span style={styles.priceLabel}>همه خدمات ما فقط در یکجا</span>
              <div style={styles.priceRow}>
                <span style={styles.currency}>$</span>
                <span style={styles.priceValue}>25</span>
                <span style={styles.pricePeriod}>/ماه</span>
              </div>
            </div>

            <div style={styles.featuresList}>
              {includedFeatures.map((item, index) => (
                <div key={index} style={styles.featureItem}>
                  <Check size={16} style={{ color: '#10b981' }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <button style={styles.joinButton} onClick={onOpenChannel}>
              <Crown size={18} />
              <span>عضویت در آلفا</span>
            </button>
          </div>

          {/* Footer Note */}
          <div className="quick-edit-card-glass" style={styles.footerCard}>
            <p style={styles.footerText}>
              ما همه را یک‌جا جمع کردیم تا عزیزان از <strong>افغانستان</strong> و <strong>ایران</strong> هم
              بتوانند با توان پرداخت منطقی وارد شوند. 💚
            </p>
          </div>

        </div>
      </div>

      <style>{`
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
      `}</style>
    </div>
  );
};

const styles = {
  heroCard: {
    textAlign: 'center',
    padding: '30px 20px'
  },

  heroContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },

  alphaLogo: {
    fontSize: '18px',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #ffffffb1 0%, #ffffffb8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  heroText: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: '15px'
  },

  spotCard: {
    padding: '20px'
  },

  spotHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  },

  spotIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'rgba(0, 0, 0, 0.20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff'
  },

  spotTitle: {
    color: 'white',
    fontSize: '16px',
    fontWeight: '600'
  },

  featuresGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  featureRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },

  featureRowSingle: {
    display: 'flex',
    justifyContent: 'center'
  },

  featureBox: {
    display: 'flex',

    alignItems: 'center',
    gap: '10px',
    padding: '18px 14px',
    background: 'rgba(0, 0, 0, 0.14)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.33)',
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    fontWeight: '600'
  },

  infoCard: {
    display: 'flex',
    gap: '14px',
    padding: '18px 20px',
    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.28), rgba(255, 255, 255, 0.05))'
  },

  infoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(0, 0, 0, 0.20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    flexShrink: 0
  },

  infoText: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px',
    fontWeight: '600',
    lineHeight: '1.7'
  },

  oldPriceCard: {
    padding: '18px 20px',
    background: 'linear-gradient(145deg, rgba(107, 0, 0, 0), rgba(255, 255, 255, 0.14))'
  },

  oldPriceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '14px'
  },

  oldPriceTitle: {
    color: 'rgba(255, 255, 255, 1)',
    fontSize: '16px',
    fontWeight: '600',
  },

oldPriceList: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },

  oldPriceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '8px 14px',
    background: 'rgba(0, 0, 0, 0.47)',
    borderRadius: '10px',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '13px', 
    fontWeight: '500',
  },

  strikePrice: {
    fontSize: '20px',
    color: '#f87171',
    fontWeight: '600',
    textDecoration: 'line-through'
  },

  pricingCard: {
    padding: '24px 20px',
    background: 'linear-gradient(333deg, rgba(0, 0, 0, 0.81), rgba(16, 185, 129, 0))',
    position: 'relative',
    overflow: 'visible'
  },

  discountBadge: {
    position: 'absolute',
    top: '-12px',
    left: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    borderRadius: '20px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
  },

  priceHeader: {
    textAlign: 'center',
    marginBottom: '20px',
    marginTop: '10px'
  },

  priceLabel: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
    marginBottom: '8px'
  },

  priceRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '4px'
  },

  currency: {
    color: '#10b981',
    fontSize: '24px',
    fontWeight: '700',
    marginTop: '8px'
  },

  priceValue: {
    color: 'white',
    fontSize: '52px',
    fontWeight: '800',
    lineHeight: 1
  },

  pricePeriod: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '16px',
    alignSelf: 'flex-end',
    marginBottom: '8px'
  },

  featuresList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px'
  },

  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '14px'
  },

  joinButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    border: 'none',
    borderRadius: '14px',
    color: '#0a0a0f',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 8px 30px rgba(251, 191, 36, 0.3)',
    transition: 'all 0.3s'
  },

  footerCard: {
    padding: '20px',
    textAlign: 'center'
  },

  footerText: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: '14px',
    lineHeight: '1.8'
  },

  oldPriceIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    background: 'rgba(0, 0, 0, 0.20)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    flexShrink: 0
  },

  oldPriceContent: {
    flex: 1
  },

};

export default AlphaPage;