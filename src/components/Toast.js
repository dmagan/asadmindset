import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Toast Context for global access
const ToastContext = React.createContext(null);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 10000) => {
    setToast({ message, type, duration, id: Date.now() });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  // Shorthand methods
  const success = useCallback((message, duration) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message, duration) => showToast(message, 'error', duration), [showToast]);
  const warning = useCallback((message, duration) => showToast(message, 'warning', duration), [showToast]);
  const info = useCallback((message, duration) => showToast(message, 'info', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, success, error, warning, info }}>
      {children}
      {toast && (
        <ToastModal
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
};

// Toast Modal Component
const ToastModal = ({ message, type, duration, onClose }) => {
  const [progress, setProgress] = useState(100);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);

    // Progress bar countdown
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - (100 / (duration / 50));
        if (newProgress <= 0) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return newProgress;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={32} />;
      case 'error':
        return <XCircle size={32} />;
      case 'warning':
        return <AlertCircle size={32} />;
      case 'info':
        return <Info size={32} />;
      default:
        return <CheckCircle size={32} />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          icon: '#10b981',
          progress: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)'
        };
      case 'error':
        return {
          icon: '#ef4444',
          progress: '#ef4444',
          border: 'rgba(239, 68, 68, 0.3)'
        };
      case 'warning':
        return {
          icon: '#f59e0b',
          progress: '#f59e0b',
          border: 'rgba(245, 158, 11, 0.3)'
        };
      case 'info':
        return {
          icon: '#3b82f6',
          progress: '#3b82f6',
          border: 'rgba(59, 130, 246, 0.3)'
        };
      default:
        return {
          icon: '#10b981',
          progress: '#10b981',
          border: 'rgba(16, 185, 129, 0.3)'
        };
    }
  };

  const colors = getColors();

  return (
    <div style={{
      ...styles.overlay,
      opacity: isVisible ? 1 : 0,
      pointerEvents: isVisible ? 'auto' : 'none'
    }}>
      <div style={{
        ...styles.modal,
        transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(-20px)',
        opacity: isVisible ? 1 : 0,
        borderColor: colors.border
      }}>
        {/* Close button */}
        <button style={styles.closeBtn} onClick={handleClose}>
          <X size={20} />
        </button>

        {/* Icon */}
        <div style={{ ...styles.iconContainer, color: colors.icon }}>
          {getIcon()}
        </div>

        {/* Message */}
        <p style={styles.message}>{message}</p>

        {/* OK Button */}
        <button style={styles.okButton} onClick={handleClose}>
          تایید
        </button>

        {/* Progress Bar */}
        <div style={styles.progressContainer}>
          <div style={{
            ...styles.progressBar,
            width: `${progress}%`,
            backgroundColor: colors.progress
          }} />
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px',
    transition: 'opacity 0.3s ease',
    backdropFilter: 'blur(4px)'
  },

  modal: {
    position: 'relative',
    width: '100%',
    maxWidth: '320px',
    background: 'linear-gradient(145deg, rgba(30, 30, 45, 0.98), rgba(20, 20, 30, 0.98))',
    borderRadius: '20px',
    padding: '30px 24px 20px',
    textAlign: 'center',
    border: '1px solid',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    transition: 'all 0.3s ease',
    overflow: 'hidden'
  },

  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  iconContainer: {
    marginBottom: '16px'
  },

  message: {
    color: 'white',
    fontSize: '15px',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
    direction: 'rtl'
  },

  okButton: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    color: 'white',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
    marginBottom: '16px'
  },

  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },

  progressBar: {
    height: '100%',
    transition: 'width 0.05s linear',
    borderRadius: '0 2px 2px 0'
  }
};

export default ToastProvider;