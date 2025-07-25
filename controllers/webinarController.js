const pool = require('../config/database');
const { isValidEduEmail, isValidPhone, validateRequiredFields, sanitizeString } = require('../utils/helpers');
const { sendWebinarConfirmationEmail } = require('../utils/emailService');

// Register for a webinar
const registerForWebinar = async (req, res) => {
  try {
    const {
      webinarId,
      name,
      email,
      phone,
      currentEducation,
      interests,
      experience = 'student'
    } = req.body;

    // Validate required fields
    const requiredFields = ['webinarId', 'name', 'email', 'phone', 'currentEducation', 'interests'];
    const missingFields = validateRequiredFields(req.body, requiredFields);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate .edu email
    if (!isValidEduEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only .edu email addresses are accepted for webinar registrations. Please use your educational institution email.'
      });
    }

    // Validate phone number
    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number with country code (e.g., +19876543210).'
      });
    }

    // Sanitize inputs
    const sanitizedData = {
      webinarId: parseInt(webinarId),
      name: sanitizeString(name),
      email: sanitizeString(email).toLowerCase(),
      phone: sanitizeString(phone),
      currentEducation: sanitizeString(currentEducation),
      interests: sanitizeString(interests),
      experience: sanitizeString(experience)
    };

    // Check if webinar exists and is active
    const webinarQuery = `
      SELECT id, title, presenter_name, event_date, event_time, duration, max_attendees, status
      FROM webinars 
      WHERE id = $1 AND is_active = true
    `;
    
    const webinarResult = await pool.query(webinarQuery, [sanitizedData.webinarId]);
    
    if (webinarResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found or no longer available'
      });
    }

    const webinar = webinarResult.rows[0];

    // Check if webinar is still accepting registrations
    if (webinar.status === 'completed' || webinar.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This webinar is no longer accepting registrations'
      });
    }

    // Check capacity if max_attendees is set
    if (webinar.max_attendees) {
      const capacityQuery = `
        SELECT COUNT(*) as current_registrations
        FROM webinar_registrations 
        WHERE webinar_id = $1
      `;
      
      const capacityResult = await pool.query(capacityQuery, [sanitizedData.webinarId]);
      const currentRegistrations = parseInt(capacityResult.rows[0].current_registrations);
      
      if (currentRegistrations >= webinar.max_attendees) {
        return res.status(400).json({
          success: false,
          message: 'This webinar has reached maximum capacity'
        });
      }
    }

    // Check for duplicate registration
    const duplicateQuery = `
      SELECT id FROM webinar_registrations 
      WHERE webinar_id = $1 AND email = $2
    `;
    
    const duplicateResult = await pool.query(duplicateQuery, [sanitizedData.webinarId, sanitizedData.email]);
    
    if (duplicateResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this webinar'
      });
    }



    // Insert registration
    const insertQuery = `
      INSERT INTO webinar_registrations (
        webinar_id, name, email, phone, current_education, interests
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING id, registered_at
    `;

    const result = await pool.query(insertQuery, [
      sanitizedData.webinarId,
      sanitizedData.name,
      sanitizedData.email,
      sanitizedData.phone,
      sanitizedData.currentEducation,
      sanitizedData.interests,
    ]);

    const registrationId = result.rows[0].id;

    // Send confirmation email
    try {
      const userDetails = {
        name: sanitizedData.name,
        email: sanitizedData.email
      };

      // Format the webinar details for email
      const formatTime = (timeStr) => {
        if (!timeStr) return 'TBD'
        const [hours, minutes] = timeStr.split(':')
        const hour24 = parseInt(hours)
        const hour12 = hour24 > 12 ? hour24 - 12 : hour24 === 0 ? 12 : hour24
        const ampm = hour24 >= 12 ? 'PM' : 'AM'
        return `${hour12}:${minutes} ${ampm} EST`
      }

      const formatDate = (dateStr) => {
        if (!dateStr) return 'TBD'
        return new Date(dateStr).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }

      const webinarDetails = {
        title: webinar.title,
        date: formatDate(webinar.event_date),
        time: formatTime(webinar.event_time),
        duration: webinar.duration,
        presenter: webinar.presenter_name
      };

      const emailResult = await sendWebinarConfirmationEmail(userDetails, webinarDetails);

      // Update email sent status
      await pool.query(
        'UPDATE webinar_registrations SET email_sent = true, email_sent_at = CURRENT_TIMESTAMP WHERE id = $1',
        [registrationId]
      );

    } catch (emailError) {
      console.error('Error sending confirmation email:', emailError);
      // Don't fail the registration if email fails, just log it
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful! You will receive a confirmation email with webinar details.',
      data: {
        registrationId,
        webinarTitle: webinar.title,
        registeredAt: result.rows[0].registered_at
      }
    });

  } catch (error) {
    console.error('Error registering for webinar:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all webinars
const getAllWebinars = async (req, res) => {
  try {
    const {
      status = 'all',
      category,
      featured,
      page = 1,
      limit = 10
    } = req.query;

    let whereClause = 'WHERE is_active = true';
    const queryParams = [];
    let paramCount = 0;

    // Add filters
    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND status = $${paramCount}`;
      queryParams.push(status);
    }

    if (category && category !== 'all') {
      paramCount++;
      whereClause += ` AND category = $${paramCount}`;
      queryParams.push(category);
    }

    if (featured === 'true') {
      whereClause += ` AND is_featured = true`;
    }

    // Calculate pagination
    const offset = (page - 1) * limit;
    paramCount++;
    const limitParam = paramCount;
    paramCount++;
    const offsetParam = paramCount;
    queryParams.push(parseInt(limit), parseInt(offset));

    // Main query with registration counts
    const query = `
      SELECT 
        w.*,
        COALESCE(r.registration_count, 0) as current_registrations
      FROM webinars w
      LEFT JOIN (
        SELECT webinar_id, COUNT(*) as registration_count
        FROM webinar_registrations
        GROUP BY webinar_id
      ) r ON w.id = r.webinar_id
      ${whereClause}
      ORDER BY w.event_date ASC, w.event_time ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM webinars 
      ${whereClause}
    `;

    const [webinarsResult, countResult] = await Promise.all([
      pool.query(query, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2))
    ]);

    const webinars = webinarsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        webinars,
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
    console.error('Error fetching webinars:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get webinar by ID
const getWebinarById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        w.*,
        COALESCE(r.registration_count, 0) as current_registrations
      FROM webinars w
      LEFT JOIN (
        SELECT webinar_id, COUNT(*) as registration_count
        FROM webinar_registrations
        GROUP BY webinar_id
      ) r ON w.id = r.webinar_id
      WHERE w.id = $1 AND w.is_active = true
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching webinar:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get webinar registrations (for admin use)
const getWebinarRegistrations = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if webinar exists
    const webinarQuery = 'SELECT title FROM webinars WHERE id = $1';
    const webinarResult = await pool.query(webinarQuery, [id]);

    if (webinarResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Webinar not found'
      });
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT 
        id, name, email, phone, current_education, interests, experience,
        registered_at, email_sent, attendance_status
      FROM webinar_registrations 
      WHERE webinar_id = $1 
      ORDER BY registered_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM webinar_registrations 
      WHERE webinar_id = $1
    `;

    const [registrationsResult, countResult] = await Promise.all([
      pool.query(query, [id, parseInt(limit), parseInt(offset)]),
      pool.query(countQuery, [id])
    ]);

    const registrations = registrationsResult.rows;
    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        webinar: webinarResult.rows[0],
        registrations,
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
    console.error('Error fetching webinar registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get webinar statistics
const getWebinarStats = async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_webinars,
        COUNT(CASE WHEN status = 'upcoming' THEN 1 END) as upcoming_webinars,
        COUNT(CASE WHEN status = 'live' THEN 1 END) as live_webinars,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_webinars,
        COUNT(DISTINCT category) as total_categories
      FROM webinars 
      WHERE is_active = true
    `;

    const registrationStatsQuery = `
      SELECT 
        COUNT(*) as total_registrations,
        COUNT(DISTINCT email) as unique_registrants,
        COUNT(CASE WHEN email_sent = true THEN 1 END) as emails_sent
      FROM webinar_registrations
    `;

    const categoryStatsQuery = `
      SELECT 
        w.category,
        COUNT(w.id) as webinar_count,
        COALESCE(SUM(r.registration_count), 0) as total_registrations
      FROM webinars w
      LEFT JOIN (
        SELECT webinar_id, COUNT(*) as registration_count
        FROM webinar_registrations
        GROUP BY webinar_id
      ) r ON w.id = r.webinar_id
      WHERE w.is_active = true
      GROUP BY w.category
      ORDER BY total_registrations DESC
    `;

    const [statsResult, registrationStatsResult, categoryStatsResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(registrationStatsQuery),
      pool.query(categoryStatsQuery)
    ]);

    res.json({
      success: true,
      data: {
        webinarStats: statsResult.rows[0],
        registrationStats: registrationStatsResult.rows[0],
        categoryBreakdown: categoryStatsResult.rows
      }
    });

  } catch (error) {
    console.error('Error fetching webinar stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  registerForWebinar,
  getAllWebinars,
  getWebinarById,
  getWebinarRegistrations,
  getWebinarStats
}; 