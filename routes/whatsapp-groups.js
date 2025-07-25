const express = require('express');
const router = express.Router();
const whatsappGroupsController = require('../controllers/whatsappGroupsController');
const { generalLimiter, strictLimiter } = require('../middleware/rateLimiter');

// Get all universities
router.get('/universities', generalLimiter, whatsappGroupsController.getUniversities);

// Get WhatsApp groups for a specific university
router.get('/universities/:universityId/groups', generalLimiter, whatsappGroupsController.getUniversityGroups);

// Start verification process (email-based)
router.post('/verify/start', strictLimiter, whatsappGroupsController.startVerification);

// Upload document for verification (admit letter/I-20)
router.post('/verify/upload', strictLimiter, whatsappGroupsController.uploadDocumentVerification);

// Confirm email verification
router.get('/verify/confirm/:token', generalLimiter, whatsappGroupsController.confirmVerification);

// Get user verification status
router.post('/verify/status', generalLimiter, whatsappGroupsController.getVerificationStatus);

// Resend verification email
router.post('/verify/resend', strictLimiter, whatsappGroupsController.resendVerification);

// Admin approve manual verification
router.post('/verify/admin/approve', strictLimiter, whatsappGroupsController.approveManualVerification);

module.exports = router; 