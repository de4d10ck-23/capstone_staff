import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { FileText, Download, Eye, Printer, X, RefreshCw, Loader2, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { MAASIN_BARANGAYS } from "../../constants/barangays";
import { downloadReport, reportResponse } from "../../utils/reportDownloads";
import { reviewLabels, reviewStyles, reportDate } from "../../utils/reportWorkflow";

const todayInManila = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const daysBefore = (end, count) => {
  const day = new Date(end + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() - count);
  return day.toISOString().slice(0, 10);
};

export default function GenerateReports() {
  const { token, API_URL, user } = useAuth();
  const [reports, setReports] = useState([]);
  const [title, setTitle] = useState("");
  const [barangay, setBarangay] = useState("all");
  const [end, setEnd] = useState(todayInManila);
  const [start, setStart] = useState(() => daysBefore(todayInManila(), 29));
  const [includeForecasts, setIncludeForecasts] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preview, setPreview] = useState(null);
  const [printReady, setPrintReady] = useState(false);
  const previewFrame = useRef(null);

  const loadReports = async (visible = true) => {
    if (visible) setLoading(true);
    try {
      const response = await reportResponse(await fetch(API_URL + "/reports", { headers: { Authorization: "Bearer " + token } }));
      const body = await response.json();
      if (!body.success) throw new Error(body.detail || "Could not load the archive.");
      setReports(body.data || []);
    } catch (err) { setError(err.message); }
    finally { if (visible) setLoading(false); }
  };
  useEffect(() => {
    loadReports();
    const refresh = () => loadReports(false);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [API_URL, token]);

  const payload = () => ({ title, barangay: barangay === "all" ? null : barangay,
    period_start: start, period_end: end, include_forecasts: includeForecasts, notes });
  const showArchived = async (report) => {
    const response = await reportResponse(await fetch(API_URL + "/reports/" + encodeURIComponent(report.id) + "/download?format=html",
      { headers: { Authorization: "Bearer " + token } }));
    setPrintReady(false);
    setPreview({ title: report.title, html: await response.text(), archived: true });
  };

  const run = async (action, report = null) => {
    if (busy) return;
    setError("");
    setSuccess("");
    setBusy(action);
    try {
      if (action === "send") {
        const response = await reportResponse(await fetch(API_URL + "/reports/" + encodeURIComponent(report.id) + "/send", {
          method: "POST", headers: { Authorization: "Bearer " + token },
        }));
        const body = await response.json();
        if (!body.success) throw new Error(body.detail || "Could not send the report.");
        setSuccess("Report sent to the CHU doctor's inbox. Its review status will update here.");
        await loadReports();
        return;
      }
      if (action === "open") { await showArchived(report); return; }
      if (action === "csv" || action === "html") { await downloadReport(API_URL, token, report.id, action); return; }
      if (!start || !end || start > end || end > todayInManila()) throw new Error("Choose a valid reporting period ending today or earlier.");
      const response = await reportResponse(await fetch(API_URL + "/reports/" + (action === "preview" ? "preview" : "generate"), {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(payload()),
      }));
      if (action === "preview") {
        setPrintReady(false);
        setPreview({ title: title || "Water Surveillance Report", html: await response.text(), archived: false });
      } else {
        const body = await response.json();
        if (!body.success) throw new Error(body.detail || "Could not archive the report.");
        setSuccess("Report generated and archived. Use Send to CHU Doctor to submit it for review.");
        await loadReports();
        await showArchived(body.data);
      }
    } catch (err) { setError(err.message || "Could not load the report."); }
    finally { setBusy(""); }
  };
  const input = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-blue-600";
  return <div className="space-y-6 font-sans">
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Water Surveillance Reports</h1>
      <p className="text-sm text-slate-500 mt-1">Compile recorded water-source conditions, resident concerns, and inspection activity for barangay or city-wide review.</p>
    </div>
    {error && <div role="alert" className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 flex gap-2"><AlertCircle size={18} className="shrink-0" />{error}</div>}
    {success && <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex gap-2"><CheckCircle2 size={18} className="shrink-0" />{success}</div>}
    <form onSubmit={(event) => { event.preventDefault(); run("generate"); }} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
      <div><h2 className="font-bold text-slate-900">Create a surveillance report</h2><p className="mt-1 text-xs text-slate-500">Preview the data, then archive a fixed report for review and export.</p></div>
      <fieldset disabled={Boolean(busy)} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Report title <span className="font-normal text-slate-400">(optional)</span>
            <input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Auto-generated from the report scope" className={input} />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Target barangay
            <select value={barangay} onChange={(event) => setBarangay(event.target.value)} className={input}>
              <option value="all">All barangays · Maasin City</option>
              {MAASIN_BARANGAYS.map((name) => <option key={name} value={name}>Brgy. {name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Period start
            <input required type="date" value={start} max={end || todayInManila()} onChange={(event) => setStart(event.target.value)} className={input} />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-700">Period end
            <input required type="date" value={end} min={start} max={todayInManila()} onChange={(event) => setEnd(event.target.value)} className={input} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[["Last 7 days", 6], ["Last 30 days", 29]].map(([label, days]) => <button key={label} type="button"
            onClick={() => { const today = todayInManila(); setEnd(today); setStart(daysBefore(today, days)); }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">{label}</button>)}
          <span className="self-center text-slate-400">Philippine time · up to 366 days</span>
        </div>
        <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-4">
          <h3 className="text-sm font-semibold text-blue-950">Included in every report</h3>
          <p className="text-xs text-blue-900 mt-1 leading-relaxed">Executive summary · Barangay totals · Source inventory and recorded status · Sources added · Status changes · Concerns submitted · Inspection workload and backlog · Follow-up register · Methods and data limitations</p>
        </div>
        <label className="flex gap-2 items-start text-sm text-slate-700">
          <input type="checkbox" checked={includeForecasts} onChange={(event) => setIncludeForecasts(event.target.checked)} className="mt-1" />
          <span>Include model forecast outlook<span className="block text-xs text-slate-500 mt-0.5">Saved estimates for today through seven days ahead, shown separately from recorded test results.</span></span>
        </label>
        <label className="block text-xs font-semibold text-slate-700 space-y-1.5">Inspector commentary <span className="font-normal text-slate-400">(optional)</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={5000}
            placeholder="Add context, observed data gaps, or follow-up priorities for the reviewer..." className={input} />
        </label>
      </fieldset>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" disabled={Boolean(busy)} onClick={() => run("preview")}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-blue-200 text-blue-800 font-semibold text-sm disabled:opacity-50"><Eye size={16} />{busy === "preview" ? "Compiling..." : "Preview report"}</button>
        <button type="submit" disabled={Boolean(busy)} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-blue-900 text-white font-semibold text-sm disabled:opacity-50">
          {busy === "generate" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}{busy === "generate" ? "Generating..." : "Generate & Archive"}
        </button>
      </div>
    </form>
    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center gap-3">
        <div><h2 className="font-bold text-slate-900">Report archive</h2><p className="text-xs text-slate-500 mt-1">Send your report to CHU once, then track the doctor's review. Downloads retain the archived data.</p></div>
        <button aria-label="Refresh report archive" disabled={loading} onClick={loadReports} className="p-2 rounded-lg border border-slate-200"><RefreshCw size={16} className={loading ? "animate-spin" : ""} /></button>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr>{["Report", "Scope", "Period", "Generated", "CHU review", "Actions"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading reports...</td></tr>
            : !reports.length ? <tr><td colSpan={6} className="text-center p-8 text-slate-400">No archived reports yet. Preview your first report above.</td></tr>
            : reports.map((report) => <tr key={report.id}>
              <td className="px-5 py-4 font-semibold text-slate-900">{report.title}{!report.schema_version && <span className="block text-[10px] text-amber-700 mt-1">Legacy metadata only · generate a new report</span>}</td>
              <td className="px-5 py-4 text-slate-600">{report.barangay || "All barangays"}</td>
              <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{report.period_start || "Not recorded"}<br />{report.period_end || ""}</td>
              <td className="px-5 py-4 text-slate-500">{report.created_at ? new Date(report.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : "Not recorded"}</td>
              <td className="px-5 py-4 min-w-44">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${reviewStyles[report.review_status || 'ready']}`}>{reviewLabels[report.review_status || 'ready']}</span>
                {report.submitted_at && <p className="mt-1 text-[10px] text-slate-500">Sent {reportDate(report.submitted_at)}</p>}
                {report.reviewed_at ? <p className="mt-1 text-[10px] text-emerald-700">Reviewed by {report.reviewed_by_name || 'CHU doctor'}<br />{reportDate(report.reviewed_at)}</p>
                  : report.review_started_at && <p className="mt-1 text-[10px] text-slate-500">Reviewing: {report.reviewer_name || 'CHU doctor'}</p>}
              </td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
                <button disabled={Boolean(busy) || !report.schema_version || Boolean(report.submitted_at) || (report.review_status || 'ready') !== 'ready' || (user?.role !== 'admin' && report.generated_by !== user?.id)}
                  onClick={() => run("send", report)} title={report.submitted_at ? 'Already sent to CHU' : 'Send the archived report to the CHU doctor'}
                  className="inline-flex gap-1 items-center rounded-full bg-blue-900 text-white px-3 py-1.5 text-xs font-semibold disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                  {report.submitted_at ? <CheckCircle2 size={14} /> : <Send size={14} />}{report.submitted_at ? 'Sent to CHU' : 'Send to CHU Doctor'}
                </button>
                <button disabled={Boolean(busy) || !report.schema_version} onClick={() => run("open", report)} className="inline-flex gap-1 items-center text-blue-700 font-semibold disabled:opacity-40"><Eye size={14} />View / Print</button>
                <button disabled={Boolean(busy) || !report.schema_version} onClick={() => run("csv", report)} className="inline-flex gap-1 items-center text-blue-700 font-semibold disabled:opacity-40"><Download size={14} />CSV</button>
                <button disabled={Boolean(busy) || !report.schema_version} onClick={() => run("html", report)} className="inline-flex gap-1 items-center text-blue-700 font-semibold disabled:opacity-40"><Download size={14} />HTML</button>
              </div></td>
            </tr>)}
        </tbody>
      </table></div>
    </section>
    {preview && <div role="dialog" aria-modal="true" aria-label="Report preview" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6 flex flex-col">
      <div className="bg-white rounded-t-2xl p-3 sm:px-5 flex flex-wrap gap-3 items-center justify-between border-b border-slate-200">
        <div className="min-w-0"><h2 className="font-bold text-sm text-slate-900 truncate">{preview.title}</h2><p className="text-[11px] text-slate-500">{preview.archived ? "Archived data snapshot" : "Preview only · data is not archived yet"}</p></div>
        <div className="flex items-center gap-2">
          <button disabled={!printReady} onClick={() => { previewFrame.current?.contentWindow?.focus(); previewFrame.current?.contentWindow?.print(); }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-blue-900 text-white px-4 py-2 disabled:opacity-50"><Printer size={14} />Print / Save PDF</button>
          <button aria-label="Close report preview" onClick={() => setPreview(null)} className="p-2 rounded-full hover:bg-slate-100"><X size={18} /></button>
        </div>
      </div>
      <iframe ref={previewFrame} title="WaterWatch report document" srcDoc={preview.html} sandbox="allow-same-origin allow-modals"
        onLoad={() => setPrintReady(true)} className="bg-white w-full flex-1 min-h-0 rounded-b-2xl" />
    </div>}
  </div>;
}
