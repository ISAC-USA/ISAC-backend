const express = require('express');
const router = express.Router();
const {
  submitTestimonial,
  getAllTestimonials,
  getTestimonialById,
  getTestimonialStats
} = require('../controllers/testimonialController');

// GET /api/testimonials - Get all testimonials with filtering and pagination
router.get('/', getAllTestimonials);

// GET /api/testimonials/stats - Get testimonial statistics
router.get('/stats', getTestimonialStats);

// GET /api/testimonials/:id - Get testimonial by ID
router.get('/:id', getTestimonialById);

// POST /api/testimonials/submit - Submit a new testimonial
router.post('/submit', submitTestimonial);

module.exports = router; 