import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Bell, Send, CheckCircle2, AlertCircle, Radio, Trash2, Calendar, Users } from "lucide-react";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";

const Alerts = () => {
  const { token, API_URL, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("warning");
  const isBarangayOfficial = user?.role === "barangay_official";
  const [barangay, setBarangay] = useState(isBarangayOfficial ? (user?.barangay || "Combado") : "all");
  const [targetRole, setTargetRole] = useState("all");

  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNotifications(data.data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [token, API_URL]);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setIsSending(true);

    try {
      let roles = [];
      if (targetRole === "residents") roles = ["resident"];
      else if (targetRole === "officials") roles = ["barangay_official"];
      else roles = ["resident", "barangay_official"];

      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        barangay: isBarangayOfficial ? user?.barangay : (barangay === "all" ? null : barangay),
        target_roles: roles
      };

      const res = await fetch(`${API_URL}/notifications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Public advisory alert broadcasted successfully!");
        setTitle("");
        setMessage("");
        fetchNotifications();
      } else {
        setErrorMsg(data.detail || "Failed to broadcast alert.");
      }
    } catch (err) {
      console.error("Error broadcasting alert:", err);
      setErrorMsg("Network error broadcasting alert.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteNotification = async (id) => {
    if (!window.confirm("Are you sure you want to delete this broadcast notice?")) return;

    try {
      const res = await fetch(`${API_URL}/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Broadcast notice deleted.");
        fetchNotifications();
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Broadcast Alerts & Health Advisories</h1>
        <p className="text-xs text-slate-500 mt-0.5">Send urgent water safety boil orders, outbreak warnings, and health guidelines</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Broadcast Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Issue New Advisory</h2>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Notice Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Boil Water Advisory for Purok 2"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Alert Level</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="warning">Warning / Boil Water</option>
                  <option value="critical">Emergency Outbreak</option>
                  <option value="info">Informational Notice</option>
                  <option value="safe">Advisory Lifted (Safe)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Target Location</label>
                {isBarangayOfficial && user?.barangay ? (
                  <input
                    type="text"
                    value={`Brgy. ${user.barangay}`}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 font-semibold"
                  />
                ) : (
                  <select
                    value={barangay}
                    onChange={(e) => setBarangay(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    <option value="all">City Wide (All 70 Barangays)</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>Brgy. {b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Target Audience</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="all">Residents & Officials</option>
                <option value="residents">Residents Only</option>
                <option value="officials">Barangay Officials Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Notice Message</label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Detail safety actions, boiling recommendations, or temporary alternative sources..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 placeholder:text-slate-400"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={14} />
              <span>{isSending ? "Broadcasting..." : "Broadcast Public Notice"}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Broadcast History */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={20} className="text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">Broadcast Feed ({notifications.length})</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">Auto-Synced</span>
          </div>

          <div className="space-y-3.5 pt-2 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-slate-400 text-xs">Loading alert broadcast history...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
                No active advisory broadcasts in history.
              </div>
            ) : (
              notifications.map((n) => {
                const isCritical = n.type === "critical";
                const isWarning = n.type === "warning";

                return (
                  <div
                    key={n.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCritical
                        ? "bg-red-50/60 border-red-200"
                        : isWarning
                        ? "bg-amber-50/60 border-amber-200"
                        : "bg-slate-50/80 border-slate-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCritical
                              ? "bg-red-100 text-red-800"
                              : isWarning
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {n.type || "Notice"}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {n.barangay ? `Brgy. ${n.barangay}` : "City Wide"}
                          </span>

                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{n.created_at ? new Date(n.created_at).toLocaleDateString() : "Recent"}</span>
                          </span>
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 leading-snug">{n.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed break-words">{n.message}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteNotification(n.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-white transition-colors cursor-pointer flex-shrink-0"
                        title="Delete Broadcast"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
