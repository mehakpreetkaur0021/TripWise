import express from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';

import healthRouter from './routes/health.js';
import citiesRouter from './routes/cities.js';
import placesRouter from './routes/places.js';
import recommendationsRouter from './routes/recommendations.js';

const app = express();

// Middleware
app.use(cors({ origin: ENV.CORS_ORIGIN }));
app.use(express.json());
app.use(requestLogger);

// REST API Routes
app.use('/api/health', healthRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/places', placesRouter);
app.use('/api/recommendations', recommendationsRouter);

// Global Error Handler
app.use(errorHandler);

// Only listen if not imported by a test harness
if (process.env.NODE_ENV !== 'test') {
  app.listen(ENV.PORT, () => {
    console.log(`[TripWise Backend] Server running on http://localhost:${ENV.PORT}`);
  });
}

export default app;
