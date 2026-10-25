import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Droplets,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Navigation,
  RefreshCw,
  Eye,
  EyeOff,
  Search,
  Shield,
  MapPin,
  Flame,
  ShieldAlert,
  Info,
  Waves,
  Mountain,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import officialFloodHazards from "../data/maasin_flood_hazards.json";
import officialLandslideHazards from "../data/maasin_landslide_hazards.json";
import { getBarangayPopulation } from "../constants/barangays";

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_KEY ||
  "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

export const NAME_LABEL_MIN_ZOOM = 18.0;
export const DOUBLE_CLICK_ZOOM = 18.0;

const WaterMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const { token, API_URL, user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [households, setHouseholds] = useState([]);

  // Official Environmental Hazard Layers (Loaded from Maasin_LandFlood)
  const [floodHazards, setFloodHazards] = useState(officialFloodHazards);
  const [landslideHazards, setLandslideHazards] = useState(officialLandslideHazards);

  // Layer Toggles
  const [showFloodZones, setShowFloodZones] = useState(false);
  const [showLandslideZones, setShowLandslideZones] = useState(false);
  const [showWaterHeatmap, setShowWaterHeatmap] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);

  // Model-driven Water Contamination Heatmap Dataset
  const [waterHeatmapData, setWaterHeatmapData] = useState(null);
  const [heatmapMeta, setHeatmapMeta] = useState(null);

  // Selections
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedHazardZone, setSelectedHazardZone] = useState(null);

  // Map Controls
  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/streets-v12");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [loading, setLoading] = useState(true);

  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const showMarkersRef = useRef(showMarkers);
  showMarkersRef.current = showMarkers;
  const showWaterHeatmapRef = useRef(showWaterHeatmap);
  showWaterHeatmapRef.current = showWaterHeatmap;
  const showFloodZonesRef = useRef(showFloodZones);
  showFloodZonesRef.current = showFloodZones;
  const showLandslideZonesRef = useRef(showLandslideZones);
  showLandslideZonesRef.current = showLandslideZones;
  const floodHazardsRef = useRef(floodHazards);
  floodHazardsRef.current = floodHazards;
  const landslideHazardsRef = useRef(landslideHazards);
  landslideHazardsRef.current = landslideHazards;
  const waterHeatmapDataRef = useRef(waterHeatmapData);
  waterHeatmapDataRef.current = waterHeatmapData;

  // Fetch all map data from backend
  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, houseRes, envRes, heatRes] = await Promise.all([
        fetch(`${API_URL}/water-locations`),
        fetch(`${API_URL}/households/spatial`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/hazards/environmental-layers`),
        fetch(`${API_URL}/forecast/heatmaps`),
      ]);

      const locData = await locRes.json();
      const houseData = await houseRes.json();
      const envData = envRes.ok ? await envRes.json() : null;
      const heatData = heatRes.ok ? await heatRes.json() : null;

      if (locData.success && Array.isArray(locData.data)) {
        setLocations(locData.data);
        locationsRef.current = locData.data;
      }
      if (houseData.success && Array.isArray(houseData.data)) {
        setHouseholds(houseData.data);
      }

      if (envData?.success) {
        if (envData.flood_hazards?.features?.length > 0) {
          setFloodHazards(envData.flood_hazards);
          floodHazardsRef.current = envData.flood_hazards;
        }
        if (envData.landslide_hazards?.features?.length > 0) {
          setLandslideHazards(envData.landslide_hazards);
          landslideHazardsRef.current = envData.landslide_hazards;
        }
      }

      if (heatData?.success && heatData.data) {
        setWaterHeatmapData(heatData.data.water_contamination_heatmap);
        waterHeatmapDataRef.current = heatData.data.water_contamination_heatmap;
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

  // Render Official Flood & Landslide Hazard Vector Layers
  const renderHazardLayers = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const fData = floodHazardsRef.current || floodHazards;
    const lData = landslideHazardsRef.current || landslideHazards;
    const isFloodVisible = showFloodZonesRef.current ?? showFloodZones;
    const isLandslideVisible = showLandslideZonesRef.current ?? showLandslideZones;

    // 1. FLOOD HAZARDS (StudyAreaFlood_Maasin from Maasin_LandFlood)
    const floodSourceId = "official-flood-hazard-source";
    const floodFillId = "flood-hazard-fill";
    const floodLineId = "flood-hazard-line";

    if (fData?.features?.length > 0) {
      if (map.current.getSource(floodSourceId)) {
        map.current.getSource(floodSourceId).setData(fData);
      } else {
        map.current.addSource(floodSourceId, {
          type: "geojson",
          data: fData,
        });

        // Polygon Fill
        map.current.addLayer({
          id: floodFillId,
          type: "fill",
          source: floodSourceId,
          layout: {
            visibility: isFloodVisible ? "visible" : "none",
          },
          paint: {
            "fill-color": ["coalesce", ["get", "color"], "#ef4444"],
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 0.22,
              14, 0.28,
              18, 0.35,
            ],
          },
        });

        // Boundary Outline
        map.current.addLayer({
          id: floodLineId,
          type: "line",
          source: floodSourceId,
          layout: {
            visibility: isFloodVisible ? "visible" : "none",
          },
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#dc2626"],
            "line-width": 1.5,
            "line-opacity": 0.85,
          },
        });
      }

      if (map.current.getLayer(floodFillId)) {
        map.current.setLayoutProperty(floodFillId, "visibility", isFloodVisible ? "visible" : "none");
      }
      if (map.current.getLayer(floodLineId)) {
        map.current.setLayoutProperty(floodLineId, "visibility", isFloodVisible ? "visible" : "none");
      }
    }

    // 2. LANDSLIDE HAZARDS (DENR-MGB sad.shp from Maasin_LandFlood)
    const landslideSourceId = "official-landslide-hazard-source";
    const landslideFillId = "landslide-hazard-fill";
    const landslideLineId = "landslide-hazard-line";

    if (lData?.features?.length > 0) {
      if (map.current.getSource(landslideSourceId)) {
        map.current.getSource(landslideSourceId).setData(lData);
      } else {
        map.current.addSource(landslideSourceId, {
          type: "geojson",
          data: lData,
        });

        map.current.addLayer({
          id: landslideFillId,
          type: "fill",
          source: landslideSourceId,
          layout: {
            visibility: isLandslideVisible ? "visible" : "none",
          },
          paint: {
            "fill-color": ["coalesce", ["get", "color"], "#9333ea"],
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              10, 0.18,
              14, 0.24,
              18, 0.32,
            ],
          },
        });

        map.current.addLayer({
          id: landslideLineId,
          type: "line",
          source: landslideSourceId,
          layout: {
            visibility: isLandslideVisible ? "visible" : "none",
          },
          paint: {
            "line-color": ["coalesce", ["get", "color"], "#7e22ce"],
            "line-width": 1.5,
            "line-dasharray": [2, 2],
            "line-opacity": 0.8,
          },
        });
      }

      if (map.current.getLayer(landslideFillId)) {
        map.current.setLayoutProperty(landslideFillId, "visibility", isLandslideVisible ? "visible" : "none");
      }
      if (map.current.getLayer(landslideLineId)) {
        map.current.setLayoutProperty(landslideLineId, "visibility", isLandslideVisible ? "visible" : "none");
      }
    }

    // Interactive Click & Hover listeners on Hazard Zones
    if (!map.current._hazardZoneListenersAttached) {
      map.current._hazardZoneListenersAttached = true;

      const handleZoneClick = (e, type) => {
        if (!e.features || !e.features.length) return;
        const feat = e.features[0];
        const props = feat.properties;

        setSelectedHazardZone({
          ...props,
          hazard_type: type,
          coordinates: [e.lngLat.lng, e.lngLat.lat],
        });
        setSelectedLocation(null);
      };

      map.current.on("click", floodFillId, (e) => handleZoneClick(e, "Flood Hazard"));
      map.current.on("click", landslideFillId, (e) => handleZoneClick(e, "Landslide Hazard"));

      const onEnter = () => {
        map.current.getCanvas().style.cursor = "pointer";
      };
      const onLeave = () => {
        map.current.getCanvas().style.cursor = "";
      };

      map.current.on("mouseenter", floodFillId, onEnter);
      map.current.on("mouseleave", floodFillId, onLeave);
      map.current.on("mouseenter", landslideFillId, onEnter);
      map.current.on("mouseleave", landslideFillId, onLeave);
    }
  };

  // Render Water Contamination Heatmap (ML Risk Plumes)
  const renderWaterHeatmap = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const wData = waterHeatmapDataRef.current || waterHeatmapData;
    const isWaterHeatActive = showWaterHeatmapRef.current ?? showWaterHeatmap;

    const waterSourceId = "model-water-heatmap-source";
    const waterLayerId = "water-contamination-heat";
    const waterAuraLayerId = "water-contamination-aura";

    if (wData?.features?.length > 0) {
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
            // Circle radius scales with zoom and with individual station's population-derived radius_scale
            "circle-radius": [
              "*",
              ["coalesce", ["get", "radius_scale"], 1.0],
              [
                "interpolate",
                ["linear"],
                ["zoom"],
                10, 8,
                12, 18,
                14, 42,
                16, 95,
                18, 200
              ]
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
            setSelectedHazardZone(null);
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

    const locList = locationsRef.current?.length ? locationsRef.current : locations;
    const filtered = locList.filter((loc) => {
      const matchQuery =
        !searchQuery ||
        (loc.name || loc.full_name)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        loc.barangay?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBarangay = selectedBarangay === "all" || loc.barangay === selectedBarangay;
      return matchQuery && matchBarangay;
    });

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
        setSelectedHazardZone(null);
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedLocation(loc);
        setSelectedHazardZone(null);
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
      renderHazardLayers();
      renderWaterHeatmap();
      renderMarkers();
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

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((m) => m.remove());
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  const currentStyleRef = useRef(mapStyle);

  // Dynamic Style Change with Layer Re-addition
  useEffect(() => {
    if (!map.current) return;
    if (currentStyleRef.current !== mapStyle) {
      currentStyleRef.current = mapStyle;
      map.current.setStyle(mapStyle, { diff: false });

      const reAddLayers = () => {
        if (!map.current) return;
        renderHazardLayers();
        renderWaterHeatmap();
        renderMarkers();
      };

      map.current.once("style.load", reAddLayers);
      map.current.once("idle", reAddLayers);
    }
  }, [mapStyle, showFloodZones, showLandslideZones, showWaterHeatmap, showMarkers]);

  // Sync hazard and heatmap layers on state updates
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderHazardLayers();
    }
  }, [showFloodZones, showLandslideZones, floodHazards, landslideHazards]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderWaterHeatmap();
      renderMarkers();
    }
  }, [showWaterHeatmap, waterHeatmapData]);

  useEffect(() => {
    renderMarkers();
  }, [locations, showMarkers, searchQuery, selectedBarangay, selectedLocation]);

  const barangays = Array.from(new Set(locations.map((l) => l.barangay).filter(Boolean))).sort();

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
            onClick={fetchData}
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
            onChange={(e) => {
              const b = e.target.value;
              setSelectedBarangay(b);
              if (b !== "all" && map.current) {
                const bLocs = locations.filter((l) => l.barangay?.toLowerCase() === b.toLowerCase() && l.latitude && l.longitude);
                if (bLocs.length > 0) {
                  const avgLat = bLocs.reduce((sum, l) => sum + l.latitude, 0) / bLocs.length;
                  const avgLng = bLocs.reduce((sum, l) => sum + l.longitude, 0) / bLocs.length;
                  map.current.flyTo({ center: [avgLng, avgLat], zoom: 15, duration: 1200 });
                }
              }
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          >
            <option value="all">All Barangays</option>
            {barangays.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Water Contamination Heatmap Toggle */}
          <button
            onClick={() => {
              const next = !showWaterHeatmap;
              setShowWaterHeatmap(next);
              showWaterHeatmapRef.current = next;
              renderWaterHeatmap();
              renderMarkers();
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${
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
          </button>

          {/* Water Station Pins Toggle */}
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            disabled={showWaterHeatmap}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${
              showWaterHeatmap
                ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                : showMarkers
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            title={showWaterHeatmap ? "Pins hidden while Contamination Heatmap is active" : "Toggle Water Station Pins"}
          >
            {showMarkers && !showWaterHeatmap ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Pins ({locations.length})</span>
          </button>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="flex-1 relative">
        <style>{`
          .show-zoom-labels .station-zoom-label {
            display: block !important;
          }
        `}</style>
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Style Selector Overlay */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-1 text-[11px] sm:text-xs font-sans transition-all">
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
          <div className="absolute bottom-4 left-4 right-4 sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:w-84 z-40 bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 animate-fade-in">
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

            <div className="py-3 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status:</span>
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
                  {selectedLocation.status || "Unknown"}
                </span>
              </div>

              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-500">E. Coli Presence:</span>
                {selectedLocation.status?.toLowerCase() === "unknown" || selectedLocation.e_coli === null || selectedLocation.e_coli === undefined || selectedLocation.e_coli === "unknown" ? (
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

              {selectedLocation.exposure_radius_meters && (
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

        {/* Selected Hazard Zone Details Card */}
        {selectedHazardZone && (
          <div className="absolute bottom-4 left-4 right-4 sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:w-84 z-30 bg-white/95 backdrop-blur-md rounded-3xl p-5 shadow-2xl border border-rose-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                    Official Environmental Hazard
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase bg-rose-100 text-rose-800">
                    {selectedHazardZone.risk_level || "Susceptible"}
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mt-1">
                  {selectedHazardZone.risk_level} Zone
                </h3>
                <p className="text-xs text-slate-500">{selectedHazardZone.description}</p>
              </div>
              <button
                onClick={() => setSelectedHazardZone(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Dataset Source:</span>
                <span className="font-semibold text-slate-800">Maasin_LandFlood (DENR-MGB)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Classification Code:</span>
                <span className="font-mono font-bold text-slate-800">{selectedHazardZone.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Susceptibility Weight:</span>
                <span className="font-mono font-bold text-rose-700">{selectedHazardZone.weight}</span>
              </div>

              <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-xl space-y-1">
                <span className="font-bold text-[11px] text-rose-900 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-rose-600" />
                  Water Quality Impact
                </span>
                <p className="text-[10px] text-slate-700 leading-normal">
                  During storm and monsoon events, runoff in this zone accelerates surface contamination, causing water sources within this boundary to face higher bacteriological contamination vulnerability.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaterMap;
