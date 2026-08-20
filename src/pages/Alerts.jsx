import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Bell, Send, CheckCircle2, AlertCircle, Radio } from "lucide-react";

const Alerts = () => {
  const { token, API_URL, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("warning");
  const [barangay, setBarangay] = useState(user?.barangay || "Combado");

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
      const payload = {
        title,
        message,
        type,
        barangay: user?.barangay || (barangay === "all" ? null : barangay),
        target_roles: ["resident", "barangay_official"]
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
        setSuccessMsg("Public advisory alert broadcasted!");
        setTitle("");
        setMessage("");
        fetchNotifications();
      } else {
        setErrorMsg(data.detail || "Failed to broadcast alert.");
      }
    } catch (err) {
      console.error("Error broadcasting alert:", err);
      setErrorMsg("Network error.");
    } finally {
      setIsSending(false);
    }
  };

  const barangays = [
    "Combado", "Batuan", "Rizal", "Hantag", "Malapoc Sur", "Malapoc Norte",
    "Matin-ao", "San Isidro", "Tagnipa", "Abgao"
  ];

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alerts & Public Health Advisories</h1>
        <p className="text-xs text-slate-500 mt-0.5">Broadcast water quality boil orders and maintenance notifications to citizens</p>
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
        <div className="lg:col-span-6 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Radio size={20} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Broadcast Water Advisory</h2>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Advisory Headline</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Precautionary Chlorination Scheduled"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Severity</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value="info">Informational</option>
                  <option value="warning">Warning / Boil Water</option>
                  <option value="critical">Emergency Outbreak</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Target Location</label>
                {user?.barangay ? (
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
                    <option value="all">City Wide</option>
                    {barangays.map((b) => (
                      <option key={b} value={b}>Brgy. {b}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Advisory Guidance</label>
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
              className="w-full py-3.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Send size={14} />
              <span>{isSending ? "Broadcasting..." : "Broadcast Public Notice"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-6 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Active Health Notices ({notifications.length})</h2>
          </div>

          <div className="space-y-3 pt-2 max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-10 text-slate-400 text-xs">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-400">
                No active notifications in stream.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-xs text-slate-900">{n.title}</h4>
                    <span className="text-[10px] text-slate-400">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString() : "Recent"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;
