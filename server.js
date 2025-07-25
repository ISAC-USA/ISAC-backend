const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import middleware
const { generalLimiter, strictLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const mentorRoutes = require('./routes/mentors');
const webinarRoutes = require('./routes/webinars');
const testimonialRoutes = require('./routes/testimonials');
const whatsappGroupsRoutes = require('./routes/whatsapp-groups');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/api/', generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/mentors', mentorRoutes);
app.use('/api/webinars', webinarRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/whatsapp-groups', whatsappGroupsRoutes);

// Apply strict rate limiting to sensitive endpoints
app.use('/api/mentors/apply', strictLimiter);
app.use('/api/webinars/register', strictLimiter);
app.use('/api/testimonials/submit', strictLimiter);
app.use('/api/whatsapp-groups/verify/start', strictLimiter);
app.use('/api/whatsapp-groups/verify/resend', strictLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ISAC Backend API',
    version: '1.0.0',
    documentation: 'https://api.isac.com/docs'
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`
🚀 Server running on port ${PORT}
📊 Environment: ${process.env.NODE_ENV}
🌐 Frontend URL: ${process.env.FRONTEND_URL}
📡 API Base URL: http://localhost:${PORT}/api
🏥 Health Check: http://localhost:${PORT}/health
  `);

  // Test email service connection
  try {
    const { testEmailConnection } = require('./utils/emailService');
    await testEmailConnection();
  } catch (error) {
    console.error('⚠️  Email service connection check failed - emails may not work');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app; 