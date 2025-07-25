const pool = require('../config/database');
const { isValidPhone } = require('../utils/helpers');

// Get all mentors with filtering and sorting
const getAllMentors = async (req, res) => {
  try {
    const {
      specialty,
      language,
      location,
      university,
      search,
      sortBy = 'full_name',
      sortOrder = 'ASC',
      page = 1,
      limit = 10
    } = req.query;

    // Build the WHERE clause dynamically
    let whereClause = 'WHERE is_approved = true AND is_active = true';
    const queryParams = [];
    let paramCount = 0;

    // Add filters
    if (specialty && specialty !== 'all') {
      paramCount++;
      whereClause += ` AND specialty = $${paramCount}`;
      queryParams.push(specialty);
    }

    if (language && language !== 'all') {
      paramCount++;
      whereClause += ` AND $${paramCount} = ANY(languages)`;
      queryParams.push(language);
    }

    if (location && location !== 'all') {
      paramCount++;
      whereClause += ` AND location = $${paramCount}`;
      queryParams.push(location);
    }

    if (university && university !== 'all') {
      paramCount++;
      whereClause += ` AND university = $${paramCount}`;
      queryParams.push(university);
    }

    // Add search functionality
    if (search) {
      paramCount++;
      whereClause += ` AND (
        full_name ILIKE $${paramCount} OR 
        specialty ILIKE $${paramCount} OR 
        university ILIKE $${paramCount} OR 
        bio ILIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
    }

    // Build ORDER BY clause
    const validSortFields = ['full_name', 'specialty', 'university', 'created_at'];
    const validSortOrder = ['ASC', 'DESC'];
    
    const orderBy = validSortFields.includes(sortBy) ? sortBy : 'full_name';
    const order = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';

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
        full_name,
        specialty,
        university,
        degree,
        location,
        languages,
        bio,
        profile_image_url,
        social_links,
        rating,
        total_reviews,
        experience_years,
        created_at
      FROM mentors 
      ${whereClause}
      ORDER BY ${orderBy} ${order}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mentors 
      ${whereClause}
    `;

    const [mentorsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
    ]);

    const mentors = mentorsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        mentors,
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
    console.error('Error fetching mentors:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get mentor by ID
const getMentorById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        full_name,
        specialty,
        university,
        degree,
        location,
        languages,
        bio,
        profile_image_url,
        social_links,
        rating,
        total_reviews,
        experience_years,
        created_at
      FROM mentors 
      WHERE id = $1 AND is_approved = true AND is_active = true
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mentor not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching mentor:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get mentor statistics
const getMentorStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_mentors,
        COUNT(DISTINCT specialty) as total_specialties,
        COUNT(DISTINCT university) as total_universities,
        COUNT(DISTINCT location) as total_locations,
        ROUND(AVG(rating), 2) as average_rating
      FROM mentors 
      WHERE is_approved = true AND is_active = true
    `;

    const specialtyStatsQuery = `
      SELECT 
        specialty,
        COUNT(*) as count
      FROM mentors 
      WHERE is_approved = true AND is_active = true
      GROUP BY specialty
      ORDER BY count DESC
    `;

    const [statsResult, specialtyStatsResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(specialtyStatsQuery)
    ]);

    res.json({
      success: true,
      data: {
        overview: statsResult.rows[0],
        specialtyBreakdown: specialtyStatsResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching mentor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Submit mentor application
const submitMentorApplication = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      currentUniversity,
      degree,
      graduationYear,
      specialization,
      experienceYears,
      languages,
      linkedinUrl,
      motivation,
      availability,
      sampleAdvice
    } = req.body;

    // Validate required fields
    const requiredFields = [
      'fullName', 'email', 'phone', 'currentUniversity', 'degree',
      'graduationYear', 'specialization', 'experienceYears', 'languages',
      'motivation', 'availability', 'sampleAdvice'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required field: ${field}`
        });
      }
    }

    // Validate phone number
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number with country code (e.g., +19876543210).'
      });
    }

    // Check if email already exists in applications or mentors
    const emailCheckQuery = `
      SELECT 'application' as source FROM mentor_applications WHERE email = $1
      UNION ALL
      SELECT 'mentor' as source FROM mentors WHERE email = $1
    `;

    const emailCheckResult = await pool.query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists in our system'
      });
    }

    // Insert application
    const insertQuery = `
      INSERT INTO mentor_applications (
        full_name, email, phone, current_university, degree, graduation_year,
        specialization, experience_years, languages, linkedin_url,
        motivation, availability, sample_advice
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      ) RETURNING id, submitted_at
    `;

    const result = await pool.query(insertQuery, [
      fullName, email, phone, currentUniversity, degree, graduationYear,
      specialization, experienceYears, languages, linkedinUrl,
      motivation, availability, sampleAdvice
    ]);

    res.status(201).json({
      success: true,
      message: 'Mentor application submitted successfully',
      data: {
        applicationId: result.rows[0].id,
        submittedAt: result.rows[0].submitted_at
      }
    });

  } catch (error) {
    console.error('Error submitting mentor application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get filter options
const getFilterOptions = async (req, res) => {
  try {
    const queries = {
      specialties: `
        SELECT DISTINCT specialty 
        FROM mentors 
        WHERE is_approved = true AND is_active = true 
        ORDER BY specialty
      `,
      languages: `
        SELECT DISTINCT UNNEST(languages) as language 
        FROM mentors 
        WHERE is_approved = true AND is_active = true 
        ORDER BY language
      `,
      locations: `
        SELECT DISTINCT location 
        FROM mentors 
        WHERE is_approved = true AND is_active = true 
        ORDER BY location
      `,
      universities: `
        SELECT DISTINCT university 
        FROM mentors 
        WHERE is_approved = true AND is_active = true 
        ORDER BY university
      `
    };

    const [specialtiesResult, languagesResult, locationsResult, universitiesResult] = await Promise.all([
      pool.query(queries.specialties),
      pool.query(queries.languages),
      pool.query(queries.locations),
      pool.query(queries.universities)
    ]);

    res.json({
      success: true,
      data: {
        specialties: specialtiesResult.rows.map(row => row.specialty),
        languages: languagesResult.rows.map(row => row.language),
        locations: locationsResult.rows.map(row => row.location),
        universities: universitiesResult.rows.map(row => row.university)
      }
    });

  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllMentors,
  getMentorById,
  getMentorStats,
  submitMentorApplication,
  getFilterOptions
}; 