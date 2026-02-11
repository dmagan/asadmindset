import { useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';

const API_URL = 'https://asadmindset.com/wp-json/asadmindset/v1';

/**
 * Hook to fetch online status for a list of user IDs.
 * Polls every 30s.
 * 
 * @param {number[]} userIds - array of user IDs to check
 * @returns {object} - { [userId]: { online: bool, lastSeen: string|null } }
 */
const useOnlineStatus = (userIds) => {
  const [statuses, setStatuses] = useState({});
  const intervalRef = useRef(null);
  const userIdsRef = useRef(userIds);
  userIdsRef.current = userIds;

  const fetchStatuses = async () => {
    try {
      const ids = userIdsRef.current;
      if (!ids || ids.length === 0) return;
      const token = authService.getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/push/online-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userIds: ids })
      });
      const data = await res.json();
      if (data.users) setStatuses(data.users);
    } catch (e) {}
  };

  useEffect(() => {
    if (!userIds || userIds.length === 0) return;
    fetchStatuses();
    intervalRef.current = setInterval(fetchStatuses, 30000);
    return () => clearInterval(intervalRef.current);
  }, [JSON.stringify(userIds)]);

  return statuses;
};

/**
 * Format lastSeen for display in Persian
 */
export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return '';
  const now = new Date();
  const seen = new Date(lastSeen);
  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'لحظاتی پیش';
  if (diffMin < 60) return `${diffMin} دقیقه پیش`;
  if (diffHour < 24) return `${diffHour} ساعت پیش`;
  if (diffDay < 7) return `${diffDay} روز پیش`;
  return seen.toLocaleDateString('fa-IR');
};

export default useOnlineStatus;