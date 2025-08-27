import express from 'express';
import { getBids, deleteBid, fetchSeptaBids } from '../controllers/bidController.js';

const router = express.Router();

// GET /api/bids - Get paginated bids with optional filters
router.get('/', getBids);

// DELETE /api/bids/:id - Delete a specific bid
router.delete('/:id', deleteBid);

// POST /api/bids/fetch/septa - Manually trigger SEPTA bid fetch
router.post('/fetch/septa', fetchSeptaBids);

export default router;