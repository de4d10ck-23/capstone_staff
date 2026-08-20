import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { MapPin, Droplets, ShieldCheck, AlertTriangle, FileCheck, Send, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const BarangayOverview = () => {
  const { user, token, API_URL } = useAuth();
  const [sources, setSources] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarangayData = async () => {
      try {
        setLoading(true);
        const [sourcesRes, concernsRes] = await Promise.all([
          fetch(`${API_URL}/water-locations?barangay=${encodeURIComponent(user?.barangay || '')}`),
          fetch(`${API_URL}/resident-reports?barangay=${encodeURIComponent(user?.barangay || '')}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const sourcesData = await sourcesRes.json();
        const concernsData = await concernsRes.json();

        if (sourcesData.success && Array.isArray(sourcesData.data)) setSources(sourcesData.data);
        if (concernsData.success && Array.isArray(concernsData.data)) setConcerns(concernsData.data);
      } catch (err) {
        console.error("Error fetching barangay overview:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.barangay) {
      fetchBarangayData();
    }
  }, [user, token, API_URL]);

  const safeCount = sources.filter((s) => s.status?.toLowerCase() === "safe").length;
  const warningCount = sources.filter((s) => s.status?.toLowerCase() === "warning").length;
  const dangerCount = sources.filter((s) => s.status?.toLowerCase() === "undrinkable" || s.status?.toLowerCase() === "contaminated").length;
  const pendingConcerns = concerns.filter((c) => c.status === "pending");

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">Barangay Official Station</span>
          <h1 className="text-3xl font-extrabold text-white">Barangay {user?.barangay || "Jurisdiction"}</h1>
          <p className="text-white/80 text-sm max-w-xl">
            Monitor local drinking supplies, validate incoming citizen reports, and escalate concerns directly to the City Health Officer.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/validate-reports"
            className="px-5 py-2.5 rounded-full bg-white text-blue-900 font-semibold text-xs transition-all shadow hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-1.5"
          >
            <FileCheck size={16} />
            <span>Validate Reports ({pendingConcerns.length})</span>
          </Link>
          <Link
            to="/escalate-concern"
            className="px-5 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition-all shadow hover:shadow-lg hover:-translate-y-0.5"
          >
            Escalate Issue
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Water Stations</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{sources.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Droplets size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Potable Safe</p>
            <h3 className="text-3xl font-bold text-emerald-600 mt-1">{safeCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Warning Points</p>
            <h3 className="text-3xl font-bold text-amber-600 mt-1">{warningCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Citizen Concerns</p>
            <h3 className="text-3xl font-bold text-blue-600 mt-1">{concerns.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileCheck size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Local Water Station Status</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-y border-slate-100">
                <tr>
                  <th className="py-3 px-4">Station</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Coliform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-slate-400">No stations registered.</td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 px-4 text-slate-600 capitalize">{s.source_type || "Well"}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          s.status === "safe" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{s.coliform_count ?? 0} MPN</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Recent Citizen Reports</h2>
          <div className="space-y-2.5 text-xs">
            {concerns.length === 0 ? (
              <p className="text-slate-400 text-center py-6">No recent concerns logged by residents.</p>
            ) : (
              concerns.slice(0, 4).map((c) => (
                <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-900">{c.title}</span>
                    <span className="text-[10px] text-slate-400 capitalize">{c.status || "Pending"}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] truncate">{c.description}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarangayOverview;
