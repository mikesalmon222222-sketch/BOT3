import Bid from '../models/Bid.js';
import logger from '../utils/logger.js';
import { SeptaScraper } from '../services/scrapers/septaScraper.js';
import Credential from '../models/Credential.js';
import { decrypt } from '../utils/encryption.js';
import mongoose from 'mongoose';
import { mockDB } from '../utils/mockDB.js';

// Check if we should use mock database
const useMockDB = () => mongoose.connection.readyState !== 1;

export const getBids = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    
    // Add filters if provided
    if (req.query.portal) {
      filter.portal = req.query.portal;
    }
    
    if (req.query.dateFrom || req.query.dateTo) {
      filter.postedDate = {};
      if (req.query.dateFrom) {
        filter.postedDate.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.postedDate.$lte = new Date(req.query.dateTo);
      }
    }

    let bids, total;

    if (useMockDB()) {
      logger.info('Using mock database for bid retrieval');
      const result = await mockDB.findBids(filter, { skip, limit });
      bids = result.bids;
      total = result.total;
    } else {
      const [bidResults, totalCount] = await Promise.all([
        Bid.find(filter)
          .sort({ postedDate: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Bid.countDocuments(filter)
      ]);
      bids = bidResults;
      total = totalCount;
    }

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        bids,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    });

    logger.info(`Retrieved ${bids.length} bids for page ${page} (using ${useMockDB() ? 'mock' : 'mongo'} DB)`);
  } catch (error) {
    logger.error('Error retrieving bids:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bids'
    });
  }
};

export const deleteBid = async (req, res) => {
  try {
    const { id } = req.params;
    
    let deletedBid;
    
    if (useMockDB()) {
      logger.info('Using mock database for bid deletion');
      deletedBid = await mockDB.deleteBid(id);
    } else {
      deletedBid = await Bid.findByIdAndDelete(id);
    }
    
    if (!deletedBid) {
      return res.status(404).json({
        success: false,
        error: 'Bid not found'
      });
    }

    logger.info(`Deleted bid: ${deletedBid.title || 'Unknown'}`);
    res.json({
      success: true,
      message: 'Bid deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting bid:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bid'
    });
  }
};

export const fetchSeptaBids = async (req, res) => {
  try {
    logger.info('Manual SEPTA bid fetch triggered');
    
    // Get SEPTA credentials
    let credential;
    
    if (useMockDB()) {
      logger.info('Using mock database for credential retrieval');
      credential = await mockDB.findCredentialByPortal('SEPTA');
    } else {
      credential = await Credential.findOne({ portal: 'SEPTA' });
    }
    
    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'No SEPTA credentials found. Please save credentials first.'
      });
    }

    let credentials;
    try {
      credentials = {
        username: decrypt(credential.usernameEnc),
        password: decrypt(credential.passwordEnc)
      };
    } catch (error) {
      logger.error('Failed to decrypt SEPTA credentials:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to decrypt credentials. Please re-save credentials.'
      });
    }

    // Initialize scraper with debug mode if requested
    const debugMode = req.query.debug === 'true';
    process.env.SEPTA_DEBUG = debugMode ? 'true' : 'false';
    
    const scraper = new SeptaScraper(credentials);
    let scrapedBids = [];
    
    try {
      await scraper.initialize();
      logger.info('Scraper initialized, attempting login...');
      
      await scraper.login();
      logger.info('Login successful, scraping bids...');
      
      scrapedBids = await scraper.scrapeBids();
      logger.info(`Scraping completed, found ${scrapedBids.length} bids`);
      
    } catch (error) {
      logger.error('Scraping process failed:', error);
      throw new Error(`Scraping failed: ${error.message}`);
    } finally {
      await scraper.cleanup();
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process each scraped bid
    for (const bidData of scrapedBids) {
      try {
        let existingBid;
        
        if (useMockDB()) {
          existingBid = await mockDB.findBidByHash(bidData.portal, bidData.titleHash);
        } else {
          existingBid = await Bid.findOne({
            portal: bidData.portal,
            titleHash: bidData.titleHash
          });
        }

        if (existingBid) {
          // Update existing bid if needed
          const hasChanges = existingBid.link !== bidData.link ||
                           existingBid.description !== bidData.description ||
                           JSON.stringify(existingBid.documents) !== JSON.stringify(bidData.documents);

          if (hasChanges) {
            if (useMockDB()) {
              await mockDB.updateBid(existingBid._id, bidData);
            } else {
              await Bid.findByIdAndUpdate(existingBid._id, bidData);
            }
            updated++;
            logger.info(`Updated bid: ${bidData.title}`);
          } else {
            skipped++;
          }
        } else {
          // Insert new bid
          if (useMockDB()) {
            await mockDB.saveBid(bidData);
          } else {
            await Bid.create(bidData);
          }
          inserted++;
          logger.info(`Inserted new bid: ${bidData.title}`);
        }
      } catch (error) {
        logger.error(`Error processing bid "${bidData.title}":`, error);
        errors.push(`Failed to save bid "${bidData.title}": ${error.message}`);
        skipped++;
      }
    }

    const summary = { inserted, updated, skipped, total: scrapedBids.length };
    
    if (errors.length > 0) {
      summary.errors = errors;
    }
    
    logger.info(`SEPTA fetch complete:`, summary);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error fetching SEPTA bids:', error);
    
    let errorMessage = 'Failed to fetch SEPTA bids';
    if (error.message.includes('credentials')) {
      errorMessage = 'Invalid credentials or authentication failed';
    } else if (error.message.includes('navigation') || error.message.includes('timeout')) {
      errorMessage = 'Network or portal access issue';
    } else if (error.message.includes('Scraper initialization')) {
      errorMessage = 'Browser initialization failed';
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
};