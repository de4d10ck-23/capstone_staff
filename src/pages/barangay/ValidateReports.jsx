import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { FileCheck, CheckCircle2, XCircle, AlertCircle, RefreshCw } from "lucide-react";

const ValidateReports = () => {
  const { user, token, API_URL } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/resident-reports?barangay=${encodeURIComponent(user?.barangay || '')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReports(data.data);
      }
    } catch (err) {
      console.error("Error fetching resident reports:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user, token, API_URL]);

  const handleUpdateStatus = async (reportId, newStatus) => {
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/resident-reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Report marked as ${newStatus}!`);
        fetchReports();
      } else {
        setErrorMsg(data.detail || "Failed to update status.");
      }
    } catch (err) {
      console.error("Error validating report:", err);
      setErrorMsg("Network error.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Validate Citizen Reports & Concerns</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review incoming water discoloration, odor, and broken pipeline reports for Barangay {user?.barangay}
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
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

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Resident Submissions ({reports.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Subject / Issue</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Description</th>
                <th className="py-3.5 px-6">Submitted Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Validation Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">Loading resident reports...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    No reports submitted by residents of Barangay {user?.barangay} yet.
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isValidated = r.status === "validated";
                  const isDismissed = r.status === "dismissed";

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{r.title}</td>
                      <td className="py-4 px-6 text-slate-600 capitalize">{r.category?.replace(/_/g, " ")}</td>
                      <td className="py-4 px-6 text-slate-600 max-w-xs">{r.description}</td>
                      <td className="py-4 px-6 text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isValidated ? "bg-emerald-100 text-emerald-800" : isDismissed ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {r.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateStatus(r.id, "validated")}
                            className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200 transition-colors"
                          >
                            Validate
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, "dismissed")}
                            className="px-3 py-1 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium border border-slate-200 transition-colors"
                          >
                            Dismiss
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
    </div>
  );
};

export default ValidateReports;
