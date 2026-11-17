import axios from 'axios';
import { ENV } from '../config/env.js';

const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_PLACES_MEDIA_URL = 'https://places.googleapis.com/v1';

// Deduplication map: name / id -> Google Place ID
const placeIdCache = new Map();

/**
 * Check if Google Places integration is active.
 */
export function isGooglePlacesConfigured() {
  return Boolean(ENV.GOOGLE_MAPS_API_KEY);
}

/**
 * Fetch supplementary data (photos, official address, user rating) from Google Places API (New).
 *
 * @param {string} placeName
 * @param {string} [city='Udaipur']
 * @returns {Promise<{ isConfigured: boolean, placeId?: string, photoUrl?: string, rating?: number, address?: string, source: string }>}
 */
export async function fetchSupplementaryPlaceData(placeName, city = 'Udaipur') {
  if (!isGooglePlacesConfigured()) {
    return {
      isConfigured: false,
      status: 'unconfigured',
      message: 'Google Places API key is not configured in server/.env.',
      source: 'none',
    };
  }

  const queryKey = `${placeName.toLowerCase()} ${city.toLowerCase()}`;
  if (placeIdCache.has(queryKey)) {
    return placeIdCache.get(queryKey);
  }

  try {
    const response = await axios.post(
      GOOGLE_PLACES_TEXT_SEARCH_URL,
      {
        textQuery: `${placeName}, ${city}, Rajasthan, India`,
        languageCode: 'en',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': ENV.GOOGLE_MAPS_API_KEY,
          // Strict field mask adhering to Essentials / low-cost tier
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos',
        },
        timeout: 4000,
      }
    );

    const place = response.data?.places?.[0];
    if (!place) {
      const emptyResult = { isConfigured: true, found: false, source: 'google_places_api' };
      placeIdCache.set(queryKey, emptyResult);
      return emptyResult;
    }

    const placeId = place.id;
    let photoUrl = null;
    if (place.photos && place.photos.length > 0) {
      const photoName = place.photos[0].name;
      photoUrl = `${GOOGLE_PLACES_MEDIA_URL}/${photoName}/media?maxWidthPx=800&key=${ENV.GOOGLE_MAPS_API_KEY}`;
    }

    const enriched = {
      isConfigured: true,
      found: true,
      placeId,
      address: place.formattedAddress || null,
      userRating: place.rating || null,
      photoUrl,
      source: 'google_places_api',
    };

    placeIdCache.set(queryKey, enriched);
    return enriched;
  } catch (err) {
    console.warn(`[GooglePlaces] Supplementary lookup failed for "${placeName}": ${err.message}`);
    return {
      isConfigured: true,
      found: false,
      error: err.message,
      source: 'google_places_api_error',
    };
  }
}

/**
 * Enrich a list of attractions with supplementary Google Places data if photos or metadata are missing.
 * Avoids duplicate calls by checking place IDs.
 *
 * @param {object[]} attractions
 * @returns {Promise<object[]>}
 */
export async function enrichAttractionsWithGooglePlaces(attractions = []) {
  if (!isGooglePlacesConfigured() || !attractions.length) {
    return attractions;
  }

  const seenPlaceIds = new Set();
  const enriched = [];

  for (const attraction of attractions) {
    // Only query if attraction has no photo or needs supplementary data
    if (!attraction.image) {
      const supp = await fetchSupplementaryPlaceData(attraction.name, 'Udaipur');
      if (supp.found) {
        // Prevent duplicate place IDs
        if (supp.placeId && seenPlaceIds.has(supp.placeId)) {
          console.warn(`[GooglePlaces] Duplicate place detected: ${attraction.name} (ID: ${supp.placeId})`);
        } else if (supp.placeId) {
          seenPlaceIds.add(supp.placeId);
        }

        if (supp.photoUrl) attraction.image = supp.photoUrl;
        if (supp.address && !attraction.address) attraction.address = supp.address;
        if (supp.userRating) attraction.googleRating = supp.userRating;
        attraction.googlePlaceId = supp.placeId;
      }
    }
    enriched.push(attraction);
  }

  return enriched;
}
