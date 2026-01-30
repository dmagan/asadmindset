import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ImageZoomModal = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isGesturing, setIsGesturing] = useState(false);
  
  const containerRef = useRef(null);
  const lastTouchRef = useRef(null);
  const lastPinchDistanceRef = useRef(null);
  const lastTapRef = useRef(0);
  const isPinchingRef = useRef(false);
  const isDraggingRef = useRef(false);
  
  // Notify App that zoom is open/closed
  useEffect(() => {
    window.dispatchEvent(new Event('imageZoomOpen'));
    
    const unlockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.unlock) {
          await screen.orientation.unlock();
        }
      } catch (e) {
        console.log('Orientation unlock not supported');
      }
    };
    
    const lockOrientation = async () => {
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('portrait');
        }
      } catch (e) {
        console.log('Orientation lock not supported');
      }
    };
    
    unlockOrientation();
    
    return () => {
      window.dispatchEvent(new Event('imageZoomClose'));
      lockOrientation();
    };
  }, []);
  
  // Calculate distance between two touch points
  const getDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Handle touch start
  const handleTouchStart = useCallback((e) => {
    const touches = e.touches;
    setIsGesturing(true);
    
    if (touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        e.preventDefault();
        setIsGesturing(false);
        if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        lastTouchRef.current = {
          x: touches[0].clientX,
          y: touches[0].clientY
        };
        isDraggingRef.current = true;
      }
      isPinchingRef.current = false;
    }
    
    if (touches.length === 2) {
      e.preventDefault();
      isPinchingRef.current = true;
      isDraggingRef.current = false;
      lastPinchDistanceRef.current = getDistance(touches);
    }
  }, [scale]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e) => {
    const touches = e.touches;
    
    if (touches.length === 2 && isPinchingRef.current) {
      e.preventDefault();
      
      const currentDistance = getDistance(touches);
      
      if (lastPinchDistanceRef.current !== null) {
        const distanceChange = currentDistance - lastPinchDistanceRef.current;
        const scaleDelta = distanceChange * 0.008;
        
        setScale(prev => {
          let newScale = prev + scaleDelta;
          newScale = Math.max(1, Math.min(3, newScale));
          
          if (newScale <= 1) {
            setPosition({ x: 0, y: 0 });
          }
          
          return newScale;
        });
      }
      
      lastPinchDistanceRef.current = currentDistance;
    }
    
    if (touches.length === 1 && isDraggingRef.current && scale > 1) {
      e.preventDefault();
      
      const touch = touches[0];
      if (lastTouchRef.current) {
        const deltaX = touch.clientX - lastTouchRef.current.x;
        const deltaY = touch.clientY - lastTouchRef.current.y;
        
        const maxPanX = (scale - 1) * 250;
        const maxPanY = (scale - 1) * 300;
        
        setPosition(prev => ({
          x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + deltaX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + deltaY))
        }));
      }
      
      lastTouchRef.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    }
  }, [scale]);
  
  // Handle touch end
  const handleTouchEnd = useCallback((e) => {
    const touches = e.touches;
    
    if (touches.length === 0) {
      isPinchingRef.current = false;
      isDraggingRef.current = false;
      lastPinchDistanceRef.current = null;
      lastTouchRef.current = null;
      setIsGesturing(false);
    } else if (touches.length === 1) {
      isPinchingRef.current = false;
      isDraggingRef.current = true;
      lastPinchDistanceRef.current = null;
      lastTouchRef.current = {
        x: touches[0].clientX,
        y: touches[0].clientY
      };
    }
  }, []);
  
  // Handle overlay click to close
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);
  
  const modalContent = (
    <div className="image-zoom-modal-overlay" onClick={handleOverlayClick}>
      <button className="zoom-modal-close-btn" onClick={onClose}>
        <X size={24} />
      </button>
      
      <div className="zoom-hint">
        {scale <= 1 ? 'دو ضربه یا با دو انگشت زوم کنید' : `${Math.round(scale * 100)}%`}
      </div>
      
      <div
        ref={containerRef}
        className="pinch-zoom-wrapper"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={src}
          alt="Zoomed"
          className="pinch-zoom-img"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isGesturing ? 'none' : 'transform 0.2s ease-out'
          }}
          draggable={false}
        />
      </div>
      
      <style>{`
        .image-zoom-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.98);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          animation: fadeInZoom 0.2s ease-out;
          touch-action: none;
        }
        
        @keyframes fadeInZoom {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .zoom-modal-close-btn {
          position: fixed;
          top: env(safe-area-inset-top, 20px);
          right: 20px;
          margin-top: 20px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: none;
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1000000;
          transition: all 0.2s;
        }
        
        .zoom-modal-close-btn:active {
          transform: scale(0.95);
          background: rgba(255, 255, 255, 0.25);
        }
        
        .zoom-hint {
          position: fixed;
          bottom: env(safe-area-inset-bottom, 30px);
          margin-bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          color: rgba(255, 255, 255, 0.8);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
          z-index: 1000000;
          pointer-events: none;
        }
        
        .pinch-zoom-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          touch-action: none;
        }
        
        .pinch-zoom-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          transform-origin: center center;
          will-change: transform;
          user-select: none;
          -webkit-user-drag: none;
        }
      `}</style>
    </div>
  );
  
  // Use Portal to render outside of phone-frame
  return createPortal(modalContent, document.body);
};

export default ImageZoomModal;