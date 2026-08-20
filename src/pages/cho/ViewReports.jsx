import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { FileText, Download, CheckCircle2, AlertCircle, RefreshCw, Filter } from "lucide-react";

const ViewReports = () => {
  const { token, API_URL } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filtered = reports.filter((r) =>
    r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.barangay?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">City Health Office - Water Surveillance Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Review, verify, and export epidemiological & water safety audit documents</p>
        </div>
        <button
          onClick={fetchReports}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search report by title or barangay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-80 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-600"
          />
          <span className="text-xs text-slate-500 font-semibold">{filtered.length} Archived Documents</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Document Title</th>
                <th className="py-3.5 px-6">Jurisdiction Scope</th>
                <th className="py-3.5 px-6">Report Category</th>
                <th className="py-3.5 px-6">Date Generated</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">Loading reports...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-10 text-slate-400">No surveillance reports found.</td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span>{r.title}</span>
                    </td>
                    <td className="py-4 px-6 text-slate-700 font-medium">
                      {r.barangay ? `Brgy. ${r.barangay}` : "City Wide Surveillance"}
                    </td>
                    <td className="py-4 px-6 text-slate-600 capitalize">
                      {r.report_type?.replace(/_/g, " ") || "Audit"}
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          const csvContent = "data:text/csv;charset=utf-8,Report Title,Scope,Type,Date\n" + `${r.title},${r.barangay || 'City Wide'},${r.report_type},${r.created_at}\n`;
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `${r.title.replace(/\s+/g, "_")}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50 font-semibold"
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

export default ViewReports;
