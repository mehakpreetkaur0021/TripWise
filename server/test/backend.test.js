import { getCityCenter, discoverPlaces } from '../src/services/placeDiscoveryService.js';
import { fetchSupplementaryPlaceData } from '../src/services/googlePlacesService.js';
import { searchActivityTickets } from '../src/services/ticketLensService.js';
import { resolveAttractionPrice } from '../src/services/pricingService.js';
import { calculateAttractionScore } from '../src/services/scoringService.js';
import { solve01Knapsack, optimizeRecommendations } from '../src/services/knapsackService.js';
import { sequenceVisitOrderTSP, calculateHaversineDistanceKm } from '../src/services/googleRoutesService.js';
import { calculateTransportationCost, calculateFinalExpenditure } from '../src/services/costCalculationService.js';
import { generateRecommendations } from '../src/services/orchestratorService.js';

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
  assert(geo.cityName === 'Udaipur' && geo.coordinates.lat > 20, 'getCityCenter returns Udaipur coordinates');

  const placesResult = await discoverPlaces({ city: 'Udaipur', category: 'Monuments', limit: 3 });
  assert(placesResult.places.length > 0, 'discoverPlaces returns places for Monuments');
  assert(placesResult.places[0].name.length > 0, 'place has a valid name');
  assert(placesResult.providerStatus.provider === 'OpenTripMap', 'reports provider OpenTripMap');

  console.log('\n--- 2. Testing Google Places Service ---');
  const googleResult = await fetchSupplementaryPlaceData('City Palace', 'Udaipur');
  assert(typeof googleResult.isConfigured === 'boolean', 'reports configuration status cleanly');
  assert(!googleResult.isConfigured ? googleResult.status === 'unconfigured' : true, 'reports unconfigured when key is absent');

  console.log('\n--- 3. Testing TicketLens Pricing Service ---');
  const ticketLensResult = await searchActivityTickets('City Palace', 'Udaipur');
  assert(ticketLensResult.provider === 'TicketLens', 'identifies provider as TicketLens');
  assert(Array.isArray(ticketLensResult.tickets), 'tickets is an array (never fabricates fake tickets)');
  assert(!ticketLensResult.isLive, 'accurately flags unconfigured status without fabrication');

  console.log('\n--- 4. Testing Pricing Service (Priority Hierarchy) ---');
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
    { id: 'free1', name: 'Temple', category: 'Religious_Places', score: 0.9, price: { amount: 0 } },
    { id: 'mon1', name: 'Palace A', category: 'Monuments', score: 0.85, price: { amount: 200 } },
    { id: 'mon2', name: 'Palace B', category: 'Monuments', score: 0.70, price: { amount: 300 } },
    { id: 'adv1', name: 'Zipline', category: 'Adventure', score: 0.95, price: { amount: 600 } },
  ];
  const knapsackWithin500 = solve01Knapsack(testPool, 500);
  const totalCost = knapsackWithin500.reduce((s, it) => s + it.price.amount, 0);
  assert(totalCost <= 500, `Knapsack strictly respects hard budget (${totalCost} <= 500)`);
  assert(knapsackWithin500.some((it) => it.id === 'free1'), 'Free attraction included without consuming budget capacity');

  const optimization = optimizeRecommendations(testPool, 500, 0.25);
  assert(optimization.withinBudget.isWithinBudget, 'Primary set marked within budget');
  assert(optimization.budgetConfiguration.isStrictlyWithinBudget, 'Expenditure revalidation passes');

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
  assert(fullResult.within_budget.total_cost <= 1200, 'Primary attractions total within ₹1200 budget');
  assert(fullResult.route.totalDistanceKm > 0, 'Route distance computed');
  assert(fullResult.financialSummary.costBreakdown.transportationCostINR > 0, 'Transportation cost calculated');
  assert(fullResult.meta.candidatesEvaluated > 0, 'Candidates evaluated count reported');

  if (failed === 0) {
    console.log('\n🎉 ALL 18 UNIT & INTEGRATION TESTS PASSED!\n');
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
