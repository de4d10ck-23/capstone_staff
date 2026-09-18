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
  Waves,
  Trees,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  AlertOctagon,
  Sparkles,
  Undo2,
  Redo2,
  Flame,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { findNearestStation, haversineDistance } from "../utils/geoCircle";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

// ============================================================================
// ZOOM SETTINGS
// Adjust these numbers to customize your zoom levels:
// - NAME_LABEL_MIN_ZOOM: Zoom threshold when hazard & water station names appear
// - DOUBLE_CLICK_ZOOM: Zoom level used when double-clicking a water source or hazard
// ============================================================================
export const NAME_LABEL_MIN_ZOOM = 18.0;
export const DOUBLE_CLICK_ZOOM = 18.0;

const WaterMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const hazardMarkersRef = useRef([]);
  const { token, API_URL, user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [hazards, setHazards] = useState([]);

  // Layer Toggles
  const [showHazardHeatmap, setShowHazardHeatmap] = useState(false);
  const [showWaterHeatmap, setShowWaterHeatmap] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHazards, setShowHazards] = useState(true);

  // Model-driven Heatmap Datasets
  const [hazardHeatmapData, setHazardHeatmapData] = useState(null);
  const [waterHeatmapData, setWaterHeatmapData] = useState(null);
  const [heatmapMeta, setHeatmapMeta] = useState(null);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedHazard, setSelectedHazard] = useState(null);

  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/streets-v12");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [loading, setLoading] = useState(true);

  // Participatory GIS Drawing State
  // drawingMode: 'none' | 'Point' | 'LineString' | 'Polygon'
  const [drawingMode, setDrawingMode] = useState("none");
  const [drawCoords, setDrawCoords] = useState([]);
  const [redoCoords, setRedoCoords] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isSavingHazard, setIsSavingHazard] = useState(false);
  const [hazardForm, setHazardForm] = useState({
    name: "",
    hazard_type: "latrine",
    risk_level: "high",
    barangay: "Batuan",
    notes: "",
  });

  const drawingModeRef = useRef(drawingMode);
  drawingModeRef.current = drawingMode;
  const drawCoordsRef = useRef(drawCoords);
  drawCoordsRef.current = drawCoords;
  const redoCoordsRef = useRef(redoCoords);
  redoCoordsRef.current = redoCoords;
  const mousePosRef = useRef(null);
  const finishDrawingRef = useRef(null);
  const cancelDrawingRef = useRef(null);
  const showSaveModalRef = useRef(showSaveModal);
  showSaveModalRef.current = showSaveModal;
  const handleUndoRef = useRef(null);
  const handleRedoRef = useRef(null);

  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const hazardsRef = useRef(hazards);
  hazardsRef.current = hazards;
  const showHazardsRef = useRef(showHazards);
  showHazardsRef.current = showHazards;
  const showMarkersRef = useRef(showMarkers);
  showMarkersRef.current = showMarkers;

  const showHazardHeatmapRef = useRef(showHazardHeatmap);
  showHazardHeatmapRef.current = showHazardHeatmap;
  const showWaterHeatmapRef = useRef(showWaterHeatmap);
  showWaterHeatmapRef.current = showWaterHeatmap;
  const hazardHeatmapDataRef = useRef(hazardHeatmapData);
  hazardHeatmapDataRef.current = hazardHeatmapData;
  const waterHeatmapDataRef = useRef(waterHeatmapData);
  waterHeatmapDataRef.current = waterHeatmapData;

  const canDrawHazards = ["admin", "sanitization_inspector", "city_health_officer", "barangay_official"].includes(user?.role);

  // Fetch all map data including contamination hazards and model heatmaps
  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, houseRes, hazRes, heatRes] = await Promise.all([
        fetch(`${API_URL}/water-locations`),
        fetch(`${API_URL}/households/spatial`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/hazards`, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        }),
        fetch(`${API_URL}/forecast/heatmaps`),
      ]);

      const locData = await locRes.json();
      const houseData = await houseRes.json();
      const hazData = await hazRes.json();
      const heatData = await heatRes.json();

      if (locData.success && Array.isArray(locData.data)) {
        setLocations(locData.data);
        locationsRef.current = locData.data;
      }
      if (houseData.success && Array.isArray(houseData.data)) setHouseholds(houseData.data);
      if (hazData.success && Array.isArray(hazData.data)) {
        setHazards(hazData.data);
        hazardsRef.current = hazData.data;
      }
      if (heatData.success && heatData.data) {
        setHazardHeatmapData(heatData.data.hazard_heatmap);
        hazardHeatmapDataRef.current = heatData.data.hazard_heatmap;
        setWaterHeatmapData(heatData.data.water_contamination_heatmap);
        waterHeatmapDataRef.current = heatData.data.water_contamination_heatmap;
        setHeatmapMeta(heatData.data);
      }
      return hazData.data || null;
    } catch (err) {
      console.error("Error fetching staff map data:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, API_URL]);

  // Dual Model-Driven Heatmap Rendering
  const renderHeatmaps = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const hData = hazardHeatmapDataRef.current || hazardHeatmapData;
    const wData = waterHeatmapDataRef.current || waterHeatmapData;
    const isHazardHeatActive = showHazardHeatmapRef.current ?? showHazardHeatmap;
    const isWaterHeatActive = showWaterHeatmapRef.current ?? showWaterHeatmap;

    // Clean up old legacy household layer if present
    if (map.current.getLayer("household-risk-heat")) map.current.removeLayer("household-risk-heat");
    if (map.current.getSource("household-spatial-data")) map.current.removeSource("household-spatial-data");

    // 1. Hazard Dispersion Heatmap (Points, Lines, Polygons)
    const hazardSourceId = "model-hazard-heatmap-source";
    const hazardLayerId = "hazard-risk-heat";

    if (hData && hData.features && hData.features.length > 0) {
      if (map.current.getSource(hazardSourceId)) {
        map.current.getSource(hazardSourceId).setData(hData);
      } else {
        map.current.addSource(hazardSourceId, {
          type: "geojson",
          data: hData,
        });

        map.current.addLayer({
          id: hazardLayerId,
          type: "heatmap",
          source: hazardSourceId,
          layout: {
            visibility: isHazardHeatActive ? "visible" : "none",
          },
          paint: {
            // Heatmap weight from normalized hazard risk weights (0.1 to 1.0)
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0.1, 0.5, 0.6, 1.0, 1.0],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.8, 14, 1.8],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(255, 255, 255, 0)",
              0.15, "rgba(251, 191, 36, 0.4)",
              0.4, "rgba(245, 158, 11, 0.7)",
              0.7, "rgba(239, 68, 68, 0.85)",
              1.0, "rgba(185, 28, 28, 0.95)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 8, 14, 32],
            "heatmap-opacity": 0.82,
          },
        });
      }

      if (map.current.getLayer(hazardLayerId)) {
        map.current.setLayoutProperty(
          hazardLayerId,
          "visibility",
          isHazardHeatActive ? "visible" : "none"
        );
      }
    }

    // 2. Water Contamination Heatmap (ML Risk Probabilities & Bacterial Status)
    const waterSourceId = "model-water-heatmap-source";
    const waterLayerId = "water-contamination-heat";

    if (wData && wData.features && wData.features.length > 0) {
      if (map.current.getSource(waterSourceId)) {
        map.current.getSource(waterSourceId).setData(wData);
      } else {
        map.current.addSource(waterSourceId, {
          type: "geojson",
          data: wData,
        });

        map.current.addLayer({
          id: waterLayerId,
          type: "heatmap",
          source: waterSourceId,
          layout: {
            visibility: isWaterHeatActive ? "visible" : "none",
          },
          paint: {
            // Heatmap weight from contamination risk probability
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 0.3, 0.35, 0.65, 0.75, 1.0, 1.0],
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 14, 2.0],
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
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 10, 14, 36],
            "heatmap-opacity": 0.82,
          },
        });
      }

      if (map.current.getLayer(waterLayerId)) {
        map.current.setLayoutProperty(
          waterLayerId,
          "visibility",
          isWaterHeatActive ? "visible" : "none"
        );
      }
    }
  };

  const renderHeatmapsRef = useRef(renderHeatmaps);
  renderHeatmapsRef.current = renderHeatmaps;

  // Render Water Station Markers
  const renderMarkers = () => {
    if (!map.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // When Contaminated Water Sources Heatmap is toggled ON, hide all discrete water pins
    const isWaterHeatActive = showWaterHeatmapRef.current ?? showWaterHeatmap;
    const shouldShow = (showMarkersRef.current ?? showMarkers) && !isWaterHeatActive;
    if (!shouldShow) return;

    const locList = locationsRef.current?.length ? locationsRef.current : locations;
    const filtered = locList.filter((loc) => {
      const matchQuery = !searchQuery ||
        loc.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      el.className = "custom-water-marker cursor-pointer group flex flex-col items-center pointer-events-auto";
      el.innerHTML = `
        <div class="transition-transform duration-200 ease-out group-hover:scale-125 origin-center flex-shrink-0" style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          </svg>
        </div>
        <div class="station-zoom-label hidden pointer-events-none mt-1 px-2 py-0.5 rounded-md bg-white/95 text-slate-900 text-[10px] font-bold shadow-md whitespace-nowrap border border-slate-300 text-center max-w-[160px] truncate">
          ${loc.name}
        </div>
      `;

      // Single-click: Show details
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedLocation(loc);
        setSelectedHazard(null);
      });

      // Double-click: Show details and zoom in using configured value
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        setSelectedLocation(loc);
        setSelectedHazard(null);
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

  // Render Contamination Hazards
  const renderHazards = (customHazards = null) => {
    if (!map.current) return;

    // 1. Clean up existing hazard DOM markers
    hazardMarkersRef.current.forEach((m) => m.remove());
    hazardMarkersRef.current = [];

    // When Hazard Heatmap is toggled ON, hide all discrete hazard shapes (points, lines, polygons)
    const isHazardHeatActive = showHazardHeatmapRef.current ?? showHazardHeatmap;
    const shouldShow = (showHazardsRef.current ?? showHazards) && !isHazardHeatActive;
    const currentHazards = customHazards || hazards;
    hazardsRef.current = currentHazards;

    // 2. Render Point hazard DOM markers (Persistent across style changes just like water sources!)
    if (shouldShow) {
      const pointHazards = currentHazards.filter(
        (h) => (h.geometry_type || "Point") === "Point" && h.coordinates
      );

      pointHazards.forEach((h) => {
        const coords = Array.isArray(h.coordinates[0]) ? h.coordinates[0] : h.coordinates;
        if (!coords || coords.length < 2) return;

        const isHigh = (h.risk_level || "high").toLowerCase() === "high";
        const isMed = (h.risk_level || "").toLowerCase() === "medium";
        const color = isHigh ? "#dc2626" : isMed ? "#ea580c" : "#16a34a";

        const el = document.createElement("div");
        el.className = "custom-hazard-marker cursor-pointer group flex flex-col items-center pointer-events-auto";
        el.innerHTML = `
          <div class="transition-transform duration-200 ease-out group-hover:scale-125 origin-center flex-shrink-0" style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="station-zoom-label hidden pointer-events-none mt-1 px-2 py-0.5 rounded-md bg-white/95 text-slate-900 text-[10px] font-bold shadow-md whitespace-nowrap border border-slate-300 text-center max-w-[160px] truncate">
            ${h.name}
          </div>
        `;

        // Single-click: Show details
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (drawingModeRef.current !== "none") return;
          const nearest = findNearestStation(coords, "Point", locationsRef.current || locations);
          setSelectedHazard({
            ...h,
            coordinates: coords,
            geometry_type: "Point",
            nearestStation: nearest,
          });
          setSelectedLocation(null);
        });

        // Double-click: Show details and zoom in using configured value
        el.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (drawingModeRef.current !== "none") return;
          const nearest = findNearestStation(coords, "Point", locationsRef.current || locations);
          setSelectedHazard({
            ...h,
            coordinates: coords,
            geometry_type: "Point",
            nearestStation: nearest,
          });
          setSelectedLocation(null);
          if (map.current) {
            map.current.flyTo({
              center: coords,
              zoom: DOUBLE_CLICK_ZOOM,
              duration: 1000,
            });
          }
        });

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords)
          .addTo(map.current);

        hazardMarkersRef.current.push(marker);
      });
    }

    // 3. Render GeoJSON layers for River (LineString) & Farmland (Polygon)
    if (!map.current.isStyleLoaded()) {
      map.current.once("style.load", () => renderHazards());
      return;
    }

    const sourceId = "staff-hazards-source";
    const polyFillId = "staff-hazards-polygon-fill";
    const polyLineId = "staff-hazards-polygon-line";
    const riverCasingId = "staff-hazards-river-casing";
    const riverLineId = "staff-hazards-river-line";

    const layerIds = [polyFillId, polyLineId, riverCasingId, riverLineId];

    if (!shouldShow) {
      layerIds.forEach((id) => {
        if (map.current.getLayer(id)) map.current.removeLayer(id);
      });
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    // Filter only non-point geometries for GeoJSON layers
    const geoHazards = currentHazards.filter(
      (h) => (h.geometry_type || "Point") !== "Point" && h.coordinates
    );

    const features = geoHazards.map((h) => ({
      type: "Feature",
      id: h.id,
      geometry: {
        type: h.geometry_type,
        coordinates: h.coordinates,
      },
      properties: {
        id: h.id,
        name: h.name,
        hazard_type: h.hazard_type,
        risk_level: h.risk_level || "high",
        barangay: h.barangay || "",
        notes: h.notes || "",
      },
    }));

    const geojson = { type: "FeatureCollection", features };

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });
    } else {
      map.current.getSource(sourceId).setData(geojson);
    }

    // Polygon Fill
    if (!map.current.getLayer(polyFillId)) {
      map.current.addLayer({
        id: polyFillId,
        type: "fill",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "match",
            ["get", "hazard_type"],
            "agricultural_land", "#16a34a",
            "farmland", "#22c55e",
            "#eab308"
          ],
          "fill-opacity": 0.35,
        },
      });
    }

    // Polygon Outline
    if (!map.current.getLayer(polyLineId)) {
      map.current.addLayer({
        id: polyLineId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": "#15803d",
          "line-width": 2.5,
          "line-dasharray": [2, 2],
        },
      });
    }

    // River Casing
    if (!map.current.getLayer(riverCasingId)) {
      map.current.addLayer({
        id: riverCasingId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#ffffff",
          "line-width": 5.5,
          "line-opacity": 0.8,
        },
      });
    }

    // River Line
    if (!map.current.getLayer(riverLineId)) {
      map.current.addLayer({
        id: riverLineId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#0284c7",
          "line-width": 3.5,
        },
      });
    }

    // Click & hover listeners for river & polygon hazards
    if (!map.current._hazardListenersAttached) {
      map.current._hazardListenersAttached = true;

      // Single-click: Show details
      const onHazardClick = (e) => {
        if (drawingModeRef.current !== "none") return;
        if (!e.features || !e.features.length) return;
        const feat = e.features[0];
        const props = feat.properties;
        const geom = feat.geometry;

        const nearest = findNearestStation(geom.coordinates, geom.type, locationsRef.current || locations);

        setSelectedHazard({
          ...props,
          coordinates: geom.coordinates,
          geometry_type: geom.type,
          nearestStation: nearest,
        });
        setSelectedLocation(null);
      };

      // Double-click: Show details and zoom in using configured value
      const onHazardDblClick = (e) => {
        if (drawingModeRef.current !== "none") return;
        if (!e.features || !e.features.length) return;
        if (e.preventDefault) e.preventDefault();

        const feat = e.features[0];
        const props = feat.properties;
        const geom = feat.geometry;

        const nearest = findNearestStation(geom.coordinates, geom.type, locationsRef.current || locations);

        setSelectedHazard({
          ...props,
          coordinates: geom.coordinates,
          geometry_type: geom.type,
          nearestStation: nearest,
        });
        setSelectedLocation(null);

        if (map.current) {
          map.current.flyTo({
            center: [e.lngLat.lng, e.lngLat.lat],
            zoom: DOUBLE_CLICK_ZOOM,
            duration: 1000,
          });
        }
      };

      map.current.on("click", riverLineId, onHazardClick);
      map.current.on("click", polyFillId, onHazardClick);
      map.current.on("dblclick", riverLineId, onHazardDblClick);
      map.current.on("dblclick", polyFillId, onHazardDblClick);

      const onHazardEnter = () => {
        if (drawingModeRef.current === "none") {
          map.current.getCanvas().style.cursor = "pointer";
        }
      };
      const onHazardLeave = () => {
        if (drawingModeRef.current === "none") {
          map.current.getCanvas().style.cursor = "";
        }
      };

      map.current.on("mouseenter", riverLineId, onHazardEnter);
      map.current.on("mouseleave", riverLineId, onHazardLeave);
      map.current.on("mouseenter", polyFillId, onHazardEnter);
      map.current.on("mouseleave", polyFillId, onHazardLeave);
    }

    // Ensure all layer visibilities are synchronized and trigger immediate canvas redraw
    layerIds.forEach((id) => {
      if (map.current.getLayer(id)) {
        map.current.setLayoutProperty(id, "visibility", shouldShow ? "visible" : "none");
      }
    });
    map.current.triggerRepaint();
  };

  const renderHazardsRef = useRef(renderHazards);
  renderHazardsRef.current = renderHazards;

  // Render Temporary Live Drawing Layers
  const updateTempDrawingSource = (coords, mode, isFinished = false) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = "temp-drawing-source";
    const lineId = "temp-drawing-line";
    const polyId = "temp-drawing-poly";
    const pointsId = "temp-drawing-points";

    if (!coords || coords.length === 0 || mode === "none") {
      if (map.current.getLayer(pointsId)) map.current.removeLayer(pointsId);
      if (map.current.getLayer(lineId)) map.current.removeLayer(lineId);
      if (map.current.getLayer(polyId)) map.current.removeLayer(polyId);
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    let features = [];

    // Points for all vertices
    coords.forEach((c) => {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: c },
        properties: {},
      });
    });

    // Connecting line (if finished as a polygon, close the line back to starting vertex)
    if (coords.length >= 2) {
      const lineCoords =
        mode === "Polygon" && coords.length >= 3 && isFinished
          ? [...coords, coords[0]]
          : coords;
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: lineCoords },
        properties: {},
      });
    }

    // Shaded polygon preview if mode is Polygon and >= 3 points
    if (mode === "Polygon" && coords.length >= 3) {
      const closed = [...coords, coords[0]];
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [closed] },
        properties: {},
      });
    }

    const geojson = { type: "FeatureCollection", features };

    if (map.current.getSource(sourceId)) {
      map.current.getSource(sourceId).setData(geojson);
    } else {
      map.current.addSource(sourceId, { type: "geojson", data: geojson });

      map.current.addLayer({
        id: polyId,
        type: "fill",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": "#f59e0b",
          "fill-opacity": 0.25,
        },
      });

      map.current.addLayer({
        id: lineId,
        type: "line",
        source: sourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#f59e0b",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });

      map.current.addLayer({
        id: pointsId,
        type: "circle",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 6,
          "circle-color": "#f59e0b",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
    }
  };

  // Live Semi-Transparent Guide Line Layer
  const guideSourceId = "temp-drawing-guide-source";
  const guideLineId = "temp-drawing-guide-line";
  const guidePointId = "temp-drawing-guide-point";

  const clearGuideSource = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    if (map.current.getSource(guideSourceId)) {
      map.current.getSource(guideSourceId).setData({
        type: "FeatureCollection",
        features: [],
      });
    }
  };

  const updateGuideSource = (mouseCoord, isNearStart = false) => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const mode = drawingModeRef.current;
    const coords = drawCoordsRef.current;

    if (mode === "none" || !coords || coords.length === 0 || !mouseCoord) {
      clearGuideSource();
      return;
    }

    const target = isNearStart ? coords[0] : mouseCoord;
    const features = [];

    // Single semi-transparent guide line from last clicked point to current cursor position
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [coords[coords.length - 1], target],
      },
      properties: {},
    });

    if (!isNearStart) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: target },
        properties: {},
      });
    }

    const geojson = { type: "FeatureCollection", features };

    if (map.current.getSource(guideSourceId)) {
      map.current.getSource(guideSourceId).setData(geojson);
    } else {
      map.current.addSource(guideSourceId, {
        type: "geojson",
        data: geojson,
      });

      // Semi-transparent dashed guide line before click
      map.current.addLayer({
        id: guideLineId,
        type: "line",
        source: guideSourceId,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": "#f59e0b",
          "line-width": 2.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.7,
        },
      });

      // Cursor position subtle dot
      map.current.addLayer({
        id: guidePointId,
        type: "circle",
        source: guideSourceId,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": "#f59e0b",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.8,
        },
      });
    }
  };

  // Map Initialization
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [124.8240, 10.1650], // Centered across Batuan water sources and San Isidro hazards
      zoom: 14.5,
      pitch: 20,
    });

    mapInstance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapInstance.addControl(new mapboxgl.FullscreenControl(), "top-right");

    // Mouse movement handler for live drawing guide line
    mapInstance.on("mousemove", (e) => {
      mousePosRef.current = [e.lngLat.lng, e.lngLat.lat];
      const mode = drawingModeRef.current;
      const coords = drawCoordsRef.current;

      if (mode === "none" || !coords || coords.length === 0) {
        clearGuideSource();
        return;
      }

      let isNearStart = false;
      if (mode === "Polygon" && coords.length >= 3) {
        const startScreen = mapInstance.project(coords[0]);
        const dx = e.point.x - startScreen.x;
        const dy = e.point.y - startScreen.y;
        if (Math.hypot(dx, dy) <= 22) {
          isNearStart = true;
        }
      }

      if (isNearStart) {
        mapInstance.getCanvas().style.cursor = "pointer";
      } else {
        mapInstance.getCanvas().style.cursor = "crosshair";
      }

      updateGuideSource([e.lngLat.lng, e.lngLat.lat], isNearStart);
    });

    mapInstance.on("mouseout", () => {
      mousePosRef.current = null;
      clearGuideSource();
    });

    // Click handler on map canvas for Participatory GIS drawing
    mapInstance.on("click", (e) => {
      const mode = drawingModeRef.current;
      if (mode === "none") return;

      const clickCoord = [e.lngLat.lng, e.lngLat.lat];

      if (mode === "Point") {
        setDrawCoords([clickCoord]);
        setRedoCoords([]);
        updateTempDrawingSource([clickCoord], "Point");
        clearGuideSource();
        setShowSaveModal(true);
      } else if (mode === "Polygon") {
        const currentCoords = drawCoordsRef.current;

        // If clicked on or near the starting point when 3+ vertices exist -> Finish & connect!
        if (currentCoords.length >= 3) {
          const startScreen = mapInstance.project(currentCoords[0]);
          const dx = e.point.x - startScreen.x;
          const dy = e.point.y - startScreen.y;
          if (Math.hypot(dx, dy) <= 22) {
            if (finishDrawingRef.current) {
              finishDrawingRef.current();
            }
            return;
          }
        }

        const next = [...currentCoords, clickCoord];
        setDrawCoords(next);
        setRedoCoords([]);
        updateTempDrawingSource(next, mode);
        updateGuideSource(clickCoord, false);
      } else if (mode === "LineString") {
        const next = [...drawCoordsRef.current, clickCoord];
        setDrawCoords(next);
        setRedoCoords([]);
        updateTempDrawingSource(next, mode);
        updateGuideSource(clickCoord, false);
      }
    });

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
      renderHeatmap();
      renderMarkers();
      renderHazards();
      if (drawingModeRef.current !== "none" && drawCoordsRef.current.length > 0) {
        updateTempDrawingSource(drawCoordsRef.current, drawingModeRef.current);
      }
    };

    mapInstance.on("zoom", checkZoomLabels);
    mapInstance.on("load", reRenderAll);
    mapInstance.on("style.load", reRenderAll);

    // Automatically resize map whenever container dimensions change (window resize, sidebar toggle, UI updates)
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
      hazardMarkersRef.current.forEach((m) => m.remove());
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  const currentStyleRef = useRef(mapStyle);

  // Dynamic Style Change with reliable layer re-addition
  useEffect(() => {
    if (!map.current) return;
    if (currentStyleRef.current !== mapStyle) {
      currentStyleRef.current = mapStyle;
      map.current.setStyle(mapStyle, { diff: false });

      const reAddLayers = () => {
        if (!map.current) return;
        renderHeatmaps();
        renderMarkers();
        renderHazards();
      };

      map.current.once("style.load", reAddLayers);
      map.current.once("idle", reAddLayers);
    }
  }, [mapStyle, hazards, showHazards, showHazardHeatmap, showWaterHeatmap, showMarkers]);

  // Cursor handling and layout sync according to drawing mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = drawingMode !== "none" ? "crosshair" : "";
    map.current.resize();
  }, [drawingMode]);

  // Sync dual model-driven heatmaps
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderHeatmaps();
      renderMarkers();
      renderHazards();
    }
  }, [showHazardHeatmap, showWaterHeatmap, hazardHeatmapData, waterHeatmapData]);

  useEffect(() => {
    renderMarkers();
  }, [locations, showMarkers, showWaterHeatmap, searchQuery, selectedBarangay]);

  useEffect(() => {
    if (!map.current) return;
    if (map.current.isStyleLoaded()) {
      renderHazards(hazards);
    } else {
      map.current.once("style.load", () => renderHazards(hazards));
    }
  }, [hazards, showHazards, showHazardHeatmap]);

  // Start Drawing Mode
  const startDrawing = (mode) => {
    setSelectedLocation(null);
    setSelectedHazard(null);
    setDrawingMode(mode);
    setDrawCoords([]);
    setRedoCoords([]);
    updateTempDrawingSource([], "none");
    clearGuideSource();

    if (map.current) {
      // Flatten pitch to 0 for orthographic top-down precision while drawing
      map.current.easeTo({ pitch: 0, duration: 250 });
      map.current.resize();
    }

    const defaultType =
      mode === "Point" ? "latrine" : mode === "LineString" ? "river" : "agricultural_land";

    setHazardForm((prev) => ({
      ...prev,
      name: "",
      hazard_type: defaultType,
      risk_level: mode === "Point" ? "high" : "medium",
      notes: "",
    }));
  };

  // Cancel Drawing Session completely
  const cancelDrawing = () => {
    setDrawingMode("none");
    setDrawCoords([]);
    setRedoCoords([]);
    setShowSaveModal(false);
    updateTempDrawingSource([], "none");
    clearGuideSource();

    if (map.current) {
      map.current.easeTo({ pitch: 20, duration: 250 });
      map.current.resize();
    }
  };
  cancelDrawingRef.current = cancelDrawing;

  // Dismiss save modal without discarding the drawn shape
  const handleCancelSaveModal = () => {
    setShowSaveModal(false);
    // Un-close the polygon visually so the user can continue drawing or make adjustments
    updateTempDrawingSource(drawCoordsRef.current, drawingModeRef.current, false);
    if (mousePosRef.current) {
      updateGuideSource(mousePosRef.current, false);
    }
  };

  // Undo last plotted vertex
  const handleUndo = () => {
    if (drawingModeRef.current === "none" || drawCoordsRef.current.length === 0) return;
    const current = drawCoordsRef.current;
    const last = current[current.length - 1];
    const next = current.slice(0, -1);

    setDrawCoords(next);
    setRedoCoords((prev) => [...prev, last]);

    updateTempDrawingSource(next, drawingModeRef.current, false);
    if (next.length > 0 && mousePosRef.current) {
      updateGuideSource(mousePosRef.current, false);
    } else {
      clearGuideSource();
    }
  };

  // Redo previously undone vertex
  const handleRedo = () => {
    if (drawingModeRef.current === "none" || redoCoordsRef.current.length === 0) return;
    const currentRedo = redoCoordsRef.current;
    const nextCoord = currentRedo[currentRedo.length - 1];
    const newRedo = currentRedo.slice(0, -1);

    const nextCoords = [...drawCoordsRef.current, nextCoord];
    setDrawCoords(nextCoords);
    setRedoCoords(newRedo);

    updateTempDrawingSource(nextCoords, drawingModeRef.current, false);
    if (mousePosRef.current) {
      updateGuideSource(mousePosRef.current, false);
    }
  };

  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  // Global Keyboard Shortcuts for Drawing (Enter to finish shape, Ctrl+Z for Undo, Ctrl+Y for Redo, Esc to cancel)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (drawingModeRef.current === "none") return;
      // Do not intercept keystrokes while typing in form inputs, textareas, or selects
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isCtrlOrMeta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoRef.current?.();
        } else {
          handleUndoRef.current?.();
        }
      } else if (isCtrlOrMeta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedoRef.current?.();
      } else if (e.key === "Enter") {
        if (!showSaveModalRef.current) {
          e.preventDefault();
          finishDrawingRef.current?.();
        }
      } else if (e.key === "Escape") {
        if (!showSaveModalRef.current) {
          e.preventDefault();
          cancelDrawingRef.current?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Complete Line or Polygon Drawing
  const finishDrawing = () => {
    const mode = drawingModeRef.current;
    const coords = drawCoordsRef.current;

    if (mode === "LineString" && coords.length < 2) {
      alert("Please click at least 2 points on the map to define the river/waterway path.");
      return;
    }
    if (mode === "Polygon" && coords.length < 3) {
      alert("Please click at least 3 points on the map to outline the agricultural area.");
      return;
    }

    clearGuideSource();

    // Visually close the polygon connecting line on the map
    if (mode === "Polygon" && coords.length >= 3) {
      updateTempDrawingSource(coords, "Polygon", true);
    }

    setShowSaveModal(true);
  };

  finishDrawingRef.current = finishDrawing;

  // Save Contamination Hazard to Backend
  const handleSaveHazard = async (e) => {
    e.preventDefault();
    if (!hazardForm.name.trim()) {
      alert("Please enter a name or description for this hazard.");
      return;
    }

    try {
      setIsSavingHazard(true);

      let finalCoords;
      if (drawingMode === "Point") {
        finalCoords = drawCoords[0];
      } else if (drawingMode === "LineString") {
        finalCoords = drawCoords;
      } else if (drawingMode === "Polygon") {
        // Ensure closed ring for polygon
        const ring = [...drawCoords];
        if (
          ring[0][0] !== ring[ring.length - 1][0] ||
          ring[0][1] !== ring[ring.length - 1][1]
        ) {
          ring.push(ring[0]);
        }
        finalCoords = [ring];
      }

      const payload = {
        name: hazardForm.name.trim(),
        hazard_type: hazardForm.hazard_type,
        geometry_type: drawingMode,
        coordinates: finalCoords,
        barangay: hazardForm.barangay || "Batuan",
        risk_level: hazardForm.risk_level,
        notes: hazardForm.notes.trim() || null,
      };

      const res = await fetch(`${API_URL}/hazards`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || "Failed to save hazard");
      }

      // Successfully saved
      cancelDrawing();
      const freshHazards = await fetchData();
      if (freshHazards && map.current) {
        renderHazards(freshHazards);
      }
    } catch (err) {
      console.error("Error saving hazard:", err);
      alert(`Could not save hazard: ${err.message}`);
    } finally {
      setIsSavingHazard(false);
    }
  };

  // Delete Hazard
  const handleDeleteHazard = async (id) => {
    if (!window.confirm("Are you sure you want to remove this contamination hazard?")) return;
    try {
      const res = await fetch(`${API_URL}/hazards/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to delete hazard");

      setSelectedHazard(null);
      const freshHazards = await fetchData();
      if (freshHazards && map.current) {
        renderHazards(freshHazards);
      }
    } catch (err) {
      console.error("Error deleting hazard:", err);
      alert(`Could not delete hazard: ${err.message}`);
    }
  };

  const barangays = Array.from(new Set(locations.map((l) => l.barangay).filter(Boolean))).sort();

  return (
    <div className="h-[calc(100vh-110px)] sm:h-[calc(100vh-140px)] flex flex-col relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm font-sans">
      {/* Top Controls */}
      <div className="bg-white p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4 z-10 shadow-sm">
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xs sm:text-sm text-slate-900 truncate">Field Surveillance & Risk Map</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              GIS v2.0
            </span>
          </div>
          <button
            onClick={fetchData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
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

          <select
            value={selectedBarangay}
            onChange={(e) => {
              const b = e.target.value;
              setSelectedBarangay(b);
              if (b !== "all" && map.current) {
                const bLocs = locations.filter((l) => l.barangay?.toLowerCase() === b.toLowerCase() && l.latitude && l.longitude);
                const bHaz = hazards.filter((h) => h.barangay?.toLowerCase() === b.toLowerCase() && h.coordinates);
                if (bLocs.length > 0) {
                  const avgLat = bLocs.reduce((sum, l) => sum + l.latitude, 0) / bLocs.length;
                  const avgLng = bLocs.reduce((sum, l) => sum + l.longitude, 0) / bLocs.length;
                  map.current.flyTo({ center: [avgLng, avgLat], zoom: 15, duration: 1200 });
                } else if (bHaz.length > 0) {
                  const coord = bHaz[0].coordinates;
                  const lng = Array.isArray(coord[0]) ? coord[0][0] : coord[0];
                  const lat = Array.isArray(coord[0]) ? coord[0][1] : coord[1];
                  map.current.flyTo({ center: [lng, lat], zoom: 15.5, duration: 1200 });
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

          {/* Hazard Heatmap Toggle */}
          <button
            onClick={() => {
              const next = !showHazardHeatmap;
              setShowHazardHeatmap(next);
              showHazardHeatmapRef.current = next;
              renderHeatmaps();
              renderHazards();
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${
              showHazardHeatmap
                ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle Continuous Hazard Heatmap (Hides discrete hazard points, lines & polygons)"
          >
            <Flame size={13} className={showHazardHeatmap ? "text-white" : "text-amber-500"} />
            <span>Hazard Heatmap</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                showHazardHeatmap ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {showHazardHeatmap ? "ON" : "OFF"}
            </span>
          </button>

          {/* Water Contamination Heatmap Toggle */}
          <button
            onClick={() => {
              const next = !showWaterHeatmap;
              setShowWaterHeatmap(next);
              showWaterHeatmapRef.current = next;
              renderHeatmaps();
              renderMarkers();
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${
              showWaterHeatmap
                ? "bg-rose-600 text-white border-rose-700 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle Water Contamination Heatmap (Hides discrete water pins)"
          >
            <Droplets size={13} className={showWaterHeatmap ? "text-white" : "text-rose-500"} />
            <span>Contamination Heatmap</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                showWaterHeatmap ? "bg-rose-800 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
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

          {/* Contamination Hazards Toggle */}
          <button
            onClick={() => setShowHazards(!showHazards)}
            disabled={showHazardHeatmap}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${
              showHazardHeatmap
                ? "bg-slate-100 text-slate-400 border-slate-200 opacity-60 cursor-not-allowed"
                : showHazards
                ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            title={showHazardHeatmap ? "Hazard shapes hidden while Hazard Heatmap is active" : "Toggle Contamination Hazards"}
          >
            {showHazards && !showHazardHeatmap ? <Eye size={13} className="text-amber-600" /> : <EyeOff size={13} className="text-slate-400" />}
            <span>Hazards</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                showHazards && !showHazardHeatmap ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {showHazardHeatmap ? "HEAT" : showHazards ? `${hazards.length}` : "OFF"}
            </span>
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

        {/* Participatory GIS Inspector Action Banner while drawing (Floating Overlay) */}
        {drawingMode !== "none" && (
          <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs z-30 shadow-md animate-fade-in font-medium">
            <div className="flex items-center gap-2">
              <span className="animate-pulse flex h-2 w-2 rounded-full bg-white" />
              {drawingMode === "Point" && (
                <span>📍 <strong>Point Mode:</strong> Click anywhere on the map to place a Pit Latrine or Septic Tank.</span>
              )}
              {drawingMode === "LineString" && (
                <span>〰️ <strong>River/Stream Mode:</strong> Click along the waterway path ({drawCoords.length} points plotted).</span>
              )}
              {drawingMode === "Polygon" && (
                <span>⬡ <strong>Agricultural Land Mode:</strong> Click vertices around the farmland boundary ({drawCoords.length} vertices plotted).</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleUndo}
                disabled={drawCoords.length === 0}
                className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-1 text-[11px] shadow-xs"
                title="Undo last vertex (Ctrl+Z)"
              >
                <Undo2 size={13} />
                <span className="hidden sm:inline">Undo</span>
              </button>
              <button
                onClick={handleRedo}
                disabled={redoCoords.length === 0}
                className="px-2.5 py-1 bg-amber-600/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all flex items-center gap-1 text-[11px] shadow-xs"
                title="Redo vertex (Ctrl+Y)"
              >
                <Redo2 size={13} />
                <span className="hidden sm:inline">Redo</span>
              </button>
              {(drawingMode === "LineString" || drawingMode === "Polygon") && (
                <button
                  onClick={finishDrawing}
                  disabled={(drawingMode === "LineString" && drawCoords.length < 2) || (drawingMode === "Polygon" && drawCoords.length < 3)}
                  className="px-3 py-1 bg-white text-amber-900 rounded-lg font-bold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all flex items-center gap-1.5"
                  title="Finish shape and save (Press Enter)"
                >
                  <span>Finish Shape</span>
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-950 text-[10px] rounded font-mono font-bold border border-amber-300">
                    ↵ Enter
                  </kbd>
                </button>
              )}
              <button
                onClick={cancelDrawing}
                className="px-2.5 py-1 bg-amber-700/60 hover:bg-amber-700 text-white rounded-lg font-medium transition-all text-[11px]"
                title="Discard drawing session (Press Esc)"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Map Style Selector Overlay */}
        <div className={`absolute ${drawingMode !== "none" ? "top-14 sm:top-14" : "top-3 sm:top-4"} left-3 sm:left-4 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-1 text-[11px] sm:text-xs font-sans transition-all`}>
          <div className="px-1 text-slate-700">
            <Layers size={15} />
          </div>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/streets-v12")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${mapStyle === "mapbox://styles/mapbox/streets-v12"
              ? "bg-[#0f3b82] text-white shadow-sm"
              : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
              }`}
          >
            Streets
          </button>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/satellite-streets-v12")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${mapStyle === "mapbox://styles/mapbox/satellite-streets-v12"
              ? "bg-[#0f3b82] text-white shadow-sm"
              : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
              }`}
          >
            Satellite
          </button>
          <button
            onClick={() => setMapStyle("mapbox://styles/mapbox/light-v11")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer ${mapStyle === "mapbox://styles/mapbox/light-v11"
              ? "bg-[#0f3b82] text-white shadow-sm"
              : "text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-50"
              }`}
          >
            Light
          </button>
        </div>

        {/* Inspector Participatory GIS Drawing Toolbar */}
        {canDrawHazards && drawingMode === "none" && (
          <div className="absolute top-14 left-3 sm:top-16 sm:left-4 z-10 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex flex-col gap-1 text-xs">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 border-b border-slate-100">
              <Sparkles size={11} className="text-amber-500" />
              <span>Inspector GIS</span>
            </div>
            <button
              onClick={() => startDrawing("Point")}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left hover:bg-red-50 text-slate-700 hover:text-red-700 transition-colors font-medium text-[11px]"
              title="Add Point Hazard (Pit Latrine, Septic Tank, Piggery)"
            >
              <div className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-[10px]">
                📍
              </div>
              <span>Add Latrine / Tank</span>
            </button>
            <button
              onClick={() => startDrawing("LineString")}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors font-medium text-[11px]"
              title="Trace River, Stream, or Open Drainage line"
            >
              <div className="w-4 h-4 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-[10px]">
                〰️
              </div>
              <span>Trace River / Stream</span>
            </button>
            <button
              onClick={() => startDrawing("Polygon")}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors font-medium text-[11px]"
              title="Draw Polygon around Agricultural Land or Rice Field"
            >
              <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
                ⬡
              </div>
              <span>Map Farmland / Ag</span>
            </button>
          </div>
        )}

        {/* Active Heatmap Legend & Model Status Badge */}
        {(showHazardHeatmap || showWaterHeatmap) && (
          <div className="absolute bottom-4 left-3 sm:bottom-5 sm:left-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-slate-200/90 max-w-[280px] sm:max-w-xs text-xs animate-fade-in space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
              <span className="font-bold text-[11px] text-slate-800 flex items-center gap-1.5">
                <Flame size={13} className="text-amber-500" />
                Continuous Heatmap View
              </span>
              <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Hourly Model
              </span>
            </div>

            {showHazardHeatmap && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
                  <span>Hazard Proximity Field</span>
                  <span className="text-amber-600 text-[9px] font-bold">Shapes Hidden</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-amber-300 via-orange-500 to-red-700" />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Low Buffer</span>
                  <span>Moderate</span>
                  <span>Critical Risk</span>
                </div>
              </div>
            )}

            {showWaterHeatmap && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
                  <span>Water Contamination Risk</span>
                  <span className="text-rose-600 text-[9px] font-bold">Pins Hidden</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-400 via-yellow-400 via-orange-500 to-red-600" />
                <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                  <span>Potable</span>
                  <span>Warning</span>
                  <span>Contaminated</span>
                </div>
              </div>
            )}

            {heatmapMeta?.last_updated && (
              <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-100 flex justify-between items-center">
                <span>Model evaluated:</span>
                <span className="font-semibold text-slate-600">
                  {new Date(heatmapMeta.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Selected Water Location Detail Card */}
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
              {selectedLocation.sample_date && (
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Sample Date & Time:</span>
                  <span className="font-mono text-slate-800 font-medium">
                    {selectedLocation.sample_date} {selectedLocation.sample_time ? `• ${selectedLocation.sample_time}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Selected Contamination Hazard Detail Card */}
        {selectedHazard && (
          <div className="absolute bottom-4 left-4 right-4 sm:top-6 sm:right-6 sm:bottom-auto sm:left-auto sm:w-80 z-20 bg-white/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl border border-amber-200 animate-fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Contamination Hazard</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${selectedHazard.risk_level === "high" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                    }`}>
                    {selectedHazard.risk_level} Risk
                  </span>
                </div>
                <h3 className="font-bold text-base text-slate-900 mt-1">{selectedHazard.name}</h3>
                <p className="text-xs text-slate-500 capitalize">{selectedHazard.hazard_type?.replace(/_/g, " ")} ({selectedHazard.geometry_type})</p>
              </div>
              <button onClick={() => setSelectedHazard(null)} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">
                ✕
              </button>
            </div>

            <div className="py-3 space-y-2 text-xs">
              {selectedHazard.barangay && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Barangay:</span>
                  <span className="font-semibold text-slate-800">{selectedHazard.barangay}</span>
                </div>
              )}

              {/* Nearest Water Station with calculated real-world distance */}
              {selectedHazard.nearestStation ? (
                <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-blue-900">
                    <Droplets size={12} className="text-blue-600" />
                    <span>Nearest Water Source</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate max-w-[170px]">{selectedHazard.nearestStation.station.name}</span>
                    <span className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                      {selectedHazard.nearestStation.distanceMeters}m
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">Used as spatial distance feature in Machine Learning model</p>
                </div>
              ) : null}

              {selectedHazard.notes && (
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-slate-600">Field Notes:</span>
                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                    {selectedHazard.notes}
                  </p>
                </div>
              )}

              {canDrawHazards && (
                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => handleDeleteHazard(selectedHazard.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-semibold text-xs transition-colors"
                  >
                    <Trash2 size={13} />
                    <span>Remove Hazard</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save Hazard Modal Dialog */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  {drawingMode === "Point" ? "📍" : drawingMode === "LineString" ? "〰️" : "⬡"}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Save Contamination Hazard
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Participatory GIS Layer: {drawingMode}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelSaveModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                title="Back to drawing"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHazard} className="py-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Hazard Name / Label *</label>
                <input
                  type="text"
                  required
                  placeholder={
                    drawingMode === "Point"
                      ? "e.g. Purok 1 Pit Latrine #4"
                      : drawingMode === "LineString"
                        ? "e.g. Batuan River North Branch"
                        : "e.g. Bugkanag Rice Field & Farmland"
                  }
                  value={hazardForm.name}
                  onChange={(e) => setHazardForm({ ...hazardForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Hazard Category</label>
                  <select
                    value={hazardForm.hazard_type}
                    onChange={(e) => setHazardForm({ ...hazardForm, hazard_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    {drawingMode === "Point" && (
                      <>
                        <option value="latrine">Pit Latrine</option>
                        <option value="septic_tank">Septic Tank / Cesspool</option>
                        <option value="piggery">Piggery / Animal Waste</option>
                        <option value="unhygienic_toilet">Unhygienic Toilet</option>
                        <option value="dump_site">Open Dump / Waste Site</option>
                      </>
                    )}
                    {drawingMode === "LineString" && (
                      <>
                        <option value="river">Natural River</option>
                        <option value="stream">Stream / Creek</option>
                        <option value="drainage">Open Drainage Canal</option>
                      </>
                    )}
                    {drawingMode === "Polygon" && (
                      <>
                        <option value="agricultural_land">Agricultural Land / Rice Field</option>
                        <option value="farmland">Farmland (Fertilizer/Pesticides)</option>
                        <option value="livestock_pasture">Livestock Grazing Area</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Risk Level</label>
                  <select
                    value={hazardForm.risk_level}
                    onChange={(e) => setHazardForm({ ...hazardForm, risk_level: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  >
                    <option value="high">High Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="low">Low Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Barangay</label>
                <select
                  value={hazardForm.barangay}
                  onChange={(e) => setHazardForm({ ...hazardForm, barangay: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                >
                  <option value="Batuan">Batuan</option>
                  {barangays.filter((b) => b !== "Batuan").map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sanitary Inspector Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional field observation notes (e.g. unlined pit, heavy runoff risk during rainfall)..."
                  value={hazardForm.notes}
                  onChange={(e) => setHazardForm({ ...hazardForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelSaveModal}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHazard}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingHazard ? "Saving..." : "Save Hazard to Map"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterMap;
