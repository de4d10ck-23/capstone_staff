import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";

const SubmitReport = () => {
  const { user, token, API_URL } = useAuth();
  const [formData, setFormData] = useState({
    title: "",
    report_type: "barangay_endorsement",
    barangay: user?.barangay || "Combado",
    description: ""
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
      const res = await fetch(`${API_URL}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title || `Barangay ${user?.barangay} Official Water Assessment`,
          report_type: "barangay_endorsement",
          barangay: user?.barangay
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Barangay water assessment submitted directly to City Health Officer!");
        setFormData({
          title: "",
          report_type: "barangay_endorsement",
          barangay: user?.barangay || "Combado",
          description: ""
        });
      } else {
        setErrorMsg(data.detail || "Failed to submit report.");
      }
    } catch (err) {
      console.error("Error submitting report:", err);
      setErrorMsg("Network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in font-sans">
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Send size={24} className="text-cyan-300" />
          <h1 className="text-3xl font-extrabold text-white">Submit Barangay Endorsement</h1>
        </div>
        <p className="text-white/80 text-sm max-w-xl">
          Transmit official barangay water condition summaries and requested interventions to the City Health Officer.
        </p>
      </div>

      {successMsg && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Report Endorsed</p>
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
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Endorsement Subject</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Request for Emergency Well Chlorination in Purok 2"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Barangay Jurisdiction</label>
            <input
              type="text"
              value={user?.barangay || "Combado"}
              disabled
              className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Official Statement / Endorsement Details</label>
            <textarea
              rows={5}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detail observations, number of households impacted, and required CHO medical or sanitation action..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Transmitting..." : "Submit to City Health Officer"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmitReport;
