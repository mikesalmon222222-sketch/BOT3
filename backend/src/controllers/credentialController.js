import Credential from '../models/Credential.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { SeptaScraper } from '../services/scrapers/septaScraper.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

export const getCredentials = async (req, res) => {
  try {
    const credentials = await Credential.find({}, {
      usernameEnc: 0,
      passwordEnc: 0
    }).lean();

    const credentialStatus = credentials.reduce((acc, cred) => {
      acc[cred.portal] = {
        exists: true,
        lastTestedAt: cred.lastTestedAt,
        lastTestOk: cred.lastTestOk,
        updatedAt: cred.updatedAt
      };
      return acc;
    }, {});

    res.json({
      success: true,
      data: credentialStatus
    });
  } catch (error) {
    logger.error('Error retrieving credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve credentials'
    });
  }
};

export const saveSeptaCredentials = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      logger.error('Database not connected, cannot save credentials');
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again later.'
      });
    }

    // Encrypt credentials
    const usernameEnc = encrypt(username);
    const passwordEnc = encrypt(password);

    // Save or update credentials
    await Credential.findOneAndUpdate(
      { portal: 'SEPTA' },
      {
        portal: 'SEPTA',
        usernameEnc,
        passwordEnc,
        lastTestOk: false // Reset test status
      },
      { upsert: true, new: true }
    );

    logger.info('SEPTA credentials saved successfully');

    res.json({
      success: true,
      message: 'SEPTA credentials saved successfully'
    });
  } catch (error) {
    logger.error('Error saving SEPTA credentials:', error);
    
    // Provide more specific error messages
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid credential data provided'
      });
    }
    
    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({
        success: false,
        error: 'Database connection error. Please try again later.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to save credentials'
    });
  }
};

export const testSeptaCredentials = async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      logger.error('Database not connected, cannot test credentials');
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again later.'
      });
    }

    // Get stored credentials
    const credential = await Credential.findOne({ portal: 'SEPTA' });
    
    if (!credential) {
      return res.status(400).json({
        success: false,
        error: 'No SEPTA credentials found'
      });
    }

    // Decrypt credentials
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
        error: 'Failed to decrypt credentials'
      });
    }

    // Test connection
    const scraper = new SeptaScraper(credentials);
    const testResult = await scraper.testConnection();

    // Update test result in database
    await Credential.findByIdAndUpdate(credential._id, {
      lastTestedAt: new Date(),
      lastTestOk: testResult
    });

    logger.info(`SEPTA credentials test result: ${testResult ? 'Success' : 'Failed'}`);

    res.json({
      success: true,
      data: {
        testPassed: testResult,
        message: testResult ? 'Connection successful' : 'Connection failed'
      }
    });
  } catch (error) {
    logger.error('Error testing SEPTA credentials:', error);
    
    // Provide more specific error messages
    if (error.name === 'MongoNetworkError') {
      return res.status(503).json({
        success: false,
        error: 'Database connection error. Please try again later.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to test credentials'
    });
  }
};

export const deleteSeptaCredentials = async (req, res) => {
  try {
    const result = await Credential.deleteOne({ portal: 'SEPTA' });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No SEPTA credentials found'
      });
    }

    logger.info('SEPTA credentials deleted successfully');

    res.json({
      success: true,
      message: 'SEPTA credentials deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting SEPTA credentials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete credentials'
    });
  }
};