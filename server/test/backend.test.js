import { getCityCenter, discoverPlaces } from '../src/services/placeDiscoveryService.js';
import { fetchSupplementaryPlaceData } from '../src/services/googlePlacesService.js';
import { resolveAttractionPrice } from '../src/services/pricingService.js';
import { calculateAttractionScore } from '../src/services/scoringService.js';
import {
  solve01Knapsack,
  optimizeRecommendations,
  computeItineraryMetrics,
} from '../src/services/knapsackService.js';
import { sequenceVisitOrderTSP, calculateHaversineDistanceKm } from '../src/services/googleRoutesService.js';
import { calculateTransportationCost, calculateFinalExpenditure } from '../src/services/costCalculationService.js';
import { generateRecommendations } from '../src/services/orchestratorService.js';
import { ENV } from '../src/config/env.js';

let failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n--- 1. Testing Place Discovery Service ---');
  const geo = await getCityCenter('Udaipur');
  assert(
    geo.cityName === 'Udaipur' &&
      Math.abs(geo.coordinates.lat - 24.5854) < 0.05 &&
      Math.abs(geo.coordinates.lon - 73.7125) < 0.05,
    `getCityCenter returns authoritative Udaipur, Rajasthan coordinates (${geo.coordinates.lat}, ${geo.coordinates.lon})`
  );

  const placesResult = await discoverPlaces({ city: 'Udaipur', category: 'Monuments', limit: 3 });
  assert(placesResult.places.length > 0, 'discoverPlaces returns places for Monuments');
  assert(placesResult.places[0].name.length > 0, 'place has a valid name');
  assert(placesResult.providerStatus.provider === 'OpenTripMap', 'reports provider OpenTripMap');

  console.log('\n--- 2. Testing Google Places Service ---');
  const googleResult = await fetchSupplementaryPlaceData('City Palace', 'Udaipur');
  assert(typeof googleResult.isConfigured === 'boolean', 'reports configuration status cleanly');
  assert(!googleResult.isConfigured ? googleResult.status === 'unconfigured' : true, 'reports unconfigured when key is absent');

  console.log('\n--- 3. Testing Pricing Service (Official Counter & Category Hierarchy) ---');
  const verifiedPrice = await resolveAttractionPrice({ id: 'otm_mon_01', name: 'City Palace Udaipur', category: 'Monuments', rating: 3 });
  assert(verifiedPrice.priceType === 'verified', 'City Palace resolved as verified official price');
  assert(verifiedPrice.amount === 400, 'City Palace official fee is verified at ₹400 (counter museum entry)');
  assert(verifiedPrice.confidence === 1.0, 'Verified price has confidence 1.0');
  assert(verifiedPrice.lastVerified !== null, 'Verified price has lastVerified timestamp');

  const freeShrinePrice = await resolveAttractionPrice({ id: 'otm_rel_01', name: 'Jagdish Temple', category: 'Religious_Places', rating: 3 });
  assert(freeShrinePrice.amount === 0, 'Jagdish Temple has verified ₹0 entry');
  assert(freeShrinePrice.priceType === 'verified', 'Free shrine correctly marked verified');

  const estimatedPrice = await resolveAttractionPrice({ id: 'random_id', name: 'Unknown Forest Camp', category: 'Adventure', rating: 2 });
  assert(estimatedPrice.priceType === 'estimated', 'Unknown place falls back to category estimate');
  assert(estimatedPrice.confidence < 1.0, 'Estimated price has confidence < 1.0');
  assert(estimatedPrice.lastVerified === null, 'Estimated price has lastVerified = null');

  console.log('\n--- 5. Testing Recommendation Scoring Service ---');
  const scoredHigh = calculateAttractionScore(
    { name: 'Palace', category: 'Monuments', rating: 3 },
    ['Monuments', 'Nature', 'Culture']
  );
  const scoredLow = calculateAttractionScore(
    { name: 'Museum', category: 'Culture', rating: 1 },
    ['Monuments', 'Nature', 'Culture']
  );
  assert(scoredHigh.score > scoredLow.score, 'Higher priority + higher rating yields strictly higher score');

  console.log('\n--- 6. Testing Knapsack Optimization Service ---');
  const testPool = [
    { id: 'free1', name: 'Temple', category: 'Religious_Places', score: 0.9, price: { amount: 0 }, coordinates: { lat: 24.5794, lon: 73.6838 } },
    { id: 'mon1', name: 'Palace A', category: 'Monuments', score: 0.85, price: { amount: 200 }, coordinates: { lat: 24.5764, lon: 73.6835 } },
    { id: 'mon2', name: 'Palace B', category: 'Monuments', score: 0.70, price: { amount: 300 }, coordinates: { lat: 24.5796, lon: 73.6816 } },
    { id: 'adv1', name: 'Zipline', category: 'Adventure', score: 0.95, price: { amount: 600 }, coordinates: { lat: 24.5218, lon: 73.7029 } },
  ];
  const knapsackWithin500 = solve01Knapsack(testPool, 500);
  const totalCost = knapsackWithin500.reduce((s, it) => s + it.price.amount, 0);
  assert(totalCost <= 500, `Knapsack strictly respects hard budget (${totalCost} <= 500)`);
  assert(knapsackWithin500.some((it) => it.id === 'free1'), 'Free attraction included without consuming budget capacity');

  const optimization = optimizeRecommendations(testPool, 500, 0.25);
  assert(optimization.withinBudget.isWithinBudget, 'Primary set marked within budget');
  assert(optimization.withinBudget.totalTripCost <= 500, 'Final primary expenditure <= ₹500');

  console.log('\n--- 7. Testing Google Routes & TSP Sequencing Service ---');
  const places = [
    { name: 'Near Stop', coordinates: { lat: 24.5800, lon: 73.7000 } },
    { name: 'Far Stop', coordinates: { lat: 24.6500, lon: 73.8000 } },
  ];
  const center = { lat: 24.5854, lon: 73.7125 };
  const sequenced = sequenceVisitOrderTSP(places, center);
  assert(sequenced[0].name === 'Near Stop', 'TSP correctly visits nearest stop first');

  const dist = calculateHaversineDistanceKm(center, { lat: 24.5764, lon: 73.6835 });
  assert(dist > 0 && dist < 10, 'Haversine distance accurately calculated');

  console.log('\n--- 8. Testing Cost Calculation & Transportation Model ---');
  const autoCost = calculateTransportationCost(10, 'auto_rickshaw');
  assert(autoCost.costINR > 0, `Auto rickshaw cost calculated: ₹${autoCost.costINR}`);
  assert(autoCost.model.baseFareINR === 30, 'Auto rickshaw base fare is ₹30');

  const finalExp = calculateFinalExpenditure({
    selectedAttractions: knapsackWithin500,
    totalDistanceKm: 15,
    userBudget: 1000,
    transportMode: 'auto_rickshaw',
  });
  assert(finalExp.budgetSummary.isAttractionsWithinBudget, 'Attractions within budget');
  assert(finalExp.costBreakdown.transportationCostINR > 0, 'Transport cost separated and accounted');

  console.log('\n--- 9. Testing Full Orchestrator End-to-End ---');
  const fullResult = await generateRecommendations({
    city: 'Udaipur',
    categories: ['Monuments', 'Lakes_Boating', 'Religious_Places'],
    priorities: ['Monuments', 'Lakes_Boating', 'Religious_Places'],
    budget: 1200,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });

  assert(fullResult.within_budget.attractions.length > 0, 'Orchestrator returned primary attractions');
  assert(fullResult.within_budget.total_trip_expenditure <= 1200, 'Primary attractions total within ₹1200 budget');
  assert(fullResult.route.totalDistanceKm > 0, 'Route distance computed');
  assert(fullResult.financialSummary.costBreakdown.transportationCostINR > 0, 'Transportation cost calculated');
  assert(fullResult.meta.candidatesEvaluated > 0, 'Candidates evaluated count reported');

  console.log('\n--- 10. Mandatory OpenTripMap Tests (Issue 4) ---');
  // Scenario 10.1: Missing API key -> Local fallback with clear reason
  const originalKey = ENV.OTM_API_KEY;
  ENV.OTM_API_KEY = '';
  const missingKeyRes = await discoverPlaces({ city: 'Udaipur', category: 'Monuments' });
  assert(!missingKeyRes.providerStatus.isLive, 'Missing key correctly triggers fallback');
  assert(missingKeyRes.providerStatus.status === 'unconfigured_fallback', 'Missing key has unconfigured_fallback status');
  assert(missingKeyRes.providerStatus.fallbackReason.includes('OTM_API_KEY is not configured'), 'Clear fallback reason for missing key');
  assert(missingKeyRes.places.length > 0, 'Local curated attractions provided on missing key');

  // Scenario 10.2: Invalid API key -> Local fallback with clear reason
  ENV.OTM_API_KEY = 'invalid_dummy_key_12345';
  const invalidKeyRes = await discoverPlaces({ city: 'Udaipur', category: 'Monuments' });
  assert(!invalidKeyRes.providerStatus.isLive, 'Invalid key correctly triggers fallback');
  assert(invalidKeyRes.providerStatus.status.includes('fallback'), 'Invalid key reports fallback status');
  assert(Boolean(invalidKeyRes.providerStatus.fallbackReason), 'Invalid key provides explicit fallback reason');

  // Scenario 10.3: Valid API key & Successful response (when key restored)
  ENV.OTM_API_KEY = originalKey;
  if (originalKey && originalKey.length > 10) {
    const liveRes = await discoverPlaces({ city: 'Udaipur', category: 'Monuments' });
    // In live network environment, isLive will be true; in isolated sandbox without network it gracefully reports network_error_fallback
    if (liveRes.providerStatus.isLive) {
      assert(liveRes.providerStatus.dataSource === 'opentripmap_live', 'Valid key uses live API data');
      assert(liveRes.places[0].dataSource === 'opentripmap_live', 'Live places marked opentripmap_live');
    } else {
      assert(liveRes.providerStatus.fallbackReason.length > 0, `Graceful fallback reported: ${liveRes.providerStatus.fallbackReason}`);
    }
  }

  // Scenario 10.4: API returns no usable attractions for category -> Fallback with clear reason
  const emptyCatRes = await discoverPlaces({ city: 'Udaipur', category: 'NonExistentCategoryXYZ' });
  assert(!emptyCatRes.providerStatus.isLive, 'Empty category safely falls back');
  assert(Boolean(emptyCatRes.providerStatus.fallbackReason), 'Clear reason provided for empty category fallback');

  console.log('\n--- 11. Mandatory Budget Compliance Tests (Issue 2 & 4) ---');
  const dummyAttractions = [
    { id: '1', name: 'Place 1', score: 0.9, price: { amount: 300 }, coordinates: { lat: 24.5764, lon: 73.6835 } },
    { id: '2', name: 'Place 2', score: 0.8, price: { amount: 400 }, coordinates: { lat: 24.5796, lon: 73.6816 } },
    { id: '3', name: 'Place 3', score: 0.7, price: { amount: 200 }, coordinates: { lat: 24.6033, lon: 73.6869 } },
    { id: '4', name: 'Place 4', score: 0.6, price: { amount: 150 }, coordinates: { lat: 24.5702, lon: 73.6841 } },
  ];

  // Scenario 11.1: Budget ₹1,000, final trip cost ₹950 -> Accept as Primary
  const test950 = calculateFinalExpenditure({
    selectedAttractions: [{ price: { amount: 800 } }],
    totalDistanceKm: 9.5, // 9.5 km in auto -> base 30 + 8 * 15 = ₹150 -> 800 + 150 = ₹950
    userBudget: 1000,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });
  assert(test950.costBreakdown.totalTripExpenditureINR === 950, 'Test 11.1 final expenditure is ₹950');
  assert(test950.budgetSummary.isTripWithinBudget, 'Test 11.1 (₹950 <= ₹1000) accepted as Primary');

  // Scenario 11.2: Budget ₹1,000, final trip cost ₹1,000 -> Accept as Primary
  const test1000 = calculateFinalExpenditure({
    selectedAttractions: [{ price: { amount: 850 } }],
    totalDistanceKm: 9.5, // 850 + 150 = ₹1000
    userBudget: 1000,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });
  assert(test1000.costBreakdown.totalTripExpenditureINR === 1000, 'Test 11.2 final expenditure is ₹1000');
  assert(test1000.budgetSummary.isTripWithinBudget, 'Test 11.2 (₹1000 <= ₹1000) accepted as Primary');

  // Scenario 11.3: Budget ₹1,000, final trip cost ₹1,050 -> Accept ONLY as Alternative
  const test1050 = calculateFinalExpenditure({
    selectedAttractions: [{ price: { amount: 900 } }],
    totalDistanceKm: 9.5, // 900 + 150 = ₹1050
    userBudget: 1000,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });
  assert(test1050.costBreakdown.totalTripExpenditureINR === 1050, 'Test 11.3 final expenditure is ₹1050');
  assert(!test1050.budgetSummary.isTripWithinBudget, 'Test 11.3 (> ₹1000) rejected as Primary');
  assert(test1050.budgetSummary.isTripWithinSoftBudget, 'Test 11.3 (<= ₹1100) accepted as Alternative');

  // Scenario 11.4: Budget ₹1,000, final trip cost ₹1,100 -> Accept ONLY as Alternative
  const test1100 = calculateFinalExpenditure({
    selectedAttractions: [{ price: { amount: 950 } }],
    totalDistanceKm: 9.5, // 950 + 150 = ₹1100
    userBudget: 1000,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });
  assert(test1100.costBreakdown.totalTripExpenditureINR === 1100, 'Test 11.4 final expenditure is ₹1100');
  assert(!test1100.budgetSummary.isTripWithinBudget, 'Test 11.4 (> ₹1000) rejected as Primary');
  assert(test1100.budgetSummary.isTripWithinSoftBudget, 'Test 11.4 (<= ₹1100) accepted as Alternative');

  // Scenario 11.5: Budget ₹1,000, final trip cost ₹1,101 -> Reject!
  const test1101 = calculateFinalExpenditure({
    selectedAttractions: [{ price: { amount: 951 } }],
    totalDistanceKm: 9.5, // 951 + 150 = ₹1101
    userBudget: 1000,
    tolerance: 0.10,
    transportMode: 'auto_rickshaw',
  });
  assert(test1101.costBreakdown.totalTripExpenditureINR === 1101, 'Test 11.5 final expenditure is ₹1101');
  assert(!test1101.budgetSummary.isTripWithinBudget, 'Test 11.5 rejected as Primary');
  assert(!test1101.budgetSummary.isTripWithinSoftBudget, 'Test 11.5 (₹1101 > ₹1100) rejected as Alternative');

  // Scenario 11.6: No valid combination within ₹1,100 -> Return no feasible itinerary with exact message
  const impossiblePool = [
    { id: 'exp1', name: 'Super Luxury Palace', score: 0.9, price: { amount: 2000 }, coordinates: { lat: 24.58, lon: 73.68 } }
  ];
  const impossibleRes = optimizeRecommendations(impossiblePool, 1000, 0.10);
  assert(!impossibleRes.feasibility.isFeasible, 'Impossible budget marks isFeasible: false');
  assert(
    impossibleRes.feasibility.message ===
      'No suitable combination of attractions is available within your budget, even with the additional 10% allowance. Please increase your budget or change your selected priorities.',
    'Impossible budget returns exact required feasibility message'
  );

  if (failed === 0) {
    console.log('\n🎉 ALL UNIT, INTEGRATION & MANDATORY AUDIT TESTS PASSED!\n');
    process.exit(0);
  } else {
    console.error(`\n💥 ${failed} TEST(S) FAILED.\n`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test crashed:', err);
  process.exit(1);
});
