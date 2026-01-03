import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Upload,
  FolderUp,
  FileText,
  Cloud,
  ChevronRight
} from 'lucide-react';

const UploadModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const options = [
    { icon: Upload, label: t('uploadVideo'), id: 'upload' },
    { icon: FolderUp, label: t('uploadMultiple'), id: 'multiple' },
    { icon: FileText, label: t('continueDraft'), id: 'draft' },
    { icon: Cloud, label: t('pasteCloudLink'), id: 'cloud' },
  ];

  return (
    <div className="modal-overlay-ios26" onClick={onClose}>
      <div className="liquid-glass-modal" onClick={e => e.stopPropagation()}>
        <div className="glass-handle"></div>
        
        <div className="glass-options">
          {options.map((option) => (
            <div key={option.id} className="glass-option-item">
              <div className="glass-icon-container">
                <option.icon size={22} strokeWidth={1.5} />
              </div>
              <span className="glass-option-label">{option.label}</span>
              <ChevronRight size={18} className="glass-chevron" />
            </div>
          ))}
        </div>
      </div>
      
      <style>{`
        .modal-overlay-ios26 {
          position: absolute;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 110px;
          background: transparent;
        }

     .liquid-glass-modal {
  width: 88%;
  max-width: 340px;
  position: relative;
  padding: 14px 14px 22px;
  border-radius: 34px;

  /* بلور واقعی iOS */
  background: rgba(255, 255, 255, 0.47);
  backdrop-filter: blur(5px) saturate(220%) brightness(1);
  -webkit-backdrop-filter: blur(5px) saturate(220%) brightness(0.87);

  border: 1px solid rgba(255, 255, 255, 0.62);

  box-shadow:
    0 24px 100px rgba(0, 0, 0, 0.55),
    0 18px 48px rgba(0, 0, 0, 0.35),
    0 0 48px rgba(120, 180, 255, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);

  transform-origin: center bottom;
  animation: bubblePop 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

/* نورهای درخشانِ کناری */
.liquid-glass-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 34px;
  pointer-events: none;

  background:
    linear-gradient(
      90deg,
      rgba(160, 210, 255, 0.55),
      transparent 30%
    ),
    linear-gradient(
      -90deg,
      rgba(160, 210, 255, 0.55),
      transparent 30%
    );

  filter: blur(24px);
  opacity: 0.9;
  animation: edgeGlow 4s ease-in-out infinite;
}

/* نور داخلی شیشه */
.liquid-glass-modal::after {
 
  );

  mix-blend-mode: screen;
  opacity: 0.6;
}

/* نویز شیشه‌ای subtle */
.liquid-glass-modal .glass-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgYWJsaWdtbmFtZT0ibm9pc2UtZ3JhZGllZW50IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmc+PHBhdGggZD0iTTEwMCwwIEMyNTAsNjAgNTAsMTYwIDUwLDI0MCBDNTAwLDE2MCA1MDAuMTEgNTAwLDEyMCA1MDAuMjQgODAsNTEwIEM0MDAuMDEgMzg1LDEwOCAyMzAsMC4wOCAyMDAuMSwyMDAuMSIgZmlsbD0iI0ZmZmY4NDIiLz4KPC9zdmc+Cg==');
  background-size: 100px 100px;
  opacity: 0.2;
  mix-blend-mode: multiply;
  animation: noise 1.6s infinite linear;
}

/* انیمیشن‌های متناسب */
@keyframes edgeGlow {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}

/* انیمیشن باز شدن مثل مینیمایز/ماکسیمایز مک */
@keyframes bubblePop {
  0% {
    opacity: 0;
    transform: scale(0.1) translateY(30px); /* شروع کوچک و پایین */
  }
  50% {
    opacity: 0.7;
    transform: scale(1.02) translateY(-6px); /* میانه کار، مقداری بزرگتر و بالاتر */
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0); /* پایان با اندازه واقعی و محل درست */
  }
}

/* مودال با انیمیشن جدید */
.liquid-glass-modal {
  width: 88%;
  max-width: 340px;
  position: relative;
  padding: 14px 14px 22px;
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.53);
  backdrop-filter: blur(5px) saturate(220%) brightness(1);
  -webkit-backdrop-filter: blur(8px) saturate(220%) brightness(1);
  border: 1px solid rgba(255, 255, 255, 0.62);

  box-shadow:
    0 24px 100px rgba(0, 0, 0, 0.55),
    0 18px 48px rgba(0, 0, 0, 0.35),
    0 0 48px rgba(120, 180, 255, 0.22),
    inset 0 1px 1px rgba(255, 255, 255, 0.35);

  transform-origin: center bottom;
  animation: bubblePop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}


@keyframes noise {
  0% { transform: translate(0px, 0px); }
  50% { transform: translate(2px, 2px); }
  100% { transform: translate(0px, 0px); }
}


/* نورهای درخشانِ کناری */
.liquid-glass-modal::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 34px;
  pointer-events: none;

  background:
    linear-gradient(
      90deg,
      rgba(160, 210, 255, 0.55),
      transparent 30%
    ),
    linear-gradient(
      -90deg,
      rgba(160, 210, 255, 0.55),
      transparent 30%
    );

  filter: blur(24px);
  opacity: 0.9;
  animation: edgeGlow 4s ease-in-out infinite;
}

/* نور داخلی شیشه */
.liquid-glass-modal::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 33px;
  pointer-events: none;

  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.32),
    rgba(255, 255, 255, 0.10),
    transparent 70%
  );

  mix-blend-mode: screen;
  opacity: 0.6;
}

/* نویز شیشه‌ای subtle */
.liquid-glass-modal .glass-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgYWJsaWdtbmFtZT0ibm9pc2UtZ3JhZGllZW50IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmc+PHBhdGggZD0iTTEwMCwwIEMyNTAsNjAgNTAsMTYwIDUwLDI0MCBDNTAwLDE2MCA1MDAuMTEgNTAwLDEyMCA1MDAuMjQgODAsNTEwIEM0MDAuMDEgMzg1LDEwOCAyMzAsMC4wOCAyMDAuMSwyMDAuMSIgZmlsbD0iI0ZmZmY4NDIiLz4KPC9zdmc+Cg==');
  background-size: 100px 100px;
  opacity: 0.12;
  mix-blend-mode: multiply;
  animation: noise 0.6s infinite linear;
}

/* انیمیشن‌های متناسب */
@keyframes edgeGlow {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}

@keyframes bubblePop {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(14px);
  }
  60% {
    opacity: 1;
    transform: scale(1.02) translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes noise {
  0% { transform: translate(0px, 0px); }
  50% { transform: translate(2px, 2px); }
  100% { transform: translate(0px, 0px); }
}


        .liquid-glass-modal::before {
          content: '';
          position: absolute;
          top: 0;
          left: 24px;
          right: 24px;
          height: 0.5px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.6) 50%,
            transparent 100%
          );
        }

        .liquid-glass-modal::after {
          content: '';
          position: absolute;
          bottom: -25px;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 50px;
          background: radial-gradient(
            ellipse at center,
            rgba(188, 188, 188, 0.4) 0%,
            transparent 70%
          );
          filter: blur(15px);
          pointer-events: none;
        }

        .glass-handle {
          width: 36px;
          height: 5px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 3px;
          margin: 4px auto 14px;
        }

        .glass-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .glass-option-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 22px;
          
       
          
     ;
          
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .glass-option-item:hover {
          background: rgba(203, 203, 203, 0.18);
          transform: scale(1.02);
        }

        .glass-option-item:active {
          transform: scale(0.98);
        }

        .glass-icon-container {
          width: 42px;
          height: 42px;
          
  
          
          
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000000ff;
          
        }

        .glass-option-label {
          flex: 1;
          color: rgba(0, 0, 0, 0.95);
          font-size: 16px;
          font-weight: 500;
        }

        .glass-chevron {
          color: rgba(0, 0, 0, 0.35);
        }

        /* 🫧 Bubble Pop - فقط Sheet */
        @keyframes bubblePop {
          0% {
            opacity: 0;
            transform: scale(0.1) translateY(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default UploadModal;