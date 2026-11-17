import axios from 'axios';
import { ENV } from '../config/env.js';

const GOOGLE_ROUTES_COMPUTE_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/**
 * Haversine formula to compute great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(coordA, coordB) {
  if (!coordA || !coordB) return 0;
  const lat1 = coordA.lat;
  const lon1 = coordA.lon;
  const lat2 = coordB.lat;
  const lon2 = coordB.lon;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Nearest-Neighbor Traveling Salesperson Problem (TSP) heuristic.
 * Sorts selected attractions starting from city center to minimize zigzag transit.
 *
 * @param {object[]} attractions
 * @param {{ lat: number, lon: number }} cityCenter
 * @returns {object[]} Sequenced attractions in visit order
 */
export function sequenceVisitOrderTSP(attractions = [], cityCenter = { lat: 24.5854, lon: 73.7125 }) {
  if (!attractions.length) return [];

  const unvisited = [...attractions];
  const sequenced = [];
  let currentPosition = cityCenter;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let shortestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const itemCoords = unvisited[i].coordinates || {
        lat: unvisited[i].lat,
        lon: unvisited[i].lon ?? unvisited[i].lng,
      };
      const dist = calculateHaversineDistanceKm(currentPosition, itemCoords);
      if (dist < shortestDistance) {
        shortestDistance = dist;
        nearestIndex = i;
      }
    }

    const nextPlace = unvisited.splice(nearestIndex, 1)[0];
    sequenced.push({
      ...nextPlace,
      distanceFromPrevStopKm: shortestDistance,
      distance_from_prev_km: shortestDistance,
    });
    currentPosition = nextPlace.coordinates || {
      lat: nextPlace.lat,
      lon: nextPlace.lon ?? nextPlace.lng,
    };
  }

  return sequenced;
}

/**
 * Compute driving distance and duration for the shortlisted itinerary.
 * Uses Google Routes API when available; otherwise falls back to Haversine estimate.
 *
 * @param {object[]} sequencedAttractions
 * @param {{ lat: number, lon: number }} cityCenter
 * @returns {Promise<object>} Route information and leg details
 */
export async function calculateRouteDetails(
  sequencedAttractions = [],
  cityCenter = { lat: 24.5854, lon: 73.7125 }
) {
  // 1. Build default Haversine fallback estimate
  const haversineFallback = buildHaversineRouteFallback(sequencedAttractions, cityCenter);

  // If no Google Maps API key or empty list, return Haversine route
  if (!ENV.GOOGLE_MAPS_API_KEY || sequencedAttractions.length === 0) {
    return {
      ...haversineFallback,
      provider: 'Haversine Geographic Matrix',
      source: 'haversine_estimate',
      isLive: false,
      status: 'active_fallback',
      note: 'Road distance estimated via great-circle distance matrix with local city traffic speed heuristic (25 km/h).',
    };
  }

  // 2. Call Google Routes API (computeRoutes)
  try {
    const toWaypoint = (coords) => ({
      location: {
        latLng: {
          latitude: coords.lat,
          longitude: coords.lon ?? coords.lng,
        },
      },
    });

    const origin = toWaypoint(cityCenter);
    const destination = toWaypoint(cityCenter);
    const intermediates = sequencedAttractions.map((a) =>
      toWaypoint(a.coordinates || { lat: a.lat, lon: a.lon ?? a.lng })
    );

    const response = await axios.post(
      GOOGLE_ROUTES_COMPUTE_URL,
      {
        origin,
        destination,
        intermediates,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': ENV.GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'routes.duration,routes.distanceMeters,routes.legs.distanceMeters,routes.legs.duration',
        },
        timeout: 6000,
      }
    );

    const route = response.data?.routes?.[0];
    if (!route) {
      return { ...haversineFallback, source: 'haversine_estimate', isLive: false };
    }

    const totalDistanceKm = Number((route.distanceMeters / 1000).toFixed(1));
    const totalDurationMin = Math.round(parseInt(route.duration || '0') / 60);

    const legs = (route.legs || []).map((leg, idx) => {
      const dist = Number((leg.distanceMeters / 1000).toFixed(1));
      const dur = Math.round(parseInt(leg.duration || '0') / 60);
      return {
        from: idx === 0 ? 'Udaipur City Center' : sequencedAttractions[idx - 1]?.name || `Stop ${idx}`,
        to:
          sequencedAttractions[idx]?.name ||
          (idx === sequencedAttractions.length ? 'Udaipur City Center' : `Stop ${idx + 1}`),
        distanceKm: dist,
        distance_km: dist,
        durationMin: dur,
        duration_min: dur,
      };
    });

    return {
      totalDistanceKm,
      total_distance_km: totalDistanceKm,
      totalDurationMin,
      total_duration_min: totalDurationMin,
      legs,
      provider: 'Google Routes API',
      source: 'google_routes',
      isLive: true,
      status: 'live',
      note: 'Verified driving distance and duration from Google Routes API.',
    };
  } catch (err) {
    const isBlocked = err.response?.data?.error?.status === 'PERMISSION_DENIED';
    console.warn(
      `[GoogleRoutes] computeRoutes API call failed: ${err.message}. ${
        isBlocked ? '(Routes API not enabled in Google Cloud Console)' : ''
      }. Using Haversine fallback.`
    );
    return {
      ...haversineFallback,
      provider: 'Haversine Geographic Matrix',
      source: 'haversine_estimate',
      isLive: false,
      status: 'active_fallback',
      note: isBlocked
        ? 'Google Routes API is not enabled for this API key in Google Cloud Console. Displaying estimated road distance.'
        : 'Google Routes call unavailable. Displaying estimated road distance.',
      error: err.response?.data?.error?.message || err.message,
    };
  }
}

function buildHaversineRouteFallback(attractions = [], cityCenter) {
  if (!attractions.length) {
    return {
      totalDistanceKm: 0,
      total_distance_km: 0,
      totalDurationMin: 0,
      total_duration_min: 0,
      legs: [],
    };
  }

  const CITY_AVERAGE_SPEED_KMH = 25; // 25 km/h local Udaipur traffic speed
  let totalDistanceKm = 0;
  const legs = [];
  let currentPos = cityCenter;
  let currentName = 'Udaipur City Center';

  for (const item of attractions) {
    const coords = item.coordinates || { lat: item.lat, lon: item.lon ?? item.lng };
    const legDist = calculateHaversineDistanceKm(currentPos, coords);
    // Multiply straight-line distance by 1.3 to model real-world urban road circuitry
    const estimatedRoadDist = Number((legDist * 1.3).toFixed(1));
    const legDurationMin = Math.max(2, Math.round((estimatedRoadDist / CITY_AVERAGE_SPEED_KMH) * 60));

    legs.push({
      from: currentName,
      to: item.name,
      distanceKm: estimatedRoadDist,
      distance_km: estimatedRoadDist,
      durationMin: legDurationMin,
      duration_min: legDurationMin,
    });

    totalDistanceKm += estimatedRoadDist;
    currentPos = coords;
    currentName = item.name;
  }

  // Return leg to city center
  const returnDist = Number(
    (calculateHaversineDistanceKm(currentPos, cityCenter) * 1.3).toFixed(1)
  );
  const returnDuration = Math.max(2, Math.round((returnDist / CITY_AVERAGE_SPEED_KMH) * 60));
  legs.push({
    from: currentName,
    to: 'Udaipur City Center',
    distanceKm: returnDist,
    distance_km: returnDist,
    durationMin: returnDuration,
    duration_min: returnDuration,
  });
  totalDistanceKm += returnDist;

  const totalDurationMin = Math.round((totalDistanceKm / CITY_AVERAGE_SPEED_KMH) * 60);

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    total_distance_km: Number(totalDistanceKm.toFixed(1)),
    totalDurationMin,
    total_duration_min: totalDurationMin,
    legs,
  };
}
