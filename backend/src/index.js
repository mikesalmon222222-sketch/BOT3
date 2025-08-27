import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { connectDB } from './utils/db.js';
import logger from './utils/logger.js';

// Import routes
import healthRoutes from './routes/healthRoutes.js';
import bidRoutes from './routes/bidRoutes.js';
import credentialRoutes from './routes/credentialRoutes.js';

// Import services for scheduled tasks
import { SeptaScraper } from './services/scrapers/septaScraper.js';
import Credential from './models/Credential.js';
import Bid from './models/Bid.js';
import { decrypt, generateHash } from './utils/encryption.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/credentials', credentialRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'SEPTA Bid Scraper API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Scheduled bid fetching function
async function scheduledBidFetch() {
  try {
    logger.info('Starting scheduled SEPTA bid fetch');
    
    // Get SEPTA credentials
    const credential = await Credential.findOne({ portal: 'SEPTA' });
    let credentials = null;
    
    if (credential) {
      try {
        credentials = {
          username: decrypt(credential.usernameEnc),
          password: decrypt(credential.passwordEnc)
        };
      } catch (error) {
        logger.error('Failed to decrypt SEPTA credentials for scheduled fetch:', error);
      }
    }

    // Initialize scraper and fetch bids
    const scraper = new SeptaScraper(credentials);
    await scraper.initialize();
    await scraper.login();
    const scrapedBids = await scraper.scrapeBids();
    await scraper.cleanup();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Process each scraped bid
    for (const bidData of scrapedBids) {
      try {
        const existingBid = await Bid.findOne({
          portal: bidData.portal,
          titleHash: bidData.titleHash
        });

        if (existingBid) {
          // Update existing bid if needed
          const hasChanges = existingBid.link !== bidData.link ||
                           existingBid.description !== bidData.description ||
                           JSON.stringify(existingBid.documents) !== JSON.stringify(bidData.documents);

          if (hasChanges) {
            await Bid.findByIdAndUpdate(existingBid._id, bidData);
            updated++;
            logger.info(`Updated bid: ${bidData.title}`);
          } else {
            skipped++;
          }
        } else {
          // Insert new bid
          await Bid.create(bidData);
          inserted++;
          logger.info(`Inserted new bid: ${bidData.title}`);
        }
      } catch (error) {
        logger.error(`Error processing bid "${bidData.title}":`, error);
        skipped++;
      }
    }

    logger.info(`Scheduled SEPTA fetch complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
  } catch (error) {
    logger.error('Error in scheduled bid fetch:', error);
  }
}

// Start server
async function startServer() {
  try {
    // Connect to MongoDB (with retry logic)
    const dbConnected = await connectDB();
    
    if (!dbConnected) {
      logger.warn('Starting server without database connection');
    }

    // Install Playwright browsers if needed
    try {
      const { chromium } = await import('playwright');
      logger.info('Playwright browsers available');
    } catch (error) {
      logger.warn('Playwright browsers may need installation:', error.message);
    }

    // Schedule automatic bid fetching every 15 minutes
    cron.schedule('*/15 * * * *', scheduledBidFetch);
    logger.info('Scheduled bid fetching every 15 minutes');

    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the application
startServer();