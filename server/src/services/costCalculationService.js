/**
 * Final Cost Calculation Service.
 *
 * Provides a configurable transportation cost model and calculates total trip expenditure.
 *
 * NOTE ON TRANSPORTATION:
 * Road distance does NOT automatically equal taxi meter fare. Street-hail auto-rickshaw
 * fares, aggregator pricing (Uber/Ola), surge multipliers, waiting charges, and negotiation
 * can cause variations. This model provides an algorithmic estimate based on standardized
 * municipal tariff slabs for Rajasthan tourist cities.
 */

export const TRANSPORT_MODELS = {
  auto_rickshaw: {
    mode: 'auto_rickshaw',
    label: 'Auto-Rickshaw (Standard City Auto)',
    baseFareINR: 30, // Covers first 1.5 km
    baseDistanceKm: 1.5,
    ratePerKmINR: 15, // Standard rate per subsequent km
    description: 'Local 3-wheeler auto-rickshaw tariff based on standard Rajasthan transport slabs.',
  },
  taxi_cab: {
    mode: 'taxi_cab',
    label: 'AC Sedan / Hatchback Cab',
    baseFareINR: 100, // Covers first 4.0 km
    baseDistanceKm: 4.0,
    ratePerKmINR: 22, // Standard rate per subsequent km
    description: 'City point-to-point tourist taxi / cab rate card.',
  },
  walking: {
    mode: 'walking',
    label: 'Walking / Public Transit',
    baseFareINR: 0,
    baseDistanceKm: 0,
    ratePerKmINR: 0,
    description: 'Zero additional transit fare (suitable for backpackers or walking tours).',
  },
};

/**
 * Calculate transportation cost based on distance and vehicle model.
 *
 * @param {number} distanceKm
 * @param {string} [mode='auto_rickshaw']
 * @returns {{ costINR: number, mode: string, model: object, calculationNotes: string }}
 */
export function calculateTransportationCost(distanceKm = 0, mode = 'auto_rickshaw') {
  const model = TRANSPORT_MODELS[mode] || TRANSPORT_MODELS.auto_rickshaw;
  const safeDistance = Math.max(0, Number(distanceKm) || 0);

  if (safeDistance === 0 || model.mode === 'walking') {
    return {
      costINR: 0,
      mode: model.mode,
      model,
      calculationNotes: 'Walking or zero transit distance.',
    };
  }

  let cost = model.baseFareINR;
  if (safeDistance > model.baseDistanceKm) {
    const additionalKm = safeDistance - model.baseDistanceKm;
    cost += additionalKm * model.ratePerKmINR;
  }

  const roundedCost = Math.round(cost);

  return {
    costINR: roundedCost,
    mode: model.mode,
    model: {
      label: model.label,
      baseFareINR: model.baseFareINR,
      ratePerKmINR: model.ratePerKmINR,
    },
    calculationNotes: `Based on ₹${model.baseFareINR} base fare for first ${model.baseDistanceKm} km, plus ₹${model.ratePerKmINR}/km for remaining distance across ${safeDistance.toFixed(1)} km.`,
  };
}

/**
 * Compute the comprehensive expenditure summary and revalidate against the user's budget.
 *
 * @param {object} options
 * @param {object[]} options.selectedAttractions
 * @param {number} options.totalDistanceKm
 * @param {number} options.userBudget
 * @param {number} [options.tolerance=0.10]
 * @param {string} [options.transportMode='auto_rickshaw']
 * @returns {object} Full financial summary
 */
export function calculateFinalExpenditure({
  selectedAttractions = [],
  totalDistanceKm = 0,
  userBudget = 2000,
  tolerance = 0.10,
  transportMode = 'auto_rickshaw',
}) {
  // 1. Entry fees breakdown
  const attractionCost = selectedAttractions.reduce(
    (sum, a) => sum + (a.price?.amount ?? 0),
    0
  );

  const verifiedPricesCount = selectedAttractions.filter(
    (a) => a.price?.priceType === 'verified'
  ).length;
  const estimatedPricesCount = selectedAttractions.length - verifiedPricesCount;

  // 2. Transport cost calculation
  const transportSummary = calculateTransportationCost(totalDistanceKm, transportMode);

  // 3. Combined expenditure
  const totalTripCost = attractionCost + transportSummary.costINR;
  const softBudget = Math.floor(userBudget * (1 + tolerance));

  // 4. Budget compliance checks
  const isAttractionsWithinBudget = attractionCost <= userBudget;
  const isTripWithinBudget = totalTripCost <= userBudget;
  const isTripWithinSoftBudget = totalTripCost <= softBudget;

  let budgetStatus = 'within_budget';
  if (!isAttractionsWithinBudget) {
    budgetStatus = 'exceeds_budget';
  } else if (!isTripWithinBudget) {
    budgetStatus = isTripWithinSoftBudget ? 'within_soft_tolerance' : 'transit_exceeds_budget';
  }

  return {
    budgetSummary: {
      userBudgetINR: userBudget,
      softBudgetLimitINR: softBudget,
      tolerancePercentage: `${Math.round(tolerance * 100)}%`,
      status: budgetStatus,
      isAttractionsWithinBudget,
      isTripWithinBudget,
      isTripWithinSoftBudget,
    },
    costBreakdown: {
      attractionsEntryCostINR: attractionCost,
      transportationCostINR: transportSummary.costINR,
      totalTripExpenditureINR: totalTripCost,
      currency: 'INR',
    },
    transportationDetails: transportSummary,
    priceAuditing: {
      totalAttractionsSelected: selectedAttractions.length,
      verifiedPricesCount,
      estimatedPricesCount,
      verificationRatio: selectedAttractions.length
        ? Number((verifiedPricesCount / selectedAttractions.length).toFixed(2))
        : 1.0,
      disclaimer:
        'Attraction entry prices are verified against municipal and tourism counter records. Transportation costs are modeled estimates based on local standard auto/cab rates and may fluctuate with street traffic or aggregator surge.',
    },
  };
}
