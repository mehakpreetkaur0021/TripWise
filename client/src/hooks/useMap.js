import { useEffect, useRef } from 'react';

export function useMap(mapRef, attractions = [], center = { lat: 24.5854, lng: 73.7125 }) {
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef(null);

  const CATEGORY_COLORS = {
    Monuments: '#b45309',
    Nature: '#15803d',
    Adventure: '#dc2626',
    Lakes_Boating: '#1d4ed8',
    Culture: '#7c3aed',
    Religious_Places: '#d97706',
  };

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
    }
  }, [mapRef, center]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    if (!attractions.length) return;

    const bounds = new window.google.maps.LatLngBounds();
    const routePath = [];

    attractions.forEach((a, idx) => {
      // Support both a.coordinates.lat/lon and top-level a.lat/a.lon/a.lng
      const lat = Number(a.coordinates?.lat ?? a.lat);
      const lng = Number(a.coordinates?.lon ?? a.lon ?? a.lng);

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const position = { lat, lng };
      bounds.extend(position);
      routePath.push(position);

      const color = CATEGORY_COLORS[a.category] || '#4b5563';

      // Numbered badge marker indicating visit sequence (Stop 1, Stop 2...)
      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: `${idx + 1}. ${a.name}`,
        label: {
          text: String(idx + 1),
          color: '#ffffff',
          fontWeight: 'bold',
          fontSize: '12px',
        },
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 14,
        },
        animation: window.google.maps.Animation.DROP,
      });

      const isVerified = a.priceDetails?.priceType === 'verified';
      const priceText = a.price === 0 ? 'Free Entry' : `₹${a.price}`;
      const badgeHtml = isVerified
        ? `<span style="background:#ecfdf5;color:#047857;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:600;">✓ Verified</span>`
        : `<span style="background:#fffbeb;color:#b45309;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:600;">~ Estimated</span>`;

      const infoContent = `
        <div style="font-family:sans-serif;min-width:180px;padding:4px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700;">Stop ${idx + 1} · ${a.category}</div>
          <div style="font-size:14px;font-weight:700;color:#111827;margin:2px 0 6px 0;">${a.name}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;font-weight:700;color:#1f2937;">${priceText}</span>
            ${badgeHtml}
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => infoWindow.open(mapInstanceRef.current, marker));

      markersRef.current.push(marker);
    });

    // Draw route path line between stops
    if (routePath.length > 1) {
      polylineRef.current = new window.google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#1a6b4a',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: mapInstanceRef.current,
      });
    }

    // Auto-fit bounds if we have points
    if (routePath.length > 0) {
      mapInstanceRef.current.fitBounds(bounds);
      // Ensure we don't zoom in too close on single stop
      const listener = window.google.maps.event.addListenerOnce(
        mapInstanceRef.current,
        'idle',
        () => {
          if (mapInstanceRef.current.getZoom() > 15) {
            mapInstanceRef.current.setZoom(15);
          }
        }
      );
    }
  }, [attractions]);

  return mapInstanceRef;
}
