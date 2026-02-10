import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, Smartphone } from 'lucide-react';
import { pushService } from '../services/pushService';

const PushPermission = ({ onClose }) => {
  const [status, setStatus] = useState('idle'); // idle, loading, success, error, unsupported, not-pwa
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check support
    if (!pushService.isSupported()) {
      setStatus('unsupported');
      return;
    }

    // Check if already granted
    if (pushService.isRegistered() && pushService.getPermissionState() === 'granted') {
      setStatus('success');
      return;
    }

    // On iOS, must be installed PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS && !pushService.isInstalledPWA()) {
      setStatus('not-pwa');
      return;
    }

    // If denied previously
    if (pushService.getPermissionState() === 'denied') {
      setStatus('error');
      setErrorMsg('اعلان‌ها توسط شما مسدود شده. لطفاً از تنظیمات مرورگر فعال کنید.');
      return;
    }
  }, []);

  const handleEnable = async () => {
    setStatus('loading');
    try {
      await pushService.requestPermissionAndGetToken();
      setStatus('success');
      setTimeout(() => onClose?.(), 1500);
    } catch (e) {
      console.error('Push enable error:', e);
      setStatus('error');
      console.error('[Push] Enable failed:', e);
      if (e.message === 'Permission denied') {
        setErrorMsg('شما دسترسی اعلان را رد کردید');
      } else {
        setErrorMsg(e.message || 'خطا در فعال‌سازی اعلان‌ها');
      }
    }
  };

  if (status === 'success') {
    return (
      <div className="push-prompt">
        <div className="push-prompt-content push-success">
          <Bell size={24} className="push-icon-success" />
          <span>اعلان‌ها فعال شد ✓</span>
        </div>
        <style>{pushStyles}</style>
      </div>
    );
  }

  if (status === 'not-pwa') {
    return (
      <div className="push-prompt">
        <div className="push-prompt-content">
          <button className="push-close" onClick={onClose}><X size={18} /></button>
          <Smartphone size={32} className="push-icon" />
          <h4>ابتدا اپ را نصب کنید</h4>
          <p>برای دریافت اعلان در آیفون، ابتدا اپ را به صفحه اصلی اضافه کنید:</p>
          <p className="push-steps">
            1. روی دکمه <strong>Share</strong> (مربع با فلش بالا) بزنید<br/>
            2. <strong>Add to Home Screen</strong> را انتخاب کنید<br/>
            3. سپس از اپ نصب‌شده باز کنید
          </p>
        </div>
        <style>{pushStyles}</style>
      </div>
    );
  }

  if (status === 'unsupported') {
    return null; // Don't show anything
  }

  if (status === 'error') {
    return (
      <div className="push-prompt">
        <div className="push-prompt-content">
          <button className="push-close" onClick={onClose}><X size={18} /></button>
          <BellOff size={32} className="push-icon-error" />
          <p>{errorMsg}</p>
        </div>
        <style>{pushStyles}</style>
      </div>
    );
  }

  return (
    <div className="push-prompt">
      <div className="push-prompt-content">
        <button className="push-close" onClick={onClose}><X size={18} /></button>
        <Bell size={32} className="push-icon" />
        <h4>دریافت اعلان پیام جدید</h4>
        <p>برای اطلاع از پیام‌های جدید، اعلان‌ها را فعال کنید</p>
        <div className="push-actions">
          <button className="push-btn-enable" onClick={handleEnable} disabled={status === 'loading'}>
            {status === 'loading' ? 'در حال فعال‌سازی...' : '🔔 فعال‌سازی اعلان'}
          </button>
          <button className="push-btn-later" onClick={onClose}>بعداً</button>
        </div>
      </div>
      <style>{pushStyles}</style>
    </div>
  );
};

const pushStyles = `
  .push-prompt {
    position: fixed;
    bottom: 80px;
    left: 16px;
    right: 16px;
    z-index: 999;
    animation: pushSlideUp 0.3s ease;
  }
  @keyframes pushSlideUp {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .push-prompt-content {
    background: rgba(20, 20, 35, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    padding: 20px;
    text-align: center;
    color: #fff;
    position: relative;
  }
  .push-prompt-content h4 {
    margin: 12px 0 6px;
    font-size: 16px;
    font-weight: 700;
  }
  .push-prompt-content p {
    margin: 0 0 14px;
    font-size: 13px;
    color: rgba(255,255,255,0.6);
    line-height: 1.6;
  }
  .push-steps {
    text-align: right;
    font-size: 12px !important;
  }
  .push-close {
    position: absolute;
    top: 12px;
    left: 12px;
    background: rgba(255,255,255,0.1);
    border: none;
    color: rgba(255,255,255,0.5);
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .push-icon { color: #fbbf24; }
  .push-icon-success { color: #10b981; }
  .push-icon-error { color: #ef4444; }
  .push-success {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
  }
  .push-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .push-btn-enable {
    padding: 14px;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
    border: none;
    border-radius: 14px;
    color: #000;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  .push-btn-enable:disabled {
    opacity: 0.7;
  }
  .push-btn-enable:active:not(:disabled) {
    transform: scale(0.98);
  }
  .push-btn-later {
    padding: 10px;
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
  }
`;

export default PushPermission;
