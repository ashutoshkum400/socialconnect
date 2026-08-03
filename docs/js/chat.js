/* ==========================================================================
   SocialConnect — chat.js
   Reusable chat utility functions (for future modularization).
   All live chat logic is integrated in dashboard.js.
   ========================================================================== */

'use strict';

/**
 * Build a sorted, canonical chat room key from two user IDs.
 * Matches the server-side chatKey() helper so keys are always consistent.
 *
 * @param {string} a - First user ID
 * @param {string} b - Second user ID
 * @returns {string} e.g. "abc_xyz"
 */
function buildChatKey(a, b) {
  return [a, b].sort().join('_');
}

/**
 * Given a chatKey and the current user's ID, extract the other participant's ID.
 *
 * @param {string} chatKey - The sorted chat key
 * @param {string} myId    - The current user's ID
 * @returns {string|null}
 */
function otherUserFromKey(chatKey, myId) {
  const parts = (chatKey || '').split('_');
  return parts.find(id => id !== myId) || null;
}

/**
 * Format a message timestamp into a short human-readable string.
 *
 * @param {string} dateStr - ISO date string
 * @returns {string} e.g. "2:45 PM"
 */
function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a chat date separator string.
 * Returns "Today", "Yesterday", or a locale date string.
 *
 * @param {string} dateStr - ISO date string
 * @returns {string}
 */
function formatChatDayLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Truncate a message preview to a given length, appending "…" if needed.
 *
 * @param {string} text   - The message text
 * @param {number} maxLen - Maximum characters (default 40)
 * @returns {string}
 */
function truncatePreview(text, maxLen = 40) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/**
 * Determine whether two message timestamps fall on different calendar days.
 * Used to decide when to insert a date separator between chat bubbles.
 *
 * @param {string} dateA - ISO date string
 * @param {string} dateB - ISO date string
 * @returns {boolean}
 */
function isDifferentDay(dateA, dateB) {
  if (!dateA || !dateB) return true;
  return new Date(dateA).toDateString() !== new Date(dateB).toDateString();
}

/**
 * Create a fallback avatar URL via ui-avatars.com.
 *
 * @param {string} name       - Display name for initials
 * @param {number} [size=60]  - Pixel size
 * @returns {string} URL
 */
function chatAvatarUrl(name, size = 60) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random&color=fff&size=${size}`;
}

/**
 * Sanitise a string for safe insertion into HTML.
 *
 * @param {string} str
 * @returns {string}
 */
function chatEscapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Export for environments that support ES modules (e.g. bundler pipeline).
// dashboard.js uses these functions inline; this file exists for reuse in
// other pages (e.g. a dedicated /messages.html) or a future module system.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildChatKey,
    otherUserFromKey,
    formatMessageTime,
    formatChatDayLabel,
    truncatePreview,
    isDifferentDay,
    chatAvatarUrl,
    chatEscapeHtml,
  };
}
