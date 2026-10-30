import useReportRefresh from "../hooks/useReportRefresh";
import { notifyReportQueueChanged } from '../utils/reportQueueEvents';
import ErrorNotice from "../components/ErrorNotice";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Check, 
  MapPin, 
  RefreshCw, 
  Search, 
  Filter, 
  FileText, 
  Eye, 
  Activity, 
  Droplets, 
  X, 
  Calendar, 
  CheckCheck, 
  ExternalLink,
  Loader2,
  Navigation
} from "lucide-react";
import { Link } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

const categoryTitle = (category) => ({
  request_inspection: "Water Inspection Request",
  water_quality: "Water Quality Concern",
  broken_pipe: "Damaged / Broken Pipeline",
  toilet_proximity: "Unhygienic Toilet Proximity",
  unregistered_source: "Unregistered Water Source",
  new_source: "New Water Source",
  other: "Other Concern",
}[category] || (category || "Inspection Request").replace(/_/g, " "));

const extractPhoto = (item) => {
  if (!item) return null;
  if (item.image_url) return item.image_url;
  if (item.photo_url) return item.photo_url;
  if (item.description) {
    const match = item.description.match(/\[(?:Attached )?Photo Proof:\s*([^\]]+)\]/i)
      || item.description.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i);
    if (match) return match[1].trim();
  }
  return null;
};

const cleanDescription = (item) => {
  if (!item) return "";
  const raw = item.clean_description || item.description || "";
  return raw
    .replace(/\[(?:Attached )?Photo Proof:[^\]]*\]/gi, "")
    .replace(/\[Inspected Source:[^\]]*\]\s*/gi, "")
    .trim();
};

const InspectionRequests = () => {
  const { user, token, API_URL } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Default status is 'pending' (Pending Review), default barangay is 'all' (All Barangays)
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [selectedBarangay, setSelectedBarangay] = useState("all");

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // View Modal state
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [showDismissForm, setShowDismissForm] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [matchedWaterSource, setMatchedWaterSource] = useState(null);

  // Image preview in modal
  const [previewPhoto, setPreviewPhoto] = useState(null);

  // Mapbox refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  const isInspector = ["sanitization_inspector", "admin"].includes(user?.role);

  const fetchInspections = async (showLoading = false) => {
    try {
      if (showLoading === true) setLoading(true);
      const res = await fetch(`${API_URL}/inspections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Unable to load CHU reports.");
      if (Array.isArray(data.data)) {
        setInspections(data.data.map((item) => ({
          ...item,
          title: item.resident_report?.title || "Inspection request",
          category: item.resident_report?.type || "request_inspection",
          description: item.resident_report?.description || item.description,
        })));
      }
    } catch (err) {
      setErrorMsg(err.message || "Unable to load CHU reports.");
      console.error("Error fetching inspections:", err);
    } finally {
      setLoading(false);
    }
  };

  useReportRefresh(fetchInspections, API_URL, token);

  // Open View Modal for an inspection ticket
  const handleOpenView = async (inspection) => {
    setShowDismissForm(false);
    setDismissReason("");
    setErrorMsg("");
    setSelectedInspection(inspection);
    setSelectedLocationId(inspection.location_id || "");
    setMatchedWaterSource(null);
    setPreviewPhoto(null);

    // Fetch water sources to identify the resident's selected water source
    try {
      const url = inspection.barangay 
        ? `${API_URL}/water-locations?barangay=${encodeURIComponent(inspection.barangay)}`
        : `${API_URL}/water-locations`;
      const res = await fetch(url);
      const data = await res.json();
      
      let locs = [];
      if (data.success && Array.isArray(data.data)) {
        locs = data.data;
      }

      // Resolve the fixed water source selected by resident
      let found = null;

      // 1. Direct location_id match
      if (inspection.location_id) {
        found = locs.find((l) => String(l.id) === String(inspection.location_id));
      }

      // 2. ID embedded in description: (ID: <uuid>)
      if (!found && inspection.description) {
        const idMatch = inspection.description.match(/\(ID:\s*([a-f0-9\-]+)\)/i);
        if (idMatch) {
          found = locs.find((l) => String(l.id) === String(idMatch[1]));
        }
      }

      if (found) {
        setMatchedWaterSource(found);
        setSelectedLocationId(found.id);

      }
    } catch (err) {
      console.error("Error fetching water sources for barangay:", err);
    }
  };

  // Close View Modal and teardown map
  const handleCloseView = () => {
    setSelectedInspection(null);
    setSelectedLocationId("");
    setMatchedWaterSource(null);
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
  };

  // Initialize Mapbox map inside View modal
  useEffect(() => {
    if (!selectedInspection || !mapContainer.current) return;

    const lat = parseFloat(selectedInspection.latitude) || 10.1330;
    const lng = parseFloat(selectedInspection.longitude) || 124.8700;
    const hasSpecificCoords = Boolean(selectedInspection.latitude && selectedInspection.longitude);

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [lng, lat],
      zoom: hasSpecificCoords ? 15 : 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const markerEl = document.createElement("div");
    markerEl.className = "flex flex-col items-center";
    markerEl.innerHTML = `
      <div class="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-lg mb-1 whitespace-nowrap border border-cyan-400 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
        <span>Brgy. ${selectedInspection.barangay || "Water Point"}</span>
      </div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map.current);

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
      }
    };
  }, [selectedInspection]);

  // Action: Transition ticket from Pending Review to Processing (in_progress)
  const handleSetProcessing = async () => {
    if (!selectedInspection || isUpdating || ["completed", "cancelled"].includes(selectedInspection.status)) return;
    setIsUpdating(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/inspections/${selectedInspection.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "in_progress"
        })
      });

      const data = await res.json();
      if (data.success) {
        notifyReportQueueChanged();
        setSuccessMsg(`Report is now Processing. Mark it Done when processing is complete.`);
        setSelectedInspection({
          ...selectedInspection,
          ...data.data
        });
        fetchInspections();
      } else {
        setErrorMsg(data.detail || "Failed to update status to Processing.");
      }
    } catch (err) {
      console.error("Error setting status to processing:", err);
      setErrorMsg("Network error updating status.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Completing a ticket updates only report processing status.
  const handleMarkDone = async () => {
    if (!selectedInspection || selectedInspection.status !== "in_progress" || isUpdating) return;
    setIsUpdating(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/inspections/${selectedInspection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Could not mark the report Done.");
      setSuccessMsg("Report marked Done.");
      notifyReportQueueChanged();
      handleCloseView();
      fetchInspections();
    } catch (err) {
      setErrorMsg(err.message || "Could not complete the report. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDismissInspection = async () => {
    if (!selectedInspection || isUpdating || !dismissReason.trim()) return;
    setIsUpdating(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch(`${API_URL}/inspections/${selectedInspection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "cancelled", notes: [selectedInspection.notes, `Dismissal reason: ${dismissReason.trim()}`].filter(Boolean).join("\n\n") }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Could not dismiss the inspection.");
      setSuccessMsg("Inspection dismissed. The linked resident report has been updated.");
      notifyReportQueueChanged();
      handleCloseView();
      fetchInspections();
    } catch (err) {
      setErrorMsg(err.message || "Could not dismiss the inspection. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Status counts (respecting the selected barangay)
  const barangayScoped = inspections.filter(
    (i) => selectedBarangay === "all" || i.barangay?.toLowerCase() === selectedBarangay.toLowerCase()
  );
  const statusCounts = {
    pending: barangayScoped.filter((i) => !i.status || ["pending", "assigned"].includes(i.status)).length,
    in_progress: barangayScoped.filter((i) => i.status === "in_progress").length,
    completed: barangayScoped.filter((i) => i.status === "completed" || i.status === "done").length,
    cancelled: barangayScoped.filter((i) => i.status === "cancelled").length,
    all: barangayScoped.length,
  };

  const statusTabs = [
    { key: "pending", label: "Pending Review", active: "bg-amber-600 text-white shadow-sm", badgeActive: "bg-amber-800/40 text-white", badge: "bg-amber-100 text-amber-800" },
    { key: "in_progress", label: "Processing", active: "bg-blue-600 text-white shadow-sm", badgeActive: "bg-blue-800/40 text-white", badge: "bg-blue-100 text-blue-800" },
    { key: "completed", label: "Done", active: "bg-emerald-600 text-white shadow-sm", badgeActive: "bg-emerald-800/40 text-white", badge: "bg-emerald-100 text-emerald-800" },
    { key: "cancelled", label: "Dismissed", active: "bg-slate-600 text-white", badgeActive: "text-white", badge: "bg-slate-100 text-slate-700" },
    { key: "all", label: "All Reports", active: "bg-slate-800 text-white shadow-sm", badgeActive: "bg-white/20 text-white", badge: "bg-slate-100 text-slate-700" },
  ];

  // Filter inspections based on Status and Barangay
  const filtered = inspections.filter((i) => {
    const matchBarangay = selectedBarangay === "all" || i.barangay?.toLowerCase() === selectedBarangay.toLowerCase();
    
    let matchStatus = true;
    if (selectedStatus === "all") {
      matchStatus = true;
    } else if (selectedStatus === "pending") {
      matchStatus = !i.status || ["pending", "assigned"].includes(i.status);
    } else if (selectedStatus === "in_progress") {
      matchStatus = i.status === "in_progress";
    } else if (selectedStatus === "cancelled") {
      matchStatus = i.status === "cancelled";
    } else if (selectedStatus === "completed") {
      matchStatus = i.status === "completed" || i.status === "done";
    }

    return matchBarangay && matchStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Field Operations & Sampling
          </span>
          <h1 className="text-3xl font-extrabold text-white">CHU Reports & Inspections</h1>
          <p className="text-white/80 text-sm max-w-xl">
            Review forwarded concerns and water sources in one queue. Start Processing, record findings, then mark Done. Status updates are shared with barangay officials and residents.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isInspector && (
            <Link
              to="/generate-reports"
              className="px-4 py-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-xs transition-all shadow flex items-center gap-1.5"
            >
              <FileText size={15} />
              <span>Generate Audit Report</span>
            </Link>
          )}
          <button
            onClick={fetchInspections}
            className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {!selectedInspection && <ErrorNotice error={errorMsg} />}

      {/* Status Filter Tabs (left) + Barangay filter & count (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          {statusTabs.map((tab) => {
            const isActive = selectedStatus === tab.key;
            return (
              <button
                key={tab.key}
                id={`inspection-status-tab-${tab.key}`}
                onClick={() => setSelectedStatus(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive ? tab.active : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? tab.badgeActive : tab.badge}`}>
                  {statusCounts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <div className="text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-900">{filtered.length}</span> active requests
          </div>
          <select
            id="inspection-barangay-filter"
            aria-label="Filter by barangay"
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:border-blue-600 cursor-pointer"
          >
            <option value="all">All Barangays</option>
            {barangays.map((b) => (
              <option key={b} value={b}>Brgy. {b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Inspections Table: No Priority column, and Actions has View button */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Citizen Reports, Endorsements & Water Sources</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Barangay & Source</th>
                <th className="py-3.5 px-6">Reason / Symptoms</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Inspector Lab Findings</th>
                <th className="py-3.5 px-6">Requested Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">Loading inspection tickets...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    No inspection requests found matching current filter ({selectedStatus === "pending" ? "Pending Review" : selectedStatus}).
                  </td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const isCompleted = i.status === "completed" || i.status === "done";
                  const isInProgress = i.status === "in_progress";
                  const isPending = !i.status || ["pending", "assigned"].includes(i.status);

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-sm">{i.title}</p>
                        <p className="text-slate-500 mt-1">Brgy. {i.barangay} | {i.category?.replace(/_/g, " ")}</p>
                        {(i.latitude || i.longitude) && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <MapPin size={10} />
                            <span>GPS: {parseFloat(i.latitude).toFixed(4)}, {parseFloat(i.longitude).toFixed(4)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-700 max-w-xs leading-relaxed font-medium">
                        {cleanDescription(i) || i.description}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : isInProgress
                            ? "bg-cyan-100 text-cyan-800 border border-cyan-200 animate-pulse"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {isInProgress && <Activity size={10} />}
                          {isCompleted && <CheckCircle2 size={10} />}
                          {isPending && <Clock size={10} />}
                          <span>{isCompleted ? "Done" : i.status === "cancelled" ? "Dismissed" : isInProgress ? "Processing" : "Pending Review"}</span>
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-600 max-w-xs">
                        {i.notes ? (
                          <p className="text-slate-800 italic text-[11px] leading-relaxed">
                            "{i.notes}"
                          </p>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No report notes</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-500">
                        {i.created_at ? new Date(i.created_at).toLocaleDateString() : "Recent"}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {["unregistered_source", "new_source"].includes(i.category) && i.resident_report_id && !isCompleted && i.status !== "cancelled" && (
                            <Link to={`/water-sources?view=resident-submissions&report=${encodeURIComponent(i.resident_report_id)}`}
                              className="px-3 py-1.5 rounded-xl bg-cyan-50 text-cyan-800 font-semibold">Review Source</Link>
                          )}
                          <button
                            onClick={() => handleOpenView(i)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye size={13} />
                            <span>View</span>
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

      {/* Comprehensive View Modal with Map, Processing Action, Fixed Water Source & Safety Dropdown */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative animate-fade-in space-y-5 my-8 max-h-[90vh] overflow-y-auto">
            <ErrorNotice error={errorMsg} />
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                    Field Inspection Ticket
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    selectedInspection.status === "completed" || selectedInspection.status === "done"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : selectedInspection.status === "in_progress"
                      ? "bg-cyan-100 text-cyan-800 border border-cyan-200 animate-pulse"
                      : "bg-amber-100 text-amber-800 border border-amber-200"
                  }`}>
                    {selectedInspection.status === "completed" || selectedInspection.status === "done"
                      ? "Done"
                      : selectedInspection.status === "in_progress"
                      ? "Processing"
                      : selectedInspection.status === "cancelled" ? "Dismissed" : "Pending Review"}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Brgy. {selectedInspection.barangay} Inspection
                </h2>
                <p className="text-xs font-semibold text-blue-700">Category: {categoryTitle(selectedInspection.category)}</p>
                {selectedInspection.title && <p className="text-sm font-medium text-slate-800">{selectedInspection.title}</p>}
                <p className="text-xs text-slate-500">
                  Requested on {selectedInspection.created_at ? new Date(selectedInspection.created_at).toLocaleDateString() : "Recent"}
                </p>
              </div>

              <button
                onClick={handleCloseView}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Vertical Stack: Map, Reason/Details, and Form/Pending Review at the Bottom */}
            <div className="space-y-4">
              {/* Inspection Location & Coordinates Map */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <MapPin size={13} className="text-blue-600" />
                    <span>Inspection Location & Coordinates</span>
                  </label>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedInspection.latitude || 10.1330},${selectedInspection.longitude || 124.8700}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Navigation size={12} className="text-blue-600" />
                    <span>Direction</span>
                  </a>
                </div>
                <div className="h-56 w-full rounded-2xl overflow-hidden border border-slate-200 relative shadow-inner">
                  <div ref={mapContainer} className="w-full h-full" />
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1.5">
                  <span>Lat: {parseFloat(selectedInspection.latitude || 10.1330).toFixed(4)}</span>
                  <span>Lng: {parseFloat(selectedInspection.longitude || 124.8700).toFixed(4)}</span>
                  <span className="text-blue-600 font-bold">Maasin City</span>
                </div>
              </div>

              {/* Reason / Symptoms Description */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Reason / Symptoms Reported
                  </span>
                  {extractPhoto(selectedInspection) && (
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(extractPhoto(selectedInspection))}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <ExternalLink size={10} />
                      <span>View Photo Proof</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-800 leading-relaxed font-medium">
                  {cleanDescription(selectedInspection) || selectedInspection.description}
                </p>

                {/* Photo Proof preview if available */}
                {extractPhoto(selectedInspection) && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-3">
                    <img
                      src={extractPhoto(selectedInspection)}
                      alt="Proof"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-xs cursor-pointer hover:opacity-90"
                      onClick={() => setPreviewPhoto(extractPhoto(selectedInspection))}
                    />
                    <div className="text-[11px] text-slate-500">
                      <p className="font-semibold text-slate-700">Citizen / Brgy Photo Proof</p>
                      <p className="text-[10px]">Click image to inspect in full view</p>
                    </div>
                  </div>
                )}
              </div>

              {["in_progress", "completed", "done"].includes(selectedInspection.status) && (
                <div className="space-y-3">
                  {/* Fixed Water Source Station based on resident selection */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Droplets size={13} className="text-blue-600" />
                        <span>Water Source Station</span>
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        Selected Source
                      </span>
                    </label>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900 text-xs">
                          {matchedWaterSource?.full_name || matchedWaterSource?.name || "No registered source selected"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                          <span>Brgy. {selectedInspection.barangay}</span>
                          {(matchedWaterSource?.latitude || selectedInspection.latitude) && (
                            <>
                              <span>•</span>
                              <span>
                                GPS: {parseFloat(matchedWaterSource?.latitude || selectedInspection.latitude).toFixed(4)}, {parseFloat(matchedWaterSource?.longitude || selectedInspection.longitude).toFixed(4)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {matchedWaterSource?.status && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          matchedWaterSource.status === "safe"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : matchedWaterSource.status === "warning" || matchedWaterSource.status === "needs_chlorination"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : matchedWaterSource.status === "undrinkable" || matchedWaterSource.status === "contaminated"
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          Current: {matchedWaterSource.status}
                        </span>
                      )}
                    </div>
                  </div>


                </div>
              )}
              {isInspector && !["completed", "done", "cancelled"].includes(selectedInspection.status) && (
                <div className="flex gap-2">
                  {selectedInspection.status === "in_progress" ? (
                    <button type="button" onClick={handleMarkDone} disabled={isUpdating}
                      className="flex-1 h-10 px-3 rounded-full border border-transparent bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <CheckCheck size={14} /> {isUpdating ? "Updating..." : "Done"}
                    </button>
                  ) : (
                    <button type="button" onClick={handleSetProcessing} disabled={isUpdating}
                      className="flex-1 h-10 px-3 rounded-full border border-transparent bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Activity size={14} /> {isUpdating ? "Updating..." : "Start Inspection"}
                    </button>
                  )}
                  <button type="button" disabled={isUpdating} onClick={() => setShowDismissForm(true)}
                    className="flex-1 h-10 px-3 rounded-full border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                    <X size={14} /> Dismiss Inspection
                  </button>
                </div>
              )}
              {isInspector && !["completed", "done", "cancelled"].includes(selectedInspection.status) && (
                <div className="space-y-3">
                  {showDismissForm && <>
                    <label htmlFor="inspection-dismiss-reason" className="block text-xs font-semibold text-slate-700">Reason for dismissal</label>
                    <textarea id="inspection-dismiss-reason" rows={2} value={dismissReason}
                      disabled={isUpdating} onChange={(event) => setDismissReason(event.target.value)}
                      placeholder="Explain why this inspection is being dismissed..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:outline-none focus:border-red-400" />
                    <div className="flex gap-2">
                      <button type="button" disabled={isUpdating} onClick={() => setShowDismissForm(false)}
                        className="flex-1 rounded-full border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 disabled:opacity-50">Back</button>
                      <button type="button" disabled={isUpdating || !dismissReason.trim()} onClick={handleDismissInspection}
                        className="flex-1 rounded-full bg-red-600 hover:bg-red-700 py-2.5 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        {isUpdating ? "Dismissing..." : "Confirm Dismissal"}
                      </button>
                    </div>
                  </>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Proof Modal */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-3xl overflow-hidden p-2" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} alt="Photo Proof" className="w-full max-h-[80vh] object-contain rounded-2xl" />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/90 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionRequests;
