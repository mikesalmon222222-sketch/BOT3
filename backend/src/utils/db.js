import mongoose from 'mongoose';
import logger from './logger.js';

const connectDB = async (retries = 5) => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/septa-bids';
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      logger.info('MongoDB connected successfully');
      return true;
    } catch (error) {
      logger.error(`MongoDB connection attempt ${attempt} failed:`, error.message);
      
      if (attempt === retries) {
        logger.error('All MongoDB connection attempts failed. Running without database.');
        return false;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return false;
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error.message);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
});

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

export { connectDB, disconnectDB };