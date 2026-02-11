/**
 * Parse server date string correctly.
 * Server sends dates like "2026-02-11 15:30:00" without timezone.
 * MySQL CURRENT_TIMESTAMP and WordPress current_time('mysql') use the server's WordPress timezone.
 * 
 * We append 'Z' to treat as UTC, then the browser handles conversion to local time.
 * This works because WordPress timezone is configured to match the intended timezone.
 * 
 * IMPORTANT: Make sure WordPress Settings > General > Timezone is set to UTC
 * OR update all current_time('mysql') calls to use gmdate('Y-m-d H:i:s')
 */

/**
 * Parse a date string from the server into a proper Date object.
 * Handles: "2026-02-11 15:30:00", "2026-02-11T15:30:00", "2026-02-11T15:30:00Z"
 */
export const parseServerDate = (dateString) => {
  if (!dateString) return null;
  // If already has timezone info, parse directly
  if (dateString.endsWith('Z') || dateString.includes('+') || dateString.includes('T')) {
    return new Date(dateString);
  }
  // Server date without timezone - treat as UTC by appending Z
  // Replace space with T for ISO format compatibility (Safari requires this)
  return new Date(dateString.replace(' ', 'T') + 'Z');
};

/**
 * Format relative time in Persian (e.g., "۵ دقیقه پیش")
 */
export const formatRelativeTime = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'همین الان';
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  if (hours < 24) return `${hours} ساعت پیش`;
  if (days < 7) return `${days} روز پیش`;
  return date.toLocaleDateString('fa-IR');
};

/**
 * Format short relative time for conversation lists (e.g., "۵ دقیقه")
 */
export const formatConvTime = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'الان';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} دقیقه`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} ساعت`;
  return date.toLocaleDateString('en-US');
};

/**
 * Format message time (HH:MM) - for chat bubbles
 */
export const formatMsgTime = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date || isNaN(date.getTime())) return '';
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
};