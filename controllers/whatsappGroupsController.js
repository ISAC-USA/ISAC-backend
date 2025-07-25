const pool = require('../config/database');
const { sendVerificationEmail, sendWhatsAppApprovalEmail } = require('../utils/emailService');
const { uploadFileToS3, validateFile } = require('../utils/s3Service');
const { processDocument } = require('../utils/documentProcessor');
const { isValidPhone } = require('../utils/helpers');
const crypto = require('crypto');
const multer = require('multer');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, and PNG files are allowed.'), false);
    }
  }
}).single('document');

// Get all universities with their WhatsApp groups
const getUniversities = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, short_name, email_domain, location
      FROM universities 
      ORDER BY name ASC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching universities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch universities'
    });
  }
};

// Get WhatsApp groups for a specific university
const getUniversityGroups = async (req, res) => {
  try {
    const { universityId } = req.params;

    const result = await pool.query(`
      SELECT 
        wg.id, wg.university_id, wg.group_name, wg.group_type, 
        wg.whatsapp_link, wg.intake_year, wg.intake_semester, 
        wg.description, wg.is_active, wg.member_count
      FROM whatsapp_groups wg
      WHERE wg.university_id = $1 AND wg.is_active = true
      ORDER BY 
        CASE wg.group_type 
          WHEN 'main' THEN 1 
          WHEN 'intake' THEN 2 
          WHEN 'academic' THEN 3 
          WHEN 'international' THEN 4 
          WHEN 'housing' THEN 5 
          ELSE 6 
        END,
        wg.intake_year DESC,
        wg.intake_semester DESC,
        wg.group_name ASC
    `, [universityId]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching university groups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch university groups'
    });
  }
};

// Start verification process
const startVerification = async (req, res) => {
  try {
    const { universityId, email, phoneNumber } = req.body;

    // Validate required fields
    if (!universityId || !email || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'University ID, email, and phone number are required'
      });
    }

    // Validate phone number format
    if (!isValidPhone(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number with country code (e.g., +19876543210).'
      });
    }

    // Check if university exists
    const universityResult = await pool.query(
      'SELECT * FROM universities WHERE id = $1',
      [universityId]
    );

    if (universityResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'University not found'
      });
    }

    const university = universityResult.rows[0];

    // Validate university email domain
    if (!email.includes(university.email_domain)) {
      return res.status(400).json({
        success: false,
        message: `Email must be from ${university.email_domain} domain`
      });
    }

    // Check if email is already verified for this university
    const existingVerification = await pool.query(
      'SELECT * FROM whatsapp_verifications WHERE email = $1 AND university_id = $2 AND status = $3',
      [email, universityId, 'verified']
    );

    if (existingVerification.rows.length > 0) {
      const verifiedRecord = existingVerification.rows[0];
      
      // Check if phone number matches the one used during verification
      if (verifiedRecord.phone_number === phoneNumber) {
        // Phone number matches - allow direct access
        return res.json({
          success: true,
          alreadyVerified: true,
          message: 'Email already verified! Redirecting to WhatsApp groups.',
          data: {
            university: university.name,
            universityShortName: university.short_name,
            universityId: university.id,
            verifiedAt: verifiedRecord.verified_at
          }
        });
      } else {
        // Phone number doesn't match - security error
        return res.status(403).json({
          success: false,
          message: 'This email is already verified with a different phone number. Please use the same phone number you used during verification, or contact support if you need to update your phone number.'
        });
      }
    }

    // Check if phone number is already used
    const phoneExists = await pool.query(
      'SELECT * FROM whatsapp_verifications WHERE phone_number = $1 AND status = $2',
      [phoneNumber, 'verified']
    );

    if (phoneExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'This phone number is already registered'
      });
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Delete any existing pending verification for this email/university
    await pool.query(
      'DELETE FROM whatsapp_verifications WHERE email = $1 AND university_id = $2 AND status = $3',
      [email, universityId, 'pending']
    );

    // Create new verification record
    const insertResult = await pool.query(`
      INSERT INTO whatsapp_verifications (university_id, email, phone_number, verification_token, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [universityId, email, phoneNumber, verificationToken, expiresAt]);

    // Send verification email
    await sendVerificationEmail({
      email,
      university: university.name,
      verificationToken,
      universityShortName: university.short_name
    });

    res.json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        verificationId: insertResult.rows[0].id,
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Error starting verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start verification process'
    });
  }
};

// Confirm email verification
const confirmVerification = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Find verification record
    const verificationResult = await pool.query(`
      SELECT wv.*, u.name as university_name, u.short_name
      FROM whatsapp_verifications wv
      JOIN universities u ON wv.university_id = u.id
      WHERE wv.verification_token = $1
    `, [token]);

    if (verificationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    const verification = verificationResult.rows[0];

    // Check if already verified
    if (verification.status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
        data: {
          university: verification.university_name
        }
      });
    }

    // Check if expired
    if (new Date() > new Date(verification.expires_at)) {
      await pool.query(
        'UPDATE whatsapp_verifications SET status = $1 WHERE id = $2',
        ['expired', verification.id]
      );
      
      return res.status(410).json({
        success: false,
        message: 'Verification token has expired'
      });
    }

    // Mark as verified
    await pool.query(
      'UPDATE whatsapp_verifications SET status = $1, verified_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['verified', verification.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully! You can now access WhatsApp groups.',
      data: {
        university: verification.university_name,
        universityShortName: verification.short_name,
        universityId: verification.university_id
      }
    });

  } catch (error) {
    console.error('Error confirming verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm verification'
    });
  }
};

// Get verification status
const getVerificationStatus = async (req, res) => {
  try {
    const { email, universityId } = req.body;

    if (!email || !universityId) {
      return res.status(400).json({
        success: false,
        message: 'Email and university ID are required'
      });
    }

    const result = await pool.query(`
      SELECT wv.*, u.name as university_name
      FROM whatsapp_verifications wv
      JOIN universities u ON wv.university_id = u.id
      WHERE wv.email = $1 AND wv.university_id = $2
      ORDER BY wv.created_at DESC
      LIMIT 1
    `, [email, universityId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          status: 'not_started'
        }
      });
    }

    const verification = result.rows[0];

    res.json({
      success: true,
      data: {
        status: verification.status,
        university: verification.university_name,
        createdAt: verification.created_at,
        verifiedAt: verification.verified_at,
        expiresAt: verification.expires_at,
        universityId: verification.status === 'verified' ? verification.university_id : null
      }
    });

  } catch (error) {
    console.error('Error getting verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get verification status'
    });
  }
};

// Resend verification email
const resendVerification = async (req, res) => {
  try {
    const { email, universityId } = req.body;

    if (!email || !universityId) {
      return res.status(400).json({
        success: false,
        message: 'Email and university ID are required'
      });
    }

    // Find existing pending verification
    const verificationResult = await pool.query(`
      SELECT wv.*, u.name as university_name, u.short_name
      FROM whatsapp_verifications wv
      JOIN universities u ON wv.university_id = u.id
      WHERE wv.email = $1 AND wv.university_id = $2 AND wv.status = $3
    `, [email, universityId, 'pending']);

    if (verificationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending verification found for this email'
      });
    }

    const verification = verificationResult.rows[0];

    // Check if not expired yet (don't resend if still valid and recent)
    const now = new Date();
    const createdAt = new Date(verification.created_at);
    const timeDiff = (now - createdAt) / (1000 * 60); // minutes

    if (timeDiff < 2) { // Prevent spam - only allow resend after 2 minutes
      return res.status(429).json({
        success: false,
        message: 'Please wait at least 2 minutes before requesting another email'
      });
    }

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE whatsapp_verifications SET verification_token = $1, expires_at = $2 WHERE id = $3',
      [newToken, newExpiresAt, verification.id]
    );

    // Send new verification email
    await sendVerificationEmail({
      email,
      university: verification.university_name,
      verificationToken: newToken,
      universityShortName: verification.short_name
    });

    res.json({
      success: true,
      message: 'Verification email resent successfully'
    });

  } catch (error) {
    console.error('Error resending verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
};

// Upload document for verification
const uploadDocumentVerification = async (req, res) => {
  // Handle file upload with multer
  upload(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    try {
      const { universityId, email, phoneNumber } = req.body;
      const file = req.file;

      // Validate required fields
      if (!universityId || !email || !phoneNumber || !file) {
        return res.status(400).json({
          success: false,
          message: 'University ID, email, phone number, and document are required'
        });
      }

      // Validate phone number format
      if (!isValidPhone(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number with country code (e.g., +19876543210).'
        });
      }

      // Check if university exists
      const universityResult = await pool.query(
        'SELECT * FROM universities WHERE id = $1',
        [universityId]
      );

      if (universityResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'University not found'
        });
      }

      const university = universityResult.rows[0];

      // Check if email already has any verification record for this university
      const existingVerification = await pool.query(
        'SELECT * FROM whatsapp_verifications WHERE email = $1 AND university_id = $2 ORDER BY created_at DESC LIMIT 1',
        [email, universityId]
      );

      if (existingVerification.rows.length > 0) {
        const existingRecord = existingVerification.rows[0];
        
        // Check if phone number matches the one used during verification
        if (existingRecord.phone_number !== phoneNumber) {
          // Phone number doesn't match - security error
          return res.status(403).json({
            success: false,
            message: 'This email is already associated with a different phone number. Please use the same phone number you used during verification, or contact support if you need to update your phone number.'
          });
        }

        // Handle different existing statuses
        if (existingRecord.status === 'verified') {
          // Already verified - allow direct access
          return res.json({
            success: true,
            alreadyVerified: true,
            message: 'Email already verified! Redirecting to WhatsApp groups.',
            data: {
              university: university.name,
              universityShortName: university.short_name,
              universityId: university.id,
              verifiedAt: existingRecord.verified_at
            }
          });
        } else if (existingRecord.status === 'pending' && existingRecord.verification_method === 'admit_letter') {
          // Already has a pending document verification - return status
          return res.json({
            success: true,
            manualReview: true,
            message: 'Document already uploaded and is under review. You will be notified within 24-48 hours.',
            data: {
              verificationId: existingRecord.id,
              decision: 'manual_review',
              reason: 'Document previously uploaded and currently under review',
              reviewEstimate: '24-48 hours'
            }
          });
        } else if (existingRecord.status === 'rejected') {
          // Previous verification was rejected - delete old record and allow new upload
          console.log('Deleting rejected verification record to allow new upload');
          await pool.query(
            'DELETE FROM whatsapp_verifications WHERE id = $1',
            [existingRecord.id]
          );
        } else if (existingRecord.status === 'expired') {
          // Previous verification expired - delete old record and allow new upload
          console.log('Deleting expired verification record to allow new upload');
          await pool.query(
            'DELETE FROM whatsapp_verifications WHERE id = $1',
            [existingRecord.id]
          );
        }
        // For other statuses or if we deleted a record, continue with new verification
      }

      // Check if phone number is already used
      const phoneExists = await pool.query(
        'SELECT * FROM whatsapp_verifications WHERE phone_number = $1 AND status = $2',
        [phoneNumber, 'verified']
      );

      if (phoneExists.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'This phone number is already registered'
        });
      }

      console.log('Processing uploaded file:', file.originalname, 'Size:', file.size);

      // Upload file to S3
      const s3Result = await uploadFileToS3(file.buffer, file.originalname, universityId);
      
      if (!s3Result.success) {
        throw new Error('Failed to upload file to S3');
      }

      console.log('File uploaded to S3:', s3Result.fileKey);

      // Download file for processing (since OCR needs local file)
      const { downloadFileFromS3 } = require('../utils/s3Service');
      const downloadResult = await downloadFileFromS3(s3Result.fileKey);
      
      if (!downloadResult.success) {
        throw new Error('Failed to download file for processing');
      }

      // Process document with OCR and classification
      console.log('Starting document processing...');
      const processingResult = await processDocument(downloadResult.buffer, universityId);
      
      console.log('Document processing result:', processingResult.decision, processingResult.reason);

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Determine initial status based on processing result
      let initialStatus = 'pending'; // Default to existing status
      if (processingResult.decision === 'approved') {
        initialStatus = 'verified';
      } else if (processingResult.decision === 'rejected') {
        initialStatus = 'rejected';
      } else {
        initialStatus = 'pending'; // Manual review goes to pending for now
      }

      // Save verification record to database
      const insertResult = await pool.query(`
        INSERT INTO whatsapp_verifications (
          university_id, email, phone_number, verification_method,
          file_path, original_filename, extracted_text, 
          classification_result, verification_token, expires_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `, [
        universityId,
        email,
        phoneNumber,
        'admit_letter',
        s3Result.fileKey,
        file.originalname,
        processingResult.extractedText || '',
        JSON.stringify({
          classification: processingResult.classification,
          autoProcessed: processingResult.autoProcessed,
          processedAt: processingResult.processedAt
        }),
        verificationToken,
        expiresAt,
        initialStatus
      ]);

      // Return response based on processing result
      if (processingResult.decision === 'approved') {
        res.json({
          success: true,
          autoApproved: true,
          message: processingResult.reason,
          data: {
            verificationId: insertResult.rows[0].id,
            university: university.name,
            universityShortName: university.short_name,
            universityId: university.id,
            decision: processingResult.decision,
            confidence: processingResult.classification?.confidence,
            documentType: processingResult.classification?.type
          }
        });
      } else if (processingResult.decision === 'rejected') {
        res.status(400).json({
          success: false,
          autoRejected: true,
          message: processingResult.reason,
          data: {
            verificationId: insertResult.rows[0].id,
            decision: processingResult.decision,
            confidence: processingResult.classification?.confidence,
            documentType: processingResult.classification?.type
          }
        });
      } else {
        // Manual review required
        res.json({
          success: true,
          manualReview: true,
          message: 'Document uploaded successfully and is under review. You will be notified within 24-48 hours.',
          data: {
            verificationId: insertResult.rows[0].id,
            decision: processingResult.decision,
            reason: processingResult.reason,
            confidence: processingResult.classification?.confidence,
            documentType: processingResult.classification?.type,
            reviewEstimate: '24-48 hours'
          }
        });
      }

    } catch (error) {
      console.error('Document upload verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process document verification: ' + error.message
      });
    }
  });
};

// Approve a pending manual document verification (admin action)
const approveManualVerification = async (req, res) => {
  try {
    const { verificationId } = req.body;
    if (!verificationId) {
      return res.status(400).json({ success: false, message: 'verificationId is required' });
    }

    // Fetch the verification record
    const result = await pool.query(
      `SELECT wv.*, u.name as university_name, u.short_name
       FROM whatsapp_verifications wv
       JOIN universities u ON wv.university_id = u.id
       WHERE wv.id = $1`,
      [verificationId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Verification record not found' });
    }
    const verification = result.rows[0];
    if (verification.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Verification is not pending' });
    }

    // Update status to verified
    await pool.query(
      'UPDATE whatsapp_verifications SET status = $1, verified_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['verified', verificationId]
    );

    // Send approval email
    await sendWhatsAppApprovalEmail({
      email: verification.email,
      university: verification.university_name,
      universityShortName: verification.short_name,
      phoneNumber: verification.phone_number
    });

    res.json({ success: true, message: 'Verification approved and user notified.' });
  } catch (error) {
    console.error('Error approving manual verification:', error);
    res.status(500).json({ success: false, message: 'Failed to approve verification' });
  }
};

module.exports = {
  getUniversities,
  getUniversityGroups,
  startVerification,
  uploadDocumentVerification,
  confirmVerification,
  getVerificationStatus,
  resendVerification,
  approveManualVerification
}; 