import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { 
  FileCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Send, 
  MapPin, 
  ExternalLink, 
  Eye
} from "lucide-react";
import ReportDetailModal from "../../components/ReportDetailModal";

const extractPhotoProof = (r) => {
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

const cleanDesc = (r) => {
  if (!r) return "";
  if (r.clean_description) return r.clean_description;
  if (r.description) {
    return r.description.replace(/\[(?:Attached )?Photo Proof:\s*https?:\/\/[^\s\]]+\]/gi, "").trim();
  }
  return "";
};

const ValidateReports = () => {
  const { user, token, API_URL } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [detailReport, setDetailReport] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, reportId: null, reason: "" });
  const [actionLoading, setActionLoading] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/resident-reports`, {
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

  const handleUpdateStatus = async (reportId, newStatus, passToInspector = false, reason = "") => {
    setSuccessMsg("");
    setErrorMsg("");
    setActionLoading(reportId);

    try {
      const res = await fetch(`${API_URL}/resident-reports/${reportId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: newStatus,
          pass_to_inspector: passToInspector,
          reason: reason || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        if (passToInspector || newStatus === "escalated") {
          setSuccessMsg("Validated report passed directly to City Health Unit (CHU)! An active inspection ticket has been generated.");
        } else if (newStatus === "validated") {
          setSuccessMsg("Report verified & validated! You can now click 'Pass to CHU' to dispatch to the City Health Unit.");
        } else if (newStatus === "rejected") {
          setSuccessMsg("Report dismissed.");
        } else {
          setSuccessMsg(`Report status updated to ${newStatus}.`);
        }
        
        // If modal was open for this report, update its state or close
        if (detailReport && detailReport.id === reportId) {
          setDetailReport({
            ...detailReport,
            status: newStatus,
            reason: reason || detailReport.reason
          });
        }
        
        fetchReports();
      } else {
        setErrorMsg(data.detail || "Failed to update report status.");
      }
    } catch (err) {
      console.error("Error validating report:", err);
      setErrorMsg("Network error communicating with server.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return !r.status || r.status === "pending";
    if (statusFilter === "validated") return r.status === "validated";
    if (statusFilter === "escalated") return r.status === "escalated";
    if (statusFilter === "rejected") return r.status === "rejected" || r.status === "dismissed";
    return true;
  });

  const pendingCount = reports.filter((r) => !r.status || r.status === "pending").length;
  const validatedCount = reports.filter((r) => r.status === "validated").length;
  const escalatedCount = reports.filter((r) => r.status === "escalated").length;

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Barangay Governance & Triage
          </span>
          <h1 className="text-3xl font-extrabold text-white">Validate Citizen Reports & Concerns</h1>
          <p className="text-white/80 text-sm max-w-xl">
            Review incoming water quality reports and new water sources. Validate incoming reports, and forward validated cases directly to CHU (City Health Unit) for field audits.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-sm animate-fade-in">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setStatusFilter("all")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-900 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Submissions ({reports.length})
        </button>
        <button
          onClick={() => setStatusFilter("pending")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === "pending"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>1. Pending Review</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">{pendingCount}</span>
        </button>
        <button
          onClick={() => setStatusFilter("validated")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === "validated"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>2. Validated (Ready to Pass)</span>
          <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">{validatedCount}</span>
        </button>
        <button
          onClick={() => setStatusFilter("escalated")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
            statusFilter === "escalated"
              ? "bg-purple-700 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <span>3. Passed to CHU</span>
          <span className="px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px]">{escalatedCount}</span>
        </button>
      </div>

      {/* Main Reports Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">
            Citizen Concerns & Submissions ({filteredReports.length})
          </h3>
          <span className="text-xs text-slate-400">Barangay {user?.barangay || "Jurisdiction"}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Subject / Issue</th>
                <th className="py-3.5 px-6">Category</th>
                <th className="py-3.5 px-6">Description & Proof</th>
                <th className="py-3.5 px-6">Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">Loading resident reports...</td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    No reports match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => {
                  const isPending = !r.status || r.status === "pending";
                  const isValidated = r.status === "validated";
                  const isEscalated = r.status === "escalated";
                  const isRejected = r.status === "rejected" || r.status === "dismissed";
                  const photoUrl = extractPhotoProof(r);
                  const displayDesc = cleanDesc(r) || r.description;
                  const isBusy = actionLoading === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Brgy. {r.barangay}</p>
                        {(r.latitude || r.longitude) && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] border border-blue-200">
                            <MapPin size={10} />
                            <span>GPS: {parseFloat(r.latitude).toFixed(4)}, {parseFloat(r.longitude).toFixed(4)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize border border-slate-200">
                          {(r.type || r.category || "Concern").replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-600 max-w-sm">
                        <p className="leading-relaxed truncate max-w-xs">{displayDesc}</p>
                        {photoUrl && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedPhoto(photoUrl)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] border border-blue-200 transition-colors cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Photo Proof</span>
                            </button>
                          </div>
                        )}
                        {r.reason && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">
                            Note: {r.reason}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-500">
                        {r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent"}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPending
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : isValidated
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : isEscalated
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {isEscalated ? "Passed to CHU" : isValidated ? "Validated" : r.status || "Pending"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* View Details Button - Available on ALL statuses */}
                          <button
                            onClick={() => setDetailReport(r)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                            title="View full report details"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          {/* Step 1: If Pending -> Show Validate Report button */}
                          {isPending && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, "validated")}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                              title="Validate and confirm this resident report"
                            >
                              <CheckCircle2 size={13} />
                              <span>Validate</span>
                            </button>
                          )}

                          {/* Step 2: If Validated -> Show Pass to CHU button */}
                          {isValidated && (
                            <button
                              onClick={() => handleUpdateStatus(r.id, "escalated", true)}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 animate-pulse"
                              title="Forward validated report to CHU (City Health Unit) with inspection ticket"
                            >
                              <Send size={13} />
                              <span>Pass to CHU</span>
                            </button>
                          )}

                          {/* Step 3: If already Escalated / Passed -> Show active badge */}
                          {isEscalated && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-200">
                              <CheckCircle2 size={12} />
                              <span>Passed</span>
                            </span>
                          )}

                          {/* Dismiss / Reject Button (when not yet escalated or dismissed) */}
                          {!isEscalated && !isRejected && (
                            <button
                              onClick={() => setRejectModal({ open: true, reportId: r.id, reason: "" })}
                              disabled={isBusy}
                              className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 font-medium text-xs border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                              title="Dismiss Report"
                            >
                              Dismiss
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

      {/* Complete Concern & Report Details Modal with Mapbox */}
      {detailReport && (
        <ReportDetailModal
          report={detailReport}
          onClose={() => setDetailReport(null)}
          onUpdateStatus={handleUpdateStatus}
          onOpenRejectModal={(id) => setRejectModal({ open: true, reportId: id, reason: "" })}
          actionLoading={actionLoading}
          isStaff={true}
        />
      )}

      {/* Photo Proof Modal (Quick Viewer) */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Citizen Photo Proof</h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="w-full max-h-[70vh] overflow-hidden rounded-2xl bg-slate-100 flex items-center justify-center">
              <img
                src={selectedPhoto}
                alt="Full Proof Preview"
                className="max-h-[68vh] w-auto object-contain"
              />
            </div>
            <div className="flex justify-end">
              <a
                href={selectedPhoto}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                <span>Open Full Resolution</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss / Reject Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-fade-in">
            <h3 className="font-bold text-base text-slate-900">Dismiss Citizen Report</h3>
            <p className="text-xs text-slate-500">Provide an optional reason or note for dismissing this concern.</p>
            <textarea
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="e.g. Duplicate report, already inspected yesterday, or issue resolved..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectModal({ open: false, reportId: null, reason: "" })}
                className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleUpdateStatus(rejectModal.reportId, "rejected", false, rejectModal.reason);
                  setRejectModal({ open: false, reportId: null, reason: "" });
                }}
                className="w-1/2 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidateReports;
