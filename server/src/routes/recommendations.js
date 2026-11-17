import { Router } from 'express';
import { z } from 'zod';
import { generateRecommendations } from '../services/orchestratorService.js';

const router = Router();

const recommendationSchema = z.object({
  city: z.string().min(1, 'City is required').default('Udaipur'),
  categories: z.array(z.string()).min(1, 'At least one category must be selected'),
  priorities: z.array(z.string()).min(1, 'Priority rankings must be specified'),
  budget: z.coerce.number().min(50, 'Budget must be at least ₹50'),
  tolerance: z.coerce.number().min(0).max(0.5).default(0.10),
  transportMode: z.enum(['auto_rickshaw', 'taxi_cab', 'walking']).default('auto_rickshaw'),
  budgetMode: z.enum(['all_inclusive', 'tickets_only']).default('all_inclusive'),
});

async function handleRecommendationRequest(req, res, next) {
  try {
    const parseResult = recommendationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten(),
      });
    }

    const result = await generateRecommendations(parseResult.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/recommendations/generate
router.post('/generate', handleRecommendationRequest);

// POST /api/recommendations (alias for frontend backward compatibility)
router.post('/', handleRecommendationRequest);

export default router;
