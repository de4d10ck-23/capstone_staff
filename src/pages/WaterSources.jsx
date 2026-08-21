import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  Droplets, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  AlertTriangle,
  XCircle,
  Clock,
  Crosshair,
  Loader2,
  Compass
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

const WaterSources = () => {
  const { token, API_URL, user } = useAuth();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    source_type: "deep_well",
    barangay: "Combado",
    latitude: 10.1330,
    longitude: 124.8700,
    status: "safe",
    e_coli_count: 0,
    coliform_count: 0,
    bacteriological_exam: "passed",
    description: ""
  });

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSources = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/water-locations`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSources(data.data);
      }
    } catch (err) {
      console.error("Error fetching water sources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [API_URL]);

  const handleOpenModal = (sourceToEdit = null) => {
    setErrorMsg("");
    setSuccessMsg("");
    if (sourceToEdit) {
      setEditingSource(sourceToEdit);
      setFormData({
        name: sourceToEdit.name || sourceToEdit.full_name || "",
        source_type: sourceToEdit.source_type || "deep_well",
        barangay: sourceToEdit.barangay || "Combado",
        latitude: sourceToEdit.latitude || 10.1330,
        longitude: sourceToEdit.longitude || 124.8700,
        status: sourceToEdit.status || "safe",
        e_coli_count: sourceToEdit.e_coli_count || 0,
        coliform_count: sourceToEdit.coliform_count || 0,
        bacteriological_exam: sourceToEdit.bacteriological_exam || "passed",
        description: sourceToEdit.description || sourceToEdit.notes || ""
      });
    } else {
      setEditingSource(null);
      setFormData({
        name: "",
        source_type: "deep_well",
        barangay: "Combado",
        latitude: 10.1330,
        longitude: 124.8700,
        status: "safe",
        e_coli_count: 0,
        coliform_count: 0,
        bacteriological_exam: "passed",
        description: ""
      });
    }
    setIsModalOpen(true);
  };

  // Initialize Mapbox map inside modal
  useEffect(() => {
    if (!isModalOpen || !mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialLat = parseFloat(formData.latitude) || 10.1330;
    const initialLng = parseFloat(formData.longitude) || 124.8700;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initialLng, initialLat],
      zoom: 15,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const el = document.createElement("div");
    el.className = "flex flex-col items-center group cursor-grab";
    el.innerHTML = `
      <div class="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-md mb-1 whitespace-nowrap border border-cyan-400">
        ${formData.name || "Water Station"}
      </div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([initialLng, initialLat])
      .addTo(map.current);

    marker.current.on("dragend", () => {
      const lngLat = marker.current.getLngLat();
      setFormData((prev) => ({
        ...prev,
        latitude: parseFloat(lngLat.lat.toFixed(6)),
        longitude: parseFloat(lngLat.lng.toFixed(6)),
      }));
    });

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      marker.current.setLngLat([lng, lat]);
      setFormData((prev) => ({
        ...prev,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6)),
      }));
    });

    const timer = setTimeout(() => {
      if (map.current) {
        map.current.resize();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (map.current) {
        map.current.remove();
        map.current = null;
        marker.current = null;
      }
    };
  }, [isModalOpen]);

  // Use Current Location Handler
  const handleUseCurrentLocation = () => {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your web browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = parseFloat(position.coords.latitude.toFixed(6));
        const lng = parseFloat(position.coords.longitude.toFixed(6));

        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        if (map.current) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: 16,
            essential: true,
          });
        }
        if (marker.current) {
          marker.current.setLngLat([lng, lat]);
        }
        setLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocating(false);
        if (error.code === 1) {
          setGeoError("Location access denied. Please allow GPS permission in your browser or click on the map to pinpoint.");
        } else {
          setGeoError("Unable to acquire your current location. Please pinpoint the location on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleManualCoordChange = (field, val) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      const lat = field === "latitude" ? parseFloat(val) : parseFloat(prev.latitude);
      const lng = field === "longitude" ? parseFloat(val) : parseFloat(prev.longitude);
      if (!isNaN(lat) && !isNaN(lng) && marker.current && map.current) {
        marker.current.setLngLat([lng, lat]);
        map.current.flyTo({ center: [lng, lat], zoom: 15 });
      }
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const url = editingSource
        ? `${API_URL}/water-locations/${editingSource.id}`
        : `${API_URL}/water-locations`;
      const method = editingSource ? "PUT" : "POST";

      const payload = {
        name: formData.name.trim(),
        full_name: formData.name.trim(),
        source_type: formData.source_type,
        barangay: formData.barangay,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        status: formData.status,
        e_coli_count: parseInt(formData.e_coli_count) || 0,
        coliform_count: parseInt(formData.coliform_count) || 0,
        e_coli: (parseInt(formData.e_coli_count) || 0) > 0,
        coliform_bacteria: (parseInt(formData.coliform_count) || 0) > 0,
        bacteriological_exam: formData.bacteriological_exam || (formData.status === "safe" ? "passed" : "failed"),
        description: formData.description.trim(),
        notes: formData.description.trim()
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(editingSource ? "Water station updated successfully!" : "New water station registered!");
        setIsModalOpen(false);
        fetchSources();
      } else {
        setErrorMsg(data.detail || "Failed to save water station.");
      }
    } catch (err) {
      console.error("Error saving water source:", err);
      setErrorMsg("Network error saving water source.");
    }
  };

  const handleDelete = async (sourceId) => {
    if (!window.confirm("Are you sure you want to permanently delete this water station?")) return;

    try {
      const res = await fetch(`${API_URL}/water-locations/${sourceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Water station removed.");
        fetchSources();
      } else {
        setErrorMsg(data.detail || "Failed to delete station.");
      }
    } catch (err) {
      console.error("Error deleting water station:", err);
    }
  };

  const filteredSources = sources.filter((s) => {
    const matchQuery = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       s.barangay?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBarangay = selectedBarangay === "all" || s.barangay === selectedBarangay;
    const matchStatus = selectedStatus === "all" || s.status?.toLowerCase() === selectedStatus.toLowerCase();
    return matchQuery && matchBarangay && matchStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Water Sources Registry</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage tested water stations, wells, taps, and laboratory metrics</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
        >
          <Plus size={16} />
          <span>Register New Station</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search station or barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Barangay:</span>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="safe">Safe Only</option>
              <option value="warning">Warning Level</option>
              <option value="undrinkable">Contaminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Station Name</th>
                <th className="py-3.5 px-6">Barangay</th>
                <th className="py-3.5 px-6">Source Type</th>
                <th className="py-3.5 px-6">Safety Status</th>
                <th className="py-3.5 px-6">Lab Metrics (E.Coli / Coliform)</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">Loading water stations...</td>
                </tr>
              ) : filteredSources.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">No water sources found matching query.</td>
                </tr>
              ) : (
                filteredSources.map((s) => {
                  const isSafe = s.status?.toLowerCase() === "safe";
                  const isWarning = s.status?.toLowerCase() === "warning";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        {s.name || s.full_name}
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={13} className="text-slate-400" />
                          <span>Brgy. {s.barangay}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 capitalize text-slate-600">
                        {s.source_type?.replace(/_/g, " ") || "Water Station"}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isSafe 
                            ? "bg-emerald-100 text-emerald-800" 
                            : isWarning 
                            ? "bg-amber-100 text-amber-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {isSafe ? <ShieldCheck size={12} /> : isWarning ? <AlertTriangle size={12} /> : <XCircle size={12} />}
                          <span>{s.status || "Unknown"}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-700">
                        <span className="font-mono">{s.e_coli_count ?? 0} CFU</span> / <span className="font-mono">{s.coliform_count ?? 0} MPN</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenModal(s)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Edit Station"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Station"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Water Source Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-fade-in max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {editingSource ? "Edit Water Station" : "Register Water Station"}
            </h2>
            <p className="text-xs text-slate-500 mb-5">Inspect, locate on Mapbox, and update water point parameters and laboratory metrics</p>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Station / Source Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Purok 3 Deep Well Spring"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Source Type</label>
                  <select
                    value={formData.source_type}
                    onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="deep_well">Deep Well</option>
                    <option value="spring">Natural Spring</option>
                    <option value="piped_tap">Piped Municipal Tap</option>
                    <option value="refilling_station">Refilling Station</option>
                    <option value="shallow_well">Shallow Well</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Barangay</label>
                  <select
                    value={formData.barangay}
                    onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {barangays.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mapbox Interactive Pinpoint & Use Current Location */}
              <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-blue-200 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Compass size={16} className="text-blue-600" />
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Station Location (Mapbox Pinpoint)
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Click the map or drag the pin to set exact coordinates.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 flex-shrink-0"
                  >
                    {locating ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Acquiring GPS...</span>
                      </>
                    ) : (
                      <>
                        <Crosshair size={14} />
                        <span>Use Current Location</span>
                      </>
                    )}
                  </button>
                </div>

                {geoError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                    <span>{geoError}</span>
                  </div>
                )}

                {/* Map View */}
                <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-300 shadow-md">
                  <div ref={mapContainer} className="w-full h-full" />
                  <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-mono shadow-md border border-white/10 pointer-events-none flex items-center gap-2 z-10">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>
                      Lat: {parseFloat(formData.latitude || 0).toFixed(6)} | Lng: {parseFloat(formData.longitude || 0).toFixed(6)}
                    </span>
                  </div>
                </div>

                {/* Manual Coordinate Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Latitude (GPS)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={(e) => handleManualCoordChange("latitude", e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Longitude (GPS)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={(e) => handleManualCoordChange("longitude", e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Safety Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="safe">Safe</option>
                    <option value="warning">Warning Level</option>
                    <option value="undrinkable">Contaminated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">E. Coli (CFU/100ml)</label>
                  <input
                    type="number"
                    value={formData.e_coli_count}
                    onChange={(e) => setFormData({ ...formData, e_coli_count: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Coliform (MPN/100ml)</label>
                  <input
                    type="number"
                    value={formData.coliform_count}
                    onChange={(e) => setFormData({ ...formData, coliform_count: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Inspection Notes / Details</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Sanitation conditions, pipe integrity, chlorination notes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-md cursor-pointer"
                >
                  {editingSource ? "Save Changes" : "Register Station"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterSources;
