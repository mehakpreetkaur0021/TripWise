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
 * Orchestrates the full 8-step pipeline.
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

  for (const cat of categories) {
    const discoveryResult = await discoverPlaces({
      city,
      category: cat,
      limit: 15,
    });

    if (discoveryResult.providerStatus?.isLive) {
      otmIsLive = true;
    }

    for (const place of discoveryResult.places) {
      const uniqueKey = place.id || place.name;
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

  // ── Step 6: Knapsack Optimization (Within Budget + 10% Alternatives) ──────
  const optimization = optimizeRecommendations(scoredPool, budget, tolerance, {
    budgetMode,
  });

  // ── Step 7: Sequencing & Routing (TSP + Google Routes) ─────────────────────
  const sequencedPrimary = sequenceVisitOrderTSP(
    optimization.withinBudget.attractions,
    cityCenter
  );

  const routeDetails = await calculateRouteDetails(sequencedPrimary, cityCenter);

  // ── Step 8: Final Expenditure & Transport Cost Calculation ─────────────────
  const expenditure = calculateFinalExpenditure({
    selectedAttractions: sequencedPrimary,
    totalDistanceKm: routeDetails.totalDistanceKm,
    userBudget: budget,
    tolerance,
    transportMode,
  });

  const verifiedPricesCount = sequencedPrimary.filter(
    (a) => a.price.priceType === 'verified'
  ).length;
  const estimatedPricesCount = sequencedPrimary.length - verifiedPricesCount;

  return {
    city: cityInfo.cityName,
    cityCenter,
    userQuery: {
      budget,
      tolerance,
      categories,
      priorities,
      transportMode,
      budgetMode,
    },
    within_budget: {
      total_cost: expenditure.costBreakdown.attractionsEntryCostINR,
      transport_cost_estimate: expenditure.costBreakdown.transportationCostINR,
      total_trip_expenditure: expenditure.costBreakdown.totalTripExpenditureINR,
      remaining_pocket_money: Math.max(
        0,
        budget - expenditure.costBreakdown.totalTripExpenditureINR
      ),
      budget_mode: budgetMode,
      attractions: sequencedPrimary.map((a) => {
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
        };
      }),
    },
    over_budget_alternatives: {
      total_cost: optimization.overBudgetAlternatives.totalAttractionCost,
      softBudgetLimit: optimization.overBudgetAlternatives.softBudgetLimit,
      tolerance: optimization.overBudgetAlternatives.tolerancePercentage,
      attractions: optimization.overBudgetAlternatives.attractions.map((a) => {
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
          dataSource: a.dataSource || (otmIsLive ? 'opentripmap_live' : 'verified_official_registry'),
        };
      }),
    },
    route: routeDetails,
    financialSummary: expenditure,
    meta: {
      candidatesEvaluated: candidatePool.length,
      primarySelectedCount: sequencedPrimary.length,
      alternativesCount: optimization.overBudgetAlternatives.attractions.length,
      verifiedPricesCount,
      estimatedPricesCount,
      dataSource: otmIsLive ? 'opentripmap_live' : 'verified_official_registry',
      isLiveOtm: otmIsLive,
      providerIntegrations: getProviderStatus(),
    },
  };
}
