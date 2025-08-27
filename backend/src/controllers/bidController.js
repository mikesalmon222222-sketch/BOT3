import Bid from '../models/Bid.js';
import logger from '../utils/logger.js';
import { SeptaScraper } from '../services/scrapers/septaScraper.js';
import Credential from '../models/Credential.js';
import { decrypt } from '../utils/encryption.js';

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

    const [bids, total] = await Promise.all([
      Bid.find(filter)
        .sort({ postedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bid.countDocuments(filter)
    ]);

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

    logger.info(`Retrieved ${bids.length} bids for page ${page}`);
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
    
    const deletedBid = await Bid.findByIdAndDelete(id);
    
    if (!deletedBid) {
      return res.status(404).json({
        success: false,
        error: 'Bid not found'
      });
    }

    logger.info(`Deleted bid: ${deletedBid.title}`);
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
    const credential = await Credential.findOne({ portal: 'SEPTA' });
    let credentials = null;
    
    if (credential) {
      try {
        credentials = {
          username: decrypt(credential.usernameEnc),
          password: decrypt(credential.passwordEnc)
        };
      } catch (error) {
        logger.error('Failed to decrypt SEPTA credentials:', error);
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

    const summary = { inserted, updated, skipped };
    logger.info(`SEPTA fetch complete:`, summary);

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Error fetching SEPTA bids:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SEPTA bids'
    });
  }
};