import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PreferencesPage from './pages/PreferencesPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/preferences" element={<PreferencesPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
