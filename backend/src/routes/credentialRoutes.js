import express from 'express';
import {
  getCredentials,
  saveSeptaCredentials,
  testSeptaCredentials,
  deleteSeptaCredentials
} from '../controllers/credentialController.js';

const router = express.Router();

// GET /api/credentials - Get credential status
router.get('/', getCredentials);

// POST /api/credentials/septa - Save SEPTA credentials
router.post('/septa', saveSeptaCredentials);

// POST /api/credentials/septa/test - Test SEPTA credentials
router.post('/septa/test', testSeptaCredentials);

// DELETE /api/credentials/septa - Delete SEPTA credentials
router.delete('/septa', deleteSeptaCredentials);

export default router;