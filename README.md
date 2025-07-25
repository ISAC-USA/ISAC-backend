# ISAC Backend API

Backend API for the International Student Advocacy Committee (ISAC) platform, providing comprehensive mentor management and educational webinar registration services.

## Features

- **Mentor Management**: Complete CRUD operations for mentors with application system
- **Webinar Registration**: Full registration system with .edu email validation
- **Email Service**: Professional HTML emails via SMTP2GO integration
- **Advanced Filtering**: Search by specialty, language, location, university
- **Pagination**: Efficient data loading with pagination support
- **Rate Limiting**: Protection against API abuse
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **Security**: CORS, Helmet, input validation, and email domain verification
- **Database**: PostgreSQL with connection pooling and transaction support

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- SMTP2GO account for email delivery
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=isac_db
   DB_USER=postgres
   DB_PASSWORD=your_password

   # SMTP Configuration (SMTP2GO)
   SMTP2GO_USERNAME=your_smtp_username
   SMTP2GO_PASSWORD=your_smtp_password
   SMTP2GO_FROM_EMAIL=noreply@yourdomain.com

   # Server Configuration
   PORT=5001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   ```

4. Set up the database:
   - Create a PostgreSQL database
   - Create required tables for mentors, webinars, and registrations
   - Insert sample data as needed

5. Start the server:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Mentors

#### Get All Mentors
```
GET /api/mentors
```

**Query Parameters:**
- `specialty` - Filter by specialty (e.g., "International Student", "Alumni", "Professor")
- `language` - Filter by language (e.g., "English", "Spanish")
- `location` - Filter by location (e.g., "New York, USA")
- `university` - Filter by university name
- `search` - Search in name, specialty, university, or bio
- `sortBy` - Sort field (full_name, specialty, university, created_at)
- `sortOrder` - Sort order (ASC, DESC)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

**Example:**
```
GET /api/mentors?specialty=International%20Student&language=English&page=1&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mentors": [
      {
        "id": 1,
        "name": "Soham Moghe",
        "specialty": "International Student",
        "university": "New York University",
        "degree": "MS in Computer Science",
        "location": "New York, USA",
        "languages": ["English", "Hindi", "Marathi"],
        "bio": "I'm an international student...",
        "image": "/api/placeholder/150/150",
        "social": {
          "instagram": "@_sohammmm",
          "linkedin": "https://www.linkedin.com/in/soham-moghe/",
          "whatsapp": "Find me in NYU groups"
        },
        "rating": 0.00,
        "totalReviews": 0,
        "experienceYears": null,
        "createdAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 6,
      "itemsPerPage": 10,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### Get Mentor by ID
```
GET /api/mentors/:id
```

#### Get Mentor Statistics
```
GET /api/mentors/stats
```

#### Get Filter Options
```
GET /api/mentors/filter-options
```

#### Submit Mentor Application
```
POST /api/mentors/apply
```

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-0123",
  "currentUniversity": "Harvard University",
  "degree": "MS Computer Science",
  "graduationYear": "2023",
  "specialization": "Graduate School Applications",
  "experienceYears": "3",
  "languages": "English, Spanish",
  "linkedinUrl": "https://linkedin.com/in/johndoe",
  "motivation": "I want to help students...",
  "availability": "Weekday evenings",
  "sampleAdvice": "I would help them by..."
}
```

### Webinars

#### Get All Webinars
```
GET /api/webinars
```

**Query Parameters:**
- `status` - Filter by status (upcoming, live, past)
- `presenter` - Filter by presenter name
- `topic` - Search in title and description
- `limit` - Items per page (default: 100)
- `page` - Page number (default: 1)
- `sortBy` - Sort field (date, title, presenter_name)
- `sortOrder` - Sort order (ASC, DESC)

**Response:**
```json
{
  "success": true,
  "data": {
    "webinars": [
      {
        "id": 1,
        "title": "Study Abroad: USA University Applications",
        "description": "Learn everything about applying to US universities",
        "presenter_name": "Dr. Sarah Johnson",
        "presenter_bio": "Education consultant with 10+ years experience",
        "date": "2024-12-20",
        "time": "19:00",
        "duration": "1 hour",
        "max_attendees": 100,
        "current_attendees": 45,
        "poster": "/path/to/poster.jpg",
        "status": "upcoming",
        "created_at": "2024-01-01T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 5,
      "itemsPerPage": 100,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### Get Webinar by ID
```
GET /api/webinars/:id
```

#### Register for Webinar
```
POST /api/webinars/register
```

**Request Body:**
```json
{
  "webinarId": 1,
  "name": "John Doe",
  "email": "john.doe@university.edu",
  "phone": "+1-555-0123",
  "currentEducation": "Bachelor's in Computer Science",
  "interests": "Machine Learning, Web Development"
}
```

**Requirements:**
- Email must be from a `.edu` domain
- Webinar must have available capacity
- No duplicate registrations allowed

**Response:**
```json
{
  "success": true,
  "message": "Registration successful! Confirmation email sent.",
  "data": {
    "registrationId": 123,
    "webinarTitle": "Study Abroad: USA University Applications",
    "webinarDate": "2024-12-20",
    "webinarTime": "19:00"
  }
}
```

#### Get Webinar Registrations (Admin)
```
GET /api/webinars/:id/registrations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webinar": {
      "id": 1,
      "title": "Study Abroad: USA University Applications",
      "date": "2024-12-20",
      "max_attendees": 100
    },
    "registrations": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john.doe@university.edu",
        "phone": "+1-555-0123",
        "current_education": "Bachelor's in Computer Science",
        "interests": "Machine Learning, Web Development",
        "registered_at": "2024-01-15T10:30:00.000Z",
        "email_sent": true
      }
    ],
    "stats": {
      "total_registrations": 45,
      "available_spots": 55,
      "registration_rate": "45%"
    }
  }
}
```

#### Get Webinar Statistics
```
GET /api/webinars/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_webinars": 5,
      "total_registrations": 234,
      "upcoming_webinars": 2,
      "average_attendance_rate": "78%"
    },
    "by_status": [
      {
        "status": "upcoming",
        "count": 2,
        "total_registrations": 89
      },
      {
        "status": "past",
        "count": 3,
        "total_registrations": 145
      }
    ]
  }
}
```

## Email Service

The backend includes a comprehensive email system for webinar registrations:

### Features
- **SMTP2GO Integration**: Professional email delivery service
- **HTML Templates**: Responsive email design with ISAC branding
- **Email Validation**: Strict .edu domain verification using regex
- **Error Handling**: Comprehensive email delivery monitoring
- **Template Variables**: Dynamic content insertion for personalization

### Email Template
The confirmation email includes:
- ISAC logo and branding
- Webinar details (title, date, time, presenter)
- Registration confirmation message
- Next steps information
- Professional footer with ISAC team signature

### Configuration
Set up the following environment variables:
```env
SMTP2GO_USERNAME=your_username
SMTP2GO_PASSWORD=your_password
SMTP2GO_FROM_EMAIL=noreply@yourdomain.com
```

### Usage
```javascript
const { sendRegistrationConfirmation } = require('./utils/emailService');

await sendRegistrationConfirmation(userDetails, webinarDetails);
```

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input, duplicate registration)
- `404` - Not Found
- `409` - Conflict (webinar at capacity)
- `429` - Too Many Requests
- `500` - Internal Server Error

**Webinar-Specific Error Responses:**
- `400` - Invalid .edu email format
- `409` - Already registered for this webinar
- `409` - Webinar has reached maximum capacity
- `404` - Webinar not found

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Registration endpoints**: 10 requests per 15 minutes (stricter for webinar registration)
- **Application endpoints**: 10 requests per 15 minutes
- **Authentication endpoints**: 5 requests per 15 minutes

## Security Features

- **CORS**: Configured for frontend domain
- **Helmet**: Security headers
- **Input validation**: All inputs are validated and sanitized
- **Email domain validation**: Only .edu emails accepted for webinar registration
- **Rate limiting**: Prevents API abuse and spam registrations
- **Error handling**: Sensitive information is not exposed in production
- **SQL injection prevention**: Parameterized queries throughout

## Development

### Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests (future implementation)

### Database Schema

The API uses PostgreSQL with the following main tables:

#### Mentors Table
```sql
CREATE TABLE mentors (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  university VARCHAR(255) NOT NULL,
  degree VARCHAR(255),
  location VARCHAR(255),
  languages TEXT[],
  bio TEXT,
  image_url VARCHAR(500),
  social_links JSONB,
  rating DECIMAL(3,2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  experience_years INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Webinars Table
```sql
CREATE TABLE webinars (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  presenter_name VARCHAR(255) NOT NULL,
  presenter_bio TEXT,
  date DATE NOT NULL,
  time TIME NOT NULL,
  duration VARCHAR(50),
  max_attendees INTEGER DEFAULT 100,
  poster VARCHAR(500),
  status VARCHAR(20) DEFAULT 'upcoming',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Webinar Registrations Table
```sql
CREATE TABLE webinar_registrations (
  id SERIAL PRIMARY KEY,
  webinar_id INTEGER REFERENCES webinars(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  current_education TEXT,
  interests TEXT,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  UNIQUE(webinar_id, email)
);
```

#### Mentor Applications Table
```sql
CREATE TABLE mentor_applications (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  current_university VARCHAR(255),
  degree VARCHAR(255),
  graduation_year VARCHAR(4),
  specialization VARCHAR(255),
  experience_years VARCHAR(50),
  languages TEXT,
  linkedin_url VARCHAR(500),
  motivation TEXT,
  availability TEXT,
  sample_advice TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Health Check

```
GET /health
```

Returns server status and database connectivity information.

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "email_service": "configured"
}
```

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5001
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
SMTP2GO_USERNAME=your_smtp_username
SMTP2GO_PASSWORD=your_smtp_password
SMTP2GO_FROM_EMAIL=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Recommended Deployment Platforms

- **Railway**: Easy PostgreSQL + Node.js deployment
- **Heroku**: Heroku Postgres add-on support
- **Render**: Database + web service combo
- **AWS/DigitalOcean**: Full control with Docker containers

## Future Enhancements

- **Authentication**: JWT-based user authentication
- **Admin Dashboard**: Web interface for managing webinars and registrations
- **Video Integration**: Direct webinar hosting capabilities
- **Advanced Analytics**: Registration patterns and user engagement metrics
- **Notification System**: SMS and push notification integration
- **Automated Testing**: Comprehensive test suite with Jest
- **API Documentation**: Interactive Swagger/OpenAPI documentation
- **Caching**: Redis integration for improved performance

---

**ISAC Backend API - Built for the International Student Community** 