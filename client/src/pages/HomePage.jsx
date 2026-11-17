import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';

export default function HomePage() {
  const navigate = useNavigate();
  const { city } = useTripStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-amber-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div>
          <div className="text-6xl mb-3">🧭</div>
          <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">TripWise</h1>
          <p className="mt-2 text-gray-500 text-lg">Priority-based, budget-aware travel recommendations</p>
        </div>

        {/* City pill */}
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-5 py-2 shadow-sm">
          <span className="text-xl">📍</span>
          <span className="font-semibold text-gray-800">{city}</span>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">MVP city</span>
        </div>

        {/* CTA */}
        <button
          onClick={() => navigate('/preferences')}
          className="w-full bg-green-700 hover:bg-green-800 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-colors"
        >
          Plan My Trip →
        </button>

        <p className="text-xs text-gray-400">Select categories · Rank preferences · Enter budget · Get recommendations</p>
      </div>
    </div>
  );
}
