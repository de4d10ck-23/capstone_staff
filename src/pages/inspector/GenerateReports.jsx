import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { FileText, Download, Plus, Filter, Calendar, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { MAASIN_BARANGAYS as barangays } from "../../constants/barangays";

const GenerateReports = () => {
  const { token, API_URL, user } = useAuth();
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState("sanitization_audit");
  const [barangay, setBarangay] = useState("Combado");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReports(data.data);
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token, API_URL]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setGenerating(true);

    try {
      const res = await fetch(`${API_URL}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title || `Sanitary Inspection Audit - Brgy. ${barangay}`,
          report_type: reportType,
          barangay: barangay
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Inspection report compiled and forwarded to City Health Officer!");
        setTitle("");
        fetchReports();
      } else {
        setErrorMsg(data.detail || "Failed to generate report.");
      }
    } catch (err) {
      console.error("Error generating report:", err);
      setErrorMsg("Network error generating report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sanitization Inspector Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Submit water safety audits, chlorine test logs, and station inspections to CHO</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-1">Create Inspection Audit Report</h2>
        <p className="text-xs text-slate-500 mb-6">Compile field findings into an official surveillance document</p>

        <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Water Station Audit"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Target Barangay</label>
            <select
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {barangays.map((b) => (
                <option key={b} value={b}>Brgy. {b}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <Plus size={16} />
              <span>{generating ? "Generating..." : "Generate & Submit"}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Submitted Reports</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Report Title</th>
                <th className="py-3.5 px-6">Barangay</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">Loading reports...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">No reports generated yet.</td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span>{r.title}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-600">Brgy. {r.barangay || "City"}</td>
                    <td className="py-4 px-6 text-slate-500">{new Date(r.created_at || Date.now()).toLocaleDateString()}</td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {r.status || "Ready"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          const csvContent = "data:text/csv;charset=utf-8,Report Title,Barangay,Date\n" + `${r.title},${r.barangay || 'City Wide'},${r.created_at}\n`;
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `${r.title.replace(/\s+/g, "_")}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold"
                      >
                        <Download size={14} />
                        <span>Export CSV</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GenerateReports;
