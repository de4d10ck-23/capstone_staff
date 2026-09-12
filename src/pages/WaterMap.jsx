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
  Sparkles
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { findNearestStation, haversineDistance } from "../utils/geoCircle";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1IjoicmFsZDEyMDEwMiIsImEiOiJjbWttZGNyaWgwY3h3M2xzZmIwZ3VhYnM3In0.xkubwGBDjYnc41XB_7FT1g";

// ============================================================================
// ZOOM THRESHOLD FOR NAMES & LABELS
// Change this single number to adjust when hazard & water station names appear:
// - Higher value (e.g. 15.5, 16.0, 16.5) = user must zoom in closer before names appear
// - Lower value (e.g. 13.5, 14.0) = names appear sooner while zoomed out
// ============================================================================
export const NAME_LABEL_MIN_ZOOM = 18.0;

const WaterMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const { token, API_URL, user } = useAuth();

  const [locations, setLocations] = useState([]);
  const [households, setHouseholds] = useState([]);
  const [hazards, setHazards] = useState([]);

  // Layer Toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showMarkers, setShowMarkers] = useState(true);
  const [showHazards, setShowHazards] = useState(true);

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

  const canDrawHazards = ["admin", "sanitization_inspector", "city_health_officer", "barangay_official"].includes(user?.role);

  // Fetch all map data including contamination hazards
  const fetchData = async () => {
    try {
      setLoading(true);
      const [locRes, houseRes, hazRes] = await Promise.all([
        fetch(`${API_URL}/water-locations`),
        fetch(`${API_URL}/households/spatial`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_URL}/hazards`)
      ]);

      const locData = await locRes.json();
      const houseData = await houseRes.json();
      const hazData = await hazRes.json();

      if (locData.success && Array.isArray(locData.data)) setLocations(locData.data);
      if (houseData.success && Array.isArray(houseData.data)) setHouseholds(houseData.data);
      if (hazData.success && Array.isArray(hazData.data)) setHazards(hazData.data);
    } catch (err) {
      console.error("Error fetching staff map data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, API_URL]);

  // Heatmap rendering
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

  const renderHeatmapRef = useRef(renderHeatmap);
  renderHeatmapRef.current = renderHeatmap;

  // Render Water Station Markers
  const renderMarkers = () => {
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

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedLocation(loc);
        setSelectedHazard(null);
        map.current.flyTo({
          center: [loc.longitude, loc.latitude],
          zoom: 18,
          duration: 1000
        });
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map.current);

      markersRef.current.push(marker);
    });
  };

  const renderMarkersRef = useRef(renderMarkers);
  renderMarkersRef.current = renderMarkers;

  // Render Contamination Hazards GeoJSON Layers
  const renderHazards = () => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const sourceId = "staff-hazards-source";
    const polyFillId = "staff-hazards-polygon-fill";
    const polyLineId = "staff-hazards-polygon-line";
    const riverCasingId = "staff-hazards-river-casing";
    const riverLineId = "staff-hazards-river-line";
    const pointCircleId = "staff-hazards-point-circle";
    const pointLabelId = "staff-hazards-point-label";

    // Clean up any legacy glow layer
    if (map.current.getLayer("staff-hazards-point-glow")) map.current.removeLayer("staff-hazards-point-glow");

    const layerIds = [polyFillId, polyLineId, riverCasingId, riverLineId, pointCircleId, pointLabelId];

    if (!showHazards) {
      layerIds.forEach((id) => {
        if (map.current.getLayer(id)) map.current.removeLayer(id);
      });
      if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);
      return;
    }

    const features = hazards.map((h) => {
      const geomType = h.geometry_type || "Point";
      return {
        type: "Feature",
        id: h.id,
        geometry: {
          type: geomType,
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
      };
    });

    const geojson = { type: "FeatureCollection", features };

    if (!map.current.getSource(sourceId)) {
      map.current.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });
    } else {
      map.current.getSource(sourceId).setData(geojson);
    }

    // 1. Polygon Fill (Farmland / Ag land)
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

    // 2. Polygon Outline
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

    // 3. River / Stream Casing
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

    // 4. River / Stream Line
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

    // 5. Point Circles (Clean solid circle with crisp white border)
    if (!map.current.getLayer(pointCircleId)) {
      map.current.addLayer({
        id: pointCircleId,
        type: "circle",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            8, 7,
            12, 9,
            16, 12
          ],
          "circle-color": [
            "match",
            ["get", "risk_level"],
            "high", "#dc2626",
            "medium", "#ea580c",
            "#16a34a"
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    // 6. Hazard Text Label (Appears automatically only when zoom >= NAME_LABEL_MIN_ZOOM)
    if (!map.current.getLayer(pointLabelId)) {
      map.current.addLayer({
        id: pointLabelId,
        type: "symbol",
        source: sourceId,
        filter: ["==", ["geometry-type"], "Point"],
        minzoom: NAME_LABEL_MIN_ZOOM,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#000000",
          "text-halo-color": "#ffffff",
          "text-halo-width": 3,
        },
      });
    }

    // Click & hover listeners on hazards
    if (!map.current._hazardListenersAttached) {
      map.current._hazardListenersAttached = true;

      const onHazardClick = (e) => {
        if (drawingModeRef.current !== "none") return;
        if (!e.features || !e.features.length) return;
        const feat = e.features[0];
        const props = feat.properties;
        const geom = feat.geometry;

        const nearest = findNearestStation(geom.coordinates, geom.type, locations);

        setSelectedHazard({
          ...props,
          coordinates: geom.coordinates,
          geometry_type: geom.type,
          nearestStation: nearest,
        });
        setSelectedLocation(null);

        const center = geom.type === "Point"
          ? geom.coordinates
          : [e.lngLat.lng, e.lngLat.lat];

        map.current.flyTo({
          center: center,
          zoom: 18,
          duration: 1000,
        });
      };

      map.current.on("click", pointCircleId, onHazardClick);
      map.current.on("click", riverLineId, onHazardClick);
      map.current.on("click", polyFillId, onHazardClick);

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

      map.current.on("mouseenter", pointCircleId, onHazardEnter);
      map.current.on("mouseleave", pointCircleId, onHazardLeave);
      map.current.on("mouseenter", riverLineId, onHazardEnter);
      map.current.on("mouseleave", riverLineId, onHazardLeave);
      map.current.on("mouseenter", polyFillId, onHazardEnter);
      map.current.on("mouseleave", polyFillId, onHazardLeave);
    }
  };

  const renderHazardsRef = useRef(renderHazards);
  renderHazardsRef.current = renderHazards;

  // Render Temporary Live Drawing Layers
  const updateTempDrawingSource = (coords, mode) => {
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

    // Connecting line
    if (coords.length >= 2) {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
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

  // Map Initialization
  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [124.8200, 10.1570], // Centered on Batuan water sources
      zoom: 14.2,
      pitch: 20,
    });

    mapInstance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapInstance.addControl(new mapboxgl.FullscreenControl(), "top-right");

    // Click handler on map canvas for Participatory GIS drawing
    mapInstance.on("click", (e) => {
      const mode = drawingModeRef.current;
      if (mode === "none") return;

      const clickCoord = [e.lngLat.lng, e.lngLat.lat];

      if (mode === "Point") {
        setDrawCoords([clickCoord]);
        updateTempDrawingSource([clickCoord], "Point");
        setShowSaveModal(true);
      } else if (mode === "LineString" || mode === "Polygon") {
        const next = [...drawCoordsRef.current, clickCoord];
        setDrawCoords(next);
        updateTempDrawingSource(next, mode);
      }
    });

    const checkZoomLabels = () => {
      if (!mapContainer.current) return;
      if (mapInstance.getZoom() >= NAME_LABEL_MIN_ZOOM) {
        mapContainer.current.classList.add("show-zoom-labels");
      } else {
        mapContainer.current.classList.remove("show-zoom-labels");
      }
    };

    mapInstance.on("zoom", checkZoomLabels);
    mapInstance.on("load", checkZoomLabels);

    mapInstance.on("style.load", () => {
      checkZoomLabels();
      renderHeatmapRef.current?.();
      renderMarkersRef.current?.();
      renderHazardsRef.current?.();
    });

    map.current = mapInstance;

    return () => {
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
        renderHeatmap();
        renderMarkers();
        renderHazards();
      };

      map.current.once("style.load", reAddLayers);
      map.current.once("idle", reAddLayers);
    }
  }, [mapStyle, hazards, households, showHazards, showHeatmap, showMarkers]);

  // Cursor handling according to drawing mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = drawingMode !== "none" ? "crosshair" : "";
  }, [drawingMode]);

  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderHeatmap();
    }
  }, [households, showHeatmap]);

  useEffect(() => {
    renderMarkers();
  }, [locations, showMarkers, searchQuery, selectedBarangay]);


  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      renderHazards();
    }
  }, [hazards, showHazards]);

  // Start Drawing Mode
  const startDrawing = (mode) => {
    setSelectedLocation(null);
    setSelectedHazard(null);
    setDrawingMode(mode);
    setDrawCoords([]);
    updateTempDrawingSource([], "none");

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

  // Cancel Drawing
  const cancelDrawing = () => {
    setDrawingMode("none");
    setDrawCoords([]);
    setShowSaveModal(false);
    updateTempDrawingSource([], "none");
  };

  // Complete Line or Polygon Drawing
  const finishDrawing = () => {
    if (drawingMode === "LineString" && drawCoords.length < 2) {
      alert("Please click at least 2 points on the map to define the river/waterway path.");
      return;
    }
    if (drawingMode === "Polygon" && drawCoords.length < 3) {
      alert("Please click at least 3 points on the map to outline the agricultural area.");
      return;
    }
    setShowSaveModal(true);
  };

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
      await fetchData();
      cancelDrawing();
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
      await fetchData();
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

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all ${showHeatmap ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200"
              }`}
          >
            {showHeatmap ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Heatmap</span>
          </button>

          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all ${showMarkers ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-slate-500 border-slate-200"
              }`}
          >
            {showMarkers ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>Pins ({locations.length})</span>
          </button>


          {/* Contamination Hazards Toggle & Locator */}
          <button
            onClick={() => {
              if (!showHazards) {
                setShowHazards(true);
                if (hazards.length > 0 && map.current) {
                  const h0 = hazards[0];
                  if (h0.coordinates) {
                    const c = Array.isArray(h0.coordinates[0]) ? h0.coordinates[0] : h0.coordinates;
                    map.current.flyTo({ center: [c[0], c[1]], zoom: 18, duration: 1200 });
                  }
                }
              } else {
                if (hazards.length > 0 && map.current) {
                  const h0 = hazards[0];
                  if (h0.coordinates) {
                    const c = Array.isArray(h0.coordinates[0]) ? h0.coordinates[0] : h0.coordinates;
                    map.current.flyTo({ center: [c[0], c[1]], zoom: 18, duration: 1000 });
                  }
                }
              }
            }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-full font-semibold border flex items-center gap-1.5 text-[11px] sm:text-xs transition-all cursor-pointer ${showHazards ? "bg-amber-50 text-amber-800 border-amber-300 shadow-xs" : "bg-white text-slate-500 border-slate-200"
              }`}
            title="Click to toggle or fly directly to Contamination Hazards"
          >
            <AlertOctagon size={13} className={showHazards ? "text-amber-600" : "text-slate-400"} />
            <span>Hazards</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${showHazards ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-500"
              }`}>
              {showHazards ? `${hazards.length}` : "OFF"}
            </span>
          </button>
        </div>
      </div>

      {/* Participatory GIS Inspector Action Banner while drawing */}
      {drawingMode !== "none" && (
        <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-xs z-20 shadow-md animate-fade-in font-medium">
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

          <div className="flex items-center gap-2">
            {(drawingMode === "LineString" || drawingMode === "Polygon") && (
              <button
                onClick={finishDrawing}
                disabled={(drawingMode === "LineString" && drawCoords.length < 2) || (drawingMode === "Polygon" && drawCoords.length < 3)}
                className="px-3 py-1 bg-white text-amber-900 rounded-lg font-bold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-all"
              >
                Finish Shape
              </button>
            )}
            <button
              onClick={cancelDrawing}
              className="px-3 py-1 bg-amber-700/60 hover:bg-amber-700 text-white rounded-lg font-medium transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map Canvas */}
      <div className="flex-1 relative">
        <style>{`
          .show-zoom-labels .station-zoom-label {
            display: block !important;
          }
        `}</style>
        <div ref={mapContainer} className="w-full h-full" />

        {/* Map Style Selector Overlay */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-2xl shadow-lg border border-slate-200/80 flex items-center gap-1 text-[11px] sm:text-xs font-sans">
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
                onClick={cancelDrawing}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
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
                  onClick={cancelDrawing}
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
