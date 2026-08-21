import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  ShieldAlert, 
  Droplets, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Send, 
  Eye, 
  Search, 
  Filter, 
  FileText, 
  PlusCircle, 
  Sparkles, 
  CheckCheck,
  ChevronRight,
  TestTube,
  Activity,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Crosshair,
  Loader2,
  Compass,
  X
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import ReportDetailModal from "../../components/ReportDetailModal";
import { MAASIN_BARANGAYS } from "../../constants/barangays";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY || "pk.eyJ1Ijoiamx0dCIsImEiOiJjbW9pNHBpZTgwMHB3MnFxMHNxcnY0MXBiIn0.__mzgeQcXuEDVkV6q8QNfQ";

const extractPhoto = (item) => {
  if (!item) return null;
  if (item.image_url) return item.image_url;
  if (item.photo_url) return item.photo_url;
  if (item.description) {
    const match = item.description.match(/\[(?:Attached )?Photo Proof:\s*(https?:\/\/[^\s\]]+)\]/i)
      || item.description.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i);
    if (match) return match[1];
  }
  return null;
};

const cleanDesc = (item) => {
  if (!item) return "";
  if (item.clean_description) return item.clean_description;
  if (item.description) {
    return item.description.replace(/\[(?:Attached )?Photo Proof:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();
  }
  return "";
};

const EndorsedReports = () => {
  const { user, token, API_URL } = useAuth();

  const [residentReports, setResidentReports] = useState([]);
  const [inspectionRequests, setInspectionRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'escalated', 'new_sources', 'inspections'
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'pending', 'in_progress', 'completed'

  // Modals
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [testModal, setTestModal] = useState({ open: false, item: null, type: "" });
  const [registerModal, setRegisterModal] = useState({ open: false, item: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");

  const registerMapContainer = useRef(null);
  const registerMap = useRef(null);
  const registerMarker = useRef(null);

  // Test form state
  const [testForm, setTestForm] = useState({
    status: "completed",
    water_status: "safe", // 'safe', 'contaminated', 'needs_chlorination'
    chlorine_residual: "0.5",
    ph_level: "7.2",
    e_coli: "Negative",
    coliform_bacteria: "0",
    notes: "",
  });

  // Water source register form state
  const [registerForm, setRegisterForm] = useState({
    name: "",
    source_type: "deep_well",
    barangay: "Combado",
    latitude: 10.1330,
    longitude: 124.8700,
    status: "safe",
    e_coli_count: 0,
    coliform_count: 0,
    bacteriological_exam: "passed",
    description: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [repRes, inspRes] = await Promise.all([
        fetch(`${API_URL}/resident-reports`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/inspections`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const repData = await repRes.json();
      const inspData = await inspRes.json();

      if (repData.success && Array.isArray(repData.data)) {
        setResidentReports(repData.data);
      }
      if (inspData.success && Array.isArray(inspData.data)) {
        setInspectionRequests(inspData.data);
      }
    } catch (err) {
      console.error("Error loading inspector data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [API_URL, token]);

  // Combined Unified Items List
  const combinedItems = useMemo(() => {
    const list = [];

    // 1. Resident Reports (Only Endorsed / Passed to CHU by Barangay Officials)
    residentReports.forEach((r) => {
      const isEndorsed = r.status === "escalated" || r.status === "passed_to_chu" || r.status === "in_progress" || r.status === "completed" || r.status === "validated";
      if (!isEndorsed) return;

      const isEscalated = r.status === "escalated" || r.status === "passed_to_chu";
      const isNewSource = r.type === "unregistered_source" || r.type === "new_source" || r.category === "new_source" || (r.title && r.title.toLowerCase().includes("water source"));
      
      list.push({
        id: r.id,
        rawId: r.id,
        kind: "resident_report",
        title: r.title,
        description: r.description,
        cleanDesc: cleanDesc(r),
        barangay: r.barangay,
        latitude: r.latitude,
        longitude: r.longitude,
        status: r.status || "escalated",
        isEscalated,
        isNewSource,
        category: r.type || r.category || "Concern",
        photoUrl: extractPhoto(r),
        reason: r.reason,
        created_at: r.created_at,
        original: r,
      });
    });

    // 2. Direct Inspection Requests
    inspectionRequests.forEach((insp) => {
      const isFromEscalation = insp.description && insp.description.includes("[Concern passed to CHU");

      // Avoid exact duplicate if resident report generated this inspection request
      list.push({
        id: `insp_${insp.id}`,
        rawId: insp.id,
        kind: "inspection_request",
        title: isFromEscalation ? "Barangay Endorsed Field Inspection" : "Citizen Water Inspection Request",
        description: insp.description,
        cleanDesc: insp.description,
        barangay: insp.barangay,
        latitude: insp.latitude,
        longitude: insp.longitude,
        status: insp.status || "pending",
        priority: insp.priority || "normal",
        isEscalated: isFromEscalation,
        isNewSource: false,
        category: "Inspection Request",
        photoUrl: null,
        notes: insp.notes,
        assigned_to: insp.assigned_to,
        created_at: insp.created_at,
        original: insp,
      });
    });

    return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [residentReports, inspectionRequests]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return combinedItems.filter((item) => {
      // Tab filtering
      if (activeTab === "escalated" && !item.isEscalated) return false;
      if (activeTab === "new_sources" && !item.isNewSource) return false;
      if (activeTab === "inspections" && item.kind !== "inspection_request") return false;

      // Status filtering
      if (statusFilter === "pending") {
        const isPend = item.status === "pending" || item.status === "escalated" || item.status === "submitted" || item.status === "open";
        if (!isPend) return false;
      }
      if (statusFilter === "in_progress") {
        const isInProg = item.status === "in_progress" || item.status === "investigating" || item.status === "assigned" || item.status === "testing";
        if (!isInProg) return false;
      }
      if (statusFilter === "completed") {
        const isComp = item.status === "completed" || item.status === "validated" || item.status === "resolved" || item.status === "action_taken" || item.status === "registered";
        if (!isComp) return false;
      }

      // Barangay filtering
      if (selectedBarangay !== "all" && item.barangay !== selectedBarangay) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchDesc = item.description?.toLowerCase().includes(query);
        const matchBrgy = item.barangay?.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchBrgy) return false;
      }

      return true;
    });
  }, [combinedItems, activeTab, statusFilter, selectedBarangay, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const escalated = combinedItems.filter((i) => i.isEscalated).length;
    const newSources = combinedItems.filter((i) => i.isNewSource).length;
    const inProgress = combinedItems.filter((i) => i.status === "in_progress").length;
    const completed = combinedItems.filter((i) => i.status === "completed" || i.status === "validated").length;

    return { escalated, newSources, inProgress, completed, total: combinedItems.length };
  }, [combinedItems]);

  // Quick status update (e.g. Start Field Test)
  const handleStartInspection = async (item) => {
    setActionLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      if (item.kind === "inspection_request") {
        const res = await fetch(`${API_URL}/inspections/${item.rawId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: "in_progress" })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg("Inspection claimed! Status changed to In Progress.");
          fetchData();
        }
      } else {
        const res = await fetch(`${API_URL}/resident-reports/${item.rawId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: "in_progress", reason: "Field inspection underway by Sanitization Inspector" })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg("Field audit claimed! Status changed to In Progress.");
          fetchData();
        }
      }
    } catch (err) {
      console.error("Error starting inspection:", err);
      setErrorMsg("Failed to start inspection. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Lab Findings & Complete Test
  const handleSubmitTestFindings = async (e) => {
    e.preventDefault();
    if (!testModal.item) return;

    setActionLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    const auditSummary = `[Lab & Field Audit]: Status: ${testForm.water_status.toUpperCase()} | Chlorine: ${testForm.chlorine_residual} ppm | pH: ${testForm.ph_level} | E. Coli: ${testForm.e_coli}. Notes: ${testForm.notes}`;

    try {
      if (testModal.item.kind === "inspection_request") {
        const res = await fetch(`${API_URL}/inspections/${testModal.item.rawId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            status: "completed",
            notes: auditSummary
          })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg("Inspection completed & field lab findings recorded successfully!");
          setTestModal({ open: false, item: null, type: "" });
          fetchData();
        }
      } else {
        const res = await fetch(`${API_URL}/resident-reports/${testModal.item.rawId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            status: "completed",
            reason: auditSummary
          })
        });
        const data = await res.json();
        if (data.success) {
          setSuccessMsg("Report verified and field findings saved successfully!");
          setTestModal({ open: false, item: null, type: "" });
          fetchData();
        }
      }
    } catch (err) {
      console.error("Error completing test:", err);
      setErrorMsg("Failed to submit test findings.");
    } finally {
      setActionLoading(false);
    }
  };

  // Register Water Source into Official Database
  const handleRegisterWaterSource = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const payload = {
        name: (registerForm.name || "Water Station").trim(),
        full_name: (registerForm.name || "Water Station").trim(),
        source_type: registerForm.source_type || "deep_well",
        barangay: registerForm.barangay || "Combado",
        latitude: parseFloat(registerForm.latitude),
        longitude: parseFloat(registerForm.longitude),
        status: registerForm.status || "safe",
        e_coli_count: parseInt(registerForm.e_coli_count) || 0,
        coliform_count: parseInt(registerForm.coliform_count) || 0,
        e_coli: (parseInt(registerForm.e_coli_count) || 0) > 0,
        coliform_bacteria: (parseInt(registerForm.coliform_count) || 0) > 0,
        bacteriological_exam: registerForm.bacteriological_exam || (registerForm.status === "safe" ? "passed" : "failed"),
        description: (registerForm.description || "Registered from verified citizen report.").trim(),
        notes: (registerForm.description || "Registered from verified citizen report.").trim(),
        sample_date: new Date().toISOString().split("T")[0]
      };

      const res = await fetch(`${API_URL}/water-locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Water station "${registerForm.name}" registered into the official database!`);
        setRegisterModal({ open: false, item: null });

        // Also mark the resident report as completed/registered
        if (registerModal.item) {
          await fetch(`${API_URL}/resident-reports/${registerModal.item.rawId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              status: "completed",
              reason: `Officially certified and added to Water Sources Registry as "${registerForm.name}".`
            })
          });
        }

        fetchData();
      } else {
        setErrorMsg(data.detail || "Failed to register water source.");
      }
    } catch (err) {
      console.error("Error registering water source:", err);
      setErrorMsg("Failed to register water source.");
    } finally {
      setActionLoading(false);
    }
  };

  const openRegisterModalFor = (item) => {
    setRegisterForm({
      name: "",
      source_type: "deep_well",
      barangay: item.barangay || "Abgao",
      latitude: item.latitude || 10.1330,
      longitude: item.longitude || 124.8700,
      status: "safe",
      e_coli_count: 0,
      coliform_count: 0,
      bacteriological_exam: "passed",
      description: "",
    });
    setRegisterModal({ open: true, item });
  };

  // Initialize Mapbox map inside Register Modal
  useEffect(() => {
    if (!registerModal.open || !registerMapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const lat = parseFloat(registerForm.latitude) || 10.1330;
    const lng = parseFloat(registerForm.longitude) || 124.8700;

    registerMap.current = new mapboxgl.Map({
      container: registerMapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [lng, lat],
      zoom: 15,
    });

    registerMap.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const el = document.createElement("div");
    el.className = "flex flex-col items-center group cursor-grab";
    el.innerHTML = `
      <div class="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold shadow-lg mb-1 whitespace-nowrap border border-cyan-400">
        ${registerForm.full_name || "New Source"}
      </div>
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 border-2 border-white shadow-xl flex items-center justify-center text-white ring-4 ring-cyan-500/25">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `;

    registerMarker.current = new mapboxgl.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([lng, lat])
      .addTo(registerMap.current);

    registerMarker.current.on("dragend", () => {
      const lngLat = registerMarker.current.getLngLat();
      setRegisterForm((prev) => ({
        ...prev,
        latitude: parseFloat(lngLat.lat.toFixed(6)),
        longitude: parseFloat(lngLat.lng.toFixed(6)),
      }));
    });

    registerMap.current.on("click", (e) => {
      const { lng: clickLng, lat: clickLat } = e.lngLat;
      registerMarker.current.setLngLat([clickLng, clickLat]);
      setRegisterForm((prev) => ({
        ...prev,
        latitude: parseFloat(clickLat.toFixed(6)),
        longitude: parseFloat(clickLng.toFixed(6)),
      }));
    });

    const timer = setTimeout(() => {
      if (registerMap.current) {
        registerMap.current.resize();
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      if (registerMap.current) {
        registerMap.current.remove();
        registerMap.current = null;
        registerMarker.current = null;
      }
    };
  }, [registerModal.open]);

  // Use Current Location for Register Modal
  const handleRegisterUseCurrentLocation = () => {
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

        setRegisterForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        if (registerMap.current) {
          registerMap.current.flyTo({
            center: [lng, lat],
            zoom: 16,
            essential: true,
          });
        }
        if (registerMarker.current) {
          registerMarker.current.setLngLat([lng, lat]);
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

  const handleRegisterManualCoordChange = (field, val) => {
    setRegisterForm((prev) => {
      const updated = { ...prev, [field]: val };
      const lat = field === "latitude" ? parseFloat(val) : parseFloat(prev.latitude);
      const lng = field === "longitude" ? parseFloat(val) : parseFloat(prev.longitude);
      if (!isNaN(lat) && !isNaN(lng) && registerMarker.current && registerMap.current) {
        registerMarker.current.setLngLat([lng, lat]);
        registerMap.current.flyTo({ center: [lng, lat], zoom: 15 });
      }
      return updated;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-purple-600" />
              <span>Sanitization Inspector Dashboard</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Barangay Endorsements & Inspection Requests
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Review water concerns escalated by Barangay Officials, process resident water source submissions, dispatch field testing, and certify clean water points.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : "text-slate-500"} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Alert Messages */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 text-xs cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-red-700 hover:text-red-900 text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Key Metric Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => {
            setActiveTab("escalated");
            setStatusFilter("all");
          }}
          className={`p-5 rounded-3xl border shadow-sm cursor-pointer hover:shadow-md transition-all group ${
            activeTab === "escalated" && statusFilter === "all"
              ? "bg-purple-50 border-purple-400 ring-2 ring-purple-400/30"
              : "bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-200/80"
          }`}
        >
          <div className="flex justify-between items-center text-purple-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-purple-700">Passed to CHU</span>
            <ShieldAlert size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{metrics.escalated}</div>
          <p className="text-[11px] text-purple-700 font-medium mt-1">Endorsed by Brgy Officials</p>
        </div>

        <div 
          onClick={() => {
            setActiveTab("new_sources");
            setStatusFilter("all");
          }}
          className={`p-5 rounded-3xl border shadow-sm cursor-pointer hover:shadow-md transition-all group ${
            activeTab === "new_sources" && statusFilter === "all"
              ? "bg-blue-50 border-blue-400 ring-2 ring-blue-400/30"
              : "bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-200/80"
          }`}
        >
          <div className="flex justify-between items-center text-blue-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-blue-700">New Water Sources</span>
            <Droplets size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{metrics.newSources}</div>
          <p className="text-[11px] text-blue-700 font-medium mt-1">Submitted for verification</p>
        </div>

        <div 
          onClick={() => {
            setActiveTab("all");
            setStatusFilter("in_progress");
          }}
          className={`p-5 rounded-3xl border shadow-sm cursor-pointer hover:shadow-md transition-all group ${
            activeTab === "all" && statusFilter === "in_progress"
              ? "bg-amber-50 border-amber-400 ring-2 ring-amber-400/30"
              : "bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-200/80"
          }`}
        >
          <div className="flex justify-between items-center text-amber-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-amber-700">In-Progress Audits</span>
            <Activity size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{metrics.inProgress}</div>
          <p className="text-[11px] text-amber-700 font-medium mt-1">Active field tests underway</p>
        </div>

        <div 
          onClick={() => {
            setActiveTab("all");
            setStatusFilter("completed");
          }}
          className={`p-5 rounded-3xl border shadow-sm cursor-pointer hover:shadow-md transition-all group ${
            activeTab === "all" && statusFilter === "completed"
              ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30"
              : "bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-200/80"
          }`}
        >
          <div className="flex justify-between items-center text-emerald-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-emerald-700">Completed & Certified</span>
            <CheckCheck size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">{metrics.completed}</div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Inspected & actioned</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
          <button
            onClick={() => {
              setActiveTab("all");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "all"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            All Submissions ({combinedItems.length})
          </button>

          <button
            onClick={() => {
              setActiveTab("escalated");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "escalated"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60"
            }`}
          >
            <ShieldAlert size={14} />
            <span>Passed to CHU ({metrics.escalated})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("new_sources");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "new_sources"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200/60"
            }`}
          >
            <Droplets size={14} />
            <span>New Water Sources ({metrics.newSources})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("inspections");
              setStatusFilter("all");
            }}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "inspections"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <FileText size={14} />
            <span>Inspection Requests</span>
          </button>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </div>

          {/* Barangay Dropdown */}
          <select
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-blue-600 font-medium cursor-pointer"
          >
            <option value="all">All Barangays ({MAASIN_BARANGAYS.length})</option>
            {MAASIN_BARANGAYS.map((b) => (
              <option key={b} value={b}>Brgy. {b}</option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`px-3.5 py-2.5 border rounded-2xl text-xs font-medium cursor-pointer transition-all ${
              statusFilter !== "all"
                ? "bg-blue-50 border-blue-400 text-blue-900 font-bold"
                : "bg-slate-50 border-slate-200 text-slate-800 focus:outline-none focus:border-blue-600"
            }`}
          >
            <option value="all">Status: All</option>
            <option value="pending">Status: Pending / Awaiting Action</option>
            <option value="in_progress">Status: In Progress / Field Testing</option>
            <option value="completed">Status: Completed / Validated</option>
          </select>
        </div>
      </div>

      {/* Main Items Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-[11px] font-bold uppercase text-slate-400 tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-4 px-6">Report / Water Source</th>
                <th className="py-4 px-6">Type & Origin</th>
                <th className="py-4 px-6">Location</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Inspector Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <span>Loading endorsed reports and water source submissions...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-slate-400">
                    <Droplets size={36} className="mx-auto text-slate-300 mb-2.5" />
                    <p className="font-bold text-sm text-slate-700">No items found matching current filters</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      {statusFilter !== "all" 
                        ? `The selected status filter ("${statusFilter.replace('_', ' ')}") has 0 matching submissions in this tab.`
                        : "No endorsed items match your current filter settings."}
                    </p>
                    {(statusFilter !== "all" || selectedBarangay !== "all" || searchQuery || activeTab !== "all") && (
                      <button
                        onClick={() => {
                          setStatusFilter("all");
                          setSelectedBarangay("all");
                          setSearchQuery("");
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw size={13} />
                        <span>Show All Statuses & Clear Filters</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isPending = item.status === "pending" || item.status === "escalated";
                  const isInProgress = item.status === "in_progress";
                  const isCompleted = item.status === "completed" || item.status === "validated";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Title & Description */}
                      <td className="py-4 px-6 max-w-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm truncate">{item.title}</p>
                            {item.photoUrl && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                Proof 📷
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                            {item.cleanDesc || item.description}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                            <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"}</span>
                            {item.reason && (
                              <>
                                <span>•</span>
                                <span className="text-purple-700 italic truncate max-w-[180px]">Brgy Note: {item.reason}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type & Origin */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.isEscalated
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : item.isNewSource
                              ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}>
                            {item.isEscalated && <ShieldAlert size={11} />}
                            {item.isNewSource && <Droplets size={11} />}
                            <span>{item.category.replace(/_/g, " ")}</span>
                          </span>

                          {item.isEscalated && (
                            <p className="text-[10px] font-semibold text-purple-700">Endorsed to CHU</p>
                          )}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800">Brgy. {item.barangay}</p>
                          {(item.latitude || item.longitude) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] border border-blue-200">
                              <MapPin size={10} />
                              <span>{parseFloat(item.latitude).toFixed(4)}, {parseFloat(item.longitude).toFixed(4)}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Jurisdiction area</span>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                          isInProgress
                            ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                            : isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : item.isEscalated
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {isInProgress && <Activity size={12} />}
                          {isCompleted && <CheckCircle2 size={12} />}
                          {isPending && !isInProgress && <Clock size={12} />}
                          <span>
                            {isInProgress
                              ? "Field Testing"
                              : isCompleted
                              ? "Completed / Certified"
                              : item.isEscalated
                              ? "Awaiting CHU Audit"
                              : "Pending Review"}
                          </span>
                        </span>
                      </td>

                      {/* Inspector Action Buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* View Full Details Modal */}
                          <button
                            type="button"
                            onClick={() => setDetailModalItem(item.original)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="View GPS Pinpoint & Photo Proof"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          {/* Action 1: Start Inspection / Claim (for non-new source concerns & requests) */}
                          {!isInProgress && !isCompleted && !item.isNewSource && (
                            <button
                              type="button"
                              onClick={() => handleStartInspection(item)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <TestTube size={13} />
                              <span>Start Test</span>
                            </button>
                          )}

                          {/* Action 2: Log Lab Findings & Complete (for non-new source concerns & requests) */}
                          {isInProgress && !item.isNewSource && (
                            <button
                              type="button"
                              onClick={() => setTestModal({ open: true, item, type: item.kind })}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 animate-bounce-short"
                            >
                              <CheckCircle2 size={13} />
                              <span>Log Findings</span>
                            </button>
                          )}

                          {/* Action 3: Register as Official Water Source (for new/unregistered sources) */}
                          {item.isNewSource && !isCompleted && (
                            <button
                              type="button"
                              onClick={() => openRegisterModalFor(item)}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                              title="Verify and register into official water inventory"
                            >
                              <PlusCircle size={13} />
                              <span>Register Source</span>
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

      {/* Mapbox & Photo Proof Detail Modal */}
      {detailModalItem && (
        <ReportDetailModal
          report={detailModalItem}
          onClose={() => setDetailModalItem(null)}
          onUpdateStatus={async (id, newStatus) => {
            await fetch(`${API_URL}/resident-reports/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ status: newStatus })
            });
            fetchData();
            setDetailModalItem(null);
          }}
          onOpenRejectModal={() => {}}
          actionLoading={actionLoading}
          isStaff={true}
        />
      )}

      {/* Log Lab & Field Findings Modal */}
      {testModal.open && testModal.item && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5 animate-fade-in">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Field Test & Lab Certification
                </span>
                <h3 className="text-lg font-bold text-slate-900">{testModal.item.title}</h3>
                <p className="text-xs text-slate-500">Record water quality parameters for Brgy. {testModal.item.barangay}</p>
              </div>
              <button
                onClick={() => setTestModal({ open: false, item: null, type: "" })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTestFindings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Overall Water Potability Certification
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestForm({ ...testForm, water_status: "safe" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      testForm.water_status === "safe"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ✓ Potable / Safe
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestForm({ ...testForm, water_status: "needs_chlorination" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      testForm.water_status === "needs_chlorination"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ⚠ Chlorinate
                  </button>

                  <button
                    type="button"
                    onClick={() => setTestForm({ ...testForm, water_status: "contaminated" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      testForm.water_status === "contaminated"
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    ✕ Contaminated
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    Free Chlorine (ppm)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={testForm.chlorine_residual}
                    onChange={(e) => setTestForm({ ...testForm, chlorine_residual: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="0.2 - 0.5"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                    pH Level
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={testForm.ph_level}
                    onChange={(e) => setTestForm({ ...testForm, ph_level: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="6.5 - 8.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  E. Coli / Microbial Test Result
                </label>
                <select
                  value={testForm.e_coli}
                  onChange={(e) => setTestForm({ ...testForm, e_coli: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="Negative">Negative / 0 CFU (Safe)</option>
                  <option value="Positive">Positive / Detected (Contaminated)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Inspector Findings & Directives
                </label>
                <textarea
                  rows={3}
                  value={testForm.notes}
                  onChange={(e) => setTestForm({ ...testForm, notes: e.target.value })}
                  placeholder="e.g. Conducted physical sample testing at water tap. Chlorine residual normal, safe for residential consumption..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 leading-relaxed"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTestModal({ open: false, item: null, type: "" })}
                  className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-1/2 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCheck size={14} />
                  <span>Submit & Certify</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Water Source Modal */}
      {registerModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-fade-in max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setRegisterModal({ open: false, item: null })}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Register Verified Water Station
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Inspect, verify pre-filled GPS coordinates from citizen report, and certify official water point parameters
            </p>

            <form onSubmit={handleRegisterWaterSource} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Station / Source Name
                </label>
                <input
                  type="text"
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  placeholder="e.g. Purok 3 Deep Well Spring"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Source Type
                  </label>
                  <select
                    value={registerForm.source_type}
                    onChange={(e) => setRegisterForm({ ...registerForm, source_type: e.target.value })}
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Barangay
                  </label>
                  <select
                    value={registerForm.barangay}
                    onChange={(e) => setRegisterForm({ ...registerForm, barangay: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {MAASIN_BARANGAYS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mapbox Interactive Pinpoint & Use Current Location (prefilled from resident report) */}
              <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-blue-200 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Compass size={16} className="text-blue-600" />
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Station Location (Coordinates from Citizen Report)
                      </label>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Pre-filled with resident GPS. Click map or drag the pin to adjust if necessary.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegisterUseCurrentLocation}
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
                  <div ref={registerMapContainer} className="w-full h-full" />
                  <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-[11px] font-mono shadow-md border border-white/10 pointer-events-none flex items-center gap-2 z-10">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span>
                      Lat: {parseFloat(registerForm.latitude || 0).toFixed(6)} | Lng: {parseFloat(registerForm.longitude || 0).toFixed(6)}
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
                      value={registerForm.latitude}
                      onChange={(e) => handleRegisterManualCoordChange("latitude", e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">Longitude (GPS)</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={registerForm.longitude}
                      onChange={(e) => handleRegisterManualCoordChange("longitude", e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Safety Status
                  </label>
                  <select
                    value={registerForm.status}
                    onChange={(e) => setRegisterForm({ ...registerForm, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="safe">Safe</option>
                    <option value="warning">Warning Level</option>
                    <option value="undrinkable">Contaminated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    E. Coli (CFU/100ml)
                  </label>
                  <input
                    type="number"
                    value={registerForm.e_coli_count}
                    onChange={(e) => setRegisterForm({ ...registerForm, e_coli_count: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Coliform (MPN/100ml)
                  </label>
                  <input
                    type="number"
                    value={registerForm.coliform_count}
                    onChange={(e) => setRegisterForm({ ...registerForm, coliform_count: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inspection Notes / Details
                </label>
                <textarea
                  rows={3}
                  value={registerForm.description}
                  onChange={(e) => setRegisterForm({ ...registerForm, description: e.target.value })}
                  placeholder="Sanitation conditions, pipe integrity, chlorination notes..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRegisterModal({ open: false, item: null })}
                  className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-1/2 py-2.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 size={14} />
                  <span>Register Station</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EndorsedReports;
