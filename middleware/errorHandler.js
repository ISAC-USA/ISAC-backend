// Error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error response
  let error = {
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error.message = 'Validation error';
    error.details = err.message;
    return res.status(400).json(error);
  }

  if (err.name === 'CastError') {
    error.message = 'Invalid ID format';
    return res.status(400).json(error);
  }

  if (err.code === '23505') { // PostgreSQL unique constraint violation
    error.message = 'Duplicate entry';
    return res.status(400).json(error);
  }

  if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    error.message = 'Referenced record not found';
    return res.status(400).json(error);
  }

  if (err.code === '23502') { // PostgreSQL not-null constraint violation
    error.message = 'Missing required field';
    return res.status(400).json(error);
  }

  // Handle rate limit errors
  if (err.status === 429) {
    error.message = 'Too many requests';
    return res.status(429).json(error);
  }

  // Default to 500 server error
  res.status(err.status || 500).json(error);
};

// 404 handler - should be used as the last middleware
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
}; 