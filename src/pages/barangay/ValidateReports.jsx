import useReportRefresh from "../../hooks/useReportRefresh";
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
  Eye,
  History
} from "lucide-react";
import ReportDetailModal from "../../components/ReportDetailModal";
import ErrorNotice from "../../components/ErrorNotice";

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
  const raw = r.clean_description || r.description || "";
  return raw
    .replace(/\[(?:Attached\s+)?Photo\s+Proof:?\s*[^\]]+\]/gi, "")
    .replace(/\[Inspected Source:[^\]]+\]\s*/gi, "")
    .replace(/https?:\/\/[^\s\]]+/gi, "")
    .trim();
};


const ValidateReports = () => {
  const { user, token, API_URL } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [doneFilter, setDoneFilter] = useState("all"); // "all" | "done" | "dismissed"
  const [dismissModal, setDismissModal] = useState({ open: false, reportId: null, reason: "" });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [detailReport, setDetailReport] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchReports = async (showLoading = false) => {
    try {
      if (showLoading === true) setLoading(true);
      const res = await fetch(`${API_URL}/resident-reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(typeof data.detail === "string" ? data.detail : "Could not load the report queue.");
      if (data.success && Array.isArray(data.data)) {
        // Exclude unregistered_source since new water sources are now reviewed directly in the Water Sources Registry
        const waterConcernsOnly = data.data.filter(
          (r) => r.type !== "unregistered_source" && r.category !== "unregistered_source"
        );
        setReports(waterConcernsOnly);
        setDetailReport((current) => current ? waterConcernsOnly.find((r) => r.id === current.id) || null : null);
      }
    } catch (err) {
      console.error("Error fetching resident reports:", err);
      setErrorMsg(err.message || "Could not load the report queue.");
    } finally {
      setLoading(false);
    }
  };

  useReportRefresh(fetchReports, API_URL, token);

  const handleUpdateStatus = async (reportId, newStatus, passToInspector = false, reason = "") => {
    if (actionLoading) return false;
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
          setSuccessMsg("Report verified & validated! You can now choose 'Pass to CHU' or mark as 'Done'.");
        } else if (newStatus === "done") {
          setSuccessMsg("Report marked as Done and archived in Done History.");
        } else if (newStatus === "dismissed" || newStatus === "rejected") {
          setSuccessMsg("Report dismissed and archived in Done History.");
        } else {
          setSuccessMsg(`Report status updated to ${newStatus}.`);
        }
        
        // If modal was open for this report, update its state
        if (detailReport && detailReport.id === reportId) {
          setDetailReport({
            ...detailReport,
            status: newStatus,
            reason: reason || detailReport.reason
          });
        }
        
        await fetchReports();
        return true;
      } else {
        setErrorMsg(data.detail || "Failed to update report status.");
      }
    } catch (err) {
      console.error("Error validating report:", err);
      setErrorMsg("Network error communicating with server.");
    } finally {
      setActionLoading(null);
    }
    return false;
  };

  const pendingCount = reports.filter((r) => !r.status || r.status === "pending").length;
  const validatedCount = reports.filter((r) => r.status === "validated").length;
  const doneCount = reports.filter((r) => r.status === "done" || r.status === "resolved" || r.status === "completed").length;
  const dismissedCount = reports.filter((r) => r.status === "dismissed" || r.status === "rejected").length;
  const doneHistoryTotal = doneCount + dismissedCount;
  const processingCount = reports.filter((r) => ["assigned", "processing", "in_progress"].includes(r.status)).length;
  const escalatedCount = reports.filter((r) => r.status === "escalated" || r.status === "passed_to_chu").length;

  const filteredReports = reports.filter((r) => {
    if (statusFilter === "processing") return ["assigned", "processing", "in_progress"].includes(r.status);
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return !r.status || r.status === "pending";
    if (statusFilter === "validated") return r.status === "validated";
    if (statusFilter === "escalated") return r.status === "escalated" || r.status === "passed_to_chu";
    if (statusFilter === "done") {
      const isD = r.status === "done" || r.status === "resolved" || r.status === "completed";
      const isDis = r.status === "dismissed" || r.status === "rejected";
      if (doneFilter === "done") return isD;
      if (doneFilter === "dismissed") return isDis;
      return isD || isDis;
    }
    return true;
  });

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
            Review incoming water quality complaints and contamination concerns. Validate incoming reports, and forward validated cases directly to CHU (City Health Unit) for field audits. New water source submissions are reviewed in the Water Sources Registry.
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

      {!detailReport && !dismissModal.open && <ErrorNotice error={errorMsg} />}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Pending Review</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "pending" ? "bg-amber-800/40 text-white" : "bg-amber-100 text-amber-800"
            }`}>{pendingCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter("validated")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "validated"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Validated</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "validated" ? "bg-emerald-800/40 text-white" : "bg-emerald-100 text-emerald-800"
            }`}>{validatedCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter("escalated")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "escalated"
                ? "bg-purple-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>Passed to CHU</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "escalated" ? "bg-purple-900/40 text-white" : "bg-purple-100 text-purple-800"
            }`}>{escalatedCount}</span>
          </button>
          <button onClick={() => setStatusFilter("processing")}
            className={`px-4 py-2 rounded-xl border text-xs font-semibold ${statusFilter === "processing" ? "bg-cyan-700 text-white" : "bg-white text-cyan-800 border-cyan-200"}`}>
            Processing <span className="ml-1">{processingCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>All Submissions</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
            }`}>{reports.length}</span>
          </button>
        </div>

        {/* History Tab - Right Side Corner */}
        <button
          onClick={() => setStatusFilter("done")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ml-auto sm:ml-0 ${
            statusFilter === "done"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <History size={14} className={statusFilter === "done" ? "text-white" : "text-slate-400"} />
          <span>History</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === "done" ? "bg-blue-800/40 text-white" : "bg-blue-100 text-blue-800"
          }`}>{doneHistoryTotal}</span>
        </button>
      </div>

      {/* History Sub-Filter (Visible when on History tab) */}
      {statusFilter === "done" && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1 mr-1">
            History Filter:
          </span>
          <button
            onClick={() => setDoneFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              doneFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <span>All ({doneHistoryTotal})</span>
          </button>
          <button
            onClick={() => setDoneFilter("done")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              doneFilter === "done"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <span>Done ({doneCount})</span>
          </button>
          <button
            onClick={() => setDoneFilter("dismissed")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              doneFilter === "dismissed"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            <span>Dismissed ({dismissedCount})</span>
          </button>
        </div>
      )}

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
                <th className="py-3.5 px-6">Description</th>
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
                  const isDone = r.status === "done" || r.status === "resolved" || r.status === "completed";
                  const isDismissed = r.status === "dismissed" || r.status === "rejected";
                  const isProcessing = ["in_progress", "processing", "assigned"].includes(r.status);
  const isEscalated = r.status === "escalated" || r.status === "passed_to_chu";
                  const displayDesc = cleanDesc(r) || r.description;
                  const isBusy = actionLoading === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Brgy. {r.barangay}</p>
                      </td>

                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize border border-slate-200">
                          {(r.type || r.category || "Concern").replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-600 max-w-sm">
                        <p className="leading-relaxed truncate max-w-xs">{displayDesc}</p>
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
                            : isDone
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : isDismissed
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : isEscalated
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}>
                          {isProcessing ? "Processing" : isEscalated ? "Passed to CHU" : isValidated ? "Validated" : isDone ? "Done" : isDismissed ? "Dismissed" : "Pending Review"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => setDetailReport(r)}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 bg-white hover:bg-blue-50 font-semibold text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="View full report details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
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
          onOpenRejectModal={(id) => setDismissModal({ open: true, reportId: id, reason: "" })}
          actionLoading={actionLoading}
          error={dismissModal.open ? null : errorMsg}
          isStaff={true}
        />
      )}

      {/* Dismiss Reason Modal */}
      {dismissModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-fade-in">
            <h3 className="font-bold text-base text-slate-900">Dismiss Citizen Report</h3>
            <ErrorNotice error={errorMsg} />
            <p className="text-xs text-slate-500">
              Provide an optional note or reason for dismissing this concern. The report will be moved to Done History with a Dismissed status.
            </p>
            <textarea
              rows={3}
              value={dismissModal.reason}
              onChange={(e) => setDismissModal({ ...dismissModal, reason: e.target.value })}
              placeholder="e.g. Duplicate report, invalid concern, or issue already settled..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDismissModal({ open: false, reportId: null, reason: "" })}
                disabled={Boolean(actionLoading)}
                className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(actionLoading)}
                onClick={async () => {
                  const saved = await handleUpdateStatus(dismissModal.reportId, "dismissed", false, dismissModal.reason);
                  if (saved) setDismissModal({ open: false, reportId: null, reason: "" });
                }}
                className="w-1/2 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md cursor-pointer"
              >
                Confirm Dismissal
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default ValidateReports;
