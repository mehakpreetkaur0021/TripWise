import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export async function fetchRecommendations(payload) {
  const { data } = await api.post('/api/recommendations', payload);
  return data;
}
