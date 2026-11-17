import { Router } from 'express';
import { getProviderStatus } from '../config/env.js';

const router = Router();
const startTime = Date.now();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TripWise Backend API',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    providers: getProviderStatus(),
  });
});

export default router;
