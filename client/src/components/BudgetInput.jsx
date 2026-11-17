import { useTripStore } from '../store/tripStore';

export default function BudgetInput() {
  const { budget, setBudget, tolerance, setTolerance, budgetMode, setBudgetMode } = useTripStore();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-800">Your Travel Budget</h3>
        <p className="text-xs text-gray-500 mt-0.5">Set the total amount you plan to spend in Udaipur</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-gray-500 font-bold text-xl">₹</span>
        <input
          type="number"
          min={100}
          max={50000}
          step={100}
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-xl font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="2000"
        />
      </div>

      {/* Budget Allocation Mode */}
      <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Budget Coverage Mode</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBudgetMode('all_inclusive')}
            className={`py-2 px-3 rounded-lg text-xs font-medium text-center transition-all ${
              budgetMode === 'all_inclusive'
                ? 'bg-green-700 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🎯 All-Inclusive<br />
            <span className="text-[10px] opacity-85 font-normal">Tickets + Transit Auto</span>
          </button>
          <button
            type="button"
            onClick={() => setBudgetMode('tickets_only')}
            className={`py-2 px-3 rounded-lg text-xs font-medium text-center transition-all ${
              budgetMode === 'tickets_only'
                ? 'bg-green-700 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            🎟️ Tickets Only<br />
            <span className="text-[10px] opacity-85 font-normal">Transport Separate</span>
          </button>
        </div>
        <p className="text-[11px] text-gray-500 pt-1">
          {budgetMode === 'all_inclusive'
            ? '✓ Optimizes tickets while reserving a buffer for local auto/cab travel within your entered budget.'
            : '✓ Allocates the full budget towards entry tickets; transit fares are estimated separately.'}
        </p>
      </div>

      {/* 10% Over-budget tolerance toggle */}
      <label className="flex items-center gap-3 cursor-pointer pt-1">
        <div
          onClick={() => setTolerance(tolerance === 0.1 ? 0 : 0.1)}
          className={`w-11 h-6 rounded-full transition-colors relative ${tolerance > 0 ? 'bg-green-500' : 'bg-gray-300'}`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${tolerance > 0 ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
        <span className="text-sm text-gray-700 font-medium">
          Allow slightly over-budget alternatives <span className="text-green-600 font-bold">(+10%)</span>
        </span>
      </label>
    </div>
  );
}
