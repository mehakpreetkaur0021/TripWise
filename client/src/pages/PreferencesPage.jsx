import { useNavigate } from 'react-router-dom';
import { useTripStore } from '../store/tripStore';
import { CATEGORIES } from '../constants/categories';
import CategoryRanker from '../components/CategoryRanker';
import BudgetInput from '../components/BudgetInput';
import { useRecommendations } from '../hooks/useRecommendations';

export default function PreferencesPage() {
  const navigate = useNavigate();
  const { selectedCategories, setSelectedCategories, priorities, setPriorities } = useTripStore();
  const { getRecommendations, status } = useRecommendations();

  function toggleCategory(id) {
    if (selectedCategories.includes(id)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== id));
      setPriorities(priorities.filter((c) => c !== id));
    } else {
      setSelectedCategories([...selectedCategories, id]);
      setPriorities([...priorities, id]);
    }
  }

  function handleSubmit() {
    if (selectedCategories.length === 0) return;
    navigate('/results');
    getRecommendations();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-gray-500 hover:text-gray-800 text-sm">← Back</button>
        <h1 className="text-xl font-bold text-gray-900 flex-1 text-center">Your Preferences</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* Category selection */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">What do you want to explore?</h2>
          <p className="text-sm text-gray-500 mb-4">Select all that interest you</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => {
              const selected = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex flex-col items-center gap-1 py-4 px-3 rounded-2xl border-2 transition-all font-medium text-sm ${
                    selected
                      ? 'border-green-500 bg-green-50 text-green-800 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-3xl">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Priority ranker */}
        {selectedCategories.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Rank your priorities</h2>
            <p className="text-sm text-gray-500 mb-4">Drag to reorder — top = most important</p>
            <CategoryRanker priorities={priorities} onChange={setPriorities} />
          </section>
        )}

        {/* Budget */}
        <BudgetInput />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={selectedCategories.length === 0 || status === 'loading'}
          className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-bold text-lg py-4 rounded-2xl shadow-lg transition-colors"
        >
          {status === 'loading' ? '🔍 Finding best places…' : 'Get Recommendations →'}
        </button>
      </div>
    </div>
  );
}
