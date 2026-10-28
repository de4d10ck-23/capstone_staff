import React, { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, Droplets, X, Layers } from "lucide-react";

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_KEY ||
  "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

const DEFAULT_CENTER = [124.87, 10.133]; // Maasin City

const STATUS_COLORS = {
  safe: "#10b981",
  warning: "#f59e0b",
  contaminated: "#ef4444",
  undrinkable: "#ef4444",
  unknown: "#64748b",
};

const BarangayWaterSourcesMap = ({
  locations = [],
  selectedLocationId,
  onSelectLocation,
  barangayName = "Community",
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/satellite-streets-v12");

  const selectedLoc = locations.find((l) => String(l.id) === String(selectedLocationId));

  const handleMapStyleChange = (newStyle) => {
    if (newStyle === mapStyle || !map.current) return;
    setMapStyle(newStyle);
    map.current.setStyle(newStyle);
  };

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const validLocs = locations.filter(
      (l) => !isNaN(parseFloat(l.latitude)) && !isNaN(parseFloat(l.longitude))
    );

    const initialCenter =
      validLocs.length > 0
        ? [parseFloat(validLocs[0].longitude), parseFloat(validLocs[0].latitude)]
        : DEFAULT_CENTER;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: initialCenter,
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const timer = setTimeout(() => {
      if (map.current) {
        map.current.resize();
        if (validLocs.length > 1) {
          const bounds = new mapboxgl.LngLatBounds();
          validLocs.forEach((l) =>
            bounds.extend([parseFloat(l.longitude), parseFloat(l.latitude)])
          );
          map.current.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 600 });
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []); // Run once on mount

  // Render or update markers whenever locations or selectedLocationId changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => {
      if (m._popup) m._popup.remove();
      m.remove();
    });
    markersRef.current = [];

    const validLocs = locations.filter(
      (l) => !isNaN(parseFloat(l.latitude)) && !isNaN(parseFloat(l.longitude))
    );

    validLocs.forEach((loc) => {
      const isSelected = String(loc.id) === String(selectedLocationId);
      const st = (loc.water_status || loc.status || "safe").toLowerCase();
      const color = STATUS_COLORS[st] || STATUS_COLORS.unknown;

      const el = document.createElement("div");
      el.className = "flex flex-col items-center cursor-pointer group";
      el.style.zIndex = isSelected ? "30" : "10";

      el.innerHTML = `
        <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transition-transform duration-150 ${
          isSelected
            ? "scale-115 ring-4 ring-blue-500/50"
            : "group-hover:scale-110"
        }" style="background: ${color};">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
          </svg>
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectLocation(String(loc.id));
      });

      const lngLat = [parseFloat(loc.longitude), parseFloat(loc.latitude)];

      const popup = new mapboxgl.Popup({ offset: 14, closeButton: false, closeOnClick: false })
        .setHTML(`
          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${loc.full_name || loc.name}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">Type: ${(loc.source_type || loc.type || "station").replace(/_/g, " ")}</div>
        `);

      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(lngLat)
        .addTo(map.current);

      el.addEventListener("mouseenter", () => popup.setLngLat(lngLat).addTo(map.current));
      el.addEventListener("mouseleave", () => popup.remove());

      marker._popup = popup;
      markersRef.current.push(marker);
    });
  }, [locations, selectedLocationId, onSelectLocation, mapStyle]);

  // Fly to selected location when selectedLocationId changes
  useEffect(() => {
    if (!map.current || !selectedLoc) return;
    const lat = parseFloat(selectedLoc.latitude);
    const lng = parseFloat(selectedLoc.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 800,
        essential: true,
      });
    }
  }, [selectedLocationId, selectedLoc]);

  return (
    <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
      {/* Map Header */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Droplets size={16} className="text-cyan-600" />
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
            Water Sources Map — Brgy. {barangayName}
          </h3>
        </div>
        <p className="text-[11px] text-slate-500">
          Click any water station pin on the map to link it to your concern / request.
        </p>
      </div>

      {/* Map Box */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Style Selector (Satellite / Streets) */}
        <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl shadow-md border border-slate-200/90 flex items-center gap-1 text-xs">
          <div className="px-1 text-slate-400">
            <Layers size={14} />
          </div>
          <button
            type="button"
            onClick={() => handleMapStyleChange("mapbox://styles/mapbox/satellite-streets-v12")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapStyle === "mapbox://styles/mapbox/satellite-streets-v12"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => handleMapStyleChange("mapbox://styles/mapbox/streets-v12")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              mapStyle === "mapbox://styles/mapbox/streets-v12"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Streets
          </button>
        </div>

        {/* Floating count badge */}
        <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-full text-white text-[11px] font-medium shadow-md border border-white/10 pointer-events-none flex items-center gap-1.5 z-10">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span>{locations.length} Stations in Brgy. {barangayName}</span>
        </div>
      </div>

      {/* Selected Station Banner */}
      {selectedLoc ? (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <MapPin size={15} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-blue-950 truncate">
                {selectedLoc.full_name || selectedLoc.name}
              </p>
              <p className="text-[11px] text-blue-700 truncate">
                Type: {(selectedLoc.source_type || selectedLoc.type || "Water Source").replace(/_/g, " ")}
                {selectedLoc.latitude && ` • GPS: ${parseFloat(selectedLoc.latitude).toFixed(4)}, ${parseFloat(selectedLoc.longitude).toFixed(4)}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectLocation("")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-slate-600 hover:text-red-600 text-[11px] font-semibold border border-slate-200 hover:border-red-200 transition-colors flex-shrink-0 cursor-pointer"
            title="Clear selection"
          >
            <X size={13} />
            <span>Clear</span>
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 italic">
          Select a water source on the map or from the dropdown before sending your request.
        </p>
      )}
    </div>
  );
};

export default BarangayWaterSourcesMap;
