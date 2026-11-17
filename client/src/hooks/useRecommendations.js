import { useState } from 'react';
import { fetchRecommendations } from '../services/api';
import { useTripStore } from '../store/tripStore';

export function useRecommendations() {
  const { city, selectedCategories, priorities, budget, tolerance, budgetMode, setResults, setLoading, setError } = useTripStore();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  async function getRecommendations() {
    setStatus('loading');
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecommendations({ city, categories: selectedCategories, priorities, budget, tolerance, budgetMode });
      setResults(data);
      setStatus('success');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Something went wrong');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return { getRecommendations, status };
}
