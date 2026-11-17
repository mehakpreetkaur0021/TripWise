export default function AttractionCard({ attraction, rank }) {
  const CATEGORY_COLORS = {
    Monuments: 'bg-amber-100 text-amber-800',
    Nature: 'bg-green-100 text-green-800',
    Adventure: 'bg-red-100 text-red-800',
    Lakes_Boating: 'bg-blue-100 text-blue-800',
    Culture: 'bg-purple-100 text-purple-800',
    Religious_Places: 'bg-yellow-100 text-yellow-800',
  };
  const CATEGORY_LABELS = {
    Monuments: 'Monuments',
    Nature: 'Nature',
    Adventure: 'Adventure',
    Lakes_Boating: 'Lakes & Boating',
    Culture: 'Culture',
    Religious_Places: 'Religious Places',
  };

  const tagColor = CATEGORY_COLORS[attraction.category] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Image */}
      <div className="relative h-44 bg-gray-100">
        {attraction.image ? (
          <img src={attraction.image} alt={attraction.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {{ Monuments: '🏯', Nature: '🌿', Adventure: '🧗', Lakes_Boating: '⛵', Culture: '🎭', Religious_Places: '🛕' }[attraction.category] || '📍'}
          </div>
        )}
        {rank && (
          <div className="absolute top-2 left-2 bg-white/90 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold text-gray-700 shadow">
            {rank}
          </div>
        )}
        <div className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full ${tagColor}`}>
          {CATEGORY_LABELS[attraction.category] || attraction.category}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="font-bold text-gray-900 text-base leading-tight">{attraction.name}</h3>
        {attraction.description && (
          <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">{attraction.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-gray-900">
              {attraction.price === 0 ? 'Free Entry' : `₹${attraction.price}`}
            </span>
            {attraction.priceDetails?.priceType === 'verified' ? (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1" title={attraction.priceDetails?.source}>
                <span>✓</span> Verified official
              </span>
            ) : (
              <span className="text-xs text-amber-600 font-medium">
                ~ Estimated price
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {'★'.repeat(Math.max(1, Math.min(3, attraction.rating ?? attraction.rate ?? 2)))}{'☆'.repeat(3 - Math.max(1, Math.min(3, attraction.rating ?? attraction.rate ?? 2)))}
            <span className="text-xs text-gray-400 ml-1">Rating</span>
          </div>
        </div>

        {(attraction.wikipediaUrl || attraction.wikipedia) && (
          <a
            href={attraction.wikipediaUrl || (attraction.wikipedia.startsWith('http') ? attraction.wikipedia : `https://en.wikipedia.org/wiki/${attraction.wikipedia.split('/').pop()}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-medium"
          >
            <span>📖</span> Read on Wikipedia →
          </a>
        )}
      </div>
    </div>
  );
}
