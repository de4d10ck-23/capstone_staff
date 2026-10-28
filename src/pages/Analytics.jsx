import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Droplets,
  ShieldCheck,
  AlertTriangle,
  Users,
  MapPin,
  RefreshCw,
  Printer,
  Flame,
  CheckCircle2,
  HelpCircle,
  Clock,
  Building2,
  Activity,
  Layers,
  Pencil,
  Search,
  Save,
  X
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  MAASIN_BARANGAYS,
  MAASIN_BARANGAY_POPULATION,
  getBarangayPopulation,
  getStoredBarangayPopulations,
  saveBarangayPopulations
} from "../constants/barangays";

const Analytics = () => {
  const { token, API_URL, user } = useAuth();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [populations, setPopulations] = useState(() => getStoredBarangayPopulations());
  const [isPopModalOpen, setIsPopModalOpen] = useState(false);
  const [popSearch, setPopSearch] = useState("");
  const [tempPopulations, setTempPopulations] = useState(populations);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  const handleOpenPopModal = () => {
    setTempPopulations({ ...populations });
    setPopSearch("");
    setIsPopModalOpen(true);
  };

  const handlePopChange = (barangay, val) => {
    const num = parseInt(val, 10);
    setTempPopulations((prev) => ({
      ...prev,
      [barangay]: isNaN(num) ? 0 : Math.max(0, num),
    }));
  };

  const handleSavePopulations = async (e) => {
    e.preventDefault();
    // Save locally first
    saveBarangayPopulations(tempPopulations);
    setPopulations(tempPopulations);
    setIsPopModalOpen(false);

    // Sync to backend so the heatmap recalculates with updated populations
    try {
      const res = await fetch(`${API_URL}/analytics/populations`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tempPopulations),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(`Populations saved — heatmap is recalculating with updated values.`);
      } else {
        setSaveSuccessMsg("Populations saved locally. Backend sync failed.");
      }
    } catch (err) {
      console.error("Failed to sync populations to backend:", err);
      setSaveSuccessMsg("Populations saved locally. Backend sync failed.");
    }
    setTimeout(() => setSaveSuccessMsg(""), 5000);
  };



  const filteredPopBarangays = useMemo(() => {
    const q = popSearch.trim().toLowerCase();
    if (!q) return MAASIN_BARANGAYS;
    return MAASIN_BARANGAYS.filter((bgy) => bgy.toLowerCase().includes(q));
  }, [popSearch]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const locRes = await fetch(`${API_URL}/water-locations`, { headers });
      const locData = await locRes.json();

      if (locData.success && Array.isArray(locData.data)) {
        setLocations(locData.data);
      }
    } catch (err) {
      console.error("Error fetching staff analytics:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [token, API_URL]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAnalyticsData();
  };

  // Distinct list of barangays found in current locations data
  const availableBarangays = useMemo(() => {
    const set = new Set(locations.map((l) => l.barangay).filter(Boolean));
    return Array.from(set).sort();
  }, [locations]);

  // Filtered locations based on selected barangay
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchBarangay = selectedBarangay === "all" || loc.barangay === selectedBarangay;
      return matchBarangay;
    });
  }, [locations, selectedBarangay]);

  // Overall and filtered health surveillance calculations
  const stats = useMemo(() => {
    let safe = 0;
    let warning = 0;
    let contaminated = 0;
    let untested = 0;

    filteredLocations.forEach((loc) => {
      const st = (loc.status || "").toLowerCase();
      const exam = (loc.bacteriological_exam || "").toLowerCase();
      const eColi = loc.e_coli === true || Number(loc.e_coli_count || 0) > 0;
      const coliform = loc.coliform_bacteria === true || Number(loc.coliform_count || 0) > 0;

      if (st in { contaminated: 1, undrinkable: 1 } || exam === "failed" || eColi) {
        contaminated += 1;
      } else if (st === "warning" || coliform) {
        warning += 1;
      } else if (st === "safe" || exam === "passed") {
        safe += 1;
      } else {
        untested += 1;
      }
    });

    const total = filteredLocations.length;
    const safeRate = total > 0 ? ((safe / total) * 100).toFixed(1) : 0;
    const contaminatedRate = total > 0 ? ((contaminated / total) * 100).toFixed(1) : 0;

    // Calculate exposed population living in barangays with contaminated water
    const contaminatedBarangays = new Set(
      locations
        .filter((l) => {
          const st = (l.status || "").toLowerCase();
          const exam = (l.bacteriological_exam || "").toLowerCase();
          return st in { contaminated: 1, undrinkable: 1 } || exam === "failed" || l.e_coli === true;
        })
        .map((l) => l.barangay)
        .filter(Boolean)
    );

    let exposedPopulation = 0;
    contaminatedBarangays.forEach((bgy) => {
      exposedPopulation += getBarangayPopulation(bgy, populations);
    });

    return {
      total,
      safe,
      warning,
      contaminated,
      untested,
      safeRate,
      contaminatedRate,
      contaminatedBarangaysCount: contaminatedBarangays.size,
      contaminatedBarangaysList: Array.from(contaminatedBarangays),
      exposedPopulation,
    };
  }, [filteredLocations, locations, populations]);

  // Group data by barangay for the Bar Chart & Ranking Table
  const barangayAnalytics = useMemo(() => {
    const map = {};

    locations.forEach((loc) => {
      const b = loc.barangay || "Unspecified";
      if (!map[b]) {
        map[b] = {
          name: b,
          total: 0,
          safe: 0,
          warning: 0,
          contaminated: 0,
          untested: 0,
          population: getBarangayPopulation(b, populations),
        };
      }
      map[b].total += 1;

      const st = (loc.status || "").toLowerCase();
      const exam = (loc.bacteriological_exam || "").toLowerCase();
      const eColi = loc.e_coli === true || Number(loc.e_coli_count || 0) > 0;
      const coliform = loc.coliform_bacteria === true || Number(loc.coliform_count || 0) > 0;

      if (st in { contaminated: 1, undrinkable: 1 } || exam === "failed" || eColi) {
        map[b].contaminated += 1;
      } else if (st === "warning" || coliform) {
        map[b].warning += 1;
      } else if (st === "safe" || exam === "passed") {
        map[b].safe += 1;
      } else {
        map[b].untested += 1;
      }
    });

    const list = Object.values(map).map((item) => {
      const failRate = item.total > 0 ? (item.contaminated / item.total) * 100 : 0;
      let urgency = "Normal";
      if (failRate >= 50 || item.contaminated >= 5) urgency = "Critical";
      else if (item.contaminated > 0 || item.warning > 0) urgency = "Elevated";

      return {
        ...item,
        failRate: Math.round(failRate),
        urgency,
      };
    });

    // Sort by highest contamination count first
    list.sort((a, b) => b.contaminated - a.contaminated || b.total - a.total);
    return list;
  }, [locations, populations]);

  // Top 10 barangays for the chart
  const barChartData = useMemo(() => {
    return barangayAnalytics.slice(0, 10);
  }, [barangayAnalytics]);

  // Donut chart data for potability distribution
  const pieData = useMemo(() => {
    return [
      { name: "Certified Safe", value: stats.safe, color: "#10b981" },
      { name: "Warning / Elevated", value: stats.warning, color: "#f59e0b" },
      { name: "Contaminated / Failed", value: stats.contaminated, color: "#ef4444" },
      { name: "Untested / Pending", value: stats.untested, color: "#94a3b8" },
    ].filter((item) => item.value > 0);
  }, [stats]);

  return (
    <div className="space-y-7 animate-fade-in font-sans pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Activity size={18} />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Health Surveillance Analytics
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            City-wide bacteriological test records, human exposure modeling, and sanitary risk surveillance across Maasin City
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Barangay Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedBarangay}
              onChange={(e) => setSelectedBarangay(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer pr-8"
            >
              <option value="all">City-Wide (All Barangays)</option>
              {availableBarangays.map((b) => (
                <option key={b} value={b}>
                  Barangay {b}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading || isRefreshing}
            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Surveillance Data"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
          </button>

          {/* Print/Export Button */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={13} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg("")}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top 4 Public Health KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monitored Stations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Stations Monitored
            </span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
              <Droplets size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-slate-900">
              {loading ? "..." : stats.total}
            </h3>
            <span className="text-xs text-slate-500 font-medium">water points</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <MapPin size={11} className="text-slate-400" />
            <span>{selectedBarangay === "all" ? `${availableBarangays.length} Barangays Monitored` : `Barangay ${selectedBarangay}`}</span>
          </p>
        </div>

        {/* Card 2: Potable & Certified Safe */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Potable & Safe
            </span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <ShieldCheck size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-emerald-700">
              {loading ? "..." : stats.safe}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {stats.safeRate}% compliant
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>Certified passed bacteriological testing</span>
          </p>
        </div>

        {/* Card 3: Active Contamination Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Contaminated Sources
            </span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-rose-600">
              {loading ? "..." : stats.contaminated}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
              {stats.contaminatedRate}% at risk
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Flame size={11} className="text-rose-500" />
            <span>Boil water notices & treatment required</span>
          </p>
        </div>

        {/* Card 4: Population in Affected Catchments */}
        <div
          onClick={handleOpenPopModal}
          className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer relative overflow-hidden group select-none active:scale-[0.99]"
          title="Click to view and edit barangay populations"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <span>Population at Risk</span>
              <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 group-hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-100/80 inline-flex items-center gap-1 transition-colors">
                <Pencil size={10} /> Edit
              </span>
            </span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
              <Users size={16} />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <h3 className="text-3xl font-extrabold text-indigo-700">
              {loading ? "..." : stats.exposedPopulation.toLocaleString()}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <Building2 size={11} className="text-indigo-500" />
            <span>Residents across {stats.contaminatedBarangaysCount} affected barangays</span>
          </p>
        </div>
      </div>

      {/* Row 1: Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bar Chart: Water Quality by Barangay */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Water Quality Distribution by Barangay</span>
                  <span className="text-xs font-normal text-slate-400">• Top 10 by Contamination</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparison of Certified Safe vs Contaminated stations across monitored barangays
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tick={{ fontSize: 10.5, fill: "#64748b" }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(val, name) => [`${val} Stations`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "15px" }} />
                  <Bar dataKey="safe" name="Safe" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="warning" name="Warning" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="contaminated" name="Contaminated" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <span>Barangay Malapoc Norte & San Isidro currently account for the highest concentration of failed sources.</span>
            <span className="font-semibold text-slate-700">Total Monitored: {locations.length}</span>
          </div>
        </div>

        {/* Donut Chart: Overall Potability Breakdown */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Potability Breakdown</h3>
            <p className="text-xs text-slate-500 mt-0.5">City-wide bacteriological compliance ratio</p>

            <div className="h-52 w-full relative mt-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [`${value} Stations (${((value / (stats.total || 1)) * 100).toFixed(1)}%)`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center hole stats */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800">{stats.safeRate}%</span>
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Potable</span>
              </div>
            </div>
          </div>

          {/* Metric list breakdown */}
          <div className="space-y-2 pt-4 border-t border-slate-100 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600 font-medium">Certified Safe:</span>
              </div>
              <span className="font-bold text-slate-900">{stats.safe} stations</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600 font-medium">Contaminated / Failed:</span>
              </div>
              <span className="font-bold text-rose-600">{stats.contaminated} stations</span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <span className="text-slate-600 font-medium">Untested / Pending:</span>
              </div>
              <span className="font-bold text-slate-600">{stats.untested} stations</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Priority Surveillance Ranking */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Barangay Surveillance Ranking</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Prioritized by contaminated source count and barangay population exposure
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            {barangayAnalytics.length} Barangays Monitored
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Rank & Barangay</th>
                <th className="pb-3 font-semibold">Total Water Points</th>
                <th className="pb-3 font-semibold">Contaminated</th>
                <th className="pb-3 font-semibold">Contamination Rate</th>
                <th className="pb-3 font-semibold">Population</th>
                <th className="pb-3 font-semibold">Urgency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {barangayAnalytics.map((item, index) => (
                <tr key={item.name} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] flex items-center justify-center font-mono">
                      {index + 1}
                    </span>
                    <span>Barangay {item.name}</span>
                  </td>
                  <td className="py-3.5 text-slate-600">{item.total} stations</td>
                  <td className="py-3.5 font-bold text-rose-600">{item.contaminated} sources</td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.failRate >= 60 ? "bg-rose-500" : item.failRate >= 30 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${item.failRate}%` }}
                        />
                      </div>
                      <span className="font-semibold text-slate-700">{item.failRate}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 font-mono text-slate-700">{item.population.toLocaleString()}</td>
                  <td className="py-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                        item.urgency === "Critical"
                          ? "bg-rose-100 text-rose-800 border border-rose-200"
                          : item.urgency === "Elevated"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {item.urgency}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barangay Population Directory Modal */}
      {isPopModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Barangay Population Directory
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edit population counts for each barangay in Maasin City to update exposure modeling and risk calculations.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPopModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics & Search Header */}
            <div className="p-4 sm:p-6 pb-3 border-b border-slate-100 bg-white space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    City Total Population
                  </span>
                  <span className="text-base font-extrabold text-slate-800 font-mono mt-0.5 block">
                    {MAASIN_BARANGAYS.reduce(
                      (sum, bgy) => sum + (Number(tempPopulations[bgy] ?? getBarangayPopulation(bgy, tempPopulations)) || 0),
                      0
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-indigo-50/80 border border-indigo-100">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Population at Risk
                  </span>
                  <span className="text-base font-extrabold text-indigo-800 font-mono mt-0.5 block">
                    {(() => {
                      let atRisk = 0;
                      stats.contaminatedBarangaysList.forEach((bgy) => {
                        atRisk += Number(tempPopulations[bgy] ?? getBarangayPopulation(bgy, tempPopulations)) || 0;
                      });
                      return atRisk.toLocaleString();
                    })()}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-rose-50/80 border border-rose-100 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">
                    Affected Catchments
                  </span>
                  <span className="text-base font-extrabold text-rose-800 font-mono mt-0.5 block">
                    {stats.contaminatedBarangaysCount} Barangays
                  </span>
                </div>
              </div>

              {/* Search bar & count */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={popSearch}
                    onChange={(e) => setPopSearch(e.target.value)}
                    placeholder="Search by barangay name..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/60"
                  />
                  {popSearch && (
                    <button
                      type="button"
                      onClick={() => setPopSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <span className="text-[11px] font-medium text-slate-400 shrink-0">
                  {filteredPopBarangays.length} of {MAASIN_BARANGAYS.length} Barangays
                </span>
              </div>
            </div>

            {/* List / Form */}
            <form onSubmit={handleSavePopulations} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2">
                {filteredPopBarangays.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No barangays match &quot;{popSearch}&quot;
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredPopBarangays.map((bgy) => {
                      const isAffected = stats.contaminatedBarangaysList.includes(bgy);
                      const currentVal = tempPopulations[bgy] ?? getBarangayPopulation(bgy);

                      return (
                        <div
                          key={bgy}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                            isAffected
                              ? "bg-rose-50/30 border-rose-200/80 hover:border-rose-300"
                              : "bg-white border-slate-200/80 hover:border-slate-300"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-800 truncate">
                                {bgy}
                              </span>
                              {isAffected && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                  At Risk
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="sr-only" htmlFor={`pop-${bgy}`}>
                              Population for {bgy}
                            </label>
                            <input
                              id={`pop-${bgy}`}
                              type="number"
                              min="0"
                              max="100000"
                              value={currentVal}
                              onChange={(e) => handlePopChange(bgy, e.target.value)}
                              className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold text-right rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPopModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save size={14} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
