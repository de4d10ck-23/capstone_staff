import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import LocationPickerMap from "../../components/LocationPickerMap";
import { 
  Send, 
  AlertOctagon, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldAlert, 
  Users, 
  MapPin, 
  Info 
} from "lucide-react";

const SubmitReport = () => {
  const { user, token, API_URL } = useAuth();

  // Mode: "endorsement" | "escalation"
  const [submissionMode, setSubmissionMode] = useState("endorsement");

  const [formData, setFormData] = useState({
    title: "",
    severity: "normal", // auto-set by mode: "normal" (endorsement) / "critical" (escalation)
    primaryConcern: "water_quality",
    otherConcern: "",
    narrative: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Pinned water source location: { latitude, longitude, locationId, locationName }
  const [pinnedLocation, setPinnedLocation] = useState({
    latitude: 10.133,
    longitude: 124.87,
    locationId: null,
    locationName: "Water Station",
  });
  const [waterSources, setWaterSources] = useState([]);

  useEffect(() => {
    if (!token) return;
    const brgy = (user?.barangay || "").trim().toLowerCase();
    fetch(`${API_URL}/water-locations`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d?.data) ? d.data : [];
        // Only water sources within the official's barangay
        const scoped = brgy
          ? list.filter((s) => (s.barangay || "").trim().toLowerCase() === brgy)
          : list;
        scoped.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setWaterSources(scoped);
      })
      .catch(() => setWaterSources([]));
  }, [API_URL, token, user?.barangay]);

  const handlePinChange = (loc) => {
    setPinnedLocation(loc);
  };

  // Dropdown -> map pin
  const handleSourceSelect = (value) => {
    if (value === "__custom__") {
      // Keep current pin (if any) but unlink from registered source
      setPinnedLocation((prev) => (prev ? { ...prev, locationId: null, locationName: null } : null));
      return;
    }
    const src = waterSources.find((s) => String(s.id) === value);
    if (!src) {
      setPinnedLocation(null);
      return;
    }
    const lat = parseFloat(src.latitude);
    const lng = parseFloat(src.longitude);
    setPinnedLocation({
      latitude: isNaN(lat) ? 10.133 : Number(lat.toFixed(6)),
      longitude: isNaN(lng) ? 124.87 : Number(lng.toFixed(6)),
      locationId: src.id,
      locationName: src.name || "Water Source",
    });
  };

  const selectedSourceValue = pinnedLocation
    ? pinnedLocation.locationId
      ? String(pinnedLocation.locationId)
      : "__custom__"
    : "";

  const handleModeChange = (mode) => {
    setSubmissionMode(mode);
    setSuccessMsg("");
    setErrorMsg("");
    if (mode === "escalation") {
      setFormData((prev) => ({
        ...prev,
        severity: "critical",
        primaryConcern: prev.primaryConcern === "water_quality" ? "diarrhea_outbreak" : prev.primaryConcern
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        severity: "normal"
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!pinnedLocation) {
      setErrorMsg("Please pin the water source location on the map before submitting.");
      return;
    }

    setIsSubmitting(true);

    const isUrgent = submissionMode === "escalation";
    const brgyName = user?.barangay || "Jurisdiction";
    const { latitude, longitude, locationId, locationName } = pinnedLocation;

    const CONCERN_LABELS = {
      water_quality: "Water Quality & Safety Assessment",
      diarrhea_outbreak: "Waterborne Illness Symptoms (Diarrhea, Vomiting, Stomach Cramps)",
      turbidity_odor: "Turbidity / Discoloration / Foul Chemical Odor",
      station_damage: "Damaged Reservoir / Broken Supply Line",
      routine_inspection: "Scheduled Routine Sampling Request",
      other: "Other",
    };

    const concernText =
      formData.primaryConcern === "other"
        ? (formData.otherConcern?.trim() ? `Primary Concern: Other (${formData.otherConcern.trim()})` : "Primary Concern: Other")
        : (CONCERN_LABELS[formData.primaryConcern] ? `Primary Concern: ${CONCERN_LABELS[formData.primaryConcern]}` : null);

    const detailedDescription = [
      formData.narrative.trim(),
      concernText,
      locationName
        ? `Water Source: ${locationName}`
        : "Water Source: Unregistered location (pinned on map)",
      `Pinned Coordinates: ${latitude}, ${longitude} (https://www.google.com/maps?q=${latitude},${longitude})`
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      // 1. Submit Normal Report Record
      const reportRes = await fetch(`${API_URL}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title || `Barangay ${brgyName} ${isUrgent ? "Emergency Incident Report" : "Normal Report"}`,
          report_type: isUrgent ? "urgent_escalation" : "barangay_endorsement",
          type: isUrgent ? "urgent_escalation" : "barangay_endorsement",
          barangay: brgyName,
          description: detailedDescription,
          severity: formData.severity,
          latitude,
          longitude,
          location_id: locationId || null
        })
      });

      const reportData = await reportRes.json().catch(() => ({}));

      // 2. If Urgent Escalation, dispatch high-priority notification to CHO & Inspectors
      if (isUrgent) {
        try {
          await fetch(`${API_URL}/notifications`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              title: `[URGENT ESCALATION] ${formData.title} (Brgy. ${brgyName})`,
              message: detailedDescription,
              type: "critical",
              barangay: brgyName,
              target_roles: ["city_health_officer", "sanitization_inspector"]
            })
          });
        } catch (notifErr) {
          console.warn("Could not dispatch notification alert:", notifErr);
        }

        // 3. Dispatch urgent inspection request ticket for immediate sampling
        try {
          await fetch(`${API_URL}/inspections`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              description: `[URGENT ESCALATION from Brgy. ${brgyName}] ${formData.title}: ${detailedDescription}`,
              priority: "high",
              barangay: brgyName,
              latitude,
              longitude,
              location_id: locationId || null
            })
          });
        } catch (inspErr) {
          console.warn("Could not dispatch urgent inspection ticket:", inspErr);
        }
      }

      if (reportRes.ok || reportData.success) {
        setSuccessMsg(
          isUrgent
            ? `Emergency Incident Escalation transmitted directly to City Health Officers and Sanitization Inspectors! An expedited inspection ticket has also been dispatched.`
            : `Normal report successfully recorded and forwarded to the City Health Officer.`
        );

        setFormData({
          title: "",
          severity: isUrgent ? "critical" : "normal",
          primaryConcern: isUrgent ? "diarrhea_outbreak" : "water_quality",
          otherConcern: "",
          narrative: ""
        });
        setPinnedLocation({
          latitude: 10.133,
          longitude: 124.87,
          locationId: null,
          locationName: "Water Station",
        });
      } else {
        setErrorMsg(reportData.detail || "Failed to submit report.");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setErrorMsg("Network or server connection error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEscalation = submissionMode === "escalation";

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in font-sans">
      {/* Banner */}
      <div
        className={`rounded-3xl p-8 text-white shadow-xl transition-all duration-300 ${
          isEscalation
            ? "bg-gradient-to-r from-red-900 via-rose-900 to-amber-900 shadow-red-950/20"
            : "bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 shadow-blue-950/20"
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          {isEscalation ? (
            <AlertOctagon size={28} className="text-red-300 animate-pulse" />
          ) : (
            <Send size={26} className="text-cyan-300" />
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {isEscalation ? "Urgent Incident Escalation" : "Submit Barangay Report"}
          </h1>
        </div>
        <p className="text-white/80 text-sm max-w-xl">
          {isEscalation
            ? "Trigger urgent, high-priority notifications to the City Health Officer and Sanitization Inspectors for immediate investigation of disease outbreaks or contaminated water sources."
            : "Transmit official barangay water condition summaries, endorsements, and requested municipal interventions directly to the City Health Officer."}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200/80 shadow-sm grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("endorsement")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
            !isEscalation
              ? "bg-blue-900 text-white shadow-md shadow-blue-900/20"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText size={16} />
          <span>Normal Report</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange("escalation")}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
            isEscalation
              ? "bg-red-600 text-white shadow-md shadow-red-600/20"
              : "text-slate-600 hover:bg-red-50 hover:text-red-700"
          }`}
        >
          <ShieldAlert size={16} />
          <span>Emergency Incident Escalation</span>
        </button>
      </div>

      {/* Status Notifications */}
      {successMsg && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Transmission Successful</p>
            <p className="mt-0.5 text-xs text-emerald-700 leading-relaxed">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error Submitting</p>
            <p className="mt-0.5 text-xs text-red-700">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Subject / Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {isEscalation ? "Incident Title / Outbreak Subject" : "Report Subject / Title"} *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={
                isEscalation
                  ? "e.g. Cluster of Acute Diarrheal Cases around Purok 4 Deep Well"
                  : "e.g. Request for Routine Water Testing & Chlorination Support in Purok 2"
              }
              className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none transition-colors ${
                isEscalation
                  ? "border-slate-200 focus:border-red-600 focus:bg-white"
                  : "border-slate-200 focus:border-blue-600 focus:bg-white"
              }`}
              required
            />
          </div>

          {/* Grid: Barangay Jurisdiction & Specific Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Barangay Jurisdiction
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold">
                <MapPin size={16} className="text-blue-600" />
                <span>Barangay {user?.barangay || "Maasin City"}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Specific Location / Water Station
              </label>
              <select
                value={selectedSourceValue}
                onChange={(e) => handleSourceSelect(e.target.value)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none font-medium ${
                  isEscalation ? "focus:border-red-600" : "focus:border-blue-600"
                }`}
              >
                <option value="">
                  {waterSources.length > 0
                    ? `Select a water source (${waterSources.length} registered)`
                    : "No registered water sources in this barangay"}
                </option>
                {waterSources.map((src) => (
                  <option key={src.id} value={String(src.id)}>
                    {src.name || "Water Source"}
                    {src.source_type ? ` — ${src.source_type.replace(/_/g, " ")}` : ""}
                  </option>
                ))}
                <option value="__custom__">Other / Unregistered location (pin on map)</option>
              </select>
            </div>
          </div>

          {/* Station Location Mapbox Pinpoint */}
          <div>
            <LocationPickerMap
              value={pinnedLocation}
              onChange={handlePinChange}
              waterSources={waterSources}
              accent={isEscalation ? "red" : "blue"}
            />
          </div>

          {/* Primary Concern Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Primary Concern Category
            </label>
            <select
              value={formData.primaryConcern}
              onChange={(e) => setFormData({ ...formData, primaryConcern: e.target.value })}
              className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none font-medium ${
                isEscalation ? "focus:border-red-600" : "focus:border-blue-600"
              }`}
            >
              <option value="water_quality">Water Quality & Safety Assessment</option>
              <option value="diarrhea_outbreak">Waterborne Illness Symptoms (Diarrhea, Vomiting, Stomach Cramps)</option>
              <option value="turbidity_odor">Turbidity / Discoloration / Foul Chemical Odor</option>
              <option value="station_damage">Damaged Reservoir / Broken Supply Line</option>
              <option value="routine_inspection">Scheduled Routine Sampling Request</option>
              <option value="other">Other</option>
            </select>

            {formData.primaryConcern === "other" && (
              <div className="mt-2.5">
                <input
                  type="text"
                  value={formData.otherConcern}
                  onChange={(e) => setFormData({ ...formData, otherConcern: e.target.value })}
                  placeholder="Please specify other concern..."
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none ${
                    isEscalation ? "focus:border-red-600 focus:bg-white" : "focus:border-blue-600 focus:bg-white"
                  }`}
                  required
                />
              </div>
            )}
          </div>

          {/* Detailed Statement / Narrative */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {isEscalation
                ? "Incident Narrative & Clinical Observations *"
                : "Report Details *"}
            </label>
            <textarea
              rows={5}
              value={formData.narrative}
              onChange={(e) => setFormData({ ...formData, narrative: e.target.value })}
              placeholder={
                isEscalation
                  ? "Detail symptom onsets, dates, affected residents (children/elderly), suspected water station, and immediate medical or sanitization help needed..."
                  : "Detail current local drinking water observations, status of community tapstands, recommendations for the City Health Officer, and requested assistance..."
              }
              className={`w-full px-4 py-3 bg-slate-50 border rounded-2xl text-xs text-slate-900 focus:outline-none placeholder:text-slate-400 transition-colors ${
                isEscalation
                  ? "border-slate-200 focus:border-red-600 focus:bg-white"
                  : "border-slate-200 focus:border-blue-600 focus:bg-white"
              }`}
              required
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 rounded-full text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ${
                isEscalation
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/30"
                  : "bg-blue-900 hover:bg-blue-800 shadow-blue-900/30"
              }`}
            >
              {isSubmitting ? (
                <span>Transmitting...</span>
              ) : isEscalation ? (
                <>
                  <AlertOctagon size={16} />
                  <span>Dispatch Emergency Escalation to CHO & Inspectors</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>Submit Report to City Health Officer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitReport;
