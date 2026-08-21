import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PlusCircle, CheckCircle2, AlertCircle, MapPin, Droplets, ShieldCheck } from "lucide-react";
import { MAASIN_BARANGAYS as barangays } from "../../constants/barangays";

const AddWaterSource = () => {
  const { token, API_URL } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    source_type: "deep_well",
    barangay: "Combado",
    latitude: 10.1330,
    longitude: 124.8700,
    status: "safe",
    e_coli_count: 0,
    coliform_count: 0,
    description: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        e_coli_count: parseInt(formData.e_coli_count) || 0,
        coliform_count: parseInt(formData.coliform_count) || 0
      };

      const res = await fetch(`${API_URL}/water-locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Water station registered successfully in City Health database!");
        setFormData({
          name: "",
          source_type: "deep_well",
          barangay: "Combado",
          latitude: 10.1330,
          longitude: 124.8700,
          status: "safe",
          e_coli_count: 0,
          coliform_count: 0,
          description: ""
        });
      } else {
        setErrorMsg(data.detail || "Failed to register station.");
      }
    } catch (err) {
      console.error("Error adding water station:", err);
      setErrorMsg("Network error saving water station.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in font-sans">
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <PlusCircle size={24} className="text-cyan-300" />
          <h1 className="text-3xl font-extrabold text-white">Add Inspected Water Source</h1>
        </div>
        <p className="text-white/80 text-sm max-w-xl">
          Register new field-inspected water stations, shallow wells, or communal taps with laboratory test metrics.
        </p>
      </div>

      {successMsg && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-3">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Water Source Registered</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Error</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Station Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Purok 1 Spring Intake"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Source Type</label>
              <select
                value={formData.source_type}
                onChange={(e) => setFormData({ ...formData, source_type: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="deep_well">Deep Well</option>
                <option value="spring">Natural Spring</option>
                <option value="piped_water">Piped Water (Tap)</option>
                <option value="shallow_well">Shallow Well</option>
                <option value="refilling_station">Water Refilling Station</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Barangay</label>
              <select
                value={formData.barangay}
                onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {barangays.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Latitude (GPS)</label>
              <input
                type="number"
                step="0.000001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Longitude (GPS)</label>
              <input
                type="number"
                step="0.000001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Safety Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              >
                <option value="safe">Safe</option>
                <option value="warning">Warning</option>
                <option value="undrinkable">Contaminated</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Coliform Count</label>
              <input
                type="number"
                value={formData.coliform_count}
                onChange={(e) => setFormData({ ...formData, coliform_count: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">E. Coli Count</label>
              <input
                type="number"
                value={formData.e_coli_count}
                onChange={(e) => setFormData({ ...formData, e_coli_count: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Inspector Notes & Description</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Sanitary conditions, proximity to drainage, pipe condition..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Registering..." : "Submit Station into Registry"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddWaterSource;
