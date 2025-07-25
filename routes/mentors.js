const express = require('express');
const router = express.Router();
const {
  getAllMentors,
  getMentorById,
  getMentorStats,
  submitMentorApplication,
  getFilterOptions
} = require('../controllers/mentorController');

// GET /api/mentors - Get all mentors with filtering and pagination
router.get('/', getAllMentors);

// GET /api/mentors/stats - Get mentor statistics
router.get('/stats', getMentorStats);

// GET /api/mentors/filter-options - Get filter options
router.get('/filter-options', getFilterOptions);

// GET /api/mentors/:id - Get mentor by ID
router.get('/:id', getMentorById);

// POST /api/mentors/apply - Submit mentor application
router.post('/apply', submitMentorApplication);

module.exports = router; 