import express from 'express';
import { getHealth } from '../controllers/healthController.js';

const router = express.Router();

// GET /api/health - Health check endpoint
router.get('/', getHealth);

export default router;