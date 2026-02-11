import { useEffect, useRef, useCallback } from 'react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

/**
 * Hook to track user presence in a chat conversation.
 * - Sends heartbeat every 25s ONLY when app is visible AND focused
 * - When user switches to another app → sends "left" via sendBeacon (reliable)
 * - When user comes back → sends presence again
 */
const usePresence = (chatType, conversationId) => {
  const intervalRef = useRef(null);
  const convIdRef = useRef(conversationId);
  const chatTypeRef = useRef(chatType);

  convIdRef.current = conversationId;
  chatTypeRef.current = chatType;

  const sendPresence = useCallback(async () => {
    try {
      const token = authService.getToken();
      const convId = convIdRef.current;
      if (!token || !convId) return;
      await fetch(`${API_URL}/push/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatType: chatTypeRef.current, conversationId: convId })
      });
    } catch (e) {}
  }, []);

  const sendLeft = useCallback(() => {
    const token = authService.getToken();
    const convId = convIdRef.current;
    if (!token || !convId) return;
    
    // Use sendBeacon for reliable delivery when page is closing/hiding
    const data = JSON.stringify({ 
      chatType: chatTypeRef.current, 
      leftConversationId: convId,
      token: token 
    });
    
    // Try sendBeacon first (works reliably on page hide)
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: 'application/json' });
      navigator.sendBeacon(`${API_URL}/push/presence-leave`, blob);
    } else {
      // Fallback to fetch with keepalive
      fetch(`${API_URL}/push/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatType: chatTypeRef.current, leftConversationId: convId }),
        keepalive: true
      }).catch(() => {});
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    sendPresence();
    intervalRef.current = setInterval(sendPresence, 25000);
  }, [sendPresence]);

  const stopHeartbeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sendLeft();
  }, [sendLeft]);

  useEffect(() => {
    if (!conversationId) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    // Start if currently visible
    if (document.visibilityState === 'visible') {
      startHeartbeat();
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      sendLeft();
    };
  }, [conversationId, chatType, startHeartbeat, stopHeartbeat, sendLeft]);
};

export default usePresence;