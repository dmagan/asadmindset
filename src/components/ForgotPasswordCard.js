import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ChevronLeft, Send, CheckCircle } from 'lucide-react';

const ForgotPasswordCard = ({ onBack }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('https://asadmindset.com/wp-json/cutify/v1/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || t('resetError', 'Failed to send reset email. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // صفحه موفقیت
  if (success) {
    return (
      <div className="forgot-password-card">
        <div className="success-container">
          <div className="success-icon">
            <CheckCircle size={48} />
          </div>
          <h2 className="success-title">{t('emailSent', 'Email Sent!')}</h2>
          <p className="success-text">
            {t('checkEmail', 'Check your email for a link to reset your password.')}
          </p>
          <button className="back-to-login-btn" onClick={onBack}>
            {t('backToLogin', 'Back to Login')}
          </button>
        </div>

        <style>{`
          .success-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 40px 20px;
          }

          .success-icon {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.15);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #10b981;
            margin-bottom: 24px;
          }

          .success-title {
            color: white;
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 12px 0;
          }

          .success-text {
            color: rgba(255, 255, 255, 0.6);
            font-size: 15px;
            margin: 0 0 32px 0;
            line-height: 1.5;
          }

          .back-to-login-btn {
            padding: 14px 32px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border: none;
            border-radius: 14px;
            color: white;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .back-to-login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="forgot-password-card">
      {/* Header */}
      <div className="forgot-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <h2 className="forgot-title">{t('forgotPassword', 'Forgot Password')}</h2>
        <div style={{ width: 40 }}></div>
      </div>

      <p className="forgot-subtitle">
        {t('forgotPasswordDesc', 'Enter your email and we\'ll send you a link to reset your password.')}
      </p>

      <form onSubmit={handleSubmit} className="forgot-form">
        {error && <div className="forgot-error">{error}</div>}

        <div className="input-group">
          <Mail size={18} className="input-icon" />
          <input
            type="email"
            placeholder={t('email', 'Email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="submit-btn" disabled={loading || !email}>
          {loading ? (
            <span className="loading-spinner"></span>
          ) : (
            <>
              <Send size={18} />
              <span>{t('sendResetLink', 'Send Reset Link')}</span>
            </>
          )}
        </button>
      </form>

      <style>{`
        .forgot-password-card {
          padding: 24px;
        }

        .forgot-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .back-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .forgot-title {
          color: white;
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .forgot-subtitle {
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
          text-align: center;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .forgot-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .forgot-error {
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #f87171;
          font-size: 14px;
          text-align: center;
        }

        .input-group {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 16px;
          color: rgba(255, 255, 255, 0.4);
          pointer-events: none;
        }

        .input-group input {
          width: 100%;
          padding: 16px 16px 16px 48px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          color: white;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: all 0.2s;
        }

        .input-group input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .input-group input:focus {
          border-color: rgba(59, 130, 246, 0.5);
          background: rgba(59, 130, 246, 0.08);
        }

        .submit-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          margin-top: 8px;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          border: none;
          border-radius: 14px;
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ForgotPasswordCard;