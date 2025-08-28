import express from 'express';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const router = express.Router();

// GET /api/debug/screenshots - List available debug screenshots
router.get('/screenshots', async (req, res) => {
  try {
    const screenshotDir = '/tmp/septa-screenshots';
    
    if (!fs.existsSync(screenshotDir)) {
      return res.json({
        success: true,
        data: {
          screenshots: [],
          message: 'No screenshots directory found'
        }
      });
    }

    const files = fs.readdirSync(screenshotDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const filePath = path.join(screenshotDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.mtime,
          url: `/api/debug/screenshots/${file}`
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json({
      success: true,
      data: {
        screenshots: files,
        count: files.length
      }
    });
  } catch (error) {
    logger.error('Error listing screenshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list screenshots'
    });
  }
});

// GET /api/debug/screenshots/:filename - Serve a specific screenshot
router.get('/screenshots/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const screenshotPath = path.join('/tmp/septa-screenshots', filename);
    
    if (!fs.existsSync(screenshotPath)) {
      return res.status(404).json({
        success: false,
        error: 'Screenshot not found'
      });
    }

    res.sendFile(screenshotPath);
  } catch (error) {
    logger.error('Error serving screenshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve screenshot'
    });
  }
});

// POST /api/debug/clear-screenshots - Clear all debug screenshots
router.post('/clear-screenshots', async (req, res) => {
  try {
    const screenshotDir = '/tmp/septa-screenshots';
    
    if (fs.existsSync(screenshotDir)) {
      const files = fs.readdirSync(screenshotDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          fs.unlinkSync(path.join(screenshotDir, file));
          deletedCount++;
        }
      }
      
      res.json({
        success: true,
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} screenshots`
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          deletedCount: 0,
          message: 'No screenshots directory found'
        }
      });
    }
  } catch (error) {
    logger.error('Error clearing screenshots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear screenshots'
    });
  }
});

export default router;