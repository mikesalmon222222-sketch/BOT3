import fs from 'fs';
import path from 'path';
import logger from './logger.js';

const DATA_DIR = '/tmp/bot3-data';
const BIDS_FILE = path.join(DATA_DIR, 'bids.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(BIDS_FILE)) {
  fs.writeFileSync(BIDS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(CREDENTIALS_FILE)) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify([]));
}

class MockDatabase {
  constructor() {
    this.connected = true;
  }

  // Bid operations
  async findBids(filter = {}, options = {}) {
    try {
      const data = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf8'));
      let filteredData = data;

      // Apply filters
      if (filter.portal) {
        filteredData = filteredData.filter(bid => bid.portal === filter.portal);
      }

      if (filter.postedDate) {
        filteredData = filteredData.filter(bid => {
          const bidDate = new Date(bid.postedDate);
          if (filter.postedDate.$gte && bidDate < new Date(filter.postedDate.$gte)) return false;
          if (filter.postedDate.$lte && bidDate > new Date(filter.postedDate.$lte)) return false;
          return true;
        });
      }

      // Apply sorting
      filteredData.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));

      // Apply pagination
      const skip = options.skip || 0;
      const limit = options.limit || filteredData.length;
      const paginatedData = filteredData.slice(skip, skip + limit);

      return {
        bids: paginatedData,
        total: filteredData.length
      };
    } catch (error) {
      logger.error('Error reading bids file:', error);
      return { bids: [], total: 0 };
    }
  }

  async findBidByHash(portal, titleHash) {
    try {
      const data = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf8'));
      return data.find(bid => bid.portal === portal && bid.titleHash === titleHash) || null;
    } catch (error) {
      logger.error('Error finding bid by hash:', error);
      return null;
    }
  }

  async saveBid(bidData) {
    try {
      const data = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf8'));
      bidData._id = Date.now().toString();
      bidData.createdAt = new Date().toISOString();
      bidData.updatedAt = new Date().toISOString();
      data.push(bidData);
      fs.writeFileSync(BIDS_FILE, JSON.stringify(data, null, 2));
      return bidData;
    } catch (error) {
      logger.error('Error saving bid:', error);
      throw error;
    }
  }

  async updateBid(id, updateData) {
    try {
      const data = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf8'));
      const index = data.findIndex(bid => bid._id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updateData, updatedAt: new Date().toISOString() };
        fs.writeFileSync(BIDS_FILE, JSON.stringify(data, null, 2));
        return data[index];
      }
      return null;
    } catch (error) {
      logger.error('Error updating bid:', error);
      throw error;
    }
  }

  async deleteBid(id) {
    try {
      const data = JSON.parse(fs.readFileSync(BIDS_FILE, 'utf8'));
      const index = data.findIndex(bid => bid._id === id);
      if (index !== -1) {
        const deleted = data.splice(index, 1)[0];
        fs.writeFileSync(BIDS_FILE, JSON.stringify(data, null, 2));
        return deleted;
      }
      return null;
    } catch (error) {
      logger.error('Error deleting bid:', error);
      throw error;
    }
  }

  // Credential operations
  async findCredentials(filter = {}) {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      if (filter.portal) {
        return data.filter(cred => cred.portal === filter.portal);
      }
      return data;
    } catch (error) {
      logger.error('Error reading credentials file:', error);
      return [];
    }
  }

  async findCredentialByPortal(portal) {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      return data.find(cred => cred.portal === portal) || null;
    } catch (error) {
      logger.error('Error finding credential:', error);
      return null;
    }
  }

  async saveCredential(credData) {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      
      // Remove existing credential for same portal
      const existingIndex = data.findIndex(cred => cred.portal === credData.portal);
      if (existingIndex !== -1) {
        data.splice(existingIndex, 1);
      }
      
      credData._id = Date.now().toString();
      credData.createdAt = new Date().toISOString();
      credData.updatedAt = new Date().toISOString();
      data.push(credData);
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
      return credData;
    } catch (error) {
      logger.error('Error saving credential:', error);
      throw error;
    }
  }

  async updateCredential(id, updateData) {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      const index = data.findIndex(cred => cred._id === id);
      if (index !== -1) {
        data[index] = { ...data[index], ...updateData, updatedAt: new Date().toISOString() };
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
        return data[index];
      }
      return null;
    } catch (error) {
      logger.error('Error updating credential:', error);
      throw error;
    }
  }

  async deleteCredential(portal) {
    try {
      const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
      const index = data.findIndex(cred => cred.portal === portal);
      if (index !== -1) {
        const deleted = data.splice(index, 1)[0];
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2));
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    } catch (error) {
      logger.error('Error deleting credential:', error);
      throw error;
    }
  }
}

export const mockDB = new MockDatabase();
export default mockDB;