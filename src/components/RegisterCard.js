import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Lock, Eye, EyeOff, UserPlus, ChevronLeft, RefreshCw, CheckCircle } from 'lucide-react';
import Pusher from 'pusher-js';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const PUSHER_KEY = '71815fd9e2b90f89a57b';
const PUSHER_CLUSTER = 'eu';

// ─── Step 1: Registration Form ───────────────────────────────────────────────
const RegistrationForm = ({ onBack, onRegistered }) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('رمزهای عبور مطابقت ندارند.');
      return;
    }
    if (password.length < 6) {
      setError('رمز عبور باید حداقل ۶ کاراکتر باشد.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ثبت‌نام با خطا مواجه شد.');

      if (data.needsVerification) {
        onRegistered({
          userId: data.userId,
          email: data.email,
          verifyToken: data.verifyToken,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-card">
      <div className="register-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <div className="header-text">
          <h2 className="register-title">{t('createAccount', 'ایجاد حساب')}</h2>
          <p className="register-subtitle">{t('registerToContinue', 'برای شروع ثبت‌نام کنید')}</p>
        </div>
        <div style={{ width: 40 }} />
      </div>

      <form onSubmit={handleSubmit} className="register-form">
        {error && <div className="register-error">{error}</div>}

        <div className="input-group">
          <User size={18} className="input-icon" />
          <input type="text" placeholder={t('username', 'نام کاربری')} value={username}
            onChange={e => setUsername(e.target.value)} required />
        </div>

        <div className="input-group">
          <Mail size={18} className="input-icon" />
          <input type="email" placeholder={t('email', 'ایمیل')} value={email}
            onChange={e => setEmail(e.target.value)} required />
        </div>

        <div className="input-group">
          <Lock size={18} className="input-icon" />
          <input type={showPassword ? 'text' : 'password'} placeholder={t('password', 'رمز عبور')}
            value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="input-group">
          <Lock size={18} className="input-icon" />
          <input type="password" placeholder={t('confirmPassword', 'تکرار رمز عبور')}
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        </div>

        <button type="submit" className="register-button" disabled={loading}>
          {loading ? <span className="loading-spinner" /> : (
            <><UserPlus size={18} /><span>{t('register', 'ثبت‌نام')}</span></>
          )}
        </button>
      </form>
    </div>
  );
};

// ─── Step 2: Verification Screen ─────────────────────────────────────────────
const VerificationScreen = ({ userId, email, verifyToken, onSuccess }) => {
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(900); // 15 min
  const inputRefs = useRef([]);
  const pusherRef = useRef(null);

  // ── Countdown timer ──
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Pusher listener for magic link verification ──
  useEffect(() => {
    if (!verifyToken) return;

    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    pusherRef.current = pusher;

    const channel = pusher.subscribe(`verify-${verifyToken}`);
    channel.bind('email-verified', (data) => {
      if (data?.token && data?.user) {
        handleLoginSuccess(data.token, data.user);
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`verify-${verifyToken}`);
      pusher.disconnect();
    };
  }, [verifyToken]);

  const handleLoginSuccess = (token, user) => {
    setSuccess(true);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  };

  // ── Code input handlers ──
  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    const fullCode = newCode.join('');
    if (fullCode.length === 4 && !newCode.includes('')) {
      submitCode(fullCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[3]?.focus();
      submitCode(pasted);
    }
  };

  const submitCode = async (codeStr) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'کد اشتباه است.');
      if (data.token && data.user) {
        handleLoginSuccess(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در ارسال مجدد.');
      setCountdown(900);
      setCode(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  };

  if (success) {
    return (
      <div className="verify-card">
        <div className="verify-success">
          <CheckCircle size={56} color="#10b981" />
          <h2>تأیید شد!</h2>
          <p>در حال ورود...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-card">
      <div className="verify-header">
        <div className="verify-icon">✉️</div>
        <h2 className="verify-title">تأیید ایمیل</h2>
        <p className="verify-subtitle">
          کد ۴ رقمی به<br />
          <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{email}</strong><br />
          ارسال شد
        </p>
      </div>

      {error && <div className="register-error">{error}</div>}

      {/* Code inputs */}
      <div className="code-inputs" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            ref={el => inputRefs.current[i] = el}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleCodeChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`code-input ${digit ? 'filled' : ''} ${loading ? 'loading' : ''}`}
            disabled={loading}
            autoFocus={i === 0}
          />
        ))}
      </div>

      {/* Spam notice */}
      <div className="spam-notice">
        <span className="spam-icon">📂</span>
        <span>ایمیل دریافت نکردید؟ پوشه <strong>اسپم</strong> را چک کنید</span>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <span className="loading-spinner" style={{ display: 'inline-block' }} />
        </div>
      )}

      {/* Timer & Resend */}
      <div className="verify-footer">
        {countdown > 0 ? (
          <p className="verify-timer">
            کد تا <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>{formatTime(countdown)}</span> معتبر است
          </p>
        ) : (
          <p className="verify-timer" style={{ color: '#f87171' }}>کد منقضی شد</p>
        )}

        <button className="resend-btn" onClick={handleResend} disabled={resending || countdown > 840}>
          {resending ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : <RefreshCw size={14} />}
          <span>ارسال مجدد کد</span>
        </button>
      </div>

      <div className="verify-divider">
        <span>یا</span>
      </div>

      <p className="verify-link-hint">
        لینک تأیید هم در ایمیل شماست — با کلیک روی آن، برنامه به طور خودکار وارد می‌شود.
      </p>
    </div>
  );
};

// ─── Main RegisterCard ────────────────────────────────────────────────────────
const RegisterCard = ({ onBack, onSuccess }) => {
  const [step, setStep] = useState('register'); // 'register' | 'verify'
  const [verifyData, setVerifyData] = useState(null);

  const handleRegistered = (data) => {
    setVerifyData(data);
    setStep('verify');
  };

  return (
    <>
      {step === 'register' && (
        <RegistrationForm onBack={onBack} onRegistered={handleRegistered} />
      )}
      {step === 'verify' && verifyData && (
        <VerificationScreen
          userId={verifyData.userId}
          email={verifyData.email}
          verifyToken={verifyData.verifyToken}
          onSuccess={onSuccess}
        />
      )}

      <style>{`
        .register-card, .verify-card {
          padding: 24px;
        }

        /* ── Header ── */
        .register-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        .back-btn {
          width: 40px; height: 40px;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .back-btn:hover { background: rgba(255,255,255,0.12); }
        .header-text { text-align: center; flex: 1; }
        .register-title { font-size: 20px; font-weight: 700; color: white; margin: 0 0 4px; }
        .register-subtitle { font-size: 13px; color: rgba(255,255,255,0.5); margin: 0; }

        /* ── Form ── */
        .register-form { display: flex; flex-direction: column; gap: 14px; }
        .register-error {
          padding: 12px 16px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 12px;
          color: #f87171; font-size: 14px; text-align: center;
          margin-bottom: 4px;
        }
        .input-group { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 16px; color: rgba(255,255,255,0.4); pointer-events: none; }
        .input-group input {
          width: 100%; padding: 14px 48px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; color: white; font-size: 15px;
          font-family: inherit; outline: none; transition: all 0.2s;
        }
        .input-group input::placeholder { color: rgba(255,255,255,0.4); }
        .input-group input:focus {
          border-color: rgba(124,58,237,0.5);
          background: rgba(124,58,237,0.08);
        }
        .password-toggle {
          position: absolute; right: 16px;
          background: none; border: none;
          color: rgba(255,255,255,0.4); cursor: pointer;
          padding: 0; display: flex; transition: color 0.2s;
        }
        .password-toggle:hover { color: rgba(255,255,255,0.7); }

        .register-button {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 14px; margin-top: 8px;
          background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
          border: none; border-radius: 14px; color: white;
          font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(124,58,237,0.3);
        }
        .register-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(124,58,237,0.4);
        }
        .register-button:active:not(:disabled) { transform: scale(0.98); }
        .register-button:disabled { opacity: 0.7; cursor: not-allowed; }

        /* ── Verify ── */
        .verify-header { text-align: center; margin-bottom: 28px; }
        .verify-icon { font-size: 48px; margin-bottom: 12px; }
        .verify-title { font-size: 20px; font-weight: 700; color: white; margin: 0 0 8px; }
        .verify-subtitle { font-size: 14px; color: rgba(255,255,255,0.5); margin: 0; line-height: 1.8; }

        .code-inputs {
          display: flex; justify-content: center; gap: 12px;
          margin: 8px 0 20px;
        }
        .code-input {
          width: 56px; height: 64px;
          border-radius: 16px; text-align: center;
          font-size: 28px; font-weight: 700; color: white;
          background: rgba(255,255,255,0.06);
          border: 2px solid rgba(255,255,255,0.12);
          outline: none; transition: all 0.2s;
          font-family: monospace;
          -webkit-appearance: none;
          caret-color: transparent;
        }
        .code-input:focus {
          border-color: #7c3aed;
          background: rgba(124,58,237,0.12);
          box-shadow: 0 0 0 4px rgba(124,58,237,0.15);
        }
        .code-input.filled {
          border-color: rgba(124,58,237,0.6);
          background: rgba(124,58,237,0.1);
        }
        .code-input.loading { opacity: 0.6; }

        .verify-footer { text-align: center; margin-top: 4px; }
        .verify-timer { font-size: 13px; color: rgba(255,255,255,0.4); margin-bottom: 10px; }
        .resend-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px; color: rgba(255,255,255,0.6);
          font-size: 13px; cursor: pointer; transition: all 0.2s;
        }
        .resend-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          color: white;
        }
        .resend-btn:disabled { opacity: 0.4; cursor: not-allowed; }


        .spam-notice {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 9px 14px; margin-bottom: 18px;
          background: rgba(251,191,36,0.06);
          border: 1px solid rgba(251,191,36,0.18);
          border-radius: 10px;
          font-size: 12px; color: rgba(255,255,255,0.35);
        }
        .spam-notice strong { color: rgba(251,191,36,0.75); }
        .spam-icon { font-size: 14px; flex-shrink: 0; }
        .verify-divider {
          text-align: center; margin: 20px 0 12px;
          position: relative;
        }
        .verify-divider::before {
          content: ''; position: absolute;
          top: 50%; left: 0; right: 0; height: 1px;
          background: rgba(255,255,255,0.08);
        }
        .verify-divider span {
          position: relative; padding: 0 12px;
          background: transparent;
          color: rgba(255,255,255,0.3); font-size: 12px;
        }

        .verify-link-hint {
          text-align: center; font-size: 12px;
          color: rgba(255,255,255,0.35); line-height: 1.7;
          margin: 0;
        }

        .verify-success {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; padding: 40px 0; text-align: center;
        }
        .verify-success h2 { color: #10b981; font-size: 22px; margin: 0; }
        .verify-success p { color: rgba(255,255,255,0.5); font-size: 14px; margin: 0; }

        /* ── Spinner ── */
        .loading-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default RegisterCard;