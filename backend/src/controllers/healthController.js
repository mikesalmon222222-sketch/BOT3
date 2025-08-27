import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export const getHealth = async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.version,
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // Check MongoDB connection
    try {
      if (mongoose.connection.readyState === 1) {
        health.services.mongodb = { status: 'connected' };
      } else {
        health.services.mongodb = { status: 'disconnected' };
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.mongodb = { status: 'error', error: error.message };
      health.status = 'degraded';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      unit: 'MB'
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

    if (health.status !== 'healthy') {
      logger.warn('Health check returned degraded status:', health);
    }
  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};