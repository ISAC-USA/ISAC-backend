const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const pdf2pic = require('pdf2pic');
const pdfParse = require('pdf-parse');

// Document classification signatures
const documentSignatures = {
  i20: {
    requiredKeywords: [
      'SEVIS', 'F-1', 'Student and Exchange Visitor Program',
      'Department of Homeland Security', 'Form I-20',
      'Certificate of Eligibility', 'Nonimmigrant Student Status'
    ],
    formatPatterns: [
      /SEVIS ID:\s*N\d{10}/i,
      /Program End Date:/i,
      /Level of Education:/i,
      /Major Field of Study:/i
    ],
    rejectKeywords: ['resume', 'curriculum vitae', 'work experience']
  },
  
  admitLetter: {
    requiredKeywords: [
      'admitted', 'accepted', 'congratulations', 'admission',
      'offer of admission', 'welcome to', 'pleased to inform'
    ],
    universityIndicators: [
      'University', 'College', 'Institute',
      'Dean', 'Admissions Office', 'Registrar'
    ],
    contextualPhrases: [
      'fall 2025', 'spring 2025', 'academic year',
      'tuition', 'enrollment', 'orientation', 'semester'
    ],
    rejectKeywords: ['resume', 'curriculum vitae', 'work experience']
  },
  
  resume: {
    rejectionKeywords: [
      'Work Experience', 'Professional Experience', 'Employment History',
      'Skills', 'Objective', 'Summary', 'References',
      'Career Objective', 'Professional Summary', 'Achievements',
      'Certifications', 'Years of experience', 'Responsible for'
    ],
    patterns: [
      /Email:\s*[\w\.-]+@[\w\.-]+\.\w+/i,
      /Phone:\s*[\+\d\s\(\)\-]+/i,
      /\d+\s*years?\s*of\s*experience/i
    ]
  }
};

// Preprocess image for better OCR accuracy
async function preprocessImage(inputBuffer) {
  try {
    return await sharp(inputBuffer)
      .grayscale()
      .normalize()
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (error) {
    console.log('Image preprocessing failed, using original:', error.message);
    return inputBuffer;
  }
}

// Check if input is a PDF buffer
function isPDFBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return false;
  return buffer.subarray(0, 4).toString() === '%PDF';
}

// Extract text from PDF using pdf-parse (faster for text-based PDFs)
async function extractTextFromPDF(buffer) {
  try {
    console.log('Extracting text from PDF using pdf-parse...');
    const data = await pdfParse(buffer);
    console.log('PDF text extraction completed, text length:', data.text.length);
    return data.text;
  } catch (error) {
    console.log('PDF text extraction failed, falling back to OCR:', error.message);
    return null;
  }
}

// Convert PDF to image and extract text using OCR
async function extractTextFromPDFWithOCR(buffer) {
  try {
    console.log('Converting PDF to images for OCR...');
    
    // Convert PDF to images
    const convert = pdf2pic.fromBuffer(buffer, {
      density: 200, // Higher density for better OCR
      saveFilename: "page",
      savePath: "/tmp",
      format: "png",
      width: 1200,
      height: 1600
    });

    // Convert only the first page for now (can be extended)
    const result = await convert(1);
    
    if (!result || !result.buffer) {
      throw new Error('Failed to convert PDF to image');
    }

    console.log('PDF converted to image, starting OCR...');
    
    // Use OCR on the converted image
    const { data: { text } } = await Tesseract.recognize(result.buffer, 'eng', {
      logger: m => console.log('OCR Progress:', m.status, m.progress)
    });
    
    console.log('OCR completed, extracted text length:', text.length);
    return text;
  } catch (error) {
    console.error('PDF OCR Error:', error);
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

// Extract text from document using appropriate method
async function extractTextFromDocument(input) {
  try {
    console.log('Starting document text extraction...');
    
    // Handle buffer input (from S3 download)
    if (Buffer.isBuffer(input)) {
      if (isPDFBuffer(input)) {
        console.log('Detected PDF document');
        
        // Try fast PDF text extraction first
        const pdfText = await extractTextFromPDF(input);
        if (pdfText && pdfText.trim().length > 50) {
          return pdfText;
        }
        
        // Fall back to OCR if PDF text extraction didn't work well
        console.log('PDF text extraction insufficient, using OCR...');
        return await extractTextFromPDFWithOCR(input);
      } else {
        // Handle image files with OCR
        console.log('Processing image with OCR...');
        const { data: { text } } = await Tesseract.recognize(input, 'eng', {
          logger: m => console.log('OCR Progress:', m.status, m.progress)
        });
        
        console.log('OCR completed, extracted text length:', text.length);
        return text;
      }
    } else {
      // Handle file path (legacy support)
      console.log('Processing file path with OCR...');
      const { data: { text } } = await Tesseract.recognize(input, 'eng', {
        logger: m => console.log('OCR Progress:', m.status, m.progress)
      });
      
      console.log('OCR completed, extracted text length:', text.length);
      return text;
    }
  } catch (error) {
    console.error('Document processing error:', error);
    throw new Error('Failed to extract text from document: ' + error.message);
  }
}

// Calculate I-20 document score
function calculateI20Score(text) {
  let score = 0;
  const normalizedText = text.toLowerCase();
  
  // SEVIS-specific keywords (high weight)
  if (normalizedText.includes('sevis')) score += 40;
  if (normalizedText.includes('form i-20') || normalizedText.includes('i-20')) score += 35;
  if (normalizedText.includes('f-1')) score += 30;
  if (normalizedText.includes('department of homeland security')) score += 25;
  if (normalizedText.includes('student and exchange visitor')) score += 20;
  
  // Document structure indicators
  if (documentSignatures.i20.formatPatterns.some(pattern => pattern.test(text))) {
    score += 20;
  }
  
  // Check for rejection keywords
  if (documentSignatures.i20.rejectKeywords.some(keyword => 
    normalizedText.includes(keyword.toLowerCase()))) {
    score -= 30;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

// Calculate admit letter score
function calculateAdmitLetterScore(text) {
  let score = 0;
  const normalizedText = text.toLowerCase();
  
  // Admission keywords
  const admissionWords = ['admitted', 'accepted', 'congratulations', 'admission'];
  const foundAdmissionWords = admissionWords.filter(word => normalizedText.includes(word));
  score += foundAdmissionWords.length * 15;
  
  // Special high-value phrases
  if (normalizedText.includes('offer of admission')) score += 35;
  if (normalizedText.includes('pleased to inform')) score += 25;
  if (normalizedText.includes('welcome to')) score += 20;
  
  // University context
  if (normalizedText.includes('university') || normalizedText.includes('college')) score += 20;
  if (normalizedText.includes('admissions office')) score += 15;
  
  // Academic year context
  if (normalizedText.includes('fall 2025') || normalizedText.includes('spring 2025')) score += 20;
  if (normalizedText.includes('academic year')) score += 10;
  
  // Check for rejection keywords
  if (documentSignatures.admitLetter.rejectKeywords.some(keyword => 
    normalizedText.includes(keyword.toLowerCase()))) {
    score -= 30;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

// Calculate resume score (for rejection)
function calculateResumeScore(text) {
  let score = 0;
  const normalizedText = text.toLowerCase();
  
  // Resume-specific sections
  const resumeKeywords = documentSignatures.resume.rejectionKeywords;
  const foundResumeKeywords = resumeKeywords.filter(keyword => 
    normalizedText.includes(keyword.toLowerCase())
  );
  score += foundResumeKeywords.length * 10;
  
  // Resume patterns
  if (documentSignatures.resume.patterns.some(pattern => pattern.test(text))) {
    score += 20;
  }
  
  // Common resume phrases
  if (normalizedText.includes('years of experience')) score += 25;
  if (normalizedText.includes('responsible for')) score += 15;
  if (normalizedText.includes('achievements')) score += 15;
  
  return Math.min(score, 100);
}

// Main document classification function
function classifyDocument(text) {
  const scores = {
    i20: calculateI20Score(text),
    admitLetter: calculateAdmitLetterScore(text),
    resume: calculateResumeScore(text)
  };
  
  // Determine primary classification
  const topClassification = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)[0];
  
  return {
    type: topClassification[0],
    confidence: topClassification[1],
    allScores: scores,
    extractedText: text.substring(0, 500) // First 500 chars for preview
  };
}

// Make approval/rejection decision
function makeDecision(classification, universityId) {
  const { type, confidence } = classification;
  
  console.log(`Document classified as: ${type} with ${confidence}% confidence`);
  
  // High confidence decisions
  if (confidence > 80) {
    switch (type) {
      case 'i20':
        return { 
          decision: 'approved', 
          reason: `Valid I-20 document detected (${confidence}% confidence)`,
          autoProcessed: true
        };
      case 'admitLetter':
        return { 
          decision: 'approved', 
          reason: `Valid admission letter detected (${confidence}% confidence)`,
          autoProcessed: true
        };
      case 'resume':
        return { 
          decision: 'rejected', 
          reason: 'Resume documents are not accepted for verification',
          autoProcessed: true
        };
    }
  }
  
  // Medium confidence - manual review for acceptable document types
  if (confidence > 50) {
    if (type === 'i20' || type === 'admitLetter') {
      return { 
        decision: 'manual_review', 
        reason: `Possible ${type} detected but requires manual verification (${confidence}% confidence)`,
        autoProcessed: false
      };
    } else {
      return { 
        decision: 'rejected', 
        reason: `Document type not acceptable: ${type} (${confidence}% confidence)`,
        autoProcessed: true
      };
    }
  }
  
  // Special case: Even low confidence resumes should be rejected
  if (type === 'resume' && confidence > 20) {
    return { 
      decision: 'rejected', 
      reason: `Other documents are not accepted for verification, please upload a valid I-20 or admission letter.`,
      autoProcessed: true
    };
  }
  
  // Low confidence - manual review
  return { 
    decision: 'manual_review', 
    reason: `Unable to classify document reliably (${confidence}% confidence)`,
    autoProcessed: false
  };
}

// Main document processing function
async function processDocument(input, universityId) {
  try {
    console.log('Processing document...');
    
    // Extract text using OCR
    const extractedText = await extractTextFromDocument(input);
    
    if (!extractedText || extractedText.trim().length < 50) {
      return {
        decision: 'manual_review',
        reason: 'Unable to extract sufficient text from document',
        autoProcessed: false,
        extractedText: extractedText
      };
    }
    
    // Classify document
    const classification = classifyDocument(extractedText);
    
    // Make decision
    const decision = makeDecision(classification, universityId);
    
    return {
      ...decision,
      classification,
      extractedText,
      processedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Document processing error:', error);
    return {
      decision: 'manual_review',
      reason: 'Failed to process document automatically: ' + error.message,
      autoProcessed: false,
      error: error.message
    };
  }
}

module.exports = {
  processDocument,
  extractTextFromDocument,
  classifyDocument,
  makeDecision,
  preprocessImage
}; 