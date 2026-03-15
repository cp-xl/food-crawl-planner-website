// Strip HTML tags from a string. Used for sanitising user-provided text
// before writing to Firestore or logging.

module.exports = function stripHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
};
