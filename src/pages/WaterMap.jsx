import ForecastTimeline from "../components/ForecastTimeline";
import React, { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Droplets,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMapForecast } from "../hooks/useMapForecast";
import MapForecastControls, { riskLabel } from "../components/MapForecastControls";
import { getBarangayPopulation } from "../constants/barangays";
import HazardOverlay from "../components/HazardOverlay";
import maasinBarangays from "../data/maasin_barangays.json";
import { getBarangayFeature, getBarangayBounds } from "../utils/barangayBoundary";
import { matchesBarangay, mapScopeOwner, resolveMapBarangay, UNASSIGNED_BARANGAY } from "../utils/barangayScope";

const MAP_BARANGAYS = maasinBarangays.features.map(f => f.properties.ADM4_EN.replace(/\s*\(Pob\.?\)/gi, '').trim()).sort();

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_KEY ||
  "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

export const NAME_LABEL_MIN_ZOOM = 18.0;
export const DOUBLE_CLICK_ZOOM = 18.0;

const WaterMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [hazardRefresh, setHazardRefresh] = useState(0);
  const { token, API_URL, user } = useAuth();

  const [records, setLocations] = useState([]);
  const [households, setHouseholds] = useState([]);

  // Layer Toggles
  const [sanitationHeatmap, setShowWaterHeatmap] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);

  // Model-driven Water Contamination Heatmap Dataset
  const [waterHeatmapData, setWaterHeatmapData] = useState(null);
  const [heatmapMeta, setHeatmapMeta] = useState(null);

  // Selections
  const [selection, setSelectedLocation] = useState(null);

  // Map Controls
  const [mapStyle] = useState("mapbox://styles/mapbox/satellite-streets-v12");
  const [searchQuery, setSearchQuery] = useState("");
  const [areaSelection, setAreaSelection] = useState(null);
  const selectedBarangay = resolveMapBarangay(user, areaSelection, MAP_BARANGAYS);
  const setSelectedBarangay = (value) => {
    setAreaSelection({ owner: mapScopeOwner(user), value });
    setSelectedLocation(null);
  };
  const [loading, setLoading] = useState(true);
  const forecast = useMapForecast(API_URL, records, selectedBarangay);
  const { locations } = forecast;
  const isModel = forecast.source === "model";
  const showWaterHeatmap = !isModel && sanitationHeatmap;
  const selectedRecord = locations.find((loc) => String(loc.id) === String(selection?.id));
  const selectedLocation = useMemo(() => selection ? { ...selection, ...selectedRecord } : null,
    [selection, selectedRecord]);

  const visibleLocations = useMemo(() => locations.filter(loc =>
    matchesBarangay(loc.barangay, selectedBarangay) && (!searchQuery ||
      (loc.name || loc.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.barangay || '').toLowerCase().includes(searchQuery.toLowerCase()))
  ), [locations, selectedBarangay, searchQuery]);
  const locationsRef = useRef(visibleLocations);
  locationsRef.current = visibleLocations;
  const showMarkersRef = useRef(showMarkers);
  showMarkersRef.current = showMarkers;
  const showWaterHeatmapRef = useRef(showWaterHeatmap);
  showWaterHeatmapRef.current = showWaterHeatmap;
  const scopedWaterHeatmap = useMemo(() => waterHeatmapData ? { ...waterHeatmapData,
    features: (waterHeatmapData.features || []).filter(f => matchesBarangay(f.properties?.barangay, selectedBarangay)),
  } : null, [waterHeatmapData, selectedBarangay]);
  const waterHeatmapDataRef = useRef(scopedWaterHeatmap);
  waterHeatmapDataRef.current = scopedWaterHeatmap;

  // Fetch all map data from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, houseRes, heatRes] = await Promise.all([
        fetch(`${API_URL}/water-locations`),
        fetch(`${API_URL}/households/spatial`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/forecast/heatmaps`),
      ]);

      const locData = await locRes.json();
      const houseData = await houseRes.json();
      const heatData = heatRes.ok ? await heatRes.json() : null;

      if (locData.success && Array.isArray(locData.data)) {
        setLocations(locData.data);
      }
      if (houseData.success && Array.isArray(houseData.data)) {
        setHouseholds(houseData.data);
      }

      if (heatData?.success && heatData.data) {
        setWaterHeatmapData(heatData.data.water_contamination_heatmap);
        setHeatmapMeta(heatData.data);
      }
    } catch (err) {
      console.error("Error fetching map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, API_URL]);

  // Render Water Contamination Heatmap (ML Risk Plumes)
  const renderWaterHeatmap = (styleReady = false) => {
    if (!map.current || (!styleReady && !map.current.isStyleLoaded())) return;

    const wData = waterHeatmapDataRef.current;
    const isWaterHeatActive = showWaterHeatmapRef.current ?? showWaterHeatmap;

    const waterSourceId = "model-water-heatmap-source";
    const waterLayerId = "water-contamination-heat";
    const waterAuraLayerId = "water-contamination-aura";

    if (wData?.features) {
      if (map.current.getSource(waterSourceId)) {
        map.current.getSource(waterSourceId).setData(wData);
      } else {
        map.current.addSource(waterSourceId, {
          type: "geojson",
          data: wData,
        });

        // 1. PHYSICAL PLUME SIZE SCALING (Option B): Soft radial plume whose physical radius expands with barangay population
        map.current.addLayer({
          id: waterAuraLayerId,
          type: "circle",
          source: waterSourceId,
          layout: {
            visibility: isWaterHeatActive ? "visible" : "none",
          },
          paint: {
            // Scale with zoom and each station's population-derived radius_scale.
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, ["*", ["coalesce", ["get", "radius_scale"], 1.0], 8],
              12, ["*", ["coalesce", ["get", "radius_scale"], 1.0], 18],
              14, ["*", ["coalesce", ["get", "radius_scale"], 1.0], 42],
              16, ["*", ["coalesce", ["get", "radius_scale"], 1.0], 95],
              18, ["*", ["coalesce", ["get", "radius_scale"], 1.0], 200],
            ],
            "circle-color": [
              "match",
              ["get", "status"],
              "undrinkable", "rgba(220, 38, 38, 0.70)",
              "warning", "rgba(234, 179, 8, 0.60)",
              "rgba(59, 130, 246, 0.35)"
            ],
            "circle-blur": 0.85,
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 0.50,
              14, 0.65,
              18, 0.75
            ],
          },
        });

        // 2. EXPOSURE INTENSITY SCALING (Option A): Smooth multi-station continuous kernel density blending
        map.current.addLayer({
          id: waterLayerId,
          type: "heatmap",
          source: waterSourceId,
          layout: {
            visibility: isWaterHeatActive ? "visible" : "none",
          },
          paint: {
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 0.3, 0.35, 0.65, 0.75, 1.0, 1.0],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 14, 1.5, 18, 2.4],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0, 0, 255, 0)",
              0.15, "rgba(59, 130, 246, 0.35)",
              0.35, "rgba(234, 179, 8, 0.65)",
              0.65, "rgba(249, 115, 22, 0.85)",
              1.0, "rgba(220, 38, 38, 0.95)",
            ],
            "heatmap-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              10, 6,
              12, 14,
              14, 32,
              18, 280
            ],
            "heatmap-opacity": 0.82,
          },
        });

        // Allow clicking anywhere on a contamination plume to inspect station & population metrics
        map.current.on("click", waterAuraLayerId, (e) => {
          if (e.features && e.features.length > 0) {
            const props = e.features[0].properties;
            setSelectedLocation({
              id: props.station_id,
              full_name: props.name,
              name: props.name,
              barangay: props.barangay,
              barangay_population: props.barangay_population,
              exposure_radius_meters: props.exposure_radius_meters,
              status: props.status,
              coliform_bacteria: props.coliform_count,
              e_coli: props.e_coli_count,
            });
          }
        });

        map.current.on("mouseenter", waterAuraLayerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = "pointer";
        });
        map.current.on("mouseleave", waterAuraLayerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = "";
        });
      }

      if (map.current.getLayer(waterLayerId)) {
        map.current.setLayoutProperty(
          waterLayerId,
          "visibility",
          isWaterHeatActive ? "visible" : "none"
        );
      }
      if (map.current.getLayer(waterAuraLayerId)) {
        map.current.setLayoutProperty(
          waterAuraLayerId,
          "visibility",
          isWaterHeatActive ? "visible" : "none"
        );
      }
    }
  };

  // Render Discrete Water Station Pins
  const renderMarkers = () => {
    if (!map.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const isWaterHeatActive = showWaterHeatmapRef.current ?? showWaterHeatmap;
    const shouldShow = (showMarkersRef.current ?? showMarkers) && !isWaterHeatActive;
    if (!shouldShow) return;

    const filtered = locationsRef.current;

    filtered.forEach((loc) => {
      if (!loc.latitude || !loc.longitude) return;

      const isSafe = loc.status?.toLowerCase() === "safe";
      const isWarning = loc.status?.toLowerCase() === "warning";
      const isUnknown = loc.status?.toLowerCase() === "unknown" || loc.status?.toLowerCase() === "pending";
      const color = isSafe ? "#10b981" : isWarning ? "#f59e0b" : isUnknown ? "#64748b" : "#ef4444";
      const isSelected = selectedLocation?.id === loc.id;

      const borderStyle = isSelected
        ? "border: 3px solid #2563eb; box-shadow: 0 4px 12px rgba(0,0,0,0.45); transform: scale(1.18);"
        : "border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35);";

      const labelStyle = isSelected
        ? "border-blue-500 bg-white/95 text-slate-900"
        : "border-slate-300 bg-white/95 text-slate-900";

      const stationName = loc.full_name || loc.name || "Station";

      const el = document.createElement("div");
      el.className = `custom-water-marker cursor-pointer group flex flex-col items-center pointer-events-auto ${isSelected ? "z-2" : "z-1"}`;
      el.style.zIndex = isSelected ? "2" : "1";
      el.innerHTML = `
        <div class="transition-all duration-200 ease-out group-hover:scale-125 origin-center flex-shrink-0" style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; ${borderStyle}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          </svg>
        </div>
        <div class="station-zoom-label hidden pointer-events-none mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold shadow-md whitespace-nowrap border text-center max-w-[160px] truncate ${labelStyle}">
          ${stationName}
        </div>
      `;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedLocation(loc);
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedLocation(loc);
        if (map.current) {
          map.current.flyTo({
            center: [loc.longitude, loc.latitude],
            zoom: DOUBLE_CLICK_ZOOM,
            duration: 1000,
          });
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  };

  const renderMarkersRef = useRef(renderMarkers);
  renderMarkersRef.current = renderMarkers;

  // Map Initialization
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [124.828, 10.165],
      zoom: 14.5,
      pitch: 20,
    });

    mapInstance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapInstance.addControl(new mapboxgl.FullscreenControl(), "top-right");

    const checkZoomLabels = () => {
      if (!mapContainer.current) return;
      const shouldShow = mapInstance.getZoom() >= NAME_LABEL_MIN_ZOOM;
      const hasClass = mapContainer.current.classList.contains("show-zoom-labels");
      if (shouldShow !== hasClass) {
        mapContainer.current.classList.toggle("show-zoom-labels", shouldShow);
      }
    };

    const reRenderAll = () => {
      checkZoomLabels();
      // load/style.load guarantees the style is ready for custom layers.
      renderWaterHeatmap(true);
      renderMarkersRef.current();
    };

    mapInstance.on("zoom", checkZoomLabels);
    mapInstance.on("load", reRenderAll);
    mapInstance.on("style.load", reRenderAll);

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstance) {
        mapInstance.resize();
      }
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    map.current = mapInstance;
    setMapReady(true);

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  const currentStyleRef = useRef(mapStyle);

  // The persistent style.load handler restores overlays using the latest refs.
  useEffect(() => {
    if (!map.current) return;
    if (currentStyleRef.current !== mapStyle) {
      currentStyleRef.current = mapStyle;
      map.current.setStyle(mapStyle, { diff: false });
    }
  }, [mapStyle]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const sync = () => {
      if (instance.isStyleLoaded()) renderWaterHeatmap();
      renderMarkersRef.current();
    };
    sync();
    // A barangay can change while another source is loading. Apply the scoped
    // heatmap when the map settles, including an empty result to clear old data.
    instance.once('idle', sync);
    return () => instance.off('idle', sync);
  }, [showWaterHeatmap, scopedWaterHeatmap]);

  useEffect(() => {
    renderMarkers();
  }, [locations, showMarkers, searchQuery, selectedBarangay, selectedLocation]);

  useEffect(() => {
    if (!mapReady || !map.current || selectedBarangay === 'all') return;
    const bounds = getBarangayBounds(getBarangayFeature(selectedBarangay));
    if (bounds) map.current.fitBounds(bounds, { padding: 55, maxZoom: 15.5, pitch: 0, bearing: 0 });
  }, [mapReady, selectedBarangay]);

  const barangays = [...MAP_BARANGAYS];
  if (selectedBarangay !== 'all' && selectedBarangay !== UNASSIGNED_BARANGAY && !barangays.includes(selectedBarangay)) barangays.push(selectedBarangay);

  return (
    <div className="h-[calc(100vh-110px)] sm:h-[calc(100vh-140px)] flex flex-col relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm font-sans">
      {/* Top Controls Toolbar */}
      <div className="bg-white p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 z-10 shadow-sm">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xs sm:text-sm text-slate-900 truncate">Field Surveillance & Risk Map</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
              <ShieldCheck size={11} />
              Official GIS
            </span>
          </div>
          <button
            onClick={() => { fetchData(); forecast.retry(); setHazardRefresh(value => value + 1); }}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0"
            title="Refresh map layers"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-40 min-w-[120px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              type="text"
              placeholder="Search station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>

          {/* Barangay Filter */}
          <select
            value={selectedBarangay}
            aria-label="Water source barangay"
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="all">All Barangays</option>
            {selectedBarangay === UNASSIGNED_BARANGAY && <option value={UNASSIGNED_BARANGAY}>No assigned barangay</option>}
            {barangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* The contamination plume represents recorded sanitation results. */}
          {!isModel && <button
            onClick={() => {
              const next = !showWaterHeatmap;
              setShowWaterHeatmap(next);
              showWaterHeatmapRef.current = next;
              renderWaterHeatmap();
              renderMarkers();
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              showWaterHeatmap
                ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle Water Contamination Plume Heatmap (Hides discrete water pins)"
          >
            <Droplets size={13} className={showWaterHeatmap ? "text-white" : "text-rose-500"} />
            <span>Contamination Heatmap</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${showWaterHeatmap ? "bg-rose-800 text-white" : "bg-slate-100 text-slate-500"}`}>
              {showWaterHeatmap ? "ON" : "OFF"}
            </span>
          </button>}

          {/* Water Station Pins Toggle */}
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            disabled={showWaterHeatmap}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              showWaterHeatmap
                ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                : showMarkers
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            title={showWaterHeatmap ? "Pins hidden while Contamination Heatmap is active" : "Toggle Water Station Pins"}
          >
            {showMarkers && !showWaterHeatmap ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Pins ({visibleLocations.length})</span>
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="relative flex flex-col flex-1 min-w-0 min-h-0">
      <div className="staff-water-map flex-1 min-h-0 relative">
        <style>{`
          .staff-water-map .mapboxgl-ctrl-top-right { top: 0px; }
          .staff-water-map .mapboxgl-ctrl-bottom-left, .staff-water-map .mapboxgl-ctrl-bottom-right { bottom: ${isModel ? 60 : 0}px; }
          .show-zoom-labels .station-zoom-label {
            display: block !important;
          }
        `}</style>
        <div ref={mapContainer} className="w-full h-full" />
        {mapReady && <HazardOverlay mapRef={map} area={selectedBarangay} onAreaChange={setSelectedBarangay} barangays={barangays} apiUrl={API_URL} token={token} refreshKey={hazardRefresh} />}

        {/* Map data controls float inside the main map. */}
        <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 max-w-[calc(100%-4rem)]">
          <MapForecastControls forecast={forecast} />
        </div>

        {/* Loading Forecast Indicator (Bottom Center of Map) */}
        {isModel && forecast.loading && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-200">
            <div className="bg-white/95 backdrop-blur-md text-black text-xs md:text-sm font-semibold px-4 py-2 rounded-full shadow-xl border border-slate-200/90 flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading forecast...</span>
            </div>
          </div>
        )}

        {/* Water Contamination Heatmap Spectrum (shown only when heatmap is active) */}
        {showWaterHeatmap && (
          <div className="absolute bottom-4 left-3 sm:bottom-5 sm:left-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200/90 max-w-[270px] text-xs animate-fade-in space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Droplets size={13} className="text-rose-600" />
                Contamination Exposure
              </span>
              <span className="text-[9px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                Pop-Weighted
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 via-orange-500 to-red-600" />
            <div className="flex justify-between text-[9px] text-slate-500 font-medium">
              <span>Safe</span>
              <span>Warning</span>
              <span>Contaminated</span>
            </div>
          </div>
        )}

        {/* Selected Water Location Detail Card */}
        {selectedLocation && (
          <div className="absolute bottom-4 left-4 right-4 sm:top-20 sm:right-6 sm:bottom-auto sm:left-auto sm:w-84 max-h-[70%] overflow-y-auto z-40 bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Station Overview</span>
                <h3 className="font-bold text-base text-slate-900">{selectedLocation.full_name || selectedLocation.name}</h3>
                <p className="text-xs text-slate-500">Barangay {selectedLocation.barangay}</p>
              </div>
              <button
                onClick={() => setSelectedLocation(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {isModel && <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
              <p className="font-semibold">Model forecast ? {forecast.dates[forecast.day].label}</p>
              {selectedLocation.forecast ? <>
                <p>{selectedLocation.forecast.hazard_assessment ? 'Risk index' : 'Estimated risk'}: {selectedLocation.forecast.risk_percentage}{selectedLocation.forecast.hazard_assessment ? ' / 100' : '%'}</p>
                {selectedLocation.forecast.hazard_assessment && <div className="border-t border-blue-200 pt-2 space-y-1">
                  <p>Natural-hazard coverage: {selectedLocation.forecast.hazard_assessment.coverage.replaceAll('_', ' ')}</p>
                  <p>Hazard adjustment: +{(selectedLocation.forecast.risk_breakdown.hazard_adjustment * 100).toFixed(1)} points</p>
                  {selectedLocation.forecast.hazard_assessment.contributions.map(item => <p key={`${item.category}-${item.code}`}>
                    {item.label}: weight {item.weight}, exposure {(item.exposure * 100).toFixed(0)}%
                    {item.distance_m != null ? ` (${item.distance_m} m away)` : ''}
                    {item.inferred ? ' — estimated zone, reduced weight' : ''}
                  </p>)}
                  <p className="text-[10px]">Provisional hazard weights. This risk index is not a measured contamination probability or a water test result.</p>
                </div>}
                <p>Rain: {selectedLocation.forecast.environmental_metrics.rainfall_24h_mm} mm/day ? {selectedLocation.forecast.environmental_metrics.temperature_celsius}?C ? Humidity: {selectedLocation.forecast.environmental_metrics.humidity_percent}%</p>
                <p>Updated: {new Date(selectedLocation.forecast.generated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (PH){selectedLocation.forecast.stale ? ' ? Older forecast' : ''}</p>
              </> : <p>{forecast.loading ? 'Loading forecast...' : 'Forecast unavailable for this station and date.'}</p>}
            </div>}
            <div className="py-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{isModel ? "Estimated risk:" : "Status:"}</span>
                <span
                  className={`font-bold uppercase px-2.5 py-0.5 rounded-full text-[10px] ${
                    selectedLocation.status?.toLowerCase() === "safe"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : selectedLocation.status?.toLowerCase() === "warning"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : selectedLocation.status?.toLowerCase() === "unknown" || !selectedLocation.status
                      ? "bg-slate-100 text-slate-700 border border-slate-200"
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}
                >
                  {isModel ? riskLabel(selectedLocation.status) : (selectedLocation.status || "Unknown")}
                </span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">E. Coli (latest test):</span>
                {selectedLocation.e_coli === null || selectedLocation.e_coli === undefined || selectedLocation.e_coli === "unknown" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>Unknown</span>
                  </span>
                ) : Boolean(selectedLocation.e_coli || (selectedLocation.e_coli_count && Number(selectedLocation.e_coli_count) > 0)) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                    <span>Present</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    <span>Not Present</span>
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">Barangay Pop.:</span>
                <span className="font-semibold text-slate-800">
                  {Number(selectedLocation.barangay_population || getBarangayPopulation(selectedLocation.barangay)).toLocaleString()} residents
                </span>
              </div>

              {!isModel && selectedLocation.exposure_radius_meters && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500">Exposure Radius:</span>
                  <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                    ~{selectedLocation.exposure_radius_meters}m plume
                  </span>
                </div>
              )}

              {selectedLocation.sample_date && (
                <div className="flex justify-between pt-1 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-500">Sample Date & Time:</span>
                  <span className="font-mono text-slate-800 font-medium">
                    {selectedLocation.sample_date} {selectedLocation.sample_time ? `• ${selectedLocation.sample_time}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}


      </div>
      {isModel && <ForecastTimeline forecast={forecast} />}
      </div>
    </div>
  );
};

export default WaterMap;
