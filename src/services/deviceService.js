import { authService } from './authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const detectBrowser = () => {
  const ua = navigator.userAgent;
  let browser = 'unknown';
  let version = '';

  if (/edg\/([\.\d]+)/i.test(ua)) {
    browser = 'Edge'; version = ua.match(/edg\/([\.\d]+)/i)?.[1] || '';
  } else if (/opr\/([\.\d]+)/i.test(ua)) {
    browser = 'Opera'; version = ua.match(/opr\/([\.\d]+)/i)?.[1] || '';
  } else if (/samsungbrowser\/([\.\d]+)/i.test(ua)) {
    browser = 'Samsung'; version = ua.match(/samsungbrowser\/([\.\d]+)/i)?.[1] || '';
  } else if (/firefox\/([\.\d]+)/i.test(ua)) {
    browser = 'Firefox'; version = ua.match(/firefox\/([\.\d]+)/i)?.[1] || '';
  } else if (/chrome\/([\.\d]+)/i.test(ua) && !/chromium/i.test(ua)) {
    browser = 'Chrome'; version = ua.match(/chrome\/([\.\d]+)/i)?.[1] || '';
  } else if (/version\/([\.\d]+)/i.test(ua) && /safari/i.test(ua)) {
    browser = 'Safari'; version = ua.match(/version\/([\.\d]+)/i)?.[1] || '';
  } else if (/trident/i.test(ua)) {
    browser = 'IE'; version = ua.match(/rv:([\d.]+)/i)?.[1] || '';
  }

  if (version) version = version.split('.').slice(0, 2).join('.');
  return { browser, version };
};

const isPWAInstalled = () => {
  if (typeof navigator.standalone === 'boolean') return navigator.standalone;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
};

// user_id رو مستقیم از JWT token می‌گیریم — همیشه موجوده
const getUidFromToken = () => {
  try {
    const token = authService.getToken();
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    // JWT Auth WordPress plugin ساختارش اینه:
    return payload?.data?.user?.id || payload?.user_id || payload?.sub || null;
  } catch (e) {
    return null;
  }
};

export const pingDevice = async (user) => {
  const token = authService.getToken();
  if (!token) return;

  // اول از user object، بعد از JWT token
  const uid = user?.id || user?.ID || getUidFromToken();
  console.log('[Device] uid:', uid, '| user:', user);
  if (!uid) {
    console.log('[Device] Could not find uid anywhere');
    return;
  }

  const { browser, version } = detectBrowser();
  const pwaInstalled = isPWAInstalled();

  console.log('[Device] Pinging:', { uid, browser, version, pwaInstalled });

  try {
    const res = await fetch(`${API_URL}/device/ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        user_agent:    navigator.userAgent,
        browser,
        browser_ver:   version,
        pwa_installed: pwaInstalled,
      }),
    });
    const data = await res.json();
    console.log('[Device] Result:', res.status, data);
  } catch (e) {
    console.log('[Device] Fetch error:', e);
  }
};

export const DEVICE_INFO = {
  ios:     { label: 'iOS',     icon: '🍎', color: '#a8b0be' },
  android: { label: 'Android', icon: '🤖', color: '#3ddc84' },
  windows: { label: 'Windows', icon: '🪟', color: '#00a4ef' },
  mac:     { label: 'Mac',     icon: '💻', color: '#c0c0c0' },
  linux:   { label: 'Linux',   icon: '🐧', color: '#f59e0b' },
  unknown: { label: 'نامشخص',  icon: '📱', color: '#6b7280' },
};

export const BROWSER_INFO = {
  Chrome:  { icon: '🟡', color: '#fbbc04' },
  Safari:  { icon: '🔵', color: '#006cff' },
  Firefox: { icon: '🦊', color: '#ff7139' },
  Edge:    { icon: '🌊', color: '#0078d4' },
  Opera:   { icon: '🔴', color: '#ff1b2d' },
  Samsung: { icon: '📱', color: '#1428a0' },
  IE:      { icon: '🌐', color: '#1ebbee' },
  unknown: { icon: '🌐', color: '#6b7280' },
};