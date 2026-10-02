function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  }
  if (error.status >= 400 && error.status < 500) {
    const messages = {
      400: 'Invalid request',
      413: 'Request body too large',
      415: 'Unsupported encoding or media type',
    };
    return res.status(error.status).json({ success: false, error: messages[error.status] ?? 'Invalid request' });
  }
  console.error(error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

module.exports = errorHandler;
