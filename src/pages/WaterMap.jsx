import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Droplets, ShieldCheck, AlertTriangle, Layers, Navigation, RefreshCw, Eye, EyeOff, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

const WaterMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const { token, API_URL, user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/streets-v12");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, houseRes] = await Promise.all([
        fetch(`${API_URL}/water-locations`),
        fetch(`${API_URL}/households/spatial`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const locData = await locRes.json();
      const houseData = await houseRes.json();

      if (locData.success && Array.isArray(locData.data)) setLocations(locData.data);
      if (houseData.success && Array.isArray(houseData.data)) setHouseholds(houseData.data);
    } catch (err) {
      console.error("Error fetching staff map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, API_URL]);

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [124.8700, 10.1330],
      zoom: 12.5,
      pitch: 20,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.current.on("load", () => {
      renderHeatmap();
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [mapStyle]);

  const renderHeatmap = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer("household-risk-heat")) {
      map.current.removeLayer("household-risk-heat");
    }
    if (map.current.getSource("household-spatial-data")) {
      map.current.removeSource("household-spatial-data");
    }

    if (!households.length) return;

    const geojsonData = {
      type: "FeatureCollection",
      features: households.map((h) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [h.longitude, h.latitude],
        },
        properties: {
          risk_score: h.risk_score || (h.toilet_facility === 0 ? 30 : 5),
        },
      })),
    };

    map.current.addSource("household-spatial-data", {
      type: "geojson",
      data: geojsonData,
    });

    map.current.addLayer({
      id: "household-risk-heat",
      type: "heatmap",
      source: "household-spatial-data",
      layout: {
        visibility: showHeatmap ? "visible" : "none",
      },
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "risk_score"], 0, 0, 10, 0.5, 30, 1.0],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 15, 2.0],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, "rgba(0, 0, 255, 0)",
          0.2, "rgba(65, 105, 225, 0.4)",
          0.5, "rgba(255, 200, 0, 0.7)",
          0.8, "rgba(255, 100, 0, 0.85)",
          1, "rgba(220, 20, 60, 0.95)",
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 14, 25],
        "heatmap-opacity": 0.75,
      },
    });
  };

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderHeatmap();
    }
  }, [households, showHeatmap]);

  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!showMarkers) return;

    const filtered = locations.filter((loc) => {
      const matchQuery = loc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         loc.barangay?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBarangay = selectedBarangay === "all" || loc.barangay === selectedBarangay;
      return matchQuery && matchBarangay;
    });

    filtered.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;

      const isSafe = loc.status?.toLowerCase() === "safe";
      const isWarning = loc.status?.toLowerCase() === "warning";
      const color = isSafe ? "#10b981" : isWarning ? "#f59e0b" : "#ef4444";

      const el = document.createElement("div");
      el.className = "custom-water-marker cursor-pointer transform hover:scale-125 transition-transform duration-200";
      el.innerHTML = `
        <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          </svg>
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedLocation(loc);
        map.current.flyTo({
          center: [loc.longitude, loc.latitude],
          zoom: 15.5,
          duration: 1000
        });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  }, [locations, showMarkers, searchQuery, selectedBarangay]);

  const barangays = Array.from(new Set(locations.map((l) => l.barangay).filter(Boolean))).sort();

  return (
    <div className="h-[calc(100vh-110px)] sm:h-[calc(100vh-140px)] flex flex-col relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm font-sans">
      {/* Top Controls */}
      <div className="bg-white p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 z-10 shadow-sm">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <h2 className="font-bold text-xs sm:text-sm text-slate-900 truncate">Field Surveillance & Risk Map</h2>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          <div className="relative flex-1 sm:w-44 min-w-[120px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Search station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="all">All Barangays</option>
            {barangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all ${
              showHeatmap ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {showHeatmap ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Risk Heatmap</span>
          </button>

          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all ${
              showMarkers ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {showMarkers ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Pins ({locations.length})</span>
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Style Selector Overlay */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-1 text-[11px] sm:text-xs font-sans">
          <div className="px-1 text-slate-700">
            <Layers size={15} />
          </div>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/streets-v12")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              mapStyle === "mapbox://styles/mapbox/streets-v12"
                ? "bg-[#0f3b82] text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
            }`}
          >
            Streets
          </button>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/satellite-streets-v12")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              mapStyle === "mapbox://styles/mapbox/satellite-streets-v12"
                ? "bg-[#0f3b82] text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/light-v11")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${
              mapStyle === "mapbox://styles/mapbox/light-v11"
                ? "bg-[#0f3b82] text-white shadow-sm"
                : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
            }`}
          >
            Light
          </button>
        </div>

        {selectedLocation && (
          <div className="absolute bottom-4 left-4 right-4 sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:w-80 z-20 bg-white/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl border border-slate-100 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Station Overview</span>
                <h3 className="font-bold text-base text-slate-900">{selectedLocation.name}</h3>
                <p className="text-xs text-slate-500">Barangay {selectedLocation.barangay}</p>
              </div>
              <button onClick={() => setSelectedLocation(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">
                ✕
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold uppercase text-slate-800">{selectedLocation.status || "Unknown"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Coliform Count:</span>
                <span className="font-bold text-slate-800">{selectedLocation.coliform_count ?? 0} MPN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">E. Coli Count:</span>
                <span className="font-bold text-slate-800">{selectedLocation.e_coli_count ?? 0} CFU</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterMap;
