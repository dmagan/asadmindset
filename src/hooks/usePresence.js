import { useEffect, useRef } from 'react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

/**
 * Hook to track user presence in a chat conversation.
 * Sends heartbeat every 30s so server knows user is active.
 * On unmount, sends "left" signal.
 * 
 * @param {string} chatType - 'support' or 'team'
 * @param {number|string} conversationId - conversation ID
 */
const usePresence = (chatType, conversationId) => {
  const intervalRef = useRef(null);

  const sendPresence = async (convId) => {
    try {
      const token = authService.getToken();
      if (!token || !convId) return;
      await fetch(`${API_URL}/push/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatType, conversationId: parseInt(convId) })
      });
    } catch (e) {}
  };

  const sendLeft = async (convId) => {
    try {
      const token = authService.getToken();
      if (!token || !convId) return;
      await fetch(`${API_URL}/push/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ chatType, leftConversationId: parseInt(convId) })
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (!conversationId) return;

    // Send initial presence
    sendPresence(conversationId);

    // Heartbeat every 30s
    intervalRef.current = setInterval(() => {
      sendPresence(conversationId);
    }, 30000);

    return () => {
      // Send left on unmount
      clearInterval(intervalRef.current);
      sendLeft(conversationId);
    };
  }, [conversationId, chatType]);
};

export default usePresence;