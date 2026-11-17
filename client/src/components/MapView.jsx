import { useRef } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';
import { useMap } from '../hooks/useMap';

function MapInner({ attractions, center }) {
  const mapRef = useRef(null);
  useMap(mapRef, attractions, center);
  return <div ref={mapRef} className="w-full h-full rounded-2xl" />;
}

export default function MapView({ attractions = [], center }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey || apiKey.trim() === '') {
    return (
      <div className="w-full h-80 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
        <span className="text-3xl mb-2">🗺️</span>
        <h4 className="text-slate-800 font-semibold text-sm">Google Maps Key Missing</h4>
        <p className="text-slate-500 text-xs mt-1 max-w-sm">
          Please add <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to <code className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded font-mono">client/.env</code> to render the live interactive itinerary map.
        </p>
      </div>
    );
  }

  const renderStatus = (status) => {
    switch (status) {
      case Status.LOADING:
        return (
          <div className="w-full h-80 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-500">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading interactive Google Map...</span>
          </div>
        );
      case Status.FAILURE:
        return (
          <div className="w-full h-80 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <span className="text-3xl mb-2">⚠️</span>
            <h4 className="text-amber-900 font-semibold text-sm">Google Maps Failed to Load</h4>
            <p className="text-amber-800 text-xs mt-2 max-w-md">
              Google Maps JavaScript API could not initialize. Common causes:
            </p>
            <ul className="text-amber-700 text-xs text-left mt-2 space-y-1 list-disc list-inside max-w-sm">
              <li><strong>Maps JavaScript API</strong> not enabled in Google Cloud Console</li>
              <li>Google Cloud Billing not active for the project</li>
              <li>API Key restrictions blocking requests from this origin (<code className="font-mono">localhost</code>)</li>
            </ul>
          </div>
        );
      case Status.SUCCESS:
        return (
          <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <MapInner attractions={attractions} center={center || { lat: 24.5854, lng: 73.7125 }} />
          </div>
        );
      default:
        return null;
    }
  };

  return <Wrapper apiKey={apiKey} render={renderStatus} />;
}
