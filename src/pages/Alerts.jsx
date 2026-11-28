import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  Radio,
  Trash2,
  Calendar,
  Smartphone,
  X,
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { MAASIN_BARANGAYS as barangays } from "../constants/barangays";

const PAGE_SIZE = 10;

const Alerts = () => {
  const { token, API_URL, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("warning");
  const isBarangayOfficial = user?.role === "barangay_official";
  const [barangay, setBarangay] = useState(isBarangayOfficial ? (user?.barangay || "Combado") : "all");

  const [isSending, setIsSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchNotifications = useCallback(async (targetPage = page, isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`${API_URL}/notifications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        if (targetPage > 1 && data.data.length === 0) {
          setPage((p) => Math.max(1, p - 1));
          return;
        }
        setNotifications(data.data);
        setHasNext(Boolean(data.has_next));
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [API_URL, token, page]);

  useEffect(() => {
    fetchNotifications(page, false);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications(page, true);
      }
    }, 15000);
    const onFocus = () => fetchNotifications(page, true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchNotifications, page]);

  useEffect(() => {
    if (!selectedNotification) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setSelectedNotification(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNotification]);

  const handleBroadcast = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setIsSending(true);

    try {
      const targetRoles = ["resident"];

      const payload = {
        title: title.trim(),
        message: message.trim(),
        type,
        barangay: isBarangayOfficial ? user?.barangay : (barangay === "all" ? null : barangay),
        target_roles: targetRoles
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
        setSuccessMsg(data.message || "Advisory posted.");
        setTitle("");
        setMessage("");
        if (page !== 1) {
          setPage(1);
        } else {
          await fetchNotifications(1, true);
        }
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
        if (selectedNotification?.id === id) {
          setSelectedNotification(null);
        }
        await fetchNotifications(page, false);
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const rangeStart = notifications.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + notifications.length;

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Broadcast Alerts & Health Advisories</h1>
        <p className="text-xs text-slate-500 mt-0.5">Send urgent water safety boil orders, outbreak warnings, and health guidelines</p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2 shadow-sm">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Broadcast Form */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
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
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
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
              className={`w-full py-3.5 rounded-full text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                type === "critical"
                  ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                  : "bg-blue-900 hover:bg-blue-800"
              }`}
            >
              <Send size={14} />
              <span>
                {isSending
                  ? "Broadcasting..."
                  : type === "critical"
                  ? "Broadcast Emergency Outbreak"
                  : "Post Public Advisory Notice"}
              </span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Broadcast History */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">Broadcast Feed</h2>
              </div>
              <span className="text-xs text-slate-400 font-medium">Auto-Synced</span>
            </div>

            <div className="space-y-3.5 pt-2 max-h-[600px] overflow-y-auto pr-1">
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
                  const isSafe = n.type === "safe";

                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNotification(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedNotification(n);
                        }
                      }}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        isCritical
                          ? "bg-red-50/60 border-red-200 hover:border-red-300"
                          : isWarning
                          ? "bg-amber-50/60 border-amber-200 hover:border-amber-300"
                          : isSafe
                          ? "bg-emerald-50/60 border-emerald-200 hover:border-emerald-300"
                          : "bg-slate-50/80 border-slate-200 hover:border-blue-300"
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
                                : isSafe
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {isCritical ? "Outbreak" : n.type || "Notice"}
                            </span>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                              isCritical
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}>
                              {isCritical ? (
                                <>
                                  <Smartphone size={10} className="text-red-600" />
                                  <span>Web Push Sent</span>
                                </>
                              ) : (
                                <span>Feed Only</span>
                              )}
                            </span>

                            <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                              {n.barangay ? `Brgy. ${n.barangay}` : "City Wide"}
                            </span>

                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              <span>{n.created_at ? new Date(n.created_at).toLocaleDateString() : "Recent"}</span>
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-slate-900 leading-snug truncate" title={n.title}>{n.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 break-words" title={n.message}>{n.message}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(n.id);
                          }}
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

          {(notifications.length > 0 || page > 1) && (
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Page <span className="font-semibold text-slate-700">{page}</span>
                {notifications.length > 0 && (
                  <>
                    {" "}· Showing <span className="font-semibold text-slate-700">{rangeStart}–{rangeEnd}</span>
                  </>
                )}
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNext || loading}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Detail Modal */}
      {selectedNotification && (() => {
        const isCritical = selectedNotification.type === "critical";
        const isWarning = selectedNotification.type === "warning";
        const isSafe = selectedNotification.type === "safe";
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={() => setSelectedNotification(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="broadcast-detail-title"
          >
            <div
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className={`px-6 py-5 border-b flex items-start justify-between gap-4 ${
                  isCritical
                    ? "bg-red-50/80 border-red-200"
                    : isWarning
                    ? "bg-amber-50/80 border-amber-200"
                    : isSafe
                    ? "bg-emerald-50/80 border-emerald-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isCritical
                        ? "bg-red-100 text-red-800"
                        : isWarning
                        ? "bg-amber-100 text-amber-800"
                        : isSafe
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {isCritical ? "Outbreak" : selectedNotification.type || "Notice"}
                    </span>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border ${
                      isCritical
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}>
                      {isCritical ? (
                        <>
                          <Smartphone size={10} className="text-red-600" />
                          <span>Web Push Sent</span>
                        </>
                      ) : (
                        <span>Feed Only</span>
                      )}
                    </span>
                  </div>

                  <h3
                    id="broadcast-detail-title"
                    className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words"
                  >
                    {selectedNotification.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="p-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex-shrink-0"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <MapPin size={12} />
                      <span>Target Location</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      {selectedNotification.barangay
                        ? `Brgy. ${selectedNotification.barangay}`
                        : "City Wide (All 70 Barangays)"}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <Clock size={12} />
                      <span>Broadcast Timestamp</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800">
                      {selectedNotification.created_at
                        ? new Date(selectedNotification.created_at).toLocaleString()
                        : "Recent"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <Users size={12} />
                    <span>Target Audience</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700">
                      Resident
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Full Advisory Message
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {selectedNotification.message || "No additional details provided."}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDeleteNotification(selectedNotification.id)}
                  className="px-3.5 py-2 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Broadcast</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Alerts;
