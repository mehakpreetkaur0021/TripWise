import { Router } from 'express';
import { z } from 'zod';
import { discoverPlaces } from '../services/placeDiscoveryService.js';
import { resolveAttractionPrice } from '../services/pricingService.js';

const router = Router();

const querySchema = z.object({
  city: z.string().default('Udaipur'),
  category: z.string().optional(),
  radius: z.coerce.number().min(1000).max(50000).default(15000),
  limit: z.coerce.number().min(1).max(50).default(20),
  page: z.coerce.number().min(1).default(1),
});

router.get('/', async (req, res, next) => {
  try {
    const parseResult = querySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
    }

    const { city, category, radius, limit, page } = parseResult.data;

    const discovery = await discoverPlaces({
      city,
      category,
      radius,
      limit,
      page,
    });

    // Attach resolved prices with verified/estimated metadata
    const placesWithPrices = await Promise.all(
      discovery.places.map(async (place) => {
        const price = await resolveAttractionPrice(place, city);
        return {
          ...place,
          price,
        };
      })
    );

    res.json({
      city,
      category: category || 'All',
      places: placesWithPrices,
      pagination: discovery.pagination,
      providerStatus: discovery.providerStatus,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
