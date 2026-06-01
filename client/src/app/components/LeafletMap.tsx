import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapFacility {
  id: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  availableSpaces: number;
  totalSpaces: number;
}

interface LeafletMapProps {
  facilities: MapFacility[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  facilities,
  selectedId,
  onMarkerClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet Map centered in Kampala
    const map = L.map(mapContainerRef.current, {
      center: [0.3192, 32.5891], // Kampala CBD center
      zoom: 14,
      zoomControl: false,
    });

    // Load OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers when facilities list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => {
      map.removeLayer(marker);
    });
    markersRef.current = {};

    facilities.forEach((f) => {
      const lat = typeof f.latitude === 'string' ? parseFloat(f.latitude) : f.latitude;
      const lng = typeof f.longitude === 'string' ? parseFloat(f.longitude) : f.longitude;

      if (isNaN(lat) || isNaN(lng)) return;

      const pct = f.availableSpaces / f.totalSpaces;
      let markerColor = '#16A34A'; // Green
      if (f.availableSpaces === 0) markerColor = '#DC2626'; // Red
      else if (pct < 0.2) markerColor = '#F59E0B'; // Orange

      const isSelected = selectedId === f.id;

      // Define premium Leaflet DivIcon
      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div style="
            position: relative;
            width: ${isSelected ? '36px' : '28px'};
            height: ${isSelected ? '36px' : '28px'};
            background-color: ${markerColor};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-family: 'Inter', sans-serif;
            font-weight: bold;
            font-size: ${isSelected ? '13px' : '11px'};
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            transition: all 0.2s ease-in-out;
            transform: translate(-50%, -50%);
          ">
            P
            ${isSelected ? `
              <div style="
                position: absolute;
                top: -6px;
                right: -6px;
                width: 12px;
                height: 12px;
                background-color: #0F4C81;
                border: 2px solid white;
                border-radius: 50%;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          onMarkerClick(f.id);
        });

      markersRef.current[f.id] = marker;

      // Auto center on selected marker
      if (isSelected) {
        map.setView([lat, lng], 15, { animate: true });
      }
    });
  }, [facilities, selectedId, onMarkerClick]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
    </div>
  );
};
export default LeafletMap;
