const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'kimber-health-documents';

// Generate unique file key
function generateFileKey(originalName, universityId) {
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const fileExtension = path.extname(originalName);
  return `documents/${universityId}/${timestamp}-${randomId}${fileExtension}`;
}

// Get content type based on file extension
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Upload file to S3
async function uploadFileToS3(buffer, originalName, universityId) {
  try {
    const fileKey = generateFileKey(originalName, universityId);
    const contentType = getContentType(originalName);

    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: fileKey,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        originalName: originalName,
        universityId: universityId,
        uploadedAt: new Date().toISOString()
      }
    };

    console.log('Uploading file to S3:', fileKey);
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);

    console.log('File uploaded successfully to S3:', fileKey);
    return {
      success: true,
      fileKey: fileKey,
      bucket: S3_BUCKET,
      url: `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileKey}`,
      contentType: contentType
    };

  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3: ' + error.message);
  }
}

// Download file from S3
async function downloadFileFromS3(fileKey) {
  try {
    const downloadParams = {
      Bucket: S3_BUCKET,
      Key: fileKey
    };

    console.log('Downloading file from S3:', fileKey);
    const command = new GetObjectCommand(downloadParams);
    const result = await s3Client.send(command);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    return {
      success: true,
      buffer: buffer,
      contentType: result.ContentType,
      metadata: result.Metadata
    };

  } catch (error) {
    console.error('S3 download error:', error);
    throw new Error('Failed to download file from S3: ' + error.message);
  }
}

// Generate signed URL for secure file access
async function generateSignedUrl(fileKey, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: fileKey
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    
    console.log('Generated signed URL for:', fileKey);
    return {
      success: true,
      signedUrl: signedUrl,
      expiresIn: expiresIn
    };

  } catch (error) {
    console.error('Signed URL generation error:', error);
    throw new Error('Failed to generate signed URL: ' + error.message);
  }
}

// Delete file from S3
async function deleteFileFromS3(fileKey) {
  try {
    const deleteParams = {
      Bucket: S3_BUCKET,
      Key: fileKey
    };

    console.log('Deleting file from S3:', fileKey);
    const command = new DeleteObjectCommand(deleteParams);
    await s3Client.send(command);

    console.log('File deleted successfully from S3:', fileKey);
    return { success: true };

  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3: ' + error.message);
  }
}

// Validate file before upload
function validateFile(file) {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }

  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('File type not allowed. Please upload PDF, JPG, PNG, DOC, or DOCX files only.');
  }

  return true;
}

// Extract file key from S3 URL
function extractFileKeyFromUrl(s3Url) {
  try {
    const url = new URL(s3Url);
    return url.pathname.substring(1); // Remove leading slash
  } catch (error) {
    throw new Error('Invalid S3 URL format');
  }
}

module.exports = {
  uploadFileToS3,
  downloadFileFromS3,
  generateSignedUrl,
  deleteFileFromS3,
  validateFile,
  extractFileKeyFromUrl,
  generateFileKey,
  getContentType
}; 