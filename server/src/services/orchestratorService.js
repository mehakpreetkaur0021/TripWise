import { discoverPlaces, getCityCenter } from './placeDiscoveryService.js';
import { enrichAttractionsWithGooglePlaces } from './googlePlacesService.js';
import { resolveAttractionPrice } from './pricingService.js';
import { scoreAttractionsBatch } from './scoringService.js';
import { optimizeRecommendations } from './knapsackService.js';
import { sequenceVisitOrderTSP, calculateRouteDetails } from './googleRoutesService.js';
import { calculateFinalExpenditure } from './costCalculationService.js';
import { getProviderStatus } from '../config/env.js';

/**
 * Master recommendation generator for TripWise.
 * Orchestrates the full 8-step pipeline with strict budget compliance
 * and live API telemetry.
 *
 * @param {object} params
 * @param {string} params.city - e.g. "Udaipur"
 * @param {string[]} params.categories - selected categories
 * @param {string[]} params.priorities - category priorities in ordered rank
 * @param {number} params.budget - budget in INR
 * @param {number} [params.tolerance=0.10] - default 0.10 (+10%)
 * @param {string} [params.transportMode='auto_rickshaw']
 * @param {'all_inclusive'|'tickets_only'} [params.budgetMode='all_inclusive']
 * @returns {Promise<object>} Complete recommendation payload
 */
export async function generateRecommendations({
  city = 'Udaipur',
  categories = [],
  priorities = [],
  budget = 2000,
  tolerance = 0.10,
  transportMode = 'auto_rickshaw',
  budgetMode = 'all_inclusive',
}) {
  const cityInfo = await getCityCenter(city);
  const cityCenter = cityInfo.coordinates;

  // ── Step 1 & 2: Discover Candidate Attractions ─────────────────────────────
  const candidatePool = [];
  const seenIds = new Set();
  let otmIsLive = false;
  let otmFallbackReason = null;
  let otmRecordsRetrieved = 0;

  for (const cat of categories) {
    const discoveryResult = await discoverPlaces({
      city,
      category: cat,
      limit: 15,
    });

    if (discoveryResult.providerStatus?.isLive) {
      otmIsLive = true;
      otmRecordsRetrieved += discoveryResult.places.length;
    } else if (!otmFallbackReason && discoveryResult.providerStatus?.fallbackReason) {
      otmFallbackReason = discoveryResult.providerStatus.fallbackReason;
    }

    for (const place of discoveryResult.places) {
      const uniqueKey = (place.name || place.id).toLowerCase().trim();
      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        candidatePool.push(place);
      }
    }
  }

  // ── Step 3: Supplementary Enrichment (Google Places) ──────────────────────
  const enrichedPool = await enrichAttractionsWithGooglePlaces(candidatePool);

  // ── Step 4: Pricing Resolution (TicketLens -> Official -> Category Estimate) ──
  const pricedPool = await Promise.all(
    enrichedPool.map(async (attraction) => {
      const price = await resolveAttractionPrice(attraction, city);
      return {
        ...attraction,
        price,
      };
    })
  );

  // ── Step 5: Scoring (Priority Ranking + Quality Rating) ────────────────────
  const scoredPool = scoreAttractionsBatch(pricedPool, priorities);

  // ── Step 6: Joint Knapsack Optimization (Tickets + Transit) ───────────────
  const optimization = optimizeRecommendations(scoredPool, budget, tolerance, {
    budgetMode,
    transportMode,
    cityCenter,
  });

  const sequencedPrimary = optimization.withinBudget.attractions || [];
  const alternativeAttractions = optimization.overBudgetAlternatives.attractions || [];

  // ── Step 7: Sequencing & Routing (TSP + Google Routes) ─────────────────────
  // Compute route details for active recommendation (primary if available, else alternative)
  const activeAttractions = sequencedPrimary.length > 0 ? sequencedPrimary : alternativeAttractions;
  const routeDetails = await calculateRouteDetails(activeAttractions, cityCenter);

  // ── Step 8: Final Expenditure & Transport Cost Calculation ─────────────────
  const expenditure = calculateFinalExpenditure({
    selectedAttractions: sequencedPrimary.length > 0 ? sequencedPrimary : alternativeAttractions,
    totalDistanceKm: routeDetails.totalDistanceKm,
    userBudget: budget,
    tolerance,
    transportMode,
  });

  // Log final recommendation telemetry required by Issue 4
  console.log(
    `[Orchestrator] === Recommendation Summary ===\n` +
    `  Destination: ${cityInfo.cityName} (${cityCenter.lat}, ${cityCenter.lon})\n` +
    `  User Budget: ₹${budget} | Soft Budget Limit (+${Math.round(tolerance * 100)}%): ₹${Math.floor(budget * (1 + tolerance))}\n` +
    `  Budget Mode: ${budgetMode} | Transport Mode: ${transportMode}\n` +
    `  Attraction Ticket Subtotal: ₹${expenditure.costBreakdown.attractionsEntryCostINR}\n` +
    `  Transportation Cost: ₹${expenditure.costBreakdown.transportationCostINR}\n` +
    `  Final Total Trip Expenditure: ₹${expenditure.costBreakdown.totalTripExpenditureINR}\n` +
    `  Budget Status: ${expenditure.budgetSummary.status}\n` +
    `  OpenTripMap Status: ${otmIsLive ? 'LIVE API (Active)' : `FALLBACK (${otmFallbackReason})`}`
  );

  const verifiedPricesCount = activeAttractions.filter(
    (a) => a.price?.priceType === 'verified'
  ).length;
  const estimatedPricesCount = activeAttractions.length - verifiedPricesCount;

  // Build active fallbacks telemetry ONLY for fallbacks genuinely in effect
  const fallbacksUsed = [];

  if (!routeDetails.isLive) {
    fallbacksUsed.push({
      feature: 'Route & Travel Times',
      api: 'Google Routes API',
      status: 'fallback_active',
      fallbackMethod: 'Haversine Geodesic Matrix',
      badge: '🗺️ Haversine Matrix',
      details:
        routeDetails.note ||
        'Road distance estimated via great-circle formula with 1.3× urban road circuity and 25 km/h city traffic speed.',
    });
  }

  if (!otmIsLive) {
    fallbacksUsed.push({
      feature: 'Place Discovery',
      api: 'OpenTripMap API',
      status: 'fallback_active',
      fallbackMethod: 'Verified Official Udaipur Registry',
      badge: '🏛️ Verified Registry',
      details:
        otmFallbackReason ||
        'Attractions loaded from curated Udaipur dataset with audited coordinates and authentic details.',
    });
  }

  if (estimatedPricesCount > 0) {
    fallbacksUsed.push({
      feature: 'Ticket Pricing',
      api: 'TicketLens / Official Counters',
      status: 'partial_fallback',
      fallbackMethod: 'Category Estimation Matrix',
      badge: '📊 Category Estimates',
      details: `${estimatedPricesCount} of ${activeAttractions.length} attraction(s) using median category estimates; ${verifiedPricesCount} verified from official tourism counters.`,
    });
  }

  // Live provider status
  const baseStatus = getProviderStatus();
  const providerIntegrations = {
    ...baseStatus,
    openTripMap: {
      provider: 'OpenTripMap',
      configured: Boolean(baseStatus.openTripMap?.configured),
      isLive: otmIsLive,
      mode: otmIsLive ? 'live_api' : 'verified_official_registry',
      status: otmIsLive ? 'connected' : 'fallback_active',
      fallbackReason: otmIsLive ? null : (otmFallbackReason || 'OpenTripMap unconfigured or offline'),
      recordsRetrieved: candidatePool.length,
      activeDataSource: otmIsLive ? 'OpenTripMap API (Live)' : 'Curated Udaipur Verified Registry',
    },
    googleRoutes: {
      provider: 'Google Routes API',
      configured: Boolean(baseStatus.googleRoutes?.configured),
      isLive: Boolean(routeDetails.isLive),
      mode: routeDetails.isLive ? 'live_api' : 'haversine_fallback',
      status: routeDetails.isLive ? 'connected' : 'fallback_active',
      fallbackReason: routeDetails.isLive ? null : (routeDetails.note || 'Google Routes call unavailable'),
      activeDataSource: routeDetails.isLive ? 'Google Routes API (Live)' : 'Haversine Geodesic Matrix (1.3× circuity, 25 km/h)',
    },
    pricingEngine: {
      provider: 'Pricing Engine',
      status: 'active',
      verifiedCount: verifiedPricesCount,
      estimatedCount: estimatedPricesCount,
      activeDataSource: `${verifiedPricesCount} Official Counter Verified, ${estimatedPricesCount} Category Median Estimates`,
    },
    ticketLens: {
      provider: 'TicketLens',
      configured: false,
      isLive: false,
      mode: 'safe_unconfigured',
      status: 'unconfigured',
      activeDataSource: 'Official Counter Rate Cards (No fake tickets fabricated)',
    },
  };

  const mapAttraction = (a) => {
    const lat = a.coordinates?.lat ?? a.lat;
    const lon = a.coordinates?.lon ?? a.lon ?? a.lng;
    return {
      id: a.id,
      name: a.name,
      category: a.category,
      rating: a.rating,
      price: a.price.amount,
      price_estimated: a.price.priceType === 'estimated',
      priceDetails: a.price,
      image: a.image,
      description: a.description,
      wikipediaUrl: a.wikipediaUrl,
      coordinates: { lat, lon },
      lat,
      lon,
      score: a.score,
      distance_from_prev_km: a.distanceFromPrevStopKm,
      distanceFromPrevStopKm: a.distanceFromPrevStopKm,
      dataSource: a.dataSource || (otmIsLive ? 'opentripmap_live' : 'verified_official_registry'),
      source: a.dataSource === 'opentripmap_live' || otmIsLive ? 'OpenTripMap (Live)' : 'Local Fallback Registry',
    };
  };

  return {
    city: cityInfo.cityName,
    cityCenter,
    isFeasible: optimization.feasibility.isFeasible,
    feasibilityMessage: optimization.feasibility.message,
    userQuery: {
      budget,
      tolerance,
      categories,
      priorities,
      transportMode,
      budgetMode,
    },
    within_budget: {
      total_cost: sequencedPrimary.length > 0 ? expenditure.costBreakdown.attractionsEntryCostINR : 0,
      transport_cost_estimate: sequencedPrimary.length > 0 ? expenditure.costBreakdown.transportationCostINR : 0,
      total_trip_expenditure: sequencedPrimary.length > 0 ? expenditure.costBreakdown.totalTripExpenditureINR : 0,
      remaining_pocket_money: sequencedPrimary.length > 0
        ? Math.max(0, budget - expenditure.costBreakdown.totalTripExpenditureINR)
        : budget,
      budget_mode: budgetMode,
      isWithinBudget: optimization.withinBudget.isWithinBudget,
      attractions: sequencedPrimary.map(mapAttraction),
    },
    over_budget_alternatives: {
      total_cost: optimization.overBudgetAlternatives.totalAttractionCost,
      transport_cost: optimization.overBudgetAlternatives.transportCost,
      total_trip_expenditure: optimization.overBudgetAlternatives.totalTripCost,
      softBudgetLimit: optimization.overBudgetAlternatives.softBudgetLimit,
      tolerance: optimization.overBudgetAlternatives.tolerancePercentage,
      isAlternativeApplicable: optimization.overBudgetAlternatives.isAlternativeApplicable,
      attractions: alternativeAttractions.map(mapAttraction),
    },
    route: routeDetails,
    financialSummary: expenditure,
    meta: {
      candidatesEvaluated: candidatePool.length,
      primarySelectedCount: sequencedPrimary.length,
      alternativesCount: alternativeAttractions.length,
      verifiedPricesCount,
      estimatedPricesCount,
      dataSource: otmIsLive ? 'opentripmap_live' : 'verified_official_registry',
      isLiveOtm: otmIsLive,
      hasFallbacks: fallbacksUsed.length > 0,
      fallbacksUsed,
      providerIntegrations,
      isFeasible: optimization.feasibility.isFeasible,
      feasibilityMessage: optimization.feasibility.message,
    },
  };
}
