import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { ClipboardList, CheckCircle2, AlertCircle, Clock, Check, XCircle, UserCheck, MessageSquare } from "lucide-react";

const InspectionRequests = () => {
  const { user, token, API_URL } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [notes, setNotes] = useState("");
  const [statusUpdate, setStatusUpdate] = useState("in_progress");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

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

  useEffect(() => {
    fetchInspections();
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
          notes: notes || selectedInspection.notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Inspection request status updated successfully!");
        setSelectedInspection(null);
        setNotes("");
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

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inspection & Audit Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage on-site laboratory testing audits and update citizen request status</p>
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

      {/* Inspections Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-sm text-slate-900">Active Requests ({inspections.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">Barangay</th>
                <th className="py-3.5 px-6">Reason / Symptoms</th>
                <th className="py-3.5 px-6">Priority</th>
                <th className="py-3.5 px-6">Current Status</th>
                <th className="py-3.5 px-6">Requested Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">Loading inspection requests...</td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">No active inspection requests found.</td>
                </tr>
              ) : (
                inspections.map((i) => {
                  const isHigh = i.priority === "high";
                  const isMed = i.priority === "medium";
                  const isCompleted = i.status === "completed";

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">Brgy. {i.barangay}</td>
                      <td className="py-4 px-6 text-slate-600 max-w-xs">{i.description}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isHigh ? "bg-red-100 text-red-800" : isMed ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {i.priority || "Normal"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          isCompleted ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          {i.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {i.created_at ? new Date(i.created_at).toLocaleDateString() : "Recent"}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedInspection(i);
                            setStatusUpdate(i.status || "in_progress");
                            setNotes(i.notes || "");
                          }}
                          className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50 font-semibold transition-colors"
                        >
                          Update Status
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

      {/* Update Status Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-100 relative animate-fade-in space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Update Inspection Request</h2>
            <p className="text-xs text-slate-500">Barangay {selectedInspection.barangay} • Reason: {selectedInspection.description}</p>

            <form onSubmit={handleUpdateStatus} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Request Progress</label>
                <select
                  value={statusUpdate}
                  onChange={(e) => setStatusUpdate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="pending">Pending Review</option>
                  <option value="assigned">Assigned to Sanitization Inspector</option>
                  <option value="in_progress">In Progress (Field Sampling Underway)</option>
                  <option value="completed">Completed (Tests Verified)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Inspector Findings & Lab Notes</label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter sample test results, microbial counts, or disinfection instructions..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedInspection(null)}
                  className="w-1/2 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="w-1/2 py-2.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs shadow-md"
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
