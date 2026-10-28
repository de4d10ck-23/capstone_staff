import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Compass, AlertCircle } from "lucide-react";

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_KEY ||
  "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

const DEFAULT_CENTER = { lat: 10.133, lng: 124.87 };

const STATUS_COLORS = {
  safe: "#10b981",
  warning: "#f59e0b",
  contaminated: "#ef4444",
  undrinkable: "#ef4444",
  unknown: "#64748b",
};

/**
 * Station Location Mapbox Pinpoint Component
 * Matching the exact UI from the Station Location specification.
 */
const LocationPickerMap = ({ value, onChange, waterSources = [], accent = "blue" }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const markerLabelRef = useRef(null);
  const sourceMarkersRef = useRef([]);
  const onChangeRef = useRef(onChange);

  const [geoError, setGeoError] = useState("");

  // Keep latest onChange in ref to prevent stale closures
  onChangeRef.current = onChange;

  const currentLat = value?.latitude != null ? value.latitude : DEFAULT_CENTER.lat;
  const currentLng = value?.longitude != null ? value.longitude : DEFAULT_CENTER.lng;

  const [latInput, setLatInput] = useState(
    value?.latitude != null ? String(value.latitude) : String(DEFAULT_CENTER.lat)
  );
  const [lngInput, setLngInput] = useState(
    value?.longitude != null ? String(value.longitude) : String(DEFAULT_CENTER.lng)
  );

  // Sync inputs when external value changes
  useEffect(() => {
    if (value?.latitude != null) {
      setLatInput(String(value.latitude));
    }
    if (value?.longitude != null) {
      setLngInput(String(value.longitude));
    }
  }, [value?.latitude, value?.longitude]);

  // Update floating label on marker
  const stationName = value?.locationName || "Water Station";
  useEffect(() => {
    if (markerLabelRef.current) {
      markerLabelRef.current.textContent = stationName;
    }
  }, [stationName]);

  // Initialize Mapbox map
  useEffect(() => {
    if (!mapContainer.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initLat = parseFloat(currentLat) || DEFAULT_CENTER.lat;
    const initLng = parseFloat(currentLng) || DEFAULT_CENTER.lng;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [initLng, initLat],
      zoom: 14,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Custom Glowing Pin matching the screenshot
    const el = document.createElement("div");
    el.className = "relative flex items-center justify-center cursor-grab group";
    el.style.width = "34px";
    el.style.height = "34px";

    const labelDiv = document.createElement("div");
    labelDiv.className =
      "absolute bottom-full mb-2 px-3 py-1 rounded-full bg-slate-950 text-white text-[11px] font-bold shadow-lg whitespace-nowrap border border-cyan-400 pointer-events-none";
    labelDiv.textContent = stationName;
    markerLabelRef.current = labelDiv;

    const pinIcon = document.createElement("div");
    pinIcon.className =
      "w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/25 transition-transform duration-150 group-hover:scale-110";
    pinIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;

    el.appendChild(labelDiv);
    el.appendChild(pinIcon);

    marker.current = new mapboxgl.Marker({ element: el, draggable: true, anchor: "center" })
      .setLngLat([initLng, initLat])
      .addTo(map.current);

    marker.current.on("dragend", () => {
      const p = marker.current.getLngLat();
      const newLat = parseFloat(p.lat.toFixed(6));
      const newLng = parseFloat(p.lng.toFixed(6));
      setLatInput(String(newLat));
      setLngInput(String(newLng));
      onChangeRef.current({
        latitude: newLat,
        longitude: newLng,
        locationId: null,
        locationName: null,
      });
    });

    map.current.on("click", (e) => {
      const newLat = parseFloat(e.lngLat.lat.toFixed(6));
      const newLng = parseFloat(e.lngLat.lng.toFixed(6));
      marker.current.setLngLat([newLng, newLat]);
      setLatInput(String(newLat));
      setLngInput(String(newLng));
      onChangeRef.current({
        latitude: newLat,
        longitude: newLng,
        locationId: null,
        locationName: null,
      });
    });

    const timer = setTimeout(() => {
      if (map.current) map.current.resize();
    }, 250);

    return () => {
      clearTimeout(timer);
      if (map.current) {
        map.current.remove();
        map.current = null;
        marker.current = null;
        markerLabelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position and flyTo when external coords change
  useEffect(() => {
    if (!map.current || !marker.current) return;
    const lat = parseFloat(value?.latitude);
    const lng = parseFloat(value?.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      marker.current.setLngLat([lng, lat]);
      map.current.easeTo({ center: [lng, lat], zoom: Math.max(map.current.getZoom(), 14), duration: 400 });
    }
  }, [value?.latitude, value?.longitude]);

  // Display other registered water sources as clickable points on the map
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    sourceMarkersRef.current.forEach((sm) => {
      sm._popup && sm._popup.remove();
      sm.remove();
    });
    sourceMarkersRef.current = [];

    const valid = waterSources.filter(
      (s) => !isNaN(parseFloat(s.latitude)) && !isNaN(parseFloat(s.longitude))
    );

    valid.forEach((src) => {
      const color = STATUS_COLORS[src.status] || STATUS_COLORS.unknown;
      const el = document.createElement("button");
      el.type = "button";
      el.title = `${src.name || "Water Source"} (click to select)`;
      el.style.cssText = `width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 2px ${color}50,0 2px 4px rgba(0,0,0,.25);cursor:pointer;`;

      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const lat = parseFloat(parseFloat(src.latitude).toFixed(6));
        const lng = parseFloat(parseFloat(src.longitude).toFixed(6));
        setLatInput(String(lat));
        setLngInput(String(lng));
        onChangeRef.current({
          latitude: lat,
          longitude: lng,
          locationId: src.id,
          locationName: src.name || "Water Source",
        });
      });

      const lngLat = [parseFloat(src.longitude), parseFloat(src.latitude)];
      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false, closeOnClick: false }).setHTML(
        `<div style="font-size:11px;font-weight:700;color:#0f172a">${src.name || "Water Source"}</div>
         <div style="font-size:10px;color:#64748b;text-transform:capitalize">${(src.status || "unknown").replace(/_/g, " ")}</div>`
      );

      const sm = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(m);
      el.addEventListener("mouseenter", () => popup.setLngLat(lngLat).addTo(m));
      el.addEventListener("mouseleave", () => popup.remove());
      sm._popup = popup;
      sourceMarkersRef.current.push(sm);
    });
  }, [waterSources]);



  const handleManualCoordChange = (field, val) => {
    if (field === "latitude") setLatInput(val);
    if (field === "longitude") setLngInput(val);

    // Check if user pasted a combined "lat, lng" pair
    if (typeof val === "string") {
      const matches = val.match(/[-+]?[0-9]*\.?[0-9]+/g);
      if (matches && matches.length >= 2) {
        const n1 = parseFloat(matches[0]);
        const n2 = parseFloat(matches[1]);
        if (!isNaN(n1) && !isNaN(n2)) {
          let lat = n1;
          let lng = n2;
          if (Math.abs(n1) > 90 && Math.abs(n2) <= 90) {
            lat = n2;
            lng = n1;
          }
          setLatInput(String(lat));
          setLngInput(String(lng));
          if (marker.current) marker.current.setLngLat([lng, lat]);
          if (map.current) map.current.flyTo({ center: [lng, lat], zoom: 15 });
          onChangeRef.current({ latitude: lat, longitude: lng, locationId: null, locationName: null });
          return;
        }
      }
    }

    const lat = field === "latitude" ? parseFloat(val) : parseFloat(latInput);
    const lng = field === "longitude" ? parseFloat(val) : parseFloat(lngInput);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      if (marker.current) marker.current.setLngLat([lng, lat]);
      if (map.current) map.current.flyTo({ center: [lng, lat], zoom: 15 });
      onChangeRef.current({ latitude: lat, longitude: lng, locationId: null, locationName: null });
    }
  };

  const handleCoordPaste = (e, targetField) => {
    const pasteText = e.clipboardData?.getData("text") || "";
    const matches = pasteText.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (matches && matches.length >= 2) {
      e.preventDefault();
      const n1 = parseFloat(matches[0]);
      const n2 = parseFloat(matches[1]);
      if (!isNaN(n1) && !isNaN(n2)) {
        let lat = n1;
        let lng = n2;
        if (Math.abs(n1) > 90 && Math.abs(n2) <= 90) {
          lat = n2;
          lng = n1;
        }
        setLatInput(String(lat));
        setLngInput(String(lng));
        if (marker.current) marker.current.setLngLat([lng, lat]);
        if (map.current) map.current.flyTo({ center: [lng, lat], zoom: 15 });
        onChangeRef.current({ latitude: lat, longitude: lng, locationId: null, locationName: null });
      }
    }
  };

  const displayLat = parseFloat(currentLat || 0).toFixed(6);
  const displayLng = parseFloat(currentLng || 0).toFixed(6);

  return (
    <div className="space-y-4 p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Compass size={18} className="text-blue-600" />
          <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800">
            Station Location (Mapbox Pinpoint)
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Click the map or drag the pin to set exact coordinates.
        </p>
      </div>

      {geoError && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="text-amber-600 flex-shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Map View */}
      <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
        <div ref={mapContainer} className="w-full h-full" />

        {/* Top-left coordinate badge */}
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full text-white text-[11px] font-mono shadow-lg border border-white/10 pointer-events-none flex items-center gap-2 z-10">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
          <span>
            Lat: {displayLat} | Lng: {displayLng}
          </span>
        </div>
      </div>

      {/* Manual Coordinate Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Latitude (GPS)
            </label>
            <span className="text-[10px] text-slate-400">Accepts paste (lat, lng)</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={latInput}
            onChange={(e) => handleManualCoordChange("latitude", e.target.value)}
            onPaste={(e) => handleCoordPaste(e, "latitude")}
            placeholder="e.g. 10.133000"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Longitude (GPS)
            </label>
            <span className="text-[10px] text-slate-400">Accepts paste (lat, lng)</span>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={lngInput}
            onChange={(e) => handleManualCoordChange("longitude", e.target.value)}
            onPaste={(e) => handleCoordPaste(e, "longitude")}
            placeholder="e.g. 124.870000"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
            required
          />
        </div>
      </div>
    </div>
  );
};

export default LocationPickerMap;
