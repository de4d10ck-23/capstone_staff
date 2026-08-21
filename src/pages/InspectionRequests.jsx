import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Check, 
  XCircle, 
  UserCheck, 
  MessageSquare,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Send,
  Play
} from "lucide-react";
import { Link } from "react-router-dom";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";

const InspectionRequests = () => {
  const { user, token, API_URL } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [notes, setNotes] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("in_progress");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const isInspector = user?.role === "sanitization_inspector";
  const isBarangayOfficial = user?.role === "barangay_official";

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/inspections`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInspections(data.data);
      }
    } catch (err) {
      console.error("Error fetching inspections:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInspectors = async () => {
    try {
      const res = await fetch(`${API_URL}/users?role=sanitization_inspector`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInspectors(data.data);
      }
    } catch (err) {
      console.error("Error fetching inspectors:", err);
    }
  };

  useEffect(() => {
    fetchInspections();
    fetchInspectors();
  }, [token, API_URL]);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedInspection) return;
    setIsUpdating(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/inspections/${selectedInspection.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: statusUpdate,
          notes: notes || selectedInspection.notes,
          assigned_to: assigneeId || undefined
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Inspection request updated successfully!");
        setSelectedInspection(null);
        setNotes("");
        setAssigneeId("");
        fetchInspections();
      } else {
        setErrorMsg(data.detail || "Failed to update inspection.");
      }
    } catch (err) {
      console.error("Error updating inspection:", err);
      setErrorMsg("Network error updating request.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickClaim = async (inspection) => {
    setIsUpdating(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/inspections/${inspection.id}/start`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Inspection claimed! Field sampling marked in-progress for Brgy. ${inspection.barangay}`);
        fetchInspections();
      } else {
        setErrorMsg(data.detail || "Failed to start inspection.");
      }
    } catch (err) {
      console.error("Error starting inspection:", err);
      setErrorMsg("Network error starting inspection.");
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = inspections.filter((i) => {
    const matchBarangay = selectedBarangay === "all" || i.barangay?.toLowerCase() === selectedBarangay.toLowerCase();
    const matchStatus = selectedStatus === "all" || i.status === selectedStatus;
    return matchBarangay && matchStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            Field Operations & Sampling
          </span>
          <h1 className="text-3xl font-extrabold text-white">Inspection & Audit Requests</h1>
          <p className="text-white/80 text-sm max-w-xl">
            Manage citizen-requested field inspections, on-site microbial laboratory testing, and water source audits passed by Barangay Officials.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isInspector && (
            <Link
              to="/generate-reports"
              className="px-4 py-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-xs transition-all shadow flex items-center gap-1.5"
            >
              <FileText size={15} />
              <span>Generate Audit Report</span>
            </Link>
          )}
          <button
            onClick={fetchInspections}
            className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh Queue</span>
          </button>
        </div>
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

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Statuses ({inspections.length})</option>
              <option value="pending">Pending Review</option>
              <option value="assigned">Assigned to Inspector</option>
              <option value="in_progress">Field Sampling In-Progress</option>
              <option value="completed">Completed & Verified</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Barangay</label>
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Barangays</option>
              {barangays.map((b) => (
                <option key={b} value={b}>Brgy. {b}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-900">{filtered.length}</span> active requests
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Active Field Inspection Tickets</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Barangay & Source</th>
                <th className="py-3.5 px-6">Reason / Symptoms</th>
                <th className="py-3.5 px-6">Priority</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Inspector Lab Findings</th>
                <th className="py-3.5 px-6">Requested Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">Loading inspection tickets...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400">No inspection requests found for this filter.</td>
                </tr>
              ) : (
                filtered.map((i) => {
                  const isHigh = i.priority === "high";
                  const isMed = i.priority === "medium";
                  const isCompleted = i.status === "completed";
                  const isInProgress = i.status === "in_progress";
                  const isAssigned = i.status === "assigned";
                  const isPending = !i.status || i.status === "pending";

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-slate-900 text-sm">Brgy. {i.barangay}</p>
                        {(i.latitude || i.longitude) && (
                          <div className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            <MapPin size={10} />
                            <span>GPS: {parseFloat(i.latitude).toFixed(4)}, {parseFloat(i.longitude).toFixed(4)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-700 max-w-xs leading-relaxed font-medium">
                        {i.description}
                      </td>

                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isHigh 
                            ? "bg-red-100 text-red-800 border border-red-200" 
                            : isMed 
                            ? "bg-amber-100 text-amber-800 border border-amber-200" 
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}>
                          {i.priority || "Normal"}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : isInProgress
                            ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                            : isAssigned
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {i.status?.replace(/_/g, " ") || "Pending"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-slate-600 max-w-xs">
                        {i.notes ? (
                          <p className="text-slate-800 italic text-[11px] leading-relaxed">
                            "{i.notes}"
                          </p>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No lab notes logged yet</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-slate-500">
                        {i.created_at ? new Date(i.created_at).toLocaleDateString() : "Recent"}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Quick Start for Inspector */}
                          {isInspector && (isPending || isAssigned) && (
                            <button
                              onClick={() => handleQuickClaim(i)}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                              title="Claim and start field sampling"
                            >
                              <Play size={12} />
                              <span>Start Test</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedInspection(i);
                              setStatusUpdate(i.status || "in_progress");
                              setNotes(i.notes || "");
                              setAssigneeId(i.assigned_to || "");
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
                          >
                            Update
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

      {/* Update Status / Findings Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-fade-in space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Update Inspection Ticket</h2>
                <p className="text-xs text-slate-500">Barangay {selectedInspection.barangay}</p>
              </div>
              <button
                onClick={() => setSelectedInspection(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-slate-900">Issue Reported:</p>
              <p>{selectedInspection.description}</p>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inspection Progress Status
                </label>
                <select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                >
                  <option value="pending">Pending Review</option>
                  <option value="assigned">Assigned to Sanitization Inspector</option>
                  <option value="in_progress">In Progress (Field Sampling Underway)</option>
                  <option value="completed">Completed (Lab Tests Verified)</option>
                </select>
              </div>

              {/* Assign Inspector dropdown for Admin / Barangay */}
              {(isBarangayOfficial || user?.role === "admin" || user?.role === "city_health_officer") && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Assign Sanitization Inspector
                  </label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Choose Sanitization Inspector --</option>
                    {inspectors.map((ins) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.full_name} ({ins.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Inspector Findings & Microbial Notes
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter on-site chlorine residual, E. Coli counts, turbidity observations, or sanitization treatment applied..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedInspection(null)}
                  className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-1/2 py-2.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? "Saving..." : "Save Progress"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InspectionRequests;
