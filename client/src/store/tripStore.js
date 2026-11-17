import { create } from 'zustand';

export const useTripStore = create((set) => ({
  city: 'Udaipur',
  selectedCategories: [],
  priorities: [],
  budget: 2000,
  tolerance: 0.1,
  budgetMode: 'all_inclusive',
  results: null,
  loading: false,
  error: null,

  setCity: (city) => set({ city }),
  setSelectedCategories: (cats) => set({ selectedCategories: cats }),
  setPriorities: (p) => set({ priorities: p }),
  setBudget: (b) => set({ budget: b }),
  setTolerance: (t) => set({ tolerance: t }),
  setBudgetMode: (budgetMode) => set({ budgetMode }),
  setResults: (r) => set({ results: r }),
  setLoading: (l) => set({ loading: l }),
  setError: (e) => set({ error: e }),
  reset: () => set({ results: null, error: null }),
}));
