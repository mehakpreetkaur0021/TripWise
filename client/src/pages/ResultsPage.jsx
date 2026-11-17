import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import ResultsPanel from '../components/ResultsPanel';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { results, loading, error, budget, city } = useTripStore();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="text-5xl animate-bounce">🔍</div>
        <p className="text-gray-600 font-medium">Finding the best places in {city}…</p>
        <p className="text-sm text-gray-400">Fetching from OpenTripMap · Running budget optimizer</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-5xl">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={() => navigate('/preferences')} className="bg-green-700 text-white px-6 py-3 rounded-xl font-semibold">
          Try Again
        </button>
      </div>
    </div>
  );

  if (!results) {
    navigate('/preferences');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/preferences')} className="text-gray-500 hover:text-gray-800 text-sm">← Preferences</button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-gray-900">Your Trip — {city}</h1>
          <p className="text-xs text-gray-500">Budget: ₹{budget}</p>
        </div>
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 text-sm">Home</button>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <ResultsPanel results={results} />
      </div>
    </div>
  );
}
