// Helper functions for the backend

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate .edu email specifically for webinar registrations
const isValidEduEmail = (email) => {
  const eduEmailRegex = /^[^\s@]+@[^\s@]+\.edu$/i;
  return eduEmailRegex.test(email) && isValidEmail(email);
};

// Validate phone number format (country code + 10 digits)
const isValidPhone = (phone) => {
  // Expected format: +[country code][10 digits] (e.g., +19876543210)
  const phoneRegex = /^\+\d{1,4}\d{10}$/;
  return phoneRegex.test(phone);
};

// Sanitize string input
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
};

// Generate random string
const generateRandomString = (length = 10) => {
  return Math.random().toString(36).substring(2, length + 2);
};

// Format mentor data for API response
const formatMentorData = (mentor) => {
  return {
    id: mentor.id,
    name: mentor.full_name,
    specialty: mentor.specialty,
    university: mentor.university,
    degree: mentor.degree,
    location: mentor.location,
    languages: mentor.languages,
    bio: mentor.bio,
    image: mentor.profile_image_url,
    social: mentor.social_links,
    rating: parseFloat(mentor.rating) || 0,
    totalReviews: mentor.total_reviews || 0,
    experienceYears: mentor.experience_years,
    createdAt: mentor.created_at
  };
};

// Build pagination info
const buildPaginationInfo = (page, limit, totalItems) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    currentPage: parseInt(page),
    totalPages,
    totalItems,
    itemsPerPage: parseInt(limit),
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// Handle async errors
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validate required fields
const validateRequiredFields = (data, requiredFields) => {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  
  return missing;
};

module.exports = {
  isValidEmail,
  isValidEduEmail,
  isValidPhone,
  sanitizeString,
  generateRandomString,
  formatMentorData,
  buildPaginationInfo,
  asyncHandler,
  validateRequiredFields
}; 