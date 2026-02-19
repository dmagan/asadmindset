import { authService } from './authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';
const FLUSH_INTERVAL = 30000; // هر ۳۰ ثانیه ارسال
const MAX_QUEUE = 100;

// session_id یکبار در بار شدن اپ ساخته می‌شه
const SESSION_ID = Math.random().toString(36).substr(2, 12) + Date.now().toString(36);

let queue = [];
let flushTimer = null;
let sessionStart = Date.now();
let currentTab = null;
let tabStart = null;

// ──────────────────────────────────────────
// ارسال batch به backend
// ──────────────────────────────────────────

const flush = async () => {
  if (queue.length === 0) return;
  const token = authService.getToken();
  if (!token) { queue = []; return; }

  const batch = queue.splice(0, 50);

  try {
    await fetch(`${API_URL}/analytics/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ events: batch }),
    });
  } catch (_) {
    // اگه ارسال fail شد دوباره به صف اضافه نکن — مهم نیست
  }
};

const pushEvent = (type, payload = {}) => {
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({
    type,
    payload,
    session_id: SESSION_ID,
    ts: Date.now(),
  });
};

const startFlushTimer = () => {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL);
};

const stopFlushTimer = () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
};

// ──────────────────────────────────────────
// API عمومی
// ──────────────────────────────────────────

export const analytics = {

  // شروع tracking بعد از لاگین
  start() {
    sessionStart = Date.now();
    pushEvent('session_start');
    pushEvent('app_open');
    startFlushTimer();

    // وقتی اپ بسته یا مخفی می‌شه
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        const duration = Math.round((Date.now() - sessionStart) / 1000);
        if (currentTab) {
          pushEvent('tab_leave', {
            tab: currentTab,
            duration: Math.round((Date.now() - tabStart) / 1000),
          });
        }
        pushEvent('session_end', { duration });
        flush(); // فوری ارسال کن
      } else {
        // برگشت به اپ
        sessionStart = Date.now();
        pushEvent('session_start');
        if (currentTab) {
          tabStart = Date.now();
          pushEvent('tab_view', { tab: currentTab });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopFlushTimer();
      flush();
    };
  },

  // stop tracking بعد از لاگ‌اوت
  stop() {
    const duration = Math.round((Date.now() - sessionStart) / 1000);
    if (currentTab) {
      pushEvent('tab_leave', {
        tab: currentTab,
        duration: Math.round((Date.now() - tabStart) / 1000),
      });
    }
    pushEvent('session_end', { duration });
    pushEvent('app_close');
    flush();
    stopFlushTimer();
    currentTab = null;
    tabStart = null;
  },

  // تغییر تب
  tabChange(newTab) {
    const now = Date.now();

    if (currentTab && currentTab !== newTab) {
      pushEvent('tab_leave', {
        tab: currentTab,
        duration: Math.round((now - tabStart) / 1000),
      });
    }

    currentTab = newTab;
    tabStart = now;
    pushEvent('tab_view', { tab: newTab });
  },

  // تماشای لایو
  liveStart(streamId) {
    pushEvent('live_watch_start', { stream_id: streamId });
  },

  liveEnd(streamId, durationSeconds) {
    pushEvent('live_watch_end', { stream_id: streamId, duration: durationSeconds });
  },

  // بازدید محتوا (پست کانال، آرشیو و...)
  contentView(contentType, contentId) {
    pushEvent('content_view', { content_type: contentType, content_id: contentId });
  },
};

export default analytics;