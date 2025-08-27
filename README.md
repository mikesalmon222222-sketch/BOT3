# SEPTA Bid Scraper - Production MERN Application

A complete, production-ready MERN stack application for scraping and managing public-sector bid notices from SEPTA (Southeastern Pennsylvania Transportation Authority).

## Features

- 🎯 **SEPTA-Specific Scraping**: Automated bid collection from SEPTA procurement portals
- 🔒 **Secure Credential Management**: AES-256-GCM encrypted credential storage
- 📊 **Real-time Dashboard**: Summary statistics and system status monitoring
- 📋 **Advanced Bid Management**: Paginated listing, filtering, and deletion capabilities
- 🔄 **Automated Scheduling**: 15-minute automatic refresh cycles
- 📱 **Mobile Responsive**: Optimized for desktop, tablet, and mobile devices
- 🛡️ **Production Security**: Helmet, CORS, input validation, and comprehensive logging
- 🚀 **Graceful Degradation**: Continues operation even when MongoDB is unavailable

## Tech Stack

### Backend
- **Node.js 20+** with Express.js
- **MongoDB** with Mongoose ODM
- **Playwright** for dynamic content scraping
- **winston** for comprehensive logging
- **node-cron** for automated scheduling
- **zod** for schema validation
- **AES encryption** for secure credential storage

### Frontend
- **React 18** with functional components and hooks
- **React Router** for client-side routing
- **Context API** for global state management
- **Axios** for HTTP client
- **Vite** for fast development and building

## Project Structure

```
/backend
  /src
    /controllers       # API route handlers
    /models           # MongoDB schemas
    /routes          # Express routes
    /services
      /scrapers      # SEPTA scraping logic
    /utils           # Database, encryption, logging utilities
    index.js         # Main server entry point
  package.json
  .env.example

/frontend
  /src
    /components      # Reusable UI components
    /pages          # Page components
    /context        # Global state management
    /services       # API client
    App.jsx         # Main app component
    index.jsx       # React entry point
  package.json

README.md
```

## Installation & Setup

### Prerequisites
- Node.js 20 or higher
- MongoDB instance (local or cloud)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/mikesalmon222222-sketch/BOT3.git
cd BOT3
```

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Required Environment Variables:**
```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/septa-bids

# Security Configuration (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your-64-character-hex-encryption-key

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# Logging Configuration
LOG_LEVEL=info
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Install Playwright Browsers (Backend)
```bash
cd ../backend
npx playwright install chromium
```

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## API Endpoints

### Health
- `GET /api/health` - System health check

### Credentials
- `GET /api/credentials` - Get credential status
- `POST /api/credentials/septa` - Save SEPTA credentials
- `POST /api/credentials/septa/test` - Test SEPTA connection
- `DELETE /api/credentials/septa` - Remove SEPTA credentials

### Bids
- `GET /api/bids` - Get paginated bids with filters
- `DELETE /api/bids/:id` - Delete specific bid
- `POST /api/bids/fetch/septa` - Manual fetch trigger

## Usage Guide

### 1. Configure SEPTA Credentials
1. Navigate to **Credentials** page
2. Enter your SEPTA portal username and password
3. Click **Test Connection** to verify
4. Credentials are automatically encrypted before storage

### 2. Fetch Bids
- **Automatic**: Every 15 minutes via background scheduler
- **Manual**: Click "Fetch Now" button in Hunting Data page

### 3. Browse and Manage Bids
- View paginated bid listings (10 per page)
- Filter by date ranges
- Use quick filters (Today, Last 7 days, Last 30 days)
- Delete individual bids as needed

### 4. Monitor System Status
- Dashboard shows real-time statistics
- Server health and database connectivity
- Credential status and last test results
- Recent activity timeline

## Security Features

### Data Protection
- **AES-256-GCM encryption** for all stored credentials
- **No credential logging** - passwords never appear in logs
- **Secure headers** via Helmet.js
- **CORS protection** with configurable origins

### Input Validation
- **Zod schemas** for API request validation
- **SQL injection protection** via Mongoose ODM
- **XSS protection** through React's built-in escaping

### Access Control
- **No authentication required** (internal tool)
- **API rate limiting** can be added as needed
- **Environment-based configuration**

## Monitoring & Logging

### Log Files (Backend)
- `logs/app.log` - General application logs
- `logs/error.log` - Error-specific logs
- `logs/exceptions.log` - Uncaught exceptions
- `logs/rejections.log` - Unhandled promise rejections

### Log Levels
- **info**: General operational messages
- **warn**: Warning conditions
- **error**: Error conditions
- **debug**: Detailed debugging information

### Health Monitoring
- Real-time server status via `/api/health`
- MongoDB connection monitoring
- Memory usage tracking
- System uptime reporting

## Troubleshooting

### Common Issues

**MongoDB Connection Failed:**
```bash
# Check MongoDB is running
sudo systemctl status mongod

# Start MongoDB
sudo systemctl start mongod
```

**Playwright Browser Installation:**
```bash
cd backend
npx playwright install chromium --with-deps
```

**Port Already in Use:**
```bash
# Find and kill process using port 3001
lsof -ti:3001 | xargs kill -9
```

**SEPTA Connection Issues:**
1. Verify credentials are correct
2. Check SEPTA portal is accessible
3. Review network connectivity
4. Check application logs for detailed errors

### Performance Optimization

**Database Indexes:**
- Automatic indexes on `portal`, `titleHash`, `postedDate`
- Compound index for deduplication
- Regular index maintenance recommended

**Memory Usage:**
- Monitor via health endpoint
- Restart if memory usage exceeds thresholds
- Consider PM2 for production process management

## Development

### Adding New Portals
1. Create new scraper in `/backend/src/services/scrapers/`
2. Add portal enum to Bid and Credential models
3. Create corresponding API endpoints
4. Update frontend to support new portal

### Database Schema Updates
1. Update Mongoose models in `/backend/src/models/`
2. Consider migration scripts for existing data
3. Update API validation schemas

### Frontend Components
- Follow existing component structure
- Use Context API for state management
- Maintain mobile responsiveness
- Add proper error boundaries

## Deployment

### Docker Deployment
```dockerfile
# Example Dockerfile for backend
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://mongo:27017/septa-bids
ENCRYPTION_KEY=<your-production-key>
FRONTEND_URL=https://your-domain.com
LOG_LEVEL=warn
```

### Systemd Service (Linux)
```ini
[Unit]
Description=SEPTA Bid Scraper
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/path/to/BOT3/backend
ExecStart=/usr/bin/node src/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the package.json files for details.

## Support

For technical support or questions:
1. Check the troubleshooting section above
2. Review application logs for detailed error information
3. Create an issue in the GitHub repository
4. Contact the system administrator