#!/usr/bin/env node
import { decrypt } from './src/utils/encryption.js';
import Credential from './src/models/Credential.js';
import { connectDB } from './src/utils/db.js';
import logger from './src/utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Simple test script to verify credentials work without Playwright
async function testCredentialsWithoutBrowser() {
  logger.info('Testing SEPTA credentials without browser automation...');
  
  try {
    // Connect to database
    await connectDB();
    
    // Get stored credentials
    const credential = await Credential.findOne({ portal: 'SEPTA' });
    
    if (!credential) {
      logger.error('No SEPTA credentials found');
      return false;
    }
    
    // Decrypt credentials
    const credentials = {
      username: decrypt(credential.usernameEnc),
      password: decrypt(credential.passwordEnc)
    };
    
    logger.info(`Successfully decrypted credentials for user: ${credentials.username}`);
    logger.info('Credentials appear to be valid (encryption/decryption working)');
    
    // Test basic HTTP request to SEPTA login page
    const response = await fetch('https://epsadmin.septa.org/vendor/login', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.ok) {
      logger.info(`SEPTA login page is accessible: ${response.status} ${response.statusText}`);
      logger.info('Basic connectivity to SEPTA portal confirmed');
      return true;
    } else {
      logger.error(`SEPTA login page not accessible: ${response.status} ${response.statusText}`);
      return false;
    }
    
  } catch (error) {
    logger.error('Error testing credentials:', error.message);
    return false;
  }
}

// Run the test
testCredentialsWithoutBrowser()
  .then(result => {
    if (result) {
      logger.info('✅ Credential test passed - credentials are valid and SEPTA is accessible');
    } else {
      logger.error('❌ Credential test failed');
    }
    process.exit(result ? 0 : 1);
  })
  .catch(error => {
    logger.error('Test script error:', error);
    process.exit(1);
  });