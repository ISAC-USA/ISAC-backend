const express = require('express');
const router = express.Router();
const {
  registerForWebinar,
  getAllWebinars,
  getWebinarById,
  getWebinarRegistrations,
  getWebinarStats
} = require('../controllers/webinarController');

// GET /api/webinars - Get all webinars with filtering and pagination
router.get('/', getAllWebinars);

// GET /api/webinars/stats - Get webinar statistics
router.get('/stats', getWebinarStats);

// GET /api/webinars/:id - Get webinar by ID
router.get('/:id', getWebinarById);

// GET /api/webinars/:id/registrations - Get registrations for a specific webinar (admin)
router.get('/:id/registrations', getWebinarRegistrations);

// POST /api/webinars/register - Register for a webinar
router.post('/register', registerForWebinar);

module.exports = router; 