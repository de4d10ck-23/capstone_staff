import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Droplets, ShieldCheck, AlertTriangle, ClipboardList, CheckCircle, PlusCircle, ArrowRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const { user, token, API_URL } = useAuth();
  const [stats, setStats] = useState(null);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const [statsRes, inspRes] = await Promise.all([
          fetch(`${API_URL}/analytics/overview`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/inspections`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const statsData = await statsRes.json();
        const inspData = await inspRes.json();

        if (statsData.success) setStats(statsData.data);
        if (inspData.success && Array.isArray(inspData.data)) setInspections(inspData.data);
      } catch (err) {
        console.error("Error fetching staff dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [token, API_URL]);

  const isInspector = user?.role === "sanitization_inspector";
  const isCHO = user?.role === "city_health_officer";
  const isBarangay = user?.role === "barangay_official";

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'city_health_officer':
        return 'City Health Officer';
      case 'sanitization_inspector':
        return 'Sanitization Inspector';
      case 'barangay_official':
        return 'Barangay Official';
      case 'admin':
        return 'Administrator';
      case 'resident':
        return 'Resident';
      default:
        return role
          ? role
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (char) => char.toUpperCase())
          : 'Staff';
    }
  };

  const pendingInspections = inspections.filter((i) => i.status === "pending" || i.status === "assigned");

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            {getRoleDisplayName(user?.role)} • Active Duty
          </span>
          <h1 className="text-3xl font-extrabold text-white">Welcome, {user?.full_name}</h1>
          <p className="text-white/80 text-sm max-w-xl">
            {isInspector && "Review assigned field inspection orders and log water laboratory testing samples."}
            {isCHO && "Review city-wide waterborne health analytics, approve medical reports, and broadcast health alerts."}
            {isBarangay && `Overseeing water station safety and resident concerns for Barangay ${user?.barangay || "Jurisdiction"}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isInspector && (
            <Link
              to="/add-water-source"
              className="px-5 py-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-900 font-semibold text-xs transition-all shadow hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <PlusCircle size={16} />
              <span>Add Water Station</span>
            </Link>
          )}
          {isCHO && (
            <Link
              to="/view-reports"
              className="px-5 py-2.5 rounded-full bg-white text-blue-900 font-semibold text-xs transition-all shadow hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <FileText size={16} />
              <span>Review Reports</span>
            </Link>
          )}
          {isBarangay && (
            <Link
              to="/validate-reports"
              className="px-5 py-2.5 rounded-full bg-white text-blue-900 font-semibold text-xs transition-all shadow hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-1.5"
            >
              <span>Validate Reports</span>
            </Link>
          )}
          <Link
            to="/map"
            className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold text-xs transition-all"
          >
            Live Water Map
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Water Stations</p>
            <h3 className="text-3xl font-bold text-slate-900 mt-1">{stats?.water_locations?.total ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Droplets size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Safe Stations</p>
            <h3 className="text-3xl font-bold text-emerald-600 mt-1">{stats?.water_locations?.safe ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Inspections</p>
            <h3 className="text-3xl font-bold text-amber-600 mt-1">{pendingInspections.length}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ClipboardList size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contaminated Points</p>
            <h3 className="text-3xl font-bold text-red-600 mt-1">{stats?.water_locations?.undrinkable ?? 0}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>

      {/* Pending Inspection Queue */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Active Inspection & Audit Queue</h2>
            <p className="text-xs text-slate-500">Citizen inspection requests requiring on-site microbial sampling</p>
          </div>
          <Link to="/inspections" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            View All Inspections →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-y border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Barangay</th>
                <th className="py-3.5 px-4">Reason / Description</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspections.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-400">
                    No active inspection requests pending in the queue.
                  </td>
                </tr>
              ) : (
                inspections.slice(0, 5).map((i) => {
                  const isHigh = i.priority === "high";
                  const isMed = i.priority === "medium";

                  return (
                    <tr key={i.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">Brgy. {i.barangay || "Maasin"}</td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{i.description}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isHigh ? "bg-red-100 text-red-800" : isMed ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {i.priority || "Normal"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-slate-100 text-slate-700">
                          {i.status || "Pending"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to="/inspections"
                          className="text-blue-700 hover:text-blue-900 font-semibold inline-flex items-center gap-1"
                        >
                          <span>Process</span>
                          <ArrowRight size={12} />
                        </Link>
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

export default Dashboard;
