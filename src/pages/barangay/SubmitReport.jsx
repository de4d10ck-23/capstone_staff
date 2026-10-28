import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import BarangayWaterSourcesMap from "../../components/BarangayWaterSourcesMap";
import { MessageSquare, Send, CheckCircle2, AlertCircle, Droplets, UploadCloud, X, Loader2 } from "lucide-react";

const categories = [
  ["request_inspection", "Water Inspection Request (Field Audit / Sampling)", "Water Inspection Request"],
  ["water_quality", "Water Quality (Odor, Color, Taste)", "Water Quality Concern"],
  ["broken_pipe", "Damaged / Broken Pipeline", "Damaged / Broken Pipeline"],
  ["toilet_proximity", "Unhygienic Toilet Near Water Source", "Unhygienic Toilet Proximity"],
  ["other", "Other", "Other Concern"],
];

export default function SubmitReport() {
  const { user, token, API_URL } = useAuth();
  const [category, setCategory] = useState("request_inspection");
  const [otherCategory, setOtherCategory] = useState("");
  const [description, setDescription] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedReportId, setSavedReportId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInput = useRef(null);
  const selectedLocation = locations.find((item) => String(item.id) === String(selectedLocationId));
  const locked = isSubmitting || Boolean(savedReportId);

  useEffect(() => {
    const controller = new AbortController();
    setLocations([]);
    setSelectedLocationId("");
    setLoadingLocations(true);
    if (!user?.barangay || !token) {
      setLoadingLocations(false);
      return () => controller.abort();
    }
    fetch(API_URL + "/water-locations?barangay=" + encodeURIComponent(user.barangay), {
      headers: { Authorization: "Bearer " + token }, signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.detail || "Could not load water sources.");
      if (!controller.signal.aborted) setLocations((body.data || []).filter(
        (item) => item.barangay?.trim().toLowerCase() === user.barangay.trim().toLowerCase()));
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message || "Could not load water sources.");
    }).finally(() => { if (!controller.signal.aborted) setLoadingLocations(false); });
    return () => controller.abort();
  }, [API_URL, token, user?.barangay]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(selected.type) || selected.size > 10 * 1024 * 1024) {
      setError("Choose a PNG, JPG, or WebP image smaller than 10 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setFile(selected);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    setSuccess("");
    setError("");
    if (!savedReportId && (!selectedLocation || loadingLocations)) {
      setError("Select a water source from the dropdown or map before sending your concern.");
      return;
    }
    if (!savedReportId && (!description.trim() || (category === "other" && !otherCategory.trim()))) {
      setError("Provide a detailed description and complete the selected category.");
      return;
    }
    setIsSubmitting(true);
    let reportId = savedReportId;
    try {
      if (!reportId) {
        let photoUrl = null;
        if (file) {
          const upload = new FormData();
          upload.append("file", file);
          const response = await fetch(API_URL + "/resident-reports/upload-image", {
            method: "POST", headers: { Authorization: "Bearer " + token }, body: upload,
          });
          const body = await response.json();
          if (!response.ok || !body.success || !body.image_url) throw new Error(body.detail || "Photo upload failed. Please try again.");
          photoUrl = body.image_url;
        }
        const categoryName = category === "other" ? "Other: " + otherCategory.trim()
          : categories.find((item) => item[0] === category)[2];
        const response = await fetch(API_URL + "/resident-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            title: categoryName + " - " + (selectedLocation.full_name || selectedLocation.name),
            category, type: category, location_id: selectedLocation.id,
            description: category === "other"
              ? "Concern: Other (" + otherCategory.trim() + ")\n\n" + description.trim() : description.trim(),
            image_url: photoUrl, photo_url: photoUrl,
          }),
        });
        const body = await response.json();
        if (!response.ok || !body.success || !body.data?.id) throw new Error(body.detail || "Could not save the concern.");
        reportId = body.data.id;
        setSavedReportId(reportId);
      }
      const response = await fetch(API_URL + "/resident-reports/" + reportId, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ status: "escalated", pass_to_inspector: true }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.detail || "Could not forward the concern to CHU.");
      setSuccess("Concern submitted to the City Health Unit and sanitation inspectors for review.");
      setSavedReportId(null);
      setCategory("request_inspection");
      setOtherCategory("");
      setDescription("");
      setSelectedLocationId("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setError(reportId
        ? "Your concern is saved, but forwarding to CHU failed. Select Retry Sending to forward the saved concern. " + err.message
        : err.message || "Could not submit the concern. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600";
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in font-sans">
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-cyan-800 rounded-3xl p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare size={24} className="text-cyan-300" />
          <h1 className="text-2xl sm:text-3xl font-extrabold">Submit Concern</h1>
        </div>
        <p className="text-white/80 text-sm">Submit a water-source concern or inspection request from Barangay {user?.barangay} to the City Health Unit and sanitation inspectors.</p>
      </div>
      {success && <div role="status" className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex gap-3"><CheckCircle2 size={20} className="shrink-0" />{success}</div>}
      {error && <div role="alert" className="p-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex gap-3"><AlertCircle size={20} className="shrink-0" />{error}</div>}
      <form onSubmit={submit} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6">
        <h2 className="text-base font-bold text-slate-900">New Concern or Inspection Details</h2>
        <fieldset disabled={locked} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label htmlFor="barangay-concern-category" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">Concern / Request Category</label>
              <select id="barangay-concern-category" value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {category === "other" && <input required value={otherCategory} onChange={(event) => setOtherCategory(event.target.value)}
                aria-label="Other concern category" placeholder="Specify your concern..." className={inputClass + " mt-2"} />}
            </div>
            <div>
              <label htmlFor="barangay-concern-source" className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 gap-2">
                <span className="flex items-center gap-1.5"><Droplets size={13} className="text-cyan-600" />Water Source in Brgy. {user?.barangay}</span>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full lowercase whitespace-nowrap">{loadingLocations ? "Loading..." : locations.length + " available"}</span>
              </label>
              <select id="barangay-concern-source" required disabled={loadingLocations || locked} value={selectedLocationId} onChange={(event) => setSelectedLocationId(event.target.value)} className={inputClass}>
                <option value="">-- Select a water source --</option>
                {locations.map((item) => <option key={item.id} value={String(item.id)}>{item.full_name || item.name} ({(item.source_type || item.type || "Station").replace(/_/g, " ")})</option>)}
              </select>
              {!loadingLocations && locations.length === 0 && <p className="text-xs text-slate-500 mt-2">No sources are available. Register an unlisted source through Water Sources.</p>}
            </div>
          </div>
          <div className={locked ? "pointer-events-none opacity-70" : ""}>
            <BarangayWaterSourcesMap locations={locations} selectedLocationId={selectedLocationId}
              onSelectLocation={(id) => { if (!locked) setSelectedLocationId(id); }} barangayName={user?.barangay || "Community"} />
          </div>
          <div>
            <label htmlFor="barangay-concern-description" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">Detailed Description</label>
            <textarea id="barangay-concern-description" required rows={4} value={description} onChange={(event) => setDescription(event.target.value)}
              placeholder="Provide specific details to help the City Health Unit and sanitation inspectors investigate..." className={inputClass} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="barangay-concern-photo" className="text-xs font-semibold uppercase tracking-wider text-slate-700">Photo Proof / Attachment</label>
              <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
            </div>
            <input id="barangay-concern-photo" ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={selectFile} className="sr-only" />
            {preview ? <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <img src={preview} alt="Photo proof preview" className="h-16 w-16 rounded-xl object-cover" />
              <span className="flex-1 min-w-0 truncate text-xs text-slate-700">{file?.name}</span>
              <button type="button" aria-label="Remove photo" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}
                className="p-2 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600"><X size={18} /></button>
            </div> : <label htmlFor="barangay-concern-photo" className="flex flex-col items-center gap-2 p-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 cursor-pointer hover:border-blue-500">
              <UploadCloud size={28} className="text-slate-400" /><span className="text-xs font-semibold text-slate-700">Click to upload photo proof</span>
              <span className="text-[11px] text-slate-400">PNG, JPG, or WebP (Max 10 MB)</span>
            </label>}
          </div>
        </fieldset>
        {!selectedLocation && !savedReportId && <p className="text-xs text-slate-500">Select a water source from the dropdown or map to enable sending.</p>}
        <button type="submit" disabled={isSubmitting || (!savedReportId && (loadingLocations || !selectedLocation))}
          className="w-full py-3.5 rounded-full bg-blue-900 hover:bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isSubmitting ? "Sending..." : savedReportId ? "Retry Sending" : "Send to Health Inspectors"}
        </button>
      </form>
    </div>
  );
}
