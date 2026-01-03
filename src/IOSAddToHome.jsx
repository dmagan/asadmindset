import { useEffect, useState } from 'react';

const isIOS = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent);

const isInstalled = () =>
  window.navigator.standalone === true;

export default function IOSAddToHome() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIOS() && !isInstalled() && !localStorage.getItem('iosA2HS')) {
      setShow(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem('iosA2HS', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={overlay}>
      <div style={sheet}>
        <div style={handle} />
        <p style={text}>
          برای نصب <b>Cutify</b><br />
          روی <b>Share</b> بزن و<br />
          <b>Add to Home Screen</b> رو انتخاب کن
        </p>
        <button style={btn} onClick={close}>فهمیدم</button>
      </div>
    </div>
  );
}

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-end',
  zIndex: 9999
};

const sheet = {
  width: '92%',
  marginBottom: 18,
  padding: 18,
  borderRadius: 28,
  background: 'rgba(255,255,255,0.55)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
  textAlign: 'center'
};

const handle = {
  width: 38,
  height: 5,
  background: 'rgba(0,0,0,0.25)',
  borderRadius: 3,
  margin: '0 auto 12px'
};

const text = {
  fontSize: 15,
  lineHeight: 1.6,
  marginBottom: 14
};

const btn = {
  border: 'none',
  borderRadius: 16,
  padding: '10px 20px',
  background: '#000',
  color: '#fff',
  fontSize: 14
};
