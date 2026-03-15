// Middleware to enforce Content-Type: application/json on POST routes.
// Prevents malformed requests from reaching route handlers.

module.exports = function validateJson(req, res, next) {
  if (req.method === 'POST') {
    const ct = req.headers['content-type'] ?? '';
    if (!ct.includes('application/json')) {
      return res.status(415).json({
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE',
      });
    }
  }
  next();
};
