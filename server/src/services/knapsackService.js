/**
 * Knapsack Optimization Service.
 *
 * Implements a Priority-Weighted 0/1 Knapsack algorithm (Dynamic Programming)
 * discretized in capacity units of ₹10.
 *
 * Features:
 * 1. Zero-cost handling: Free attractions (₹0) are included without consuming budget capacity.
 * 2. Budget Mode support:
 *    - 'all_inclusive' (default): reserves a transit allowance so total expenditure (tickets + travel) stays within budget.
 *    - 'tickets_only': user budget applies exclusively to attraction tickets.
 * 3. Soft-budget pass: Computes optimal combination within a configurable over-budget tolerance (e.g. +10%).
 * 4. Isolates true alternatives: Soft-budget results show attractions NOT already in the hard-budget set.
 * 5. Revalidates final expenditure.
 */

const CAPACITY_UNIT_INR = 10;

/**
 * Core 0/1 Knapsack DP Solver.
 *
 * @param {object[]} items - items with .score and .price.amount
 * @param {number} budgetInINR - max capacity in INR
 * @returns {object[]} selected items
 */
export function solve01Knapsack(items = [], budgetInINR = 0) {
  if (!items.length || budgetInINR < 0) return [];

  // Separate completely free items (amount == 0) from paid items
  const freeItems = items.filter((item) => (item.price?.amount ?? 0) <= 0);
  const paidItems = items.filter((item) => (item.price?.amount ?? 0) > 0);

  // Discretize budget into integer units
  const maxUnits = Math.floor(budgetInINR / CAPACITY_UNIT_INR);

  // Filter out paid items that individually exceed total capacity
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
  const values = eligiblePaid.map((item) => item.score);

  // 1D DP table & 2D decision tracking matrix
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

  // Backtrack to recover optimal subset of paid items
  const selectedPaid = [];
  let w = maxUnits;
  for (let i = n - 1; i >= 0; i--) {
    if (keep[i][w]) {
      selectedPaid.push(eligiblePaid[i]);
      w -= weights[i];
    }
  }

  // Combine free items + optimal paid items
  return [...freeItems, ...selectedPaid];
}

/**
 * Optimize recommendations with primary set and soft-budget alternatives.
 *
 * @param {object[]} scoredAttractions
 * @param {number} budget - Total user budget in INR
 * @param {number} [tolerance=0.10] - e.g. 0.10 for +10%
 * @param {object} [options]
 * @param {'all_inclusive'|'tickets_only'} [options.budgetMode='all_inclusive']
 * @param {number} [options.transportReserveINR=200]
 * @returns {object} Optimization output
 */
export function optimizeRecommendations(
  scoredAttractions = [],
  budget = 2000,
  tolerance = 0.10,
  options = {}
) {
  const safeBudget = Math.max(0, Number(budget) || 0);
  const safeTolerance = Math.min(Math.max(Number(tolerance) || 0.10, 0), 0.50);
  const budgetMode = options.budgetMode || 'all_inclusive';

  // Calculate allocation for attraction tickets
  let attractionBudget = safeBudget;
  let allocatedTransportBuffer = 0;

  if (budgetMode === 'all_inclusive') {
    // Dynamic transport reserve: ~20% of budget, bounded between ₹150 and ₹450
    allocatedTransportBuffer = Math.min(
      Math.max(Math.round(safeBudget * 0.20), 150),
      450
    );
    // Don't reduce attraction budget below ₹100 if user budget allows
    if (safeBudget > allocatedTransportBuffer + 100) {
      attractionBudget = safeBudget - allocatedTransportBuffer;
    } else {
      allocatedTransportBuffer = Math.round(safeBudget * 0.15);
      attractionBudget = safeBudget - allocatedTransportBuffer;
    }
  }

  // 1. Primary pass (Within attraction budget)
  const primaryAttractions = solve01Knapsack(scoredAttractions, attractionBudget);
  const primaryTotalCost = primaryAttractions.reduce(
    (sum, item) => sum + (item.price?.amount || 0),
    0
  );

  // 2. Soft-budget pass (Budget + Tolerance)
  const softAttractionBudget = Math.floor(
    (safeBudget * (1 + safeTolerance)) - (budgetMode === 'all_inclusive' ? allocatedTransportBuffer : 0)
  );
  const softAttractions = solve01Knapsack(scoredAttractions, softAttractionBudget);

  // Isolate distinct alternatives (items in soft set that are NOT in primary set)
  const primaryIds = new Set(primaryAttractions.map((item) => item.id || item.name));
  const alternativeAttractions = softAttractions.filter(
    (item) => !primaryIds.has(item.id || item.name)
  );
  const alternativeTotalCost = alternativeAttractions.reduce(
    (sum, item) => sum + (item.price?.amount || 0),
    0
  );

  // 3. Final expenditure revalidation
  const isStrictlyWithinBudget = primaryTotalCost <= attractionBudget;
  const isWithinUserTotalBudget = primaryTotalCost <= safeBudget;

  return {
    withinBudget: {
      attractions: primaryAttractions,
      totalAttractionCost: primaryTotalCost,
      isWithinBudget: isStrictlyWithinBudget,
    },
    overBudgetAlternatives: {
      attractions: alternativeAttractions,
      totalAttractionCost: alternativeTotalCost,
      softBudgetLimit: softAttractionBudget,
      tolerancePercentage: `${Math.round(safeTolerance * 100)}%`,
    },
    budgetConfiguration: {
      userTotalBudget: safeBudget,
      budgetMode,
      allocatedTransportBuffer,
      effectiveAttractionBudget: attractionBudget,
      toleranceApplied: safeTolerance,
      isStrictlyWithinBudget,
      isWithinUserTotalBudget,
    },
  };
}
