import { historyDate, manilaDate, indexHistory, snapshotForDay, historyFormValues } from "../utils/waterStatusHistory";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { notifyReportQueueChanged } from '../utils/reportQueueEvents';
import ErrorNotice from "../components/ErrorNotice";
import { 
  Droplets, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ArchiveRestore,
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
  Compass,
  Shield,
  History,
  Calendar,
  Info,
  HelpCircle,
  Inbox,
  FileText,
  ExternalLink,
  Eye,
  Check,
  Image as ImageIcon,
  Camera,
  ChevronLeft,
  ChevronRight,
  Upload,
  CheckCircle2,
  Maximize2,
  Layers
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";
import {
  getBarangayFeature,
  getBarangayBounds,
  getBarangayCenter,
  checkBarangayJurisdiction,
  formatBarangayName
} from "../utils/barangayBoundary";

export const parseLocationPhotos = (loc) => {
  if (!loc) return [];
  const raw = loc.image_url || loc.photo_url || loc.photos;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {
        // ignore parse error
      }
    }
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((s) => s.trim()).filter((s) => s.startsWith("http"));
    }
    return [trimmed];
  }
  return [];
};

const extractPhotoProof = (r) => {
  if (!r) return null;
  if (r.image_url) return r.image_url;
  if (r.photo_url) return r.photo_url;
  if (r.description) {
    const match = r.description.match(/\[(?:Attached )?Photo Proof:\s*([^\]]+)\]/i)
      || r.description.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i);
    if (match) return match[1].trim();
  }
  return null;
};

const cleanDesc = (r) => {
  if (!r) return "";
  const raw = r.clean_description || r.description || "";
  return raw
    .replace(/\[(?:Attached\s+)?Photo\s+Proof:?\s*[^\]]+\]/gi, "")
    .replace(/\[Inspected Source:[^\]]+\]\s*/gi, "")
    .replace(/https?:\/\/[^\s\]]+/gi, "")
    .trim();
};

const getSubmissionStatus = (r) => {
  if (!r) return "pending";
  const st = (r.status || "").toLowerCase().trim();
  if (st === "done" || st === "registered" || st === "approved" || st === "resolved" || st === "completed") {
    return "registered";
  }
  if (st === "dismissed" || st === "rejected") {
    return "dismissed";
  }
  return "pending";
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

// Helper to extract clean YYYY-MM-DD from log without UTC conversion shifts
const extractLogDateStr = historyDate;

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return dateStr;
};

// GitHub-Style Activity Calendar Heatmap for Water Source Status Changes (Light Theme with Year Selector)
const WaterStatusHeatmap = ({ 
  history = [], 
  loading = false, 
  currentStatus = null,
  selectedDate = null,
  onSelectLog = null,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredDay, setHoveredDay] = useState(null);

  const historyIndex = useMemo(() => indexHistory(history), [history]);
  const historyByDate = historyIndex.changes;

  // Collect available years from history + default range
  const availableYears = useMemo(() => {
    const set = new Set([currentYear, currentYear - 1, currentYear - 2, currentYear - 3]);
    if (Array.isArray(history)) {
      history.forEach((log) => {
        const dStr = extractLogDateStr(log);
        if (dStr) {
          const yr = parseInt(dStr.split("-")[0], 10);
          if (!isNaN(yr)) set.add(yr);
        }
      });
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [history, currentYear]);

  // Count audits in selected year (only evaluated checks: safe, warning, contaminated)
  const yearAuditsCount = useMemo(() => {
    return Object.values(historyByDate).filter((log) => {
      const dStr = extractLogDateStr(log);
      if (!dStr) return false;
      const yr = parseInt(dStr.split("-")[0], 10);
      const st = (log.status || "").toLowerCase();
      return yr === selectedYear && st !== "unknown" && st !== "pending" && st !== "";
    }).length;
  }, [historyByDate, selectedYear]);

  // Generate full January-December weeks for selectedYear
  const { weeks, monthLabels } = useMemo(() => {
    const jan1 = new Date(selectedYear, 0, 1);
    const dec31 = new Date(selectedYear, 11, 31);

    // Week starts on Sunday (day 0)
    const startDate = new Date(selectedYear, 0, 1 - jan1.getDay());
    const endDate = new Date(selectedYear, 11, 31 + (6 - dec31.getDay()));

    const weeksArr = [];
    const months = [];
    let curr = new Date(startDate);
    let lastMonth = -1;
    let weekIndex = 0;
    const now = new Date();

    while (curr <= endDate) {
      const currentWeek = [];
      for (let d = 0; d < 7; d++) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, "0");
        const dd = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const isCurrentYear = yyyy === selectedYear;
        const log = isCurrentYear ? historyByDate[dateStr] : null;

        currentWeek.push({
          date: new Date(curr),
          dateStr,
          isCurrentYear,
          log,
          snapshot: isCurrentYear ? snapshotForDay(historyIndex, dateStr) : null,
          dayOfWeek: d,
        });
        curr.setDate(curr.getDate() + 1);
      }
      weeksArr.push(currentWeek);

      // Check month label
      const dayInYear = currentWeek.find((d) => d.isCurrentYear);
      if (dayInYear) {
        const m = dayInYear.date.getMonth();
        if (m !== lastMonth) {
          months.push({
            weekIndex,
            label: dayInYear.date.toLocaleString("en-US", { month: "short" }),
          });
          lastMonth = m;
        }
      }
      weekIndex++;
    }

    return { weeks: weeksArr, monthLabels: months };
  }, [selectedYear, historyByDate, historyIndex]);

  const getCellColor = (day) => {
    if (!day.log) {
      return "bg-slate-200/90 hover:border-slate-400 border border-slate-300/80 cursor-pointer";
    }

    const status = (day.log.status || "").toLowerCase();
    const exam = (day.log.bacteriological_exam || "").toLowerCase();

    // If status is unknown, pending, or untested: don't put a color in the boxes (uncolored/grey)
    if (status === "unknown" || status === "pending" || (!status && (exam === "unknown" || exam === "untested")) || (status === "unknown" && exam === "passed")) {
      return "bg-slate-200/90 hover:border-slate-400 border border-slate-300/80 cursor-pointer";
    }

    // Contaminated / failed check is red
    if (status === "contaminated" || status === "undrinkable" || (!status && exam === "failed")) {
      return "bg-red-500 hover:bg-red-600 border border-red-600 shadow-xs shadow-red-500/20 cursor-pointer";
    }
    // Warning level is amber
    if (status === "warning") {
      return "bg-amber-400 hover:bg-amber-500 border border-amber-500 shadow-xs shadow-amber-500/20 cursor-pointer";
    }
    // Safe level is emerald (only when evaluated as safe)
    if (status === "safe" || (exam === "passed" && status !== "unknown")) {
      return "bg-emerald-500 hover:bg-emerald-600 border border-emerald-600 shadow-xs shadow-emerald-500/20 cursor-pointer";
    }

    return "bg-slate-200/90 hover:border-slate-400 border border-slate-300/80 cursor-pointer";
  };

  return (
    <div className="bg-white text-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <History size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                Status Transition History
              </h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono border border-slate-200 font-medium">
                {loading
                  ? "Loading..."
                  : `${yearAuditsCount} ${yearAuditsCount === 1 ? "audit" : "audits"} in ${selectedYear}`}
              </span>
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Annual timeline of recorded safety checks and status updates (Jan – Dec)
            </p>
          </div>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
          <Calendar size={13} className="text-slate-500" />
          <label htmlFor="heatmap-year-select" className="text-xs font-semibold text-slate-600">
            Year:
          </label>
          <select
            id="heatmap-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-bold bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heatmap Grid with horizontal scroll */}
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="min-w-[690px]">
          {/* Month labels row */}
          <div className="relative h-4 text-[10px] font-semibold text-slate-600 mb-1.5 pl-7 select-none">
            {monthLabels.map((m, idx) => (
              <span
                key={idx}
                className="absolute"
                style={{ left: `${m.weekIndex * 13 + 28}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            {/* Day of week labels on left (Mon, Wed, Fri aligned with respective rows) */}
            <div className="flex flex-col gap-[2px] text-[9px] text-slate-600 font-semibold pr-1 select-none w-6 text-right">
              <span className="h-[11px] leading-[11px]"></span>
              <span className="h-[11px] leading-[11px]">Mon</span>
              <span className="h-[11px] leading-[11px]"></span>
              <span className="h-[11px] leading-[11px]">Wed</span>
              <span className="h-[11px] leading-[11px]"></span>
              <span className="h-[11px] leading-[11px]">Fri</span>
              <span className="h-[11px] leading-[11px]"></span>
            </div>

            {/* Week Columns */}
            <div className="flex gap-[2px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[2px]">
                  {week.map((day, dIdx) => (
                    <button
                      type="button"
                      key={dIdx}
                      disabled={!day.isCurrentYear || day.dateStr > manilaDate() || loading}
                      aria-label={`${day.dateStr}: ${day.log?.status || "No changes"}`}
                      aria-pressed={selectedDate === day.dateStr}
                      onClick={() => onSelectLog?.(day.snapshot, day.dateStr)}
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-all ${getCellColor(day)} ${
                        selectedDate === day.dateStr ? "ring-2 ring-blue-600 scale-125 z-10" : ""
                      }`}
                      title={`${day.dateStr}${day.log ? `: ${day.log.status}` : ": No changes"}${day.log ? " (Click to load this audit)" : ""}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Interactive Details or Legend */}
      {hoveredDay ? (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                !hoveredDay.log || hoveredDay.log.status === "unknown" || hoveredDay.log.status === "pending"
                  ? "bg-slate-400"
                  : hoveredDay.log.status === "undrinkable"
                  ? "bg-red-500"
                  : hoveredDay.log.status === "warning"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
            <span className="font-bold text-slate-900">
              {formatDisplayDate(hoveredDay.dateStr)}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                !hoveredDay.log || hoveredDay.log.status === "unknown" || hoveredDay.log.status === "pending"
                  ? "bg-slate-100 text-slate-600 border border-slate-200"
                  : hoveredDay.log.status === "undrinkable"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : hoveredDay.log.status === "warning"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {hoveredDay.log
                ? hoveredDay.log.status === "undrinkable"
                  ? "Contaminated"
                  : hoveredDay.log.status === "unknown"
                  ? "Unknown (Not Tested)"
                  : hoveredDay.log.status
                : "No Status Changes"}
            </span>
          </div>

          {hoveredDay.log && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
              <span>
                E. Coli:{" "}
                <strong
                  className={
                    hoveredDay.log.e_coli || (hoveredDay.log.e_coli_count && Number(hoveredDay.log.e_coli_count) > 0)
                      ? "text-red-600 font-bold"
                      : hoveredDay.log.status === "unknown" || hoveredDay.log.status === "pending"
                      ? "text-slate-500 font-normal"
                      : "text-emerald-700 font-bold"
                  }
                >
                  {hoveredDay.log.e_coli || (hoveredDay.log.e_coli_count && Number(hoveredDay.log.e_coli_count) > 0)
                    ? "Present"
                    : hoveredDay.log.status === "unknown" || hoveredDay.log.status === "pending"
                    ? "Not Tested"
                    : "Not Present"}
                </strong>
              </span>
              {hoveredDay.log.notes && (
                <span className="italic truncate max-w-xs text-slate-700">
                  "{hoveredDay.log.notes}"
                </span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 px-1 pt-1 gap-2">
          <span>Click a day to load its saved details. Gray days carry forward the last change.</span>
          <div className="flex items-center gap-2 font-medium">
            <span className="text-[10px] text-slate-600">No Changes</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-slate-200 border border-slate-300" />
            <span className="text-[10px] text-slate-600 pl-1">Safe</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500 border border-emerald-600" />
            <span className="text-[10px] text-slate-600 pl-1">Warning</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-amber-400 border border-amber-500" />
            <span className="text-[10px] text-slate-600 pl-1">Contaminated</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-red-500 border border-red-600" />
          </div>
        </div>
      )}
    </div>
  );
};

const WaterSources = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, API_URL, user } = useAuth();
  const isBrgyOfficial = user?.role === "barangay_official";
  const isInspector = user?.role === "sanitization_inspector";
  const userBarangay = user?.barangay || "Combado";

  const [sources, setSources] = useState([]);
  const [archivedSources, setArchivedSources] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [editingSource, setEditingSource] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(manilaDate);
  const [historyError, setHistoryError] = useState("");
  const historyRequestRef = useRef(0);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Resident Submissions State
  const [residentSubmissions, setResidentSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [isSubmissionsModalOpen, setIsSubmissionsModalOpen] = useState(false);
  const [submissionsTab, setSubmissionsTab] = useState("pending"); // "pending" | "registered" | "dismissed" | "all"
  useEffect(() => {
    if (searchParams.get("view") !== "resident-submissions") return;
    setIsSubmissionsModalOpen(true);
    setSubmissionsTab("all");
    // Consume the navigation request so closing the dialog keeps it closed.
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("view");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [associatedReport, setAssociatedReport] = useState(null);
  const [dismissDialog, setDismissDialog] = useState({ open: false, reportId: null, reportTitle: "", reason: "" });
  const [dismissing, setDismissing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState({ open: false, photos: [], index: 0, title: "" });

  const [formData, setFormData] = useState({
    name: "",
    source_type: "deep_well",
    barangay: isBrgyOfficial ? userBarangay : "Combado",
    latitude: 10.1330,
    longitude: 124.8700,
    status: "safe",
    e_coli_present: false,
    e_coli_count: 0,
    coliform_count: 0,
    bacteriological_exam: "passed",
    sample_date: "",
    sample_time: "",
    description: "",
    photos: []
  });

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  const [mapStyle, setMapStyle] = useState("mapbox://styles/mapbox/satellite-streets-v12");
  const [locationValidation, setLocationValidation] = useState({
    isValid: true,
    detectedArea: "",
    message: "",
  });
  const [validatingLoc, setValidatingLoc] = useState(false);

  // Render boundary overlay layers on Mapbox map inside modal
  const renderBoundaryLayer = (brgyName, shouldFit = false) => {
    if (!map.current) return;

    const target = brgyName || formData.barangay || userBarangay || "Combado";
    const feature = getBarangayFeature(target);
    if (!feature) return;

    if (!map.current.isStyleLoaded()) {
      map.current.once("idle", () => {
        renderBoundaryLayer(brgyName, shouldFit);
      });
      return;
    }

    const sourceData = {
      type: "FeatureCollection",
      features: [feature],
    };

    try {
      const existingSource = map.current.getSource("barangay-boundary");
      if (existingSource) {
        existingSource.setData(sourceData);
      } else {
        map.current.addSource("barangay-boundary", {
          type: "geojson",
          data: sourceData,
        });
      }

      if (!map.current.getLayer("barangay-boundary-fill")) {
        map.current.addLayer({
          id: "barangay-boundary-fill",
          type: "fill",
          source: "barangay-boundary",
          paint: {
            "fill-color": "#0ea5e9",
            "fill-opacity": 0.28,
          },
        });
      }

      if (!map.current.getLayer("barangay-boundary-glow")) {
        map.current.addLayer({
          id: "barangay-boundary-glow",
          type: "line",
          source: "barangay-boundary",
          paint: {
            "line-color": "#38bdf8",
            "line-width": 6,
            "line-opacity": 0.85,
          },
        });
      }

      if (!map.current.getLayer("barangay-boundary-line")) {
        map.current.addLayer({
          id: "barangay-boundary-line",
          type: "line",
          source: "barangay-boundary",
          paint: {
            "line-color": "#0284c7",
            "line-width": 3.5,
            "line-dasharray": [2, 1.5],
          },
        });
      }
    } catch (err) {
      console.warn("Error rendering boundary layer:", err);
    }

    if (shouldFit) {
      const bounds = getBarangayBounds(feature);
      if (bounds) {
        map.current.fitBounds(bounds, { padding: 45, maxZoom: 16.5, duration: 800 });
      }
    }
  };

  const handleFitToBoundary = () => {
    if (!map.current) return;
    const target = formData.barangay || userBarangay || "Combado";
    renderBoundaryLayer(target, true);
  };

  const handleMapStyleChange = (newStyle) => {
    if (newStyle === mapStyle) return;
    setMapStyle(newStyle);
    if (!map.current) return;

    map.current.once("idle", () => {
      renderBoundaryLayer(formData.barangay || userBarangay || "Combado", false);
    });

    map.current.setStyle(newStyle, { diff: false });
  };

  const validateCoordinates = async (lat, lng, targetBrgyOverride = null) => {
    const targetBrgy = (targetBrgyOverride || formData.barangay || userBarangay || "Combado").trim();
    if (isNaN(lat) || isNaN(lng)) return;
    setValidatingLoc(true);

    // 1. Strict check against GeoJSON barangay polygon boundaries
    const jurisdiction = checkBarangayJurisdiction(lng, lat, targetBrgy);
    if (jurisdiction.targetFeature) {
      if (jurisdiction.isInsideTarget) {
        setLocationValidation({
          isValid: true,
          detectedArea: targetBrgy,
          message: `Location verified inside Barangay ${targetBrgy}.`,
        });
      } else {
        const detected = jurisdiction.detectedBarangay;
        setLocationValidation({
          isValid: false,
          detectedArea: detected || "Outside boundary",
          message:
            detected && detected.toLowerCase() !== targetBrgy.toLowerCase()
              ? `Location is in Barangay ${detected} (Outside Barangay ${targetBrgy}). Please pin inside.`
              : `Location is outside Barangay ${targetBrgy}. Please pin inside.`,
        });
      }
      setValidatingLoc(false);
      return;
    }

    // 2. Fallback to Mapbox geocoding reverse lookup
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const features = data.features || [];

      let detectedName = null;
      for (const f of features) {
        const pt = f.place_type || [];
        if (pt.includes("locality") || pt.includes("neighborhood")) {
          detectedName = f.text;
          break;
        } else if (pt.includes("address")) {
          const ctx = (f.context || []).find((c) => c.id.startsWith("locality") || c.id.startsWith("neighborhood"));
          if (ctx) {
            detectedName = ctx.text;
            break;
          }
        }
      }

      const targetLower = targetBrgy.toLowerCase();
      const isMatch = features.some((f) => {
        const pName = (f.place_name || "").toLowerCase();
        const text = (f.text || "").toLowerCase();
        return pName.includes(targetLower) || text === targetLower;
      });

      const isExplicitDifferent = detectedName && detectedName.toLowerCase() !== targetLower;
      const isValid = isMatch && !isExplicitDifferent;

      if (isValid) {
        setLocationValidation({
          isValid: true,
          detectedArea: detectedName || targetBrgy,
          message: `Location verified inside Barangay ${targetBrgy}.`
        });
      } else {
        const areaText = detectedName ? `in Barangay ${detectedName}` : "outside your barangay boundary";
        setLocationValidation({
          isValid: false,
          detectedArea: detectedName || "Outside boundary",
          message: `Location is ${areaText} (outside Barangay ${targetBrgy}). Please pin inside.`
        });
      }
    } catch (err) {
      console.warn("Location boundary check error:", err);
    } finally {
      setValidatingLoc(false);
    }
  };

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchStatusHistory = async (locId) => {
    const requestId = ++historyRequestRef.current;
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const res = await fetch(`${API_URL}/water-locations/${locId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (requestId !== historyRequestRef.current) return;
      if (res.ok && data.success && Array.isArray(data.data)) {
        setStatusHistory(data.data);
        if (data.latest) {
          setSelectedHistoryDate(historyDate(data.latest));
          setFormData((prev) => ({ ...prev, ...historyFormValues(data.latest) }));
        }
      } else {
        setStatusHistory([]);
        setHistoryError(data.detail || "Could not load status history.");
      }
    } catch (err) {
      console.error("Error fetching water status history:", err);
      if (requestId === historyRequestRef.current) {
        setStatusHistory([]);
        setHistoryError("Could not load status history. Please reopen this source to try again.");
      }
    } finally {
      if (requestId === historyRequestRef.current) setHistoryLoading(false);
    }
  };

  const handleSelectHistoryLog = (log, dateStr) => {
    setSelectedHistoryDate(dateStr);
    setFormData((prev) => ({ ...prev, ...historyFormValues(log) }));
  };

  const fetchSources = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_URL}/water-locations`, { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.detail === "string" ? data.detail : "Could not load water sources. Please retry.");
      if (data.success && Array.isArray(data.data)) {
        if (isBrgyOfficial && userBarangay) {
          setSources(data.data.filter((s) => s.barangay?.toLowerCase() === userBarangay.toLowerCase()));
        } else {
          setSources(data.data);
        }
      }
    } catch (err) {
      console.error("Error fetching water sources:", err);
      setErrorMsg(err.message || "Could not load water sources.");
    } finally {
      setLoading(false);
    }
  };

  const fetchArchive = async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`${API_URL}/water-locations/archive`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Could not load archived stations.");
      setArchivedSources(data.data || []);
    } catch (err) {
      setErrorMsg(err.message || "Could not load archived stations.");
    } finally {
      setArchiveLoading(false);
    }
  };

  const fetchResidentSubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      const res = await fetch(`${API_URL}/resident-reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        let list = data.data.filter(
          (r) => r.type === "unregistered_source" || r.category === "unregistered_source"
        );
        if (isBrgyOfficial && userBarangay) {
          list = list.filter((r) => !r.barangay || r.barangay.toLowerCase() === userBarangay.toLowerCase());
        }
        setResidentSubmissions(list);
        notifyReportQueueChanged();
      }
    } catch (err) {
      console.error("Error fetching resident water source submissions:", err);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
    fetchResidentSubmissions();
  }, [API_URL, token]);

  const handleOpenModal = (sourceToEdit = null, prefillReport = null) => {
    historyRequestRef.current += 1;
    setHistoryError("");
    setHistoryLoading(false);
    setErrorMsg("");
    setSuccessMsg("");
    if (sourceToEdit) {
      const rawStatus = (sourceToEdit.status || "safe").toLowerCase();
      const normalizedStatus = rawStatus === "undrinkable" ? "contaminated" : rawStatus;
      const isUnknown = normalizedStatus === "unknown" || sourceToEdit.e_coli === null || sourceToEdit.e_coli === undefined;
      const eColiPresent = isUnknown
        ? "unknown"
        : Boolean(sourceToEdit.e_coli || (sourceToEdit.e_coli_count && Number(sourceToEdit.e_coli_count) > 0))
        ? "present"
        : "not_present";
      setEditingSource(sourceToEdit);
      setSelectedHistoryDate(sourceToEdit.sample_date || manilaDate());
      setStatusHistory([]);
      setAssociatedReport(null);
      fetchStatusHistory(sourceToEdit.id);
      const targetBrgy = isBrgyOfficial ? userBarangay : (sourceToEdit.barangay || "Combado");
      const lat = sourceToEdit.latitude || 10.1330;
      const lng = sourceToEdit.longitude || 124.8700;

      setFormData({
        name: sourceToEdit.name || sourceToEdit.full_name || "",
        source_type: sourceToEdit.source_type || "unknown",
        barangay: targetBrgy,
        latitude: lat,
        longitude: lng,
        status: normalizedStatus,
        e_coli_present: eColiPresent,
        e_coli_count: eColiPresent === "present" ? 1 : 0,
        coliform_count: sourceToEdit.coliform_count ?? (sourceToEdit.coliform_bacteria ? 1 : 0),
        bacteriological_exam: sourceToEdit.bacteriological_exam || (eColiPresent === "present" ? "failed" : (normalizedStatus === "safe" ? "passed" : (normalizedStatus === "unknown" ? "untested" : "failed"))),
        sample_date: sourceToEdit.sample_date || "",
        sample_time: sourceToEdit.sample_time || "",
        description: sourceToEdit.description || sourceToEdit.notes || "",
        photos: parseLocationPhotos(sourceToEdit)
      });
      validateCoordinates(lat, lng, targetBrgy);
    } else if (prefillReport) {
      setEditingSource(null);
      setAssociatedReport(prefillReport);
      setStatusHistory([]);

      const combinedText = `${prefillReport.title || ""} ${prefillReport.description || ""}`.toLowerCase();
      let guessedType = "deep_well";
      if (combinedText.includes("spring")) guessedType = "spring";
      else if (combinedText.includes("tap") || combinedText.includes("faucet") || combinedText.includes("piped")) guessedType = "piped_tap";
      else if (combinedText.includes("refill") || combinedText.includes("station")) guessedType = "refilling_station";
      else if (combinedText.includes("shallow")) guessedType = "shallow_well";

      const cleanedDesc = cleanDesc(prefillReport);
      const residentPhoto = extractPhotoProof(prefillReport);
      const targetBrgy = isBrgyOfficial ? userBarangay : (prefillReport.barangay || userBarangay || "Combado");
      const lat = parseFloat(prefillReport.latitude) || 10.1330;
      const lng = parseFloat(prefillReport.longitude) || 124.8700;

      setFormData({
        name: prefillReport.title || "Resident Submitted Water Source",
        source_type: guessedType,
        barangay: targetBrgy,
        latitude: lat,
        longitude: lng,
        status: "unknown",
        e_coli_present: false,
        e_coli_count: 0,
        coliform_count: 0,
        bacteriological_exam: "passed",
        sample_date: new Date().toISOString().split("T")[0],
        sample_time: new Date().toTimeString().split(" ")[0].slice(0, 5),
        description: cleanedDesc,
        photos: residentPhoto ? [residentPhoto] : []
      });
      validateCoordinates(lat, lng, targetBrgy);
    } else {
      setEditingSource(null);
      setAssociatedReport(null);
      setStatusHistory([]);
      const targetBrgy = isBrgyOfficial ? userBarangay : "Combado";
      const feat = getBarangayFeature(targetBrgy);
      const center = feat ? getBarangayCenter(feat) : [124.8700, 10.1330];
      const defaultLat = center ? parseFloat(center[1].toFixed(6)) : 10.1330;
      const defaultLng = center ? parseFloat(center[0].toFixed(6)) : 124.8700;

      setFormData({
        name: "",
        source_type: "deep_well",
        barangay: targetBrgy,
        latitude: defaultLat,
        longitude: defaultLng,
        status: "safe",
        e_coli_present: false,
        e_coli_count: 0,
        coliform_count: 0,
        bacteriological_exam: "passed",
        sample_date: "",
        sample_time: "",
        description: "",
        photos: []
      });
      validateCoordinates(defaultLat, defaultLng, targetBrgy);
    }
    setIsModalOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingPhoto(true);
    setErrorMsg("");

    const uploadedUrls = [];
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setErrorMsg(`File "${file.name}" is not an image.`);
          continue;
        }
        if (file.size > 16 * 1024 * 1024) {
          setErrorMsg(`File "${file.name}" exceeds 16MB limit.`);
          continue;
        }

        const bodyData = new FormData();
        bodyData.append("file", file);

        const res = await fetch(`${API_URL}/water-locations/upload-image`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: bodyData
        });

        const data = await res.json();
        if (data.success && data.image_url) {
          uploadedUrls.push(data.image_url);
        } else {
          console.warn("Upload response without image_url:", data);
          setErrorMsg(data.detail || data.message || "Failed to upload photo.");
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), ...uploadedUrls]
        }));
      }
    } catch (err) {
      console.error("Error uploading photo:", err);
      setErrorMsg("Failed to upload photo due to a network error.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setFormData((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleReviewAndRegister = (report) => {
    setIsSubmissionsModalOpen(false);
    handleOpenModal(null, report);
  };

  useEffect(() => {
    const reportId = searchParams.get("report");
    if (!reportId) return;
    const report = residentSubmissions.find((item) => String(item.id) === reportId);
    if (!report) return;
    if (!["done", "completed", "resolved", "dismissed", "rejected"].includes(report.status)) {
      handleReviewAndRegister(report);
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("report");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, residentSubmissions]);

  const handleDismissSubmission = async () => {
    if (!dismissDialog.reportId || dismissing) return;
    setDismissing(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/resident-reports/${dismissDialog.reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "dismissed",
          reason: dismissDialog.reason || "Dismissed by Barangay Official during Water Sources review."
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Resident water source submission dismissed.");
        setDismissDialog({ open: false, reportId: null, reportTitle: "", reason: "" });
        fetchResidentSubmissions();
      } else {
        setErrorMsg(data.detail || "Failed to dismiss submission.");
      }
    } catch (err) {
      console.error("Error dismissing submission:", err);
      setErrorMsg("Network error dismissing submission.");
    } finally {
      setDismissing(false);
    }
  };

  // Initialize Mapbox map inside modal
  useEffect(() => {
    if (!isModalOpen || !mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const initialLat = parseFloat(formData.latitude) || 10.1330;
    const initialLng = parseFloat(formData.longitude) || 124.8700;
    const currentTargetBrgy = formData.barangay || userBarangay || "Combado";

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [initialLng, initialLat],
      zoom: 15,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const el = document.createElement("div");
    el.className = "relative flex items-center justify-center cursor-grab group";
    el.style.width = "32px";
    el.style.height = "32px";
    el.innerHTML = `
      <div class="absolute bottom-full mb-1.5 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-md whitespace-nowrap border border-cyan-400 pointer-events-none">
        ${formData.name || "Water Station"}
      </div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-blue-500/25 transition-transform duration-150 group-hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: el, draggable: true, anchor: "center" })
      .setLngLat([initialLng, initialLat])
      .addTo(map.current);

    validateCoordinates(initialLat, initialLng, currentTargetBrgy);

    map.current.on("load", () => {
      renderBoundaryLayer(currentTargetBrgy, !editingSource && !associatedReport);
    });

    marker.current.on("dragend", () => {
      const lngLat = marker.current.getLngLat();
      const lat = parseFloat(lngLat.lat.toFixed(6));
      const lng = parseFloat(lngLat.lng.toFixed(6));
      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
      validateCoordinates(lat, lng, formData.barangay || userBarangay);
    });

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      const roundedLat = parseFloat(lat.toFixed(6));
      const roundedLng = parseFloat(lng.toFixed(6));
      marker.current.setLngLat([lng, lat]);
      setFormData((prev) => ({
        ...prev,
        latitude: roundedLat,
        longitude: roundedLng,
      }));
      validateCoordinates(roundedLat, roundedLng, formData.barangay || userBarangay);
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
        validateCoordinates(lat, lng, formData.barangay || userBarangay);
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

  const updateMapMarker = (latVal, lngVal) => {
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    const isValidLat = !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLng = !isNaN(lng) && lng >= -180 && lng <= 180;

    if (isValidLat && isValidLng && marker.current && map.current) {
      try {
        marker.current.setLngLat([lng, lat]);
        map.current.flyTo({ center: [lng, lat], zoom: 15 });
        validateCoordinates(lat, lng, formData.barangay || userBarangay);
      } catch (err) {
        console.warn("Could not update map marker position:", err);
      }
    }
  };

  const handleManualCoordChange = (field, val) => {
    // Check if user pasted a coordinate pair like "10.1330, 124.8700"
    if (typeof val === "string") {
      const matches = val.match(/[-+]?[0-9]*\.?[0-9]+/g);
      if (matches && matches.length >= 2) {
        let n1 = parseFloat(matches[0]);
        let n2 = parseFloat(matches[1]);
        if (!isNaN(n1) && !isNaN(n2)) {
          let lat = n1;
          let lng = n2;
          if (Math.abs(n1) > 90 && Math.abs(n2) <= 90) {
            lat = n2;
            lng = n1;
          }
          setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
          updateMapMarker(lat, lng);
          return;
        }
      }
    }

    setFormData((prev) => {
      const updated = { ...prev, [field]: val };
      const lat = field === "latitude" ? parseFloat(val) : parseFloat(prev.latitude);
      const lng = field === "longitude" ? parseFloat(val) : parseFloat(prev.longitude);
      updateMapMarker(lat, lng);
      return updated;
    });
  };

  const handleCoordPaste = (e, targetField) => {
    const pasteText = e.clipboardData?.getData("text") || "";
    const matches = pasteText.match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (matches && matches.length >= 2) {
      e.preventDefault();
      let n1 = parseFloat(matches[0]);
      let n2 = parseFloat(matches[1]);
      if (!isNaN(n1) && !isNaN(n2)) {
        let lat = n1;
        let lng = n2;
        // In the Philippines / globally: latitude is <= 90
        if (Math.abs(n1) > 90 && Math.abs(n2) <= 90) {
          lat = n2;
          lng = n1;
        }
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        updateMapMarker(lat, lng);
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (savingRef.current || uploadingPhoto) return;
    setErrorMsg("");
    setSuccessMsg("");

    if (editingSource && (historyLoading || historyError)) {
      setErrorMsg(historyError || "Wait for status history to finish loading.");
      return;
    }

    if (!locationValidation.isValid) {
      setErrorMsg(
        `Cannot save: The chosen location is outside Barangay ${formData.barangay || userBarangay}. Please place the pin inside the designated barangay.`
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const url = editingSource
        ? `${API_URL}/water-locations/${editingSource.id}`
        : `${API_URL}/water-locations`;
      const method = editingSource ? "PUT" : "POST";

      const isPresent = formData.e_coli_present === "present" || formData.e_coli_present === true;
      const isEColiUnknown = formData.e_coli_present === "unknown" || formData.e_coli_present === null;
      const isContaminated = formData.status === "contaminated" || formData.status === "undrinkable";
      const isSafe = formData.status === "safe";
      const isUnknown = formData.status === "unknown";

      const finalImageUrl = (formData.photos && formData.photos.length > 0)
        ? (formData.photos.length === 1 ? formData.photos[0] : JSON.stringify(formData.photos))
        : null;

      const payload = {
        name: formData.name.trim(),
        full_name: formData.name.trim(),
        source_type: formData.source_type,
        ...(editingSource ? { history_date: selectedHistoryDate } : {}),
        barangay: isBrgyOfficial ? userBarangay : formData.barangay,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        ...(isBrgyOfficial ? (editingSource ? {} : {
          status: "unknown",
          bacteriological_exam: "untested",
        }) : {
          status: isContaminated ? "contaminated" : (isUnknown ? "unknown" : (isSafe ? "safe" : "warning")),
          e_coli: (isUnknown || isEColiUnknown) ? null : isPresent,
          coliform_bacteria: isUnknown ? null : Number(formData.coliform_count || 0) > 0,
          e_coli_count: (isUnknown || isEColiUnknown) ? 0 : (isPresent ? 1 : 0),
          coliform_count: isUnknown ? 0 : Number(formData.coliform_count || 0),
          bacteriological_exam: isUnknown
            ? "untested"
            : formData.bacteriological_exam,
          sample_date: formData.sample_date || null,
          sample_time: formData.sample_time || null,
        }),
        image_url: finalImageUrl,
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
        if (associatedReport) {
          try {
            const reportRes = await fetch(`${API_URL}/resident-reports/${associatedReport.id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                status: "done",
                reason: `Verified and registered into Barangay Water Sources Registry as "${formData.name.trim()}".`
              })
            });
            const reportData = await reportRes.json();
            if (!reportRes.ok || !reportData.success) throw new Error(reportData.detail || "Report status update failed.");
          } catch (repErr) {
            // Keep the saved source ID so retrying updates it instead of inserting a duplicate.
            setEditingSource(data.data);
            setErrorMsg(`Water source saved, but the report is not yet Done. ${repErr.message} Save again to retry.`);
            fetchSources();
            return;
          }
          setAssociatedReport(null);
          fetchResidentSubmissions();
        }

        setSuccessMsg(
          associatedReport
            ? `Water station "${formData.name.trim()}" registered and resident submission marked as Done!`
            : (editingSource ? "Water station updated successfully!" : "New water station registered!")
        );
        setIsModalOpen(false);
        fetchSources();
      } else {
        setErrorMsg(data.detail || "Failed to save water station.");
      }
    } catch (err) {
      console.error("Error saving water source:", err);
      setErrorMsg("Network error saving water source.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async (sourceId) => {
    if (!window.confirm("Archive this water station? You can restore it with its history later.")) return;

    try {
      const res = await fetch(`${API_URL}/water-locations/${sourceId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Water station archived. Its history is preserved.");
        fetchSources();
        if (archiveOpen) fetchArchive();
      } else {
        setErrorMsg(data.detail || "Failed to delete station.");
      }
    } catch (err) {
      console.error("Error deleting water station:", err);
      setErrorMsg("Could not archive the station. Check your connection and retry.");
    }
  };

  const handleRestore = async (sourceId) => {
    setArchiveBusy(sourceId);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/water-locations/${sourceId}/restore`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Could not restore station.");
      setSuccessMsg("Water station restored with its original status history.");
      await Promise.all([fetchSources(), fetchArchive()]);
    } catch (err) {
      setErrorMsg(err.message || "Could not restore station.");
    } finally {
      setArchiveBusy("");
    }
  };

  const {
    pendingSubmissionsCount,
    registeredSubmissionsCount,
    dismissedSubmissionsCount,
    totalSubmissionsCount
  } = useMemo(() => {
    let pending = 0;
    let registered = 0;
    let dismissed = 0;
    residentSubmissions.forEach((sub) => {
      const st = getSubmissionStatus(sub);
      if (st === "pending") pending++;
      else if (st === "registered") registered++;
      else if (st === "dismissed") dismissed++;
    });
    return {
      pendingSubmissionsCount: pending,
      registeredSubmissionsCount: registered,
      dismissedSubmissionsCount: dismissed,
      totalSubmissionsCount: residentSubmissions.length
    };
  }, [residentSubmissions]);

  const filteredSources = sources.filter((s) => {
    if (isBrgyOfficial && userBarangay && s.barangay?.toLowerCase() !== userBarangay.toLowerCase()) {
      return false;
    }
    const matchQuery = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       s.barangay?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchBarangay = isBrgyOfficial ? true : (selectedBarangay === "all" || s.barangay === selectedBarangay);
    const sStatus = s.status?.toLowerCase() === "undrinkable" ? "contaminated" : (s.status?.toLowerCase() || "");
    const matchStatus = selectedStatus === "all" || sStatus === selectedStatus.toLowerCase();
    return matchQuery && matchBarangay && matchStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Water Sources Registry</h1>
            {isBrgyOfficial && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Brgy. {userBarangay} Jurisdiction
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {isBrgyOfficial
              ? `Manage and monitor registered water stations, wells, and taps in Barangay ${userBarangay}`
              : "Manage tested water stations, wells, taps, and laboratory metrics"}
          </p>
        </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              aria-pressed={archiveOpen}
              onClick={() => { if (!archiveOpen) fetchArchive(); setArchiveOpen(!archiveOpen); }}
              className={`inline-flex items-center gap-2 border px-4 py-2.5 rounded-full text-xs font-semibold transition-colors ${archiveOpen ? "bg-blue-900 hover:bg-blue-800 text-white border-blue-900 shadow-sm" : "bg-white hover:bg-slate-50 text-slate-800 border-slate-300"}`}
            >
              <ArchiveRestore size={16} className={archiveOpen ? "text-white" : "text-blue-600"} />
              <span>Archived Stations</span>
            </button>
            {!isInspector && <>
            <button
              onClick={() => setIsSubmissionsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-4 py-2.5 rounded-full text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer relative"
            >
              <Inbox size={16} className="text-blue-600" />
              <span>Resident Submissions</span>
              {pendingSubmissionsCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white animate-pulse">
                  {pendingSubmissionsCount}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                  0
                </span>
              )}
            </button>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-full text-xs font-semibold shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>Register New Station</span>
            </button>
            </>}
          </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {!isModalOpen && !isSubmissionsModalOpen && <ErrorNotice error={errorMsg} />}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={isBrgyOfficial ? `Search stations in ${userBarangay}...` : "Search station or barangay..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {isBrgyOfficial ? (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900">
              <MapPin size={13} className="text-blue-600" />
              <span>Brgy. {userBarangay}</span>
            </div>
          ) : (
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
          )}

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
              <option value="contaminated">Contaminated</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      {archiveOpen ? (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Archived water sources</h2>
            <p className="text-xs text-slate-500 mt-1">Restore a station to return its original record and status history to the registry.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase"><tr>
              <th className="px-6 py-3">Station</th><th className="px-6 py-3">Barangay</th>
              <th className="px-6 py-3">Status when archived</th><th className="px-6 py-3">Archived</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {archiveLoading ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading archive...</td></tr>
                : archivedSources.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No archived stations.</td></tr>
                : archivedSources.map((source) => <tr key={source.id}>
                  <td className="px-6 py-4 font-semibold text-slate-900">{source.full_name || source.name}</td>
                  <td className="px-6 py-4 text-slate-600">Brgy. {source.barangay}</td>
                  <td className="px-6 py-4 capitalize text-slate-600">{source.status || "Unknown"}</td>
                  <td className="px-6 py-4 text-slate-600">{source.archived_at ? new Date(source.archived_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : ""}<span className="block text-slate-400">{source.archived_by_name || "Staff"}</span></td>
                  <td className="px-6 py-4 text-right"><button type="button" disabled={Boolean(archiveBusy)} onClick={() => handleRestore(source.id)} className="inline-flex items-center gap-1.5 rounded-full bg-blue-900 text-white px-3 py-2 font-semibold disabled:opacity-50"><ArchiveRestore size={14} />{archiveBusy === source.id ? "Restoring..." : "Restore"}</button></td>
                </tr>)}
            </tbody>
          </table></div>
        </section>
      ) : <>
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
                <th className="py-3.5 px-6">Sample Date & Time</th>
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
                  const isUnknown = s.status?.toLowerCase() === "unknown";
                  const isContaminated = s.status?.toLowerCase() === "contaminated" || s.status?.toLowerCase() === "undrinkable";

                  const displayStatus = isSafe 
                    ? "Safe" 
                    : isWarning 
                    ? "Warning" 
                    : isUnknown 
                    ? "Unknown" 
                    : "Contaminated";

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{s.name || s.full_name}</span>
                          {(() => {
                            const photos = parseLocationPhotos(s);
                            if (photos.length === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setPhotoLightbox({
                                  open: true,
                                  photos,
                                  index: 0,
                                  title: s.name || s.full_name
                                })}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                                title={`View ${photos.length} photo(s)`}
                              >
                                <Camera size={11} className="text-blue-600" />
                                <span>{photos.length}</span>
                              </button>
                            );
                          })()}
                        </div>
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
                            : isUnknown
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {isSafe ? <ShieldCheck size={12} /> : isWarning ? <AlertTriangle size={12} /> : isUnknown ? <HelpCircle size={12} /> : <XCircle size={12} />}
                          <span>{displayStatus}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-800">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{s.sample_date || "—"}</span>
                        </div>
                        {s.sample_time && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono mt-0.5">
                            <Clock size={11} className="text-slate-400" />
                            <span>{s.sample_time}</span>
                          </div>
                        )}
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
                          {!isInspector && (
                            <button
                              onClick={() => handleDelete(s.id)}
                              className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete Station"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      </>}
      {/* Add / Edit Water Source Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-fade-in max-h-[92vh] overflow-y-auto">
            <button
              disabled={saving}
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {editingSource 
                ? "Edit Water Station" 
                : associatedReport 
                ? "Register Resident-Submitted Station" 
                : "Register Water Station"}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {associatedReport
                ? "Review and edit the resident's reported details and map location before registering into the official registry."
                : "Inspect, locate on Mapbox, and update water point parameters and laboratory metrics"}
            </p>

            {associatedReport && (
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5 mb-5">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold flex items-center justify-between">
                    <span>Pre-filled from Resident Submission</span>
                    <span className="text-[10px] text-blue-700 bg-white px-2 py-0.5 rounded-full border border-blue-200 font-semibold">
                      Citizen Report
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800/80 mt-1">
                    Details and GPS coordinates have been automatically loaded from the resident's report. You can modify any field or drag the map pin before submitting. Saving will register the station and mark the citizen report as <strong>Done</strong>.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <ErrorNotice error={errorMsg} />
              <fieldset disabled={saving || uploadingPhoto} className="contents">
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
                    <option value="unknown">Unknown / Not recorded</option>
                    <option value="deep_well">Deep Well</option>
                    <option value="spring">Natural Spring</option>
                    <option value="piped_tap">Piped Municipal Tap</option>
                    <option value="refilling_station">Refilling Station</option>
                    <option value="shallow_well">Shallow Well</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Barangay {isBrgyOfficial && <span className="text-blue-600 font-bold lowercase">(assigned jurisdiction)</span>}
                  </label>
                  {isBrgyOfficial ? (
                    <div className="w-full px-3.5 py-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 flex items-center gap-2">
                      <MapPin size={14} className="text-blue-600" />
                      <span>Brgy. {userBarangay}</span>
                    </div>
                  ) : (
                    <select
                      value={formData.barangay}
                      onChange={(e) => {
                        const newBrgy = e.target.value;
                        setFormData((prev) => ({ ...prev, barangay: newBrgy }));
                        renderBoundaryLayer(newBrgy, true);
                        validateCoordinates(parseFloat(formData.latitude), parseFloat(formData.longitude), newBrgy);
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      {barangays.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  )}
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

                {/* Real-time Location Boundary Verification Status */}
                {validatingLoc ? (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2 animate-pulse">
                    <Loader2 size={15} className="animate-spin text-blue-600 flex-shrink-0" />
                    <span>Verifying coordinates within Barangay {formData.barangay || userBarangay}...</span>
                  </div>
                ) : !locationValidation.isValid ? (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-2xs">
                    <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                    <span className="font-semibold">
                      {locationValidation.detectedArea && locationValidation.detectedArea !== "Outside boundary"
                        ? `Location is in Barangay ${locationValidation.detectedArea} (Outside Barangay ${formData.barangay || userBarangay}). Please pin inside.`
                        : `Location is outside Barangay ${formData.barangay || userBarangay}. Please pin inside.`}
                    </span>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    <span className="font-semibold">Location Verified: Inside Barangay {formData.barangay || userBarangay}</span>
                  </div>
                )}

                {geoError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                    <span>{geoError}</span>
                  </div>
                )}

                {/* Map View */}
                <div className="relative w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-slate-300 shadow-md">
                  <div ref={mapContainer} className="w-full h-full" />

                  {/* Map Style Selector (Streets / Satellite) */}
                  <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl shadow-lg border border-slate-200/90 flex items-center gap-1 text-xs">
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

                  {/* Floating Boundary Badge & Focus Button on bottom-left of map */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-slate-800 text-xs font-medium shadow-lg border border-slate-200/90 flex items-center gap-2.5 z-10">
                    <span className="w-3.5 h-3.5 rounded-full bg-sky-500/20 border-2 border-sky-600 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                    </span>
                    <span className="font-semibold text-slate-700">
                      Barangay {formData.barangay || userBarangay} Boundary
                    </span>
                    <button
                      type="button"
                      onClick={handleFitToBoundary}
                      className="ml-1 px-2.5 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold border border-sky-200 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Focus view on designated barangay boundary"
                    >
                      <Maximize2 size={11} />
                      <span>Fit Boundary</span>
                    </button>
                  </div>
                </div>

                {/* Manual Coordinate Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Latitude (GPS)</label>
                      <span className="text-[10px] text-slate-400">Accepts paste (lat, lng)</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.latitude}
                      onChange={(e) => handleManualCoordChange("latitude", e.target.value)}
                      onPaste={(e) => handleCoordPaste(e, "latitude")}
                      placeholder="e.g. 10.1330"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">Longitude (GPS)</label>
                      <span className="text-[10px] text-slate-400">Accepts paste (lat, lng)</span>
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.longitude}
                      onChange={(e) => handleManualCoordChange("longitude", e.target.value)}
                      onPaste={(e) => handleCoordPaste(e, "longitude")}
                      placeholder="e.g. 124.8700"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Status Change Audit Trail Heatmap (shown only when editing existing station) */}
              {editingSource && (
                <div className="pt-2 pb-1">
                  <WaterStatusHeatmap 
                    history={statusHistory} 
                    loading={historyLoading || Boolean(historyError)} 
                    currentStatus={formData.status === "undrinkable" ? "contaminated" : formData.status}
                    selectedDate={selectedHistoryDate}
                    onSelectLog={handleSelectHistoryLog}
                  />
                  {historyError && <p role="alert" className="mt-2 text-xs text-red-700">{historyError}</p>}
                  <p className="mt-2 text-xs text-slate-600">Selected day: {formatDisplayDate(selectedHistoryDate)}. {statusHistory.some((log) => historyDate(log) === selectedHistoryDate) ? "Saved change on this day." : "No change recorded; showing the last saved details."}</p>
                </div>
              )}

              {!isBrgyOfficial && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Safety Status</label>
                      <select
                        value={formData.status === "undrinkable" ? "contaminated" : formData.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            status: newStatus,
                            bacteriological_exam: newStatus === "unknown" ? "untested"
                              : newStatus === "safe" ? "passed" : newStatus === "warning" ? "untested" : "failed",
                            e_coli_present: newStatus === "unknown" ? "unknown" : prev.e_coli_present
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                      >
                        <option value="safe">Safe</option>
                        <option value="warning">Warning Level</option>
                        <option value="contaminated">Contaminated</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        E. Coli Presence
                      </label>
                      <select
                        value={
                          formData.status === "unknown" || formData.e_coli_present === "unknown" || formData.e_coli_present === null
                            ? "unknown"
                            : (formData.e_coli_present === "present" || formData.e_coli_present === true ? "present" : "not_present")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData((prev) => ({
                            ...prev,
                            e_coli_present: val,
                            e_coli_count: val === "present" ? 1 : 0,
                            coliform_count: val === "present" ? 1 : 0,
                            status: val === "present" && (prev.status === "safe" || prev.status === "unknown")
                              ? "contaminated"
                              : val === "unknown"
                              ? "unknown"
                              : prev.status
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                      >
                        <option value="not_present">Not Present</option>
                        <option value="present">Present</option>
                        <option value="unknown">Unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Sample / Test Date</label>
                      <input
                        type="date"
                        value={formData.sample_date}
                        onChange={(e) => { setSelectedHistoryDate(e.target.value || manilaDate()); setFormData({ ...formData, sample_date: e.target.value }); }}
                        max={manilaDate()}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Sample / Test Time</label>
                      <input
                        type="time"
                        step="1"
                        value={formData.sample_time}
                        onChange={(e) => setFormData({ ...formData, sample_time: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                </>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Notes / Details</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Sanitation conditions, pipe integrity, chlorination notes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Water Source Photos Section (1 or more) */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Water Source Photos (1 or more)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Upload physical photos of the water source, station, well, or tap. These will be viewable on the public map.
                    </p>
                  </div>
                  {formData.photos && formData.photos.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                      {formData.photos.length} {formData.photos.length === 1 ? "Photo" : "Photos"}
                    </span>
                  )}
                </div>

                {/* Thumbnail Previews Grid */}
                {formData.photos && formData.photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {formData.photos.map((photoUrl, pIdx) => (
                      <div
                        key={pIdx}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video shadow-xs hover:shadow-md transition-all"
                      >
                        <img
                          src={photoUrl}
                          alt={`Water source ${pIdx + 1}`}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                          onClick={() => setPhotoLightbox({
                            open: true,
                            photos: formData.photos,
                            index: pIdx,
                            title: formData.name || "Water Source Photo"
                          })}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(pIdx)}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100 shadow-md cursor-pointer transition-opacity"
                          title="Remove photo"
                        >
                          <X size={12} />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-slate-900/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-xs pointer-events-none">
                          #{pIdx + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button Box */}
                <div className="pt-1">
                  <label className={`w-full py-3 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    uploadingPhoto
                      ? "border-blue-400 bg-blue-50/50 pointer-events-none"
                      : "border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/30 text-slate-600 hover:text-blue-700"
                  }`}>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      className="hidden"
                    />
                    {uploadingPhoto ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 py-1">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Uploading photo(s) to storage...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <Camera size={16} className="text-blue-600" />
                          <span>Click to Upload Photo(s)</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Supports PNG, JPG, JPEG, WEBP (You can select multiple photos)
                        </span>
                      </>
                    )}
                  </label>
                </div>
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
                  {saving ? "Saving..." : editingSource ? "Save Changes" : associatedReport ? "Confirm & Register Station" : "Register Station"}
                </button>
              </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}

      {/* Resident Submissions Modal */}
      {isSubmissionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-fade-in max-h-[92vh] flex flex-col">
            <button
              onClick={() => setIsSubmissionsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <ErrorNotice error={errorMsg} />
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
                <Inbox size={22} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Resident-Submitted Water Sources</h2>
                <p className="text-xs text-slate-500">
                  Review new water sources reported by community residents in {isBrgyOfficial ? `Brgy. ${userBarangay}` : "your jurisdiction"}.
                </p>
              </div>
            </div>

            {/* Submissions Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pt-3 pb-3 mb-4">
              <button
                type="button"
                onClick={() => setSubmissionsTab("pending")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  submissionsTab === "pending"
                    ? "bg-blue-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Pending Review</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  submissionsTab === "pending" ? "bg-amber-500 text-white font-black" : "bg-white text-slate-600 border border-slate-200"
                }`}>
                  {pendingSubmissionsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSubmissionsTab("registered")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  submissionsTab === "registered"
                    ? "bg-blue-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Registered</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  submissionsTab === "registered" ? "bg-emerald-600 text-white font-black" : "bg-white text-slate-600 border border-slate-200"
                }`}>
                  {registeredSubmissionsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSubmissionsTab("dismissed")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  submissionsTab === "dismissed"
                    ? "bg-blue-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>Dismissed</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  submissionsTab === "dismissed" ? "bg-slate-700 text-white font-black" : "bg-white text-slate-600 border border-slate-200"
                }`}>
                  {dismissedSubmissionsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSubmissionsTab("all")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  submissionsTab === "all"
                    ? "bg-blue-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>All</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  submissionsTab === "all" ? "bg-blue-800 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}>
                  {totalSubmissionsCount}
                </span>
              </button>
            </div>

            {/* Submissions Content Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {submissionsLoading ? (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <span className="text-xs">Loading resident submissions...</span>
                </div>
              ) : (() => {
                const filteredList = residentSubmissions.filter((s) => {
                  const normStatus = getSubmissionStatus(s);
                  if (submissionsTab === "pending") return normStatus === "pending";
                  if (submissionsTab === "registered") return normStatus === "registered";
                  if (submissionsTab === "dismissed") return normStatus === "dismissed";
                  return true; // "all"
                });

                if (filteredList.length === 0) {
                  let emptyTitle = "No resident submissions found.";
                  let emptyDesc = "Any unregistered water sources submitted by residents will appear here.";
                  if (submissionsTab === "pending") {
                    emptyTitle = "No pending resident submissions.";
                    emptyDesc = "All resident water source submissions have been reviewed and processed.";
                  } else if (submissionsTab === "registered") {
                    emptyTitle = "No registered submissions.";
                    emptyDesc = "Submissions that were approved and registered into the water sources registry will appear here.";
                  } else if (submissionsTab === "dismissed") {
                    emptyTitle = "No dismissed submissions.";
                    emptyDesc = "Dismissed or archived submissions will appear here.";
                  }

                  return (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                      <Inbox size={36} className="text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">{emptyTitle}</p>
                      <p className="text-xs text-slate-400">{emptyDesc}</p>
                    </div>
                  );
                }

                return filteredList.map((sub) => {
                  const photoUrl = extractPhotoProof(sub);
                  const desc = cleanDesc(sub);
                  const normStatus = getSubmissionStatus(sub);
                  const isPending = normStatus === "pending";
                  const isDone = normStatus === "registered";
                  const isDismissed = normStatus === "dismissed";

                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 justify-between items-start"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{sub.title || "Water Source"}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isPending
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : isDone
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>
                            {isPending ? "Pending Review" : isDone ? "Registered" : "Dismissed"}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <div className="flex items-center gap-1 font-medium text-blue-900 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                            <MapPin size={12} className="text-blue-600" />
                            <span>Brgy. {sub.barangay}</span>
                          </div>

                          <div className="font-mono text-[11px] bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-slate-700">
                            Lat: {parseFloat(sub.latitude || 0).toFixed(6)}, Lng: {parseFloat(sub.longitude || 0).toFixed(6)}
                          </div>

                          {sub.created_at && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock size={11} />
                              <span>{new Date(sub.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          )}
                        </div>

                        {desc && (
                          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                            {desc}
                          </p>
                        )}

                        {sub.reason && (
                          <p className="text-xs italic text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <strong>Note:</strong> {sub.reason}
                          </p>
                        )}

                        {photoUrl && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(photoUrl)}
                              className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50/80 hover:bg-blue-100/80 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors cursor-pointer"
                            >
                              <ImageIcon size={14} className="text-blue-600" />
                              <span>View Attached Photo Proof</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {isPending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReviewAndRegister(sub)}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Plus size={14} />
                              <span>Add to Registry</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDismissDialog({ open: true, reportId: sub.id, reportTitle: sub.title || "Water Source", reason: "" })}
                              className="w-full sm:w-auto px-3.5 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <XCircle size={14} />
                              <span>Dismiss</span>
                            </button>
                          </>
                        ) : isDone ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                            <CheckCircle size={13} />
                            <span>Registered</span>
                          </span>
                        ) : (
                          <div className="flex flex-col sm:items-end gap-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                              <XCircle size={13} />
                              <span>Archived in History</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleReviewAndRegister(sub)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                            >
                              <Plus size={12} />
                              <span>Register anyway</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSubmissionsModalOpen(false)}
                className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Confirmation Dialog */}
      {dismissDialog.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative animate-fade-in space-y-4">
            <h3 className="text-base font-bold text-slate-900">Dismiss Water Source Submission</h3>
            <ErrorNotice error={errorMsg} />
            <p className="text-xs text-slate-600">
              Are you sure you want to dismiss <strong>"{dismissDialog.reportTitle}"</strong>? This will archive the report and notify the resident.
            </p>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Reason / Note for Resident (Optional)
              </label>
              <textarea
                rows={2}
                value={dismissDialog.reason}
                onChange={(e) => setDismissDialog({ ...dismissDialog, reason: e.target.value })}
                placeholder="e.g. Duplicate point, invalid coordinates, private inaccessible source..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDismissDialog({ open: false, reportId: null, reportTitle: "", reason: "" })}
                disabled={dismissing}
                className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDismissSubmission}
                disabled={dismissing}
                className="w-1/2 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                Confirm Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Proof Lightbox Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="bg-white rounded-3xl p-4 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-800">Attached Proof Photo</h4>
              <button 
                onClick={() => setSelectedPhoto(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pt-3 max-h-[75vh] flex items-center justify-center overflow-hidden rounded-xl bg-slate-950">
              <img 
                src={selectedPhoto} 
                alt="Water Source Photo Proof" 
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Water Source Multi-Photo Lightbox Modal */}
      {photoLightbox.open && photoLightbox.photos && photoLightbox.photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer animate-fade-in"
          onClick={() => setPhotoLightbox({ open: false, photos: [], index: 0, title: "" })}
        >
          <div
            className="bg-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-blue-600" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">{photoLightbox.title || "Water Source Photos"}</h4>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {photoLightbox.index + 1} of {photoLightbox.photos.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPhotoLightbox({ open: false, photos: [], index: 0, title: "" })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-3 flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden min-h-[300px] max-h-[65vh]">
              <img
                src={photoLightbox.photos[photoLightbox.index]}
                alt={`Photo ${photoLightbox.index + 1}`}
                className="max-h-[60vh] w-auto object-contain rounded-lg transition-all"
              />

              {photoLightbox.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoLightbox((prev) => ({
                        ...prev,
                        index: (prev.index - 1 + prev.photos.length) % prev.photos.length
                      }));
                    }}
                    className="absolute left-3 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white backdrop-blur-sm cursor-pointer transition-transform hover:scale-110 shadow-lg"
                    title="Previous photo"
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoLightbox((prev) => ({
                        ...prev,
                        index: (prev.index + 1) % prev.photos.length
                      }));
                    }}
                    className="absolute right-3 p-2.5 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white backdrop-blur-sm cursor-pointer transition-transform hover:scale-110 shadow-lg"
                    title="Next photo"
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Navigation Row */}
            {photoLightbox.photos.length > 1 && (
              <div className="flex gap-2 pt-3 overflow-x-auto justify-center">
                {photoLightbox.photos.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPhotoLightbox((prev) => ({ ...prev, index: idx }))}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      photoLightbox.index === idx ? "border-blue-600 scale-105 shadow-md" : "border-slate-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaterSources;
