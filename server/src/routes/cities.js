import { Router } from 'express';

const router = Router();

const SUPPORTED_CITIES = [
  {
    id: 'udaipur',
    name: 'Udaipur',
    state: 'Rajasthan',
    country: 'India',
    isMvpCity: true,
    coordinates: { lat: 24.5854, lon: 73.7125 },
    currency: 'INR',
    description: 'The City of Lakes — world famous for historic palaces, mountain lakes, cultural centers and heritage architecture.',
    supportedCategories: [
      { id: 'Monuments', label: 'Monuments & Palaces', emoji: '🏯' },
      { id: 'Nature', label: 'Nature & Parks', emoji: '🌿' },
      { id: 'Adventure', label: 'Adventure & Sports', emoji: '🧗' },
      { id: 'Lakes_Boating', label: 'Lakes & Boating', emoji: '⛵' },
      { id: 'Culture', label: 'Culture & Museums', emoji: '🎭' },
      { id: 'Religious_Places', label: 'Religious Places & Shrines', emoji: '🛕' },
    ],
  },
];

router.get('/', (req, res) => {
  res.json({
    count: SUPPORTED_CITIES.length,
    cities: SUPPORTED_CITIES,
  });
});

export default router;
