import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { AlertOctagon, Send, CheckCircle2, AlertCircle } from "lucide-react";

const EscalateConcern = () => {
  const { user, token, API_URL } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    severity: "critical",
    message: "",
    barangay: user?.barangay || "Combado"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: `[URGENT ESCALATION] ${formData.title} (Brgy. ${user?.barangay})`,
          message: formData.message,
          type: "critical",
          barangay: user?.barangay,
          target_roles: ["city_health_officer", "sanitization_inspector"]
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Urgent escalation dispatched directly to City Health Officers and Sanitization Inspectors!");
        setFormData({
          title: "",
          severity: "critical",
          message: "",
          barangay: user?.barangay || "Combado"
        });
      } else {
        setErrorMsg(data.detail || "Failed to escalate.");
      }
    } catch (err) {
      console.error("Error escalating concern:", err);
      setErrorMsg("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in font-sans">
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-amber-900 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <AlertOctagon size={26} className="text-red-300" />
          <h1 className="text-3xl font-extrabold text-white">Emergency Incident Escalation</h1>
        </div>
        <p className="text-white/80 text-sm max-w-xl">
          Trigger high-priority alerts to the City Health Officer for immediate investigation of suspected waterborne disease outbreaks, acute gastroenteritis, or severe toxic runoff.
        </p>
      </div>

      {successMsg && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Escalation Sent</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Incident Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Cluster of Diarrheal Illness Cases around Purok 4 Well"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-red-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Urgency Level</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-red-600"
              >
                <option value="critical">Critical (Immediate Field Response Required)</option>
                <option value="high">High Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Barangay</label>
              <input
                type="text"
                value={user?.barangay || "Combado"}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Detailed Escalation Narrative & Clinical Symptoms</label>
            <textarea
              rows={5}
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Detail number of affected residents, symptoms (fever, diarrhea, vomiting), water source used, and urgent medical or chlorination equipment needed..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-red-600 placeholder:text-slate-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-full bg-red-700 hover:bg-red-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Dispatching Emergency Escalation..." : "Transmit Critical Escalation"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EscalateConcern;
