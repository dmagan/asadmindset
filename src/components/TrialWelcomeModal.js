import React, { useState, useEffect } from 'react';
import { FlaskConical, Clock, CheckCircle, X } from 'lucide-react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const PRODUCT_LABELS = {
  alpha_channel: 'کانال آلفا',
  academy:       'آکادمی',
  ai_chat:       'هوش مصنوعی',
};

const TrialWelcomeModal = () => {
  const [trials, setTrials] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const user = authService.getUser();
    if (!user?.id) return;

    const storageKey = `trial_welcomed_${user.id}`;
    const seenIds    = JSON.parse(localStorage.getItem(storageKey) || '[]');

    fetch(`${API_URL}/subscription/status`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.activeTrials?.length) return;

        // فقط تریال‌هایی که قبلاً دیده نشدن
        const newTrials = data.activeTrials.filter(t => !seenIds.includes(t.id));
        if (!newTrials.length) return;

        setTrials(newTrials);
        setVisible(true);
      })
      .catch(() => {});
  }, []);

  const handleClose = () => {
    const user = authService.getUser();
    if (user?.id) {
      const storageKey = `trial_welcomed_${user.id}`;
      const seenIds    = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const newSeen    = [...new Set([...seenIds, ...trials.map(t => t.id)])];
      localStorage.setItem(storageKey, JSON.stringify(newSeen));
    }
    setVisible(false);
  };

  if (!visible || !trials.length) return null;

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fa-IR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '360px',
          background: 'linear-gradient(135deg, rgba(10,15,25,0.97), rgba(16,25,40,0.97))',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px', overflow: 'hidden',
          direction: 'rtl', animation: 'popIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))',
          borderBottom: '1px solid rgba(16,185,129,0.15)',
          padding: '24px 20px 20px',
          textAlign: 'center',
          position: 'relative',
        }}>
          <button
            onClick={handleClose}
            style={{
              position: 'absolute', top: '14px', left: '14px',
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)', border: 'none',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>

          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(16,185,129,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <FlaskConical size={28} style={{ color: '#10b981' }} />
          </div>

          <div style={{ fontSize: '18px', fontWeight: '800', color: 'white', marginBottom: '6px' }}>
            🎉 خوش آمدید!
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>
            اشتراک آزمایشی رایگان برای شما فعال شد
          </div>
        </div>

        {/* Trial list */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {trials.map(trial => {
              const productLabel = PRODUCT_LABELS[trial.planType] || trial.planType;
              return (
                <div key={trial.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: 'rgba(16,185,129,0.07)',
                  borderRadius: '12px',
                  border: '1px solid rgba(16,185,129,0.15)',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    background: 'rgba(16,185,129,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <CheckCircle size={18} style={{ color: '#10b981' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '3px' }}>
                      {productLabel}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', color: 'rgba(255,255,255,0.45)',
                    }}>
                      <Clock size={11} />
                      <span>{trial.daysRemaining} روز باقی‌مانده</span>
                      <span>•</span>
                      <span>تا {formatDate(trial.expiresAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            fontSize: '11px', color: 'rgba(255,255,255,0.3)',
            textAlign: 'center', lineHeight: '1.6', marginBottom: '16px',
          }}>
            می‌توانید به صورت آزمایشی از این بخش‌ها استفاده کنید.
            پس از اتمام دوره آزمایشی، برای ادامه اشتراک تهیه کنید.
          </div>

          <button
            onClick={handleClose}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none', borderRadius: '12px',
              color: 'white', fontSize: '15px', fontWeight: '700',
              fontFamily: 'inherit', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <CheckCircle size={18} />
            <span>باشه، ممنون!</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default TrialWelcomeModal;