import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const ENV = {
  PORT: parseInt(process.env.PORT || '5005', 10),
  OTM_API_KEY: process.env.OTM_API_KEY || '',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};

/**
 * Returns configuration status of external API providers.
 */
export function getProviderStatus() {
  return {
    openTripMap: {
      provider: 'OpenTripMap',
      configured: Boolean(ENV.OTM_API_KEY),
      mode: ENV.OTM_API_KEY ? 'live_api' : 'verified_official_registry',
    },
    googlePlaces: {
      provider: 'Google Places API (New)',
      configured: Boolean(ENV.GOOGLE_MAPS_API_KEY),
      mode: ENV.GOOGLE_MAPS_API_KEY ? 'live_api' : 'disabled',
    },
    googleRoutes: {
      provider: 'Google Routes API',
      configured: Boolean(ENV.GOOGLE_MAPS_API_KEY),
      mode: ENV.GOOGLE_MAPS_API_KEY ? 'live_api' : 'haversine_fallback',
    },
  };
}
