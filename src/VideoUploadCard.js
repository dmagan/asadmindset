import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadCloud, X, Film, Plus, ChevronRight, ChevronLeft, Check, Pencil } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import LoginCard from './components/LoginCard';
import ReactDOM from 'react-dom';
import { authService } from './services/authService';

const VideoUploadCard = () => {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [descriptions, setDescriptions] = useState({});
  const [selectedVideoId, setSelectedVideoId] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedDelivery, setSelectedDelivery] = useState('standard');
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [generalDescription, setGeneralDescription] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  const fileInputRef = useRef(null);

  const styles = [
    { id: 'viral', label: 'Viral', description: 'Trendy and engaging content' },
    { id: 'luxury', label: 'Luxury', description: 'Premium and elegant style' },
    { id: 'minimal', label: 'Minimal', description: 'Clean and simple design' },
    { id: 'alpha', label: 'Alpha', description: 'Bold and powerful look' },
  ];

  const deliveryOptions = [
    { id: 'standard', label: t('standard', 'Standard'), time: '48h', price: null },
    { id: 'fast', label: t('fast', 'Fast'), time: '24h', price: 10 },
    { id: 'rush', label: t('rush', 'Rush'), time: '12h', price: 20 },
  ];

  const extraOptions = [
    { id: 'subtitles_basic', label: t('subtitlesBasic', 'Subtitles Basic'), price: 30 },
    { id: 'subtitles_pro', label: t('subtitlesPro', 'Subtitles Pro'), price: 50 },
    { id: 'color_grading', label: t('colorGrading', 'Color Grading'), price: 40 },
    { id: 'music_license', label: t('musicLicense', 'Music License'), price: 25 },
  ];

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        const videoUrl = URL.createObjectURL(file);
        
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          const duration = Math.floor(video.duration);
          const mins = Math.floor(duration / 60);
          const secs = duration % 60;
          const formattedDuration = `${mins}:${secs.toString().padStart(2, '0')}`;
          
          video.currentTime = 1;
          video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg');
            
            setUploadedVideos(prev => [...prev, {
              id: Date.now() + Math.random(),
              name: file.name,
              size: (file.size / (1024 * 1024)).toFixed(2),
              duration: formattedDuration,
              thumbnail: thumbnail,
              url: videoUrl
            }]);
          };
        };
        video.src = videoUrl;
      }
    });
    
    e.target.value = '';
  };

  const removeVideo = (id) => {
    setUploadedVideos(prev => {
      const video = prev.find(v => v.id === id);
      if (video?.url) {
        URL.revokeObjectURL(video.url);
      }
      return prev.filter(v => v.id !== id);
    });
    setDescriptions(prev => {
      const newDesc = { ...prev };
      delete newDesc[id];
      return newDesc;
    });
    if (selectedVideoId === id) {
      setSelectedVideoId(null);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleContinue = () => {
    // در مرحله 1 چک کن که لاگین هست یا نه
    if (currentStep === 1 && !isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    // بعد از لاگین موفق، برو به مرحله بعد
    setCurrentStep(2);
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const toggleExtra = (extraId) => {
    setSelectedExtras(prev => 
      prev.includes(extraId) 
        ? prev.filter(id => id !== extraId)
        : [...prev, extraId]
    );
  };

  const getStepStyle = (step) => ({
    transform: currentStep === step ? 'translateX(0)' : 
               currentStep > step ? 'translateX(-100%)' : 'translateX(100%)',
    opacity: currentStep === step ? 1 : 0,
    position: currentStep === step ? 'relative' : 'absolute',
    pointerEvents: currentStep === step ? 'auto' : 'none'
  });

const calculateTotal = () => {
  let total = 99; // قیمت پایه
  
  // هزینه delivery
  const delivery = deliveryOptions.find(d => d.id === selectedDelivery);
  if (delivery?.price) {
    total += delivery.price;
  }
  
  // هزینه extras
  selectedExtras.forEach(extraId => {
    const extra = extraOptions.find(e => e.id === extraId);
    if (extra?.price) {
      total += extra.price;
    }
  });
  
  return total;
};


const handleSubmitOrder = async () => {
  setSubmitting(true);
  
  try {
    // آپلود ویدیوها
    const uploadedVideoData = [];
    
    for (const video of uploadedVideos) {
      // اگه ویدیو از فایل آپلود شده باشه
      const fileInput = fileInputRef.current;
      // فعلاً اطلاعات لوکال رو می‌فرستیم
      uploadedVideoData.push({
        name: video.name,
        url: video.url, // بعداً باید آپلود واقعی بشه
        size: video.size + ' MB',
        description: descriptions[video.id] || '',
        thumbnail: video.thumbnail
      });
    }

    // ساخت سفارش
    const orderData = {
      style: selectedStyle,
      delivery: selectedDelivery,
      extras: selectedExtras,
      generalDescription: generalDescription,
      videos: uploadedVideoData
    };

    const result = await authService.createOrder(orderData);
    
    alert(t('orderSuccess', 'Order submitted successfully! Order #') + result.orderId);
    
    // ریست فرم
    setUploadedVideos([]);
    setDescriptions({});
    setSelectedStyle(null);
    setSelectedDelivery('standard');
    setSelectedExtras([]);
    setGeneralDescription('');
    setCurrentStep(1);
    
  } catch (error) {
    console.error('Order failed:', error);
    alert(t('orderFailed', 'Failed to submit order. Please try again.'));
  } finally {
    setSubmitting(false);
  }
};


  return (
  <div className="video-upload-card ">

{/* Progress Bar */}
<div className="progress-bar-container">
{[1, 2, 3, 4, 5].map((step, index) => (
      <React.Fragment key={step}>
      <div className={`progress-circle ${currentStep >= step ? 'active' : ''} ${currentStep === step ? 'current' : ''}`}>
        {currentStep > step ? (
          <Check size={16} />
        ) : (
          <span>{step}</span>
        )}
      </div>
{index < 4 && (
        <div className={`progress-line ${currentStep > step ? 'active' : ''}`} />
      )}
    </React.Fragment>
  ))}
</div>


      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileSelect}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0
        }}
      />

      <div className="slider-wrapper">
        {/* Step 1: Upload */}
        <div className="step-content" style={getStepStyle(1)}>
          {uploadedVideos.length === 0 ? (
            <div className="upload-empty-state">
              <div className="upload-header-row">
                <div className="upload-cloud-icon">
                  <UploadCloud size={48} strokeWidth={1.5} />
                </div>
                <div className="upload-text-content">
                  <h3 className="upload-title">
                    {t('uploadYourVideo', 'Upload Your Video')}
                  </h3>
                  <p className="upload-description-text">
                    {t('uploadDescription', 'Add and edit your own video clips')}
                  </p>
                </div>
              </div>

              <button className="upload-button" onClick={triggerFileInput}>
                {t('upload', 'Upload')}
              </button>
            </div>
          ) : (
            <div className="upload-videos-list">
              <div className="upload-list-header">
                <div className="upload-header-row">
                  <div className="upload-cloud-icon small">
                    <UploadCloud size={22} strokeWidth={1.5} />
                  </div>
                  <div className="upload-text-content">
                    <h3 className="upload-title">
                      {t('uploadYourVideo', 'Upload Your Video')}
                    </h3>
                    <p className="upload-description-text">
                      {uploadedVideos.length} {t('filesSelected', 'files selected')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="uploaded-videos">
                {uploadedVideos.map((video) => (
                 <div key={video.id} className="video-item-wrapper">
  <div className={`uploaded-video-item ${selectedVideoId === video.id ? 'selected' : ''}`}
    onClick={() => setSelectedVideoId(video.id === selectedVideoId ? null : video.id)}
  >
   <div className="video-thumbnail">
  {video.thumbnail ? (
    <img src={video.thumbnail} alt={video.name} />
  ) : (
    <div className="video-thumbnail-placeholder">
      <Film size={20} />
    </div>
  )}
  <span className="video-duration-badge">{video.duration}</span>
</div>


    <div className="video-info">
  <p className="video-name">{video.name}</p>
  <p className="video-size">{video.size} MB</p>
  <div className="video-description-row">
    <Pencil size={12} className="description-icon" />
    <input
      type="text"
      className="description-field"
      placeholder={t('videoDescription', 'Add description...')}
      value={descriptions[video.id] || ''}
      onChange={(e) => setDescriptions(prev => ({
        ...prev,
        [video.id]: e.target.value
      }))}
      onClick={(e) => e.stopPropagation()}
    />
  </div>
</div>

    <button
      onClick={(e) => {
        e.stopPropagation();
        removeVideo(video.id);
      }}
      className="remove-video-btn"
    >
      <X size={16} />
    </button>
  </div>


</div>
                ))}

              </div>
{/* General Description */}
<div className="general-description-box">
  <div className="general-description-header">
    <Pencil size={16} className="general-desc-icon" />
    <span>{t('generalDescription', 'General Description')}</span>
  </div>
<textarea
  className="general-description-textarea"
  placeholder={t('generalDescriptionPlaceholder', 'Add overall description for your project...')}
  value={generalDescription}
  onChange={(e) => setGeneralDescription(e.target.value)}
  rows={3}
/></div>

              <button onClick={triggerFileInput} className="add-more-button">
                <Plus size={18} />
                <span>{t('addMore', 'Add more videos')}</span>
              </button>

              <button onClick={handleContinue} className="continue-button">
                <span>{t('continue', 'Continue')}</span>
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Style Selection */}
        <div className="step-content" style={getStepStyle(2)}>
          <div className="step-inner">
            <button className="back-button" onClick={handleBack}>
              <ChevronLeft size={20} />
              <span>{t('back', 'Back')}</span>
            </button>

            <div className="step-header">
              <h3 className="step-title">{t('selectStyle', 'Select Style')}</h3>
              <p className="step-subtitle">{t('chooseStyle', 'Choose a style for your video')}</p>
            </div>

            <div className="options-list">
              {styles.map((style) => (
                <div 
                  key={style.id} 
                  className={`option-item radio ${selectedStyle === style.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <div className="radio-circle">
                    {selectedStyle === style.id && <div className="radio-dot" />}
                  </div>
                  <div className="option-content">
                    <span className="option-label">{style.label}</span>
                    <span className="option-desc">{style.description}</span>
                  </div>
                </div>
              ))}
            </div>

            <button 
              className={`continue-button ${!selectedStyle ? 'disabled' : ''}`}
              disabled={!selectedStyle}
              onClick={handleContinue}
            >
              <span>{t('continue', 'Continue')}</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Step 3: Delivery Time */}
        <div className="step-content" style={getStepStyle(3)}>
          <div className="step-inner">
            <button className="back-button" onClick={handleBack}>
              <ChevronLeft size={20} />
              <span>{t('back', 'Back')}</span>
            </button>

            <div className="step-header">
              <h3 className="step-title">{t('deliveryTime', 'Delivery Time')}</h3>
              <p className="step-subtitle">{t('chooseDelivery', 'Choose your delivery speed')}</p>
            </div>

            <div className="options-list">
              {deliveryOptions.map((option) => (
                <div 
                  key={option.id} 
                  className={`option-item radio ${selectedDelivery === option.id ? 'selected' : ''}`}
                  onClick={() => setSelectedDelivery(option.id)}
                >
                  <div className="radio-circle">
                    {selectedDelivery === option.id && <div className="radio-dot" />}
                  </div>
                  <div className="option-content">
                    <span className="option-label">
                      {option.label} ({option.time})
                    </span>
                    {option.price && (
                      <span className="option-price">+ ${option.price}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button className="continue-button" onClick={handleContinue}>
              <span>{t('continue', 'Continue')}</span>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Step 4: Extras */}
        <div className="step-content" style={getStepStyle(4)}>
          <div className="step-inner">
            <button className="back-button" onClick={handleBack}>
              <ChevronLeft size={20} />
              <span>{t('back', 'Back')}</span>
            </button>

            <div className="step-header">
              <h3 className="step-title">{t('extras', 'Extras')}</h3>
              <p className="step-subtitle">{t('chooseExtras', 'Add extra features to your video')}</p>
            </div>

            <div className="options-list">
              {extraOptions.map((option) => (
                <div 
                  key={option.id} 
                  className={`option-item checkbox ${selectedExtras.includes(option.id) ? 'selected' : ''}`}
                  onClick={() => toggleExtra(option.id)}
                >
                  <div className="checkbox-square">
                    {selectedExtras.includes(option.id) && <Check size={14} />}
                  </div>
                  <div className="option-content">
                    <span className="option-label">{option.label}</span>
                    <span className="option-price">+ ${option.price}</span>
                  </div>
                </div>
              ))}
            </div>

            <button
  className="continue-button"
  onClick={handleContinue}
>
  <span>{t('continue', 'Continue')}</span>
  <ChevronRight size={20} />
</button>

          </div>
        </div>

        {/* Step 5: Review & Submit */}
<div className="step-content" style={getStepStyle(5)}>
  <div className="step-inner">
    <button className="back-button" onClick={handleBack}>
      <ChevronLeft size={20} />
      <span>{t('back', 'Back')}</span>
    </button>

    <div className="step-header">
      <h3 className="step-title">{t('reviewOrder', 'Review Order')}</h3>
      <p className="step-subtitle">{t('reviewOrderDesc', 'Check your order before submitting')}</p>
    </div>

    {/* Videos Summary */}
    <div className="review-section">
      <div className="review-section-title">{t('videos', 'Videos')}</div>
      <div className="review-videos">
        {uploadedVideos.map(video => (
  <div key={video.id} className="review-video-item">
    <img src={video.thumbnail} alt={video.name} className="review-thumb" />

    <div className="review-video-info">
      <span className="review-video-name">{video.name}</span>
      <span className="review-video-duration">{video.duration}</span>

      {descriptions[video.id] && (
        <p className="review-video-description">
          {descriptions[video.id]}
        </p>
      )}
    </div>
  </div>
))}

      </div>
    </div>

{/* General Description Summary */}
{generalDescription && (
  <div className="review-section">
    <div className="review-section-title">
      {t('generalDescription', 'General Description')}
    </div>

    <p className="review-general-description">
      {generalDescription}
    </p>
  </div>
)}


    {/* Style Summary */}
    <div className="review-section">
      <div className="review-row">
        <span className="review-label">{t('style', 'Style')}</span>
        <span className="review-value">{styles.find(s => s.id === selectedStyle)?.label}</span>
      </div>
    </div>

    {/* Delivery Summary */}
    <div className="review-section">
      <div className="review-row">
        <span className="review-label">{t('delivery', 'Delivery')}</span>
        <span className="review-value">
          {deliveryOptions.find(d => d.id === selectedDelivery)?.label}
          {' '}({deliveryOptions.find(d => d.id === selectedDelivery)?.time})
          {deliveryOptions.find(d => d.id === selectedDelivery)?.price && (
            <span className="review-price"> +${deliveryOptions.find(d => d.id === selectedDelivery)?.price}</span>
          )}
        </span>
      </div>
    </div>

    {/* Extras Summary */}
    {selectedExtras.length > 0 && (
      <div className="review-section">
        <div className="review-section-title">{t('extras', 'Extras')}</div>
        {selectedExtras.map(extraId => {
          const extra = extraOptions.find(e => e.id === extraId);
          return (
            <div key={extraId} className="review-row">
              <span className="review-label">{extra?.label}</span>
              <span className="review-price">+${extra?.price}</span>
            </div>
          );
        })}
      </div>
    )}

    {/* Total */}
    <div className="review-total">
      <span className="total-label">{t('total', 'Total')}</span>
      <span className="total-price">${calculateTotal()}</span>
    </div>

    {/* Submit Button */}
    <button 
  className="submit-button" 
  onClick={handleSubmitOrder}
  disabled={submitting}
>
  {submitting ? (
    <span className="loading-spinner"></span>
  ) : (
    <span>{t('submitOrder', 'Submit Order')}</span>
  )}
</button>
  </div>
</div>

      </div>

      {/* Login Modal */}
      {/* Login Modal */}
{showLoginModal && ReactDOM.createPortal(
  <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="login-modal-close" onClick={() => setShowLoginModal(false)}>
              <X size={20} />
            </button>
            <LoginCard onSuccess={handleLoginSuccess} />
</div>
      </div>,
      document.body
)}

      <style>{`
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.submit-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}


      .review-general-description {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.6;
  white-space: pre-wrap;
}



      .review-video-description {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.4;
}


.review-section {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
}

.review-section-title {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.review-videos {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-video-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  object-fit: cover;
}

.review-video-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.review-video-name {
  color: white;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.review-video-duration {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

.review-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.review-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
}

.review-value {
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.review-price {
  color: #10b981;
  font-size: 13px;
  font-weight: 600;
}

.review-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 14px;
}

.total-label {
  color: white;
  font-size: 16px;
  font-weight: 600;
}

.total-price {
  color: #10b981;
  font-size: 24px;
  font-weight: 700;
}

      .video-upload-card {
  /* ... بقیه استایل‌ها ... */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.uploaded-video-item {
  /* ... بقیه استایل‌ها ... */
  transform: none !important;
}

.video-thumbnail img {
  /* ... بقیه استایل‌ها ... */
  transform: none !important;
}

.general-description-box {
  margin-bottom: 12px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.general-description-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 500;
}

.general-desc-icon {
  color: rgba(255, 255, 255, 0.5);
}

.general-description-textarea {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: white;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.general-description-textarea::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.general-description-textarea:focus {
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.08);
}

.video-description-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.description-icon {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.description-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-family: inherit;
  padding: 0;
}

.description-field::placeholder {
  color: rgba(255, 255, 255, 0.3);
}





.description-icon {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.description-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-size: 13px;
  font-family: inherit;
}

.description-field::placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.uploaded-video-item {
  border-radius: 14px;
}

      .progress-bar-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px;
  gap: 0;
}

.progress-circle {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  flex-shrink: 0;
}

.progress-circle.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.progress-circle.current {
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
}

.progress-line {
  flex: 1;
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
  border-radius: 2px;
  transition: all 0.3s ease;
  max-width: 40px;
}

.progress-line.active {
  background: #3b82f6;
}


        .video-upload-card {
          margin: 0 0px 50px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
          overflow: hidden;
          position: relative;
        }

        .slider-wrapper {
          position: relative;
          width: 100%;
          overflow: hidden;
        }

        .step-content {
          width: 100%;
          transition: transform 0.4s ease, opacity 0.3s ease;
          top: 0;
          left: 0;
        }

        .step-inner {
          padding: 16px;
        }

        /* Step 1 Styles */
        .upload-empty-state {
          padding: 24px;
        }

        .upload-header-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 16px;
        }

        .upload-cloud-icon {
          width: 70px;
          height: 70px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }

        .upload-cloud-icon.small {
          width: 44px;
          height: 44px;
        }

        .upload-text-content {
          flex: 1;
        }

        .upload-title {
          color: white;
          font-size: 17px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .upload-description-text {
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          margin: 0;
        }

        .upload-button {
          width: 100%;
          padding: 14px 24px;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: rgba(255, 255, 255, 0.12);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .upload-button:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        .upload-button:active {
          transform: scale(0.98);
        }

        .upload-videos-list {
          padding: 10px;
        }

        .upload-list-header {
          margin-bottom: 12px;
        }

        .upload-list-header .upload-header-row {
          margin-bottom: 0;
        }

        .uploaded-videos {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
          overflow-y: auto;
        }

        .video-item-wrapper {
          display: flex;
          flex-direction: column;
        }

        .uploaded-video-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: all 0.2s;
        }

        .uploaded-video-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .uploaded-video-item.selected {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.08);
}

        .video-thumbnail {
          position: relative;
          width: 50px;
          height: 50px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .video-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-thumbnail-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
        }

        .video-duration-badge {
          position: absolute;
          bottom: 2px;
          right: 2px;
          padding: 2px 4px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.75);
          color: white;
          font-size: 9px;
          font-weight: 500;
        }

        .video-info {
          flex: 1;
          min-width: 0;
        }

        .video-name {
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          font-weight: 500;
          margin: 0 0 2px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .video-size {
          color: rgba(255, 255, 255, 0.4);
          font-size: 11px;
          margin: 0;
        }

        .remove-video-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(239, 68, 68, 1);
          color: #ffffffff;
          flex-shrink: 0;
        }

        .remove-video-btn:hover {
          background: rgba(239, 68, 68, 0.25);
        }

        .remove-video-btn:active {
          transform: scale(0.9);
        }

        

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }



        .add-more-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.2);
          background: rgba(30, 255, 0, 0.13);
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 10px;
        }

        .add-more-button:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.8);
        }

        .add-more-button:active {
          transform: scale(0.98);
        }

        /* Common Step Styles */
        .back-button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          border-radius: 10px;
          border: none;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 16px;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        .back-button:active {
          transform: scale(0.98);
        }

        .step-header {
          margin-bottom: 16px;
        }

        .step-title {
          color: white;
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }

        .step-subtitle {
          color: rgba(255, 255, 255, 0.5);
          font-size: 13px;
          margin: 0;
        }

        .options-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .option-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: all 0.2s;
        }

        .option-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .option-item.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .radio-circle {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .option-item.selected .radio-circle {
          border-color: #3b82f6;
        }

        .radio-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #3b82f6;
        }

        .checkbox-square {
          width: 20px;
          height: 20px;
          border-radius: 6px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.2s;
          color: white;
        }

        .option-item.selected .checkbox-square {
          border-color: #3b82f6;
          background: #3b82f6;
        }

        .option-content {
          display: flex;
          flex: 1;
          justify-content: space-between;
          align-items: center;
        }

        .option-label {
          color: white;
          font-size: 14px;
          font-weight: 500;
        }

        .option-desc {
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
        }

        .option-price {
          color: #10b981;
          font-size: 13px;
          font-weight: 600;
        }

        .continue-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .continue-button:hover:not(.disabled) {
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .continue-button:active:not(.disabled) {
          transform: scale(0.98);
        }

        .continue-button.disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          cursor: not-allowed;
          box-shadow: none;
        }

        .submit-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .submit-button:hover {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }

        .submit-button:active {
          transform: scale(0.98);
        }

        /* Login Modal Styles */
        .login-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;


          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .login-modal-content {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: rgba(30, 30, 35, 0.95);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 1;
        }

        .login-modal-close:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }
      `}</style>
    </div>
  );
};

export default VideoUploadCard;