import Credential from '../models/Credential.js';
import { encrypt, decrypt } from '../utils/encryption.js';
import { SeptaScraper } from '../services/scrapers/septaScraper.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';
import { mockDB } from '../utils/mockDB.js';

// Check if we should use mock database
const useMockDB = () => mongoose.connection.readyState !== 1;

export const getCredentials = async (req, res) => {
  try {
    let credentials;
    
    if (useMockDB()) {
      logger.info('Using mock database for credential retrieval');
      credentials = await mockDB.findCredentials();
      // Remove sensitive fields
      credentials = credentials.map(cred => ({
        portal: cred.portal,
        lastTestedAt: cred.lastTestedAt,
        lastTestOk: cred.lastTestOk,
        updatedAt: cred.updatedAt
      }));
    } else {
      credentials = await Credential.find({}, {
        usernameEnc: 0,
        passwordEnc: 0
      }).lean();
    }

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

    // Check if database is connected (only relevant for MongoDB)
    if (!useMockDB() && mongoose.connection.readyState !== 1) {
      logger.error('Database not connected, cannot save credentials');
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again later.'
      });
    }

    // Encrypt credentials
    const usernameEnc = encrypt(username);
    const passwordEnc = encrypt(password);

    const credentialData = {
      portal: 'SEPTA',
      usernameEnc,
      passwordEnc,
      lastTestOk: false // Reset test status
    };

    // Save or update credentials
    if (useMockDB()) {
      logger.info('Using mock database for credential storage');
      await mockDB.saveCredential(credentialData);
    } else {
      await Credential.findOneAndUpdate(
        { portal: 'SEPTA' },
        credentialData,
        { upsert: true, new: true }
      );
    }

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
    // Check if database is connected (only relevant for MongoDB)
    if (!useMockDB() && mongoose.connection.readyState !== 1) {
      logger.error('Database not connected, cannot test credentials');
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable. Please try again later.'
      });
    }

    // Get stored credentials
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
        error: 'Failed to decrypt credentials. Please re-save credentials.'
      });
    }

    // Test connection with detailed error handling
    const scraper = new SeptaScraper(credentials);
    let testResult = false;
    let errorMessage = 'Connection test failed';
    
    try {
      testResult = await scraper.testConnection();
      
      if (testResult) {
        errorMessage = 'Connection successful';
      } else {
        errorMessage = 'Invalid credentials or portal access denied';
      }
    } catch (error) {
      logger.error('Connection test error:', error);
      
      if (error.message.includes('initialization')) {
        errorMessage = 'Browser initialization failed';
      } else if (error.message.includes('credentials')) {
        errorMessage = 'Invalid username or password';
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        errorMessage = 'Network timeout or portal unavailable';
      } else {
        errorMessage = `Connection failed: ${error.message}`;
      }
    }

    // Update test result in database
    if (useMockDB()) {
      await mockDB.updateCredential(credential._id, {
        lastTestedAt: new Date().toISOString(),
        lastTestOk: testResult
      });
    } else {
      await Credential.findByIdAndUpdate(credential._id, {
        lastTestedAt: new Date(),
        lastTestOk: testResult
      });
    }

    logger.info(`SEPTA credentials test result: ${testResult ? 'SUCCESS' : 'FAILED'} - ${errorMessage}`);

    res.json({
      success: true,
      data: {
        testPassed: testResult,
        message: errorMessage,
        timestamp: new Date().toISOString()
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
      error: 'Failed to test credentials due to system error'
    });
  }
};

export const deleteSeptaCredentials = async (req, res) => {
  try {
    let result;
    
    if (useMockDB()) {
      logger.info('Using mock database for credential deletion');
      result = await mockDB.deleteCredential('SEPTA');
    } else {
      result = await Credential.deleteOne({ portal: 'SEPTA' });
    }

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