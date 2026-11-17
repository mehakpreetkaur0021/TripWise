import AttractionCard from './AttractionCard';
import MapView from './MapView';

export default function ResultsPanel({ results }) {
  const { within_budget, over_budget_alternatives, route, meta, userQuery, financialSummary } = results;
  const primary = within_budget?.attractions || [];
  const alternatives = over_budget_alternatives?.attractions || [];

  const userBudget = userQuery?.budget ?? (within_budget?.total_cost || 0);
  const entryCost = within_budget?.total_cost ?? 0;
  const transportCost = within_budget?.transport_cost_estimate ?? 0;
  const totalTripCost = within_budget?.total_trip_expenditure ?? (entryCost + transportCost);
  const remainingPocket = within_budget?.remaining_pocket_money ?? Math.max(0, userBudget - totalTripCost);
  const isAllInclusive = userQuery?.budgetMode === 'all_inclusive' || within_budget?.budget_mode === 'all_inclusive';

  const totalDistance = route?.total_distance_km ?? route?.totalDistanceKm ?? '—';
  const totalDuration = route?.total_duration_min ?? route?.totalDurationMin ?? '—';

  return (
    <div className="space-y-8">
      {/* Budget & Route Summary Banner */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
        {/* Top bar: Mode indicator and API telemetry */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Plan Mode:</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
              isAllInclusive
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {isAllInclusive ? '🎯 All-Inclusive (Tickets + Local Transport)' : '🎟️ Tickets Only'}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {route?.isLive ? (
              <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                ⚡ Live Google Routes
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-medium" title={route?.note}>
                🗺️ Estimated Road Distance (Haversine)
              </span>
            )}
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              ✓ {meta?.verifiedPricesCount ?? 0} Verified · ~ {meta?.estimatedPricesCount ?? 0} Est.
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-1">
          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <span className="text-gray-500 font-semibold text-xs">Total Budget</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5">₹{userBudget}</div>
            <span className="text-[10px] text-gray-400">User entered</span>
          </div>

          <div className="bg-emerald-50/70 rounded-2xl p-3 border border-emerald-100">
            <span className="text-emerald-700 font-semibold text-xs">Attraction Tickets</span>
            <div className="text-xl font-bold text-emerald-950 mt-0.5">₹{entryCost}</div>
            <span className="text-[10px] text-emerald-700 font-medium">{primary.length} places</span>
          </div>

          <div className="bg-blue-50/70 rounded-2xl p-3 border border-blue-100">
            <span className="text-blue-700 font-semibold text-xs">Est. Transport</span>
            <div className="text-xl font-bold text-blue-950 mt-0.5">₹{transportCost}</div>
            <span className="text-[10px] text-blue-700 font-medium">Local Auto</span>
          </div>

          <div className="bg-amber-50/70 rounded-2xl p-3 border border-amber-100">
            <span className="text-amber-800 font-semibold text-xs">Total Trip Spend</span>
            <div className="text-xl font-bold text-amber-950 mt-0.5">₹{totalTripCost}</div>
            <span className="text-[10px] text-amber-700 font-medium">Tickets + Transit</span>
          </div>

          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <span className="text-gray-600 font-semibold text-xs">Pocket Money</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5">₹{remainingPocket}</div>
            <span className="text-[10px] text-gray-400">Remaining</span>
          </div>

          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100">
            <span className="text-gray-600 font-semibold text-xs">Drive / Transit</span>
            <div className="text-xl font-bold text-gray-900 mt-0.5">{totalDistance} km</div>
            <span className="text-[10px] text-gray-500 font-medium">~{totalDuration} min travel</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapView attractions={primary} center={results.cityCenter} />

      {/* Primary recommendations */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              ✅ Recommended Itinerary — {primary.length} places
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ranked and selected using priority-weighted knapsack optimization
            </p>
          </div>
        </div>

        {primary.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
            No attractions could fit within your current budget settings. Try increasing your budget or selecting fewer expensive monuments.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {primary.map((a, i) => (
              <AttractionCard key={a.id || a.xid || i} attraction={a} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Over-budget alternatives */}
      {alternatives.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">💡 Slightly Over Budget (+10% Tolerance)</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              High-value places that slightly exceeded your strict limit but fit within +10%
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {alternatives.map((a, i) => (
              <AttractionCard key={a.id || a.xid || i} attraction={a} />
            ))}
          </div>
        </section>
      )}

      {/* Route legs */}
      {route?.legs?.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">🗺️ Suggested Optimal Route (TSP Ordered)</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Stops sequenced to minimize travel distance across Udaipur
              </p>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              Total {totalDistance} km · ~{totalDuration} mins
            </span>
          </div>

          <div className="space-y-3">
            {route.legs.map((leg, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm">
                <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <span className="text-gray-700 font-medium">{leg.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-semibold text-gray-900">{leg.to}</span>
                </div>
                <div className="text-right text-xs text-gray-500 font-medium">
                  {leg.distance_km ?? leg.distanceKm} km · {leg.duration_min ?? leg.durationMin} min
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
