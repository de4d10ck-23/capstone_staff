import React, { useEffect, useRef } from "react";
import { 
  MapPin, 
  Calendar, 
  ExternalLink, 
  CheckCircle2, 
  Send, 
  X, 
  Image as ImageIcon,
  Compass,
  AlertCircle
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

const extractImage = (r) => {
  if (!r) return null;
  if (r.image_url) return r.image_url;
  if (r.photo_url) return r.photo_url;
  if (r.description) {
    const match = r.description.match(/\[(?:Attached )?Photo Proof:\s*(https?:\/\/[^\s\]]+)\]/i)
      || r.description.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i);
    if (match) return match[1];
  }
  return null;
};

const getDisplayDescription = (r) => {
  if (!r) return "";
  if (r.clean_description) return r.clean_description;
  if (r.description) {
    return r.description.replace(/\[(?:Attached )?Photo Proof:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();
  }
  return "";
};

const ReportDetailModal = ({ 
  report, 
  onClose, 
  onUpdateStatus, 
  onOpenRejectModal,
  actionLoading,
  isStaff = true 
}) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  const hasCoords = report && (report.latitude || report.longitude);
  const lat = parseFloat(report?.latitude) || 10.1330;
  const lng = parseFloat(report?.longitude) || 124.8700;
  const photoUrl = extractImage(report);
  const displayDescription = getDisplayDescription(report);

  useEffect(() => {
    if (!report || !mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: hasCoords ? 15 : 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    // Custom glowing marker
    const el = document.createElement("div");
    el.className = "flex flex-col items-center group";
    el.innerHTML = `
      <div class="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-lg mb-1 whitespace-nowrap border border-cyan-400 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
        <span>${report.title || "Water Source"}</span>
      </div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(map.current);

    // Resize map when modal transition finishes
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
  }, [report, lat, lng, hasCoords]);

  if (!report) return null;

  const isPending = !report.status || report.status === "pending";
  const isValidated = report.status === "validated";
  const isEscalated = report.status === "escalated";
  const isRejected = report.status === "rejected" || report.status === "dismissed";
  const isBusy = actionLoading === report.id;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative space-y-6 max-h-[92vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {(report.type || report.category || "Concern").replace(/_/g, " ")}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isPending
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : isValidated
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  : isEscalated
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200"
              }`}>
                {isEscalated
                  ? "Passed to CHU"
                  : isValidated
                  ? "Validated"
                  : report.status || "Pending Review"}
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 pt-1">{report.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close details"
          >
            <X size={18} />
          </button>
        </div>

        {/* Location & Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Barangay Jurisdiction</p>
              <p className="font-bold text-slate-800 text-sm">Barangay {report.barangay}</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center flex-shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Submitted</p>
              <p className="font-semibold text-slate-800">
                {report.created_at ? new Date(report.created_at).toLocaleString() : "Recent"}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Mapbox Section */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Compass size={16} className="text-blue-600" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Water Source Geographic Location (Mapbox)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors"
              >
                <ExternalLink size={12} />
                <span>Google Maps</span>
              </a>
            </div>
          </div>

          <div className="relative w-full h-64 rounded-2xl overflow-hidden border border-slate-300 shadow-inner">
            <div ref={mapContainer} className="w-full h-full" />
            <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-mono shadow-md border border-white/15 pointer-events-none flex items-center gap-2 z-10">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Exact Coordinates Pinpoint</span>
            </div>
          </div>
        </div>

        {/* Detailed Description */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
            Concern Description
          </label>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
            {displayDescription || report.description}
          </div>
        </div>

        {/* Reason / Notes if present */}
        {report.reason && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-700" />
              <span>Barangay Official Note / Dismissal Reason:</span>
            </p>
            <p>{report.reason}</p>
          </div>
        )}

        {/* Image Proof Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <ImageIcon size={16} className="text-blue-600" />
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Attached Photo Proof
              </label>
            </div>
            {photoUrl && (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink size={12} />
                <span>Open Full Resolution</span>
              </a>
            )}
          </div>

          {photoUrl ? (
            <div className="w-full max-h-72 overflow-hidden rounded-2xl border border-slate-200 bg-slate-950/5 flex items-center justify-center p-2">
              <img
                src={photoUrl}
                alt="Water Source Proof"
                className="max-h-68 w-auto rounded-xl object-contain shadow-sm"
              />
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
              No attached photo proof was submitted with this concern.
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>

          {isStaff && (
            <div className="flex items-center gap-2">
              {/* If Pending: Validate Button */}
              {isPending && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(report.id, "validated")}
                  disabled={isBusy}
                  className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 size={14} />
                  <span>Validate Report</span>
                </button>
              )}

              {/* If Validated: Pass to CHU Button */}
              {isValidated && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(report.id, "escalated", true)}
                  disabled={isBusy}
                  className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-pulse"
                >
                  <Send size={14} />
                  <span>Pass to CHU</span>
                </button>
              )}

              {/* If Escalated: Show active badge */}
              {isEscalated && (
                <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-purple-50 text-purple-700 font-semibold text-xs border border-purple-200">
                  <CheckCircle2 size={13} />
                  <span>Passed to CHU ✓</span>
                </span>
              )}

              {/* Dismiss Button */}
              {!isEscalated && !isRejected && (
                <button
                  type="button"
                  onClick={() => onOpenRejectModal(report.id)}
                  disabled={isBusy}
                  className="px-4 py-2.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Dismiss Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportDetailModal;
