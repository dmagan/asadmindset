import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { authService } from './authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

const firebaseConfig = {
  apiKey: "AIzaSyBR5v8c1t68dw3HrgPkIu1l_twQ5Qjjw7w",
  authDomain: "asadmindset-4d01b.firebaseapp.com",
  projectId: "asadmindset-4d01b",
  storageBucket: "asadmindset-4d01b.firebasestorage.app",
  messagingSenderId: "947229401014",
  appId: "1:947229401014:web:dab4c7d4b8ec60a292eb17"
};

const VAPID_KEY = 'BCi3AjSq7B7i1mTDBxAM0jPX1cx2fIkeFSCJNzB6Jt4Uv4BwAxWNelD7BdmYyhEy2-Yh3IuB96GHIT0HRMzhtgE';

let app = null;
let messaging = null;

const getFirebaseMessaging = () => {
  if (!messaging) {
    try {
      app = initializeApp(firebaseConfig);
      messaging = getMessaging(app);
    } catch (e) {
      console.error('Firebase init error:', e);
      return null;
    }
  }
  return messaging;
};

export const pushService = {

  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  isInstalledPWA() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  },

  getPermissionState() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  async requestPermissionAndGetToken() {
    if (!this.isSupported()) {
      throw new Error('Push not supported on this device');
    }

    // Step 1: Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permission denied');
    }

    // Step 2: Register Firebase SW
    let swRegistration;
    try {
      swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope'
      });
      // Wait for it to be active
      await new Promise((resolve, reject) => {
        if (swRegistration.active) return resolve();
        const sw = swRegistration.installing || swRegistration.waiting;
        if (sw) {
          sw.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') resolve();
            if (e.target.state === 'redundant') reject(new Error('SW became redundant'));
          });
          setTimeout(() => resolve(), 10000);
        } else {
          resolve();
        }
      });
    } catch (e) {
      throw new Error('SW register failed: ' + e.message);
    }

    // Step 3: Get FCM token
    const msg = getFirebaseMessaging();
    if (!msg) throw new Error('Firebase init failed');

    let token;
    try {
      token = await getToken(msg, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration
      });
    } catch (e) {
      throw new Error('FCM token failed: ' + e.message);
    }

    if (!token) throw new Error('Empty FCM token');

    // Step 4: Save to backend
    await this.saveTokenToServer(token);
    localStorage.setItem('fcm_token', token);
    return token;
  },

  async saveTokenToServer(fcmToken) {
    try {
      const jwtToken = authService.getToken();
      if (!jwtToken) return;
      await fetch(`${API_URL}/push/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
        body: JSON.stringify({ token: fcmToken, platform: this.getPlatform() })
      });
    } catch (e) {
      console.error('Failed to save FCM token:', e);
    }
  },

  async removeToken() {
    try {
      const fcmToken = localStorage.getItem('fcm_token');
      if (!fcmToken) return;
      const jwtToken = authService.getToken();
      if (jwtToken) {
        await fetch(`${API_URL}/push/unregister`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwtToken}` },
          body: JSON.stringify({ token: fcmToken })
        });
      }
      localStorage.removeItem('fcm_token');
    } catch (e) {}
  },

  onForegroundMessage(callback) {
    const msg = getFirebaseMessaging();
    if (!msg) return () => {};
    return onMessage(msg, (payload) => {
      console.log('Foreground message:', payload);
      callback(payload);
    });
  },

  getPlatform() {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  },

  isRegistered() {
    return !!localStorage.getItem('fcm_token');
  }
};
