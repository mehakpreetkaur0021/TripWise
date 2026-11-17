/**
 * Recommendation Scoring Service for TripWise.
 *
 * Combines traveler-defined category priorities with attraction quality ratings.
 *
 * Scoring Formula:
 *   score = (0.70 × priorityWeight) + (0.30 × rateWeight)
 *
 * Where:
 *   priorityWeight = (N - rank(category)) / N
 *     (rank 0 = top priority, yields 1.0; lowest priority yields 1/N)
 *   rateWeight = rating / 3
 *     (rating tier from 1 to 3)
 */

export function calculateAttractionScore(attraction, priorities = []) {
  const N = priorities.length || 1;
  const categoryIndex = priorities.indexOf(attraction.category);

  // If category was not selected in user's priority list, minimal priority weight
  const priorityWeight = categoryIndex === -1 ? 0.05 : (N - categoryIndex) / N;

  const rawRating = attraction.rating || 1;
  const rateWeight = Math.min(Math.max(rawRating, 1), 3) / 3;

  // Weighted score bounded between 0 and 1
  const score = Number((0.7 * priorityWeight + 0.3 * rateWeight).toFixed(4));

  return {
    ...attraction,
    score,
    scoreBreakdown: {
      categoryRank: categoryIndex === -1 ? null : categoryIndex + 1,
      priorityWeight: Number(priorityWeight.toFixed(3)),
      rateWeight: Number(rateWeight.toFixed(3)),
    },
  };
}

/**
 * Score a batch of attractions according to user's category priorities.
 *
 * @param {object[]} attractions
 * @param {string[]} priorities
 * @returns {object[]} Scored attractions sorted descending by score
 */
export function scoreAttractionsBatch(attractions = [], priorities = []) {
  return attractions
    .map((attraction) => calculateAttractionScore(attraction, priorities))
    .sort((a, b) => b.score - a.score);
}
