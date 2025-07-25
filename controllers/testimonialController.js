 const pool = require('../config/database');
const { validateRequiredFields, sanitizeString } = require('../utils/helpers');

// Submit a new testimonial
const submitTestimonial = async (req, res) => {
  try {
    const {
      name,
      age,
      university,
      program,
      location,
      review
    } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'age', 'university', 'program', 'location', 'review'];
    const missingFields = validateRequiredFields(req.body, requiredFields);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate age
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 16 || ageNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 16 and 100'
      });
    }

    // Validate review length
    if (review.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Review must be at least 10 characters long'
      });
    }

    if (review.trim().length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Review must be less than 1000 characters'
      });
    }

    // Sanitize inputs
    const sanitizedData = {
      name: sanitizeString(name),
      age: ageNum,
      university: sanitizeString(university),
      program: sanitizeString(program),
      location: sanitizeString(location),
      review: sanitizeString(review)
    };

    // Check for potential duplicate (same name and university)
    const duplicateQuery = `
      SELECT id FROM testimonials 
      WHERE LOWER(name) = LOWER($1) AND LOWER(university) = LOWER($2)
      AND status != 'rejected'
    `;
    
    const duplicateResult = await pool.query(duplicateQuery, [sanitizedData.name, sanitizedData.university]);
    
    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A testimonial from this student for this university already exists'
      });
    }

    // Insert testimonial with pending status
    const insertQuery = `
      INSERT INTO testimonials (
        name, age, university, program, location, review, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'pending'
      ) RETURNING id, name, created_at
    `;

    const result = await pool.query(insertQuery, [
      sanitizedData.name,
      sanitizedData.age,
      sanitizedData.university,
      sanitizedData.program,
      sanitizedData.location,
      sanitizedData.review
    ]);

    const newTestimonial = result.rows[0];

    // Log for admin notification
    console.log(`New testimonial submitted by ${newTestimonial.name} (ID: ${newTestimonial.id})`);

    res.status(201).json({
      success: true,
      message: 'Testimonial submitted successfully! It will be reviewed and published soon.',
      data: {
        testimonialId: newTestimonial.id,
        name: newTestimonial.name,
        status: 'pending',
        submittedAt: newTestimonial.created_at
      }
    });

  } catch (error) {
    console.error('Error submitting testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all testimonials
const getAllTestimonials = async (req, res) => {
  try {
    const {
      status = 'approved',
      page = 1,
      limit = 50
    } = req.query;

    let whereClause = 'WHERE is_active = true';
    const queryParams = [];
    let paramCount = 0;

    // Add status filter
    if (status && status !== 'all') {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      queryParams.push(status);
    }

    // Calculate pagination
    const offset = (page - 1) * limit;
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Main query
    const query = `
      SELECT 
        id,
        name,
        age,
        university,
        program,
        location,
        review,
        image_url,
        status,
        created_at,
        approved_at,
        display_order
      FROM testimonials
      ${whereClause}
      ORDER BY 
        CASE WHEN display_order > 0 THEN display_order END DESC,
        approved_at DESC,
        created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM testimonials 
      ${whereClause}
    `;

    const [testimonialsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const testimonials = testimonialsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        testimonials,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get testimonial by ID
const getTestimonialById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        name,
        age,
        university,
        program,
        location,
        review,
        image_url,
        status,
        created_at,
        approved_at,
        display_order
      FROM testimonials
      WHERE id = $1 AND is_active = true
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Testimonial not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching testimonial:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get testimonial statistics
const getTestimonialStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_testimonials,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_testimonials,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_testimonials,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_testimonials,
        COUNT(DISTINCT university) as total_universities,
        COUNT(DISTINCT program) as total_programs
      FROM testimonials 
      WHERE is_active = true
    `;

    const universityStatsQuery = `
      SELECT 
        university,
        COUNT(*) as testimonial_count,
        AVG(age) as avg_age
      FROM testimonials
      WHERE is_active = true AND status = 'approved'
      GROUP BY university
      ORDER BY testimonial_count DESC
      LIMIT 10
    `;

    const programStatsQuery = `
      SELECT 
        program,
        COUNT(*) as testimonial_count
      FROM testimonials
      WHERE is_active = true AND status = 'approved'
      GROUP BY program
      ORDER BY testimonial_count DESC
      LIMIT 10
    `;

    const [statsResult, universityStatsResult, programStatsResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(universityStatsQuery),
      pool.query(programStatsQuery)
    ]);

    res.json({
      success: true,
      data: {
        testimonialStats: statsResult.rows[0],
        topUniversities: universityStatsResult.rows,
        topPrograms: programStatsResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching testimonial stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  submitTestimonial,
  getAllTestimonials,
  getTestimonialById,
  getTestimonialStats
}; 