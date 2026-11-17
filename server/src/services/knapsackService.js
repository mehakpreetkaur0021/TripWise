import { sequenceVisitOrderTSP, calculateHaversineDistanceKm } from './googleRoutesService.js';
import { calculateTransportationCost } from './costCalculationService.js';

const CAPACITY_UNIT_INR = 10;

/**
 * Core 0/1 Knapsack DP Solver (Discretized capacity units).
 *
 * @param {object[]} items - items with .score and .price.amount
 * @param {number} budgetInINR - max capacity in INR
 * @returns {object[]} selected items
 */
export function solve01Knapsack(items = [], budgetInINR = 0) {
  if (!items.length || budgetInINR <= 0) return [];

  const freeItems = items.filter((item) => (item.price?.amount ?? 0) <= 0);
  const paidItems = items.filter((item) => (item.price?.amount ?? 0) > 0);

  const maxUnits = Math.floor(budgetInINR / CAPACITY_UNIT_INR);
  if (maxUnits <= 0) return freeItems;

  const eligiblePaid = paidItems.filter(
    (item) => Math.round(item.price.amount / CAPACITY_UNIT_INR) <= maxUnits
  );

  const n = eligiblePaid.length;
  if (n === 0) {
    return freeItems;
  }

  const weights = eligiblePaid.map((item) =>
    Math.max(1, Math.round(item.price.amount / CAPACITY_UNIT_INR))
  );
  const values = eligiblePaid.map((item) => item.score || 0.1);

  const dp = new Float32Array(maxUnits + 1).fill(0);
  const keep = Array.from({ length: n }, () => new Uint8Array(maxUnits + 1));

  for (let i = 0; i < n; i++) {
    const wi = weights[i];
    const vi = values[i];
    for (let w = maxUnits; w >= wi; w--) {
      const withItem = dp[w - wi] + vi;
      if (withItem > dp[w]) {
        dp[w] = withItem;
        keep[i][w] = 1;
      }
    }
  }

  const selectedPaid = [];
  let w = maxUnits;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][w]) {
      selectedPaid.push(eligiblePaid[i]);
      w -= weights[i];
    }
  }

  return [...freeItems, ...selectedPaid];
}

/**
 * Accurately compute itinerary metrics including TSP sequencing, road distance,
 * attraction tickets, and transit fares.
 *
 * @param {object[]} attractions
 * @param {object} options
 * @returns {object} Comprehensive itinerary metrics
 */
export function computeItineraryMetrics(
  attractions = [],
  {
    cityCenter = { lat: 24.5854, lon: 73.7125 },
    transportMode = 'auto_rickshaw',
    budgetMode = 'all_inclusive',
  } = {}
) {
  if (!attractions.length) {
    return {
      sequenced: [],
      attractionTicketsCost: 0,
      transportationCost: 0,
      totalDistanceKm: 0,
      totalTripCost: 0,
      totalScore: 0,
    };
  }

  const sequenced = sequenceVisitOrderTSP(attractions, cityCenter);
  const attractionTicketsCost = attractions.reduce(
    (sum, a) => sum + (a.price?.amount || 0),
    0
  );
  const totalScore = Number(
    attractions.reduce((sum, a) => sum + (a.score || 0), 0).toFixed(4)
  );

  // Compute total road distance with 1.3x urban circuity factor
  let totalDistanceKm = 0;
  let currentPos = cityCenter;
  for (const item of sequenced) {
    const coords = item.coordinates || { lat: item.lat, lon: item.lon ?? item.lng };
    const legDist = calculateHaversineDistanceKm(currentPos, coords);
    totalDistanceKm += legDist * 1.3;
    currentPos = coords;
  }
  const returnDist = calculateHaversineDistanceKm(currentPos, cityCenter) * 1.3;
  totalDistanceKm += returnDist;
  totalDistanceKm = Number(totalDistanceKm.toFixed(1));

  const transportInfo = calculateTransportationCost(totalDistanceKm, transportMode);
  const transportationCost = budgetMode === 'tickets_only' ? 0 : transportInfo.costINR;
  const totalTripCost = attractionTicketsCost + transportationCost;

  return {
    sequenced,
    attractionTicketsCost,
    transportationCost,
    totalDistanceKm,
    totalTripCost,
    totalScore,
    transportInfo,
  };
}

/**
 * Find the optimal combination of attractions whose TOTAL trip expenditure
 * (tickets + transportation) does not exceed maxBudget.
 *
 * @param {object[]} scoredAttractions
 * @param {number} maxBudget
 * @param {object} options
 * @returns {{ attractions: object[], metrics: object, isFeasible: boolean }}
 */
export function optimizeItineraryForBudget(
  scoredAttractions = [],
  maxBudget = 1000,
  options = {}
) {
  const {
    cityCenter = { lat: 24.5854, lon: 73.7125 },
    transportMode = 'auto_rickshaw',
    budgetMode = 'all_inclusive',
  } = options;

  if (!scoredAttractions.length || maxBudget <= 0) {
    return {
      attractions: [],
      metrics: computeItineraryMetrics([], options),
      isFeasible: false,
    };
  }

  // 1. Initial Knapsack pass reserving minimal baseline transit buffer in all_inclusive mode
  let initialTransitReserve = 0;
  if (budgetMode === 'all_inclusive') {
    initialTransitReserve = Math.min(Math.max(Math.round(maxBudget * 0.15), 60), 250);
  }
  const initialTicketBudget = Math.max(0, maxBudget - initialTransitReserve);

  let currentSelection = solve01Knapsack(scoredAttractions, initialTicketBudget);
  let metrics = computeItineraryMetrics(currentSelection, options);

  // 2. Strict Budget Convergence: Prune if totalTripCost exceeds maxBudget
  let iterations = 0;
  while (currentSelection.length > 0 && metrics.totalTripCost > maxBudget && iterations < 35) {
    iterations++;
    let worstIndex = -1;
    let worstEfficiency = Infinity;

    for (let i = 0; i < currentSelection.length; i++) {
      const item = currentSelection[i];
      const cost = item.price?.amount || 0;
      // Evaluate marginal efficiency
      const efficiency = cost > 0 ? (item.score || 0.1) / cost : (item.score || 0.1) * 5;
      if (efficiency < worstEfficiency) {
        worstEfficiency = efficiency;
        worstIndex = i;
      }
    }

    if (worstIndex >= 0) {
      currentSelection.splice(worstIndex, 1);
      metrics = computeItineraryMetrics(currentSelection, options);
    } else {
      break;
    }
  }

  // 3. Greedy Augmentation: Try fitting any omitted candidates that stay within maxBudget
  const selectedIds = new Set(currentSelection.map((a) => a.id || a.name));
  const remainingCandidates = scoredAttractions
    .filter((a) => !selectedIds.has(a.id || a.name))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  for (const candidate of remainingCandidates) {
    const testSet = [...currentSelection, candidate];
    const testMetrics = computeItineraryMetrics(testSet, options);
    if (testMetrics.totalTripCost <= maxBudget) {
      currentSelection = testSet;
      metrics = testMetrics;
    }
  }

  // 4. Strict re-validation against maxBudget
  const isStrictlyCompliant = metrics.totalTripCost <= maxBudget && currentSelection.length > 0;

  return {
    attractions: isStrictlyCompliant ? metrics.sequenced : [],
    metrics: isStrictlyCompliant ? metrics : computeItineraryMetrics([], options),
    isFeasible: isStrictlyCompliant,
  };
}

/**
 * Full Recommendation Optimizer with strict hard-budget Primary recommendations,
 * 10% soft-budget Alternatives, and explicit rejection if no combination fits.
 *
 * @param {object[]} scoredAttractions
 * @param {number} budget - User budget in INR
 * @param {number} [tolerance=0.10] - Default 0.10 (+10%)
 * @param {object} [options]
 * @returns {object} Structured optimization output
 */
export function optimizeRecommendations(
  scoredAttractions = [],
  budget = 1000,
  tolerance = 0.10,
  options = {}
) {
  const safeBudget = Math.max(0, Number(budget) || 0);
  const safeTolerance = Math.min(Math.max(Number(tolerance) || 0.10, 0), 0.50);
  const softBudget = Math.floor(safeBudget * (1 + safeTolerance));
  const budgetMode = options.budgetMode || 'all_inclusive';
  const transportMode = options.transportMode || 'auto_rickshaw';
  const cityCenter = options.cityCenter || { lat: 24.5854, lon: 73.7125 };

  const optParams = { budgetMode, transportMode, cityCenter };

  // 1. Primary Recommendation Pass (Strictly <= userBudget)
  const primaryResult = optimizeItineraryForBudget(scoredAttractions, safeBudget, optParams);

  // 2. Soft Budget Pass (Strictly <= softBudget)
  const softResult = optimizeItineraryForBudget(scoredAttractions, softBudget, optParams);

  // 3. Alternative Determination
  // Only accept alternative if:
  // - Primary couldn't find a valid combination within userBudget, BUT softBudget fits, OR
  // - Soft budget unlocks a distinct higher-value itinerary where totalTripCost > safeBudget AND <= softBudget
  let alternativeItinerary = [];
  let alternativeMetrics = null;
  let isAlternativeApplicable = false;

  if (!primaryResult.isFeasible && softResult.isFeasible) {
    alternativeItinerary = softResult.attractions;
    alternativeMetrics = softResult.metrics;
    isAlternativeApplicable = true;
  } else if (
    primaryResult.isFeasible &&
    softResult.isFeasible &&
    softResult.metrics.totalScore > primaryResult.metrics.totalScore &&
    softResult.metrics.totalTripCost > safeBudget &&
    softResult.metrics.totalTripCost <= softBudget
  ) {
    alternativeItinerary = softResult.attractions;
    alternativeMetrics = softResult.metrics;
    isAlternativeApplicable = true;
  }

  // 4. Overall Feasibility Check
  const isFeasible = primaryResult.isFeasible || isAlternativeApplicable;
  const feasibilityMessage = !isFeasible
    ? 'No suitable combination of attractions is available within your budget, even with the additional 10% allowance. Please increase your budget or change your selected priorities.'
    : null;

  // Logging required by Issue 4
  console.log(
    `[BudgetOptimizer] Budget: ₹${safeBudget} | Soft Budget (Max +${Math.round(safeTolerance * 100)}%): ₹${softBudget} | Mode: ${budgetMode}`
  );
  if (primaryResult.isFeasible) {
    console.log(
      `[BudgetOptimizer] ✅ Primary Itinerary Accepted: ${primaryResult.attractions.length} places | Attraction Subtotal: ₹${primaryResult.metrics.attractionTicketsCost} | Transport: ₹${primaryResult.metrics.transportationCost} | Final Expenditure: ₹${primaryResult.metrics.totalTripCost} <= ₹${safeBudget}`
    );
  } else {
    console.log(`[BudgetOptimizer] ⚠️ No combination feasible within strict budget of ₹${safeBudget}`);
  }
  if (isAlternativeApplicable) {
    console.log(
      `[BudgetOptimizer] 💡 Alternative Itinerary Accepted: ${alternativeItinerary.length} places | Attraction Subtotal: ₹${alternativeMetrics.attractionTicketsCost} | Transport: ₹${alternativeMetrics.transportationCost} | Final Expenditure: ₹${alternativeMetrics.totalTripCost} <= ₹${softBudget}`
    );
  }
  if (!isFeasible) {
    console.warn(`[BudgetOptimizer] ❌ ${feasibilityMessage}`);
  }

  return {
    withinBudget: {
      attractions: primaryResult.attractions,
      totalAttractionCost: primaryResult.metrics.attractionTicketsCost,
      transportCost: primaryResult.metrics.transportationCost,
      totalTripCost: primaryResult.metrics.totalTripCost,
      totalDistanceKm: primaryResult.metrics.totalDistanceKm,
      isWithinBudget: primaryResult.isFeasible,
      metrics: primaryResult.metrics,
    },
    overBudgetAlternatives: {
      attractions: alternativeItinerary,
      totalAttractionCost: alternativeMetrics?.attractionTicketsCost || 0,
      transportCost: alternativeMetrics?.transportationCost || 0,
      totalTripCost: alternativeMetrics?.totalTripCost || 0,
      totalDistanceKm: alternativeMetrics?.totalDistanceKm || 0,
      softBudgetLimit: softBudget,
      tolerancePercentage: `${Math.round(safeTolerance * 100)}%`,
      isAlternativeApplicable,
      metrics: alternativeMetrics,
    },
    feasibility: {
      isFeasible,
      message: feasibilityMessage,
    },
    budgetConfiguration: {
      userTotalBudget: safeBudget,
      softBudgetLimit: softBudget,
      budgetMode,
      transportMode,
      toleranceApplied: safeTolerance,
      primaryTotalTripCost: primaryResult.metrics.totalTripCost,
      alternativeTotalTripCost: alternativeMetrics?.totalTripCost || 0,
    },
  };
}
