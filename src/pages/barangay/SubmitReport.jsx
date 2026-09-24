import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  Send, 
  AlertOctagon, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldAlert, 
  ClipboardCheck, 
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
    severity: "normal", // "normal", "high", "critical"
    location: "",
    households: "",
    primaryConcern: "water_quality",
    narrative: "",
    requestedActions: ["water_testing"]
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const toggleAction = (actionKey) => {
    setFormData((prev) => {
      const exists = prev.requestedActions.includes(actionKey);
      return {
        ...prev,
        requestedActions: exists
          ? prev.requestedActions.filter((a) => a !== actionKey)
          : [...prev.requestedActions, actionKey]
      };
    });
  };

  const handleModeChange = (mode) => {
    setSubmissionMode(mode);
    setSuccessMsg("");
    setErrorMsg("");
    if (mode === "escalation") {
      setFormData((prev) => ({
        ...prev,
        severity: prev.severity === "normal" ? "critical" : prev.severity,
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
    setIsSubmitting(true);

    const isUrgent = submissionMode === "escalation" || formData.severity === "critical" || formData.severity === "high";
    const brgyName = user?.barangay || "Jurisdiction";

    const detailedDescription = [
      formData.narrative.trim(),
      formData.location ? `Specific Location/Purok: ${formData.location}` : null,
      formData.households ? `Impacted Households: ${formData.households}` : null,
      formData.requestedActions.length > 0
        ? `Requested Interventions: ${formData.requestedActions.join(", ")}`
        : null
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      // 1. Submit Official Assessment / Endorsement Record
      const reportRes = await fetch(`${API_URL}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title || `Barangay ${brgyName} ${isUrgent ? "Emergency Incident Report" : "Official Water Assessment"}`,
          report_type: isUrgent ? "urgent_escalation" : "barangay_endorsement",
          type: isUrgent ? "urgent_escalation" : "barangay_endorsement",
          barangay: brgyName,
          description: detailedDescription,
          severity: formData.severity
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
              barangay: brgyName
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
            : `Barangay water assessment and endorsement successfully recorded and forwarded to the City Health Officer.`
        );

        setFormData({
          title: "",
          severity: isUrgent ? "critical" : "normal",
          location: "",
          households: "",
          primaryConcern: isUrgent ? "diarrhea_outbreak" : "water_quality",
          narrative: "",
          requestedActions: ["water_testing"]
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
          <span>Official Assessment / Endorsement</span>
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
              {isEscalation ? "Incident Title / Outbreak Subject" : "Report Subject / Endorsement Title"} *
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

          {/* Grid: Urgency Level & Barangay Jurisdiction */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Urgency / Priority Level *
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:outline-none transition-colors font-medium ${
                  isEscalation ? "border-red-200 focus:border-red-600" : "border-slate-200 focus:border-blue-600"
                }`}
              >
                {isEscalation ? (
                  <>
                    <option value="critical">Critical (Immediate Field Response Required)</option>
                    <option value="high">High Priority (Expedited Intervention)</option>
                  </>
                ) : (
                  <>
                    <option value="normal">Normal / Routine Review</option>
                    <option value="high">High Priority (Urgent Attention)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Barangay Jurisdiction
              </label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold">
                <MapPin size={16} className="text-blue-600" />
                <span>Barangay {user?.barangay || "Maasin City"}</span>
              </div>
            </div>
          </div>

          {/* Grid: Specific Location & Impacted Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Specific Location / Water Station
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Purok 3 Communal Tap / Station 5"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Impacted Households / Residents
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.households}
                  onChange={(e) => setFormData({ ...formData, households: e.target.value })}
                  placeholder="e.g. Approx. 20 households / 65 people"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Primary Concern Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Primary Concern Category
            </label>
            <select
              value={formData.primaryConcern}
              onChange={(e) => setFormData({ ...formData, primaryConcern: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
            >
              <option value="water_quality">Water Quality & Safety Assessment</option>
              <option value="diarrhea_outbreak">Waterborne Illness Symptoms (Diarrhea, Vomiting, Stomach Cramps)</option>
              <option value="turbidity_odor">Turbidity / Discoloration / Foul Chemical Odor</option>
              <option value="station_damage">Damaged Reservoir / Broken Supply Line</option>
              <option value="routine_inspection">Scheduled Routine Sampling Request</option>
            </select>
          </div>

          {/* Detailed Statement / Narrative */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              {isEscalation
                ? "Incident Narrative & Clinical Observations *"
                : "Official Statement / Endorsement Details *"}
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

          {/* Requested Actions / Interventions */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Requested Interventions from City Health Office / Inspectors
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { key: "water_testing", label: "Microbial Water Sampling & Lab Audit" },
                { key: "chlorination", label: "Emergency Well Chlorination / Disinfection" },
                { key: "medical_mission", label: "CHO Medical Mission & Oresol Support" },
                { key: "advisory", label: "City-wide / Local Boil Water Advisory" },
                { key: "station_shutdown", label: "Temporary Water Source Closure" },
              ].map((act) => {
                const checked = formData.requestedActions.includes(act.key);
                return (
                  <button
                    key={act.key}
                    type="button"
                    onClick={() => toggleAction(act.key)}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                      checked
                        ? isEscalation
                          ? "bg-red-50 border-red-300 text-red-900 font-semibold"
                          : "bg-blue-50 border-blue-300 text-blue-900 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                        checked
                          ? isEscalation
                            ? "bg-red-600 border-red-600 text-white"
                            : "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {checked && <ClipboardCheck size={12} />}
                    </div>
                    <span>{act.label}</span>
                  </button>
                );
              })}
            </div>
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
                  <span>Submit Official Endorsement to City Health Officer</span>
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
