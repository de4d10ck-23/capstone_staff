import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { downloadReport, reportResponse } from "../../utils/reportDownloads";
import { reviewLabels, reviewStyles, reportDate } from "../../utils/reportWorkflow";
import { FileText, Inbox, Eye, Printer, Download, RefreshCw, X, CheckCircle2, ClipboardCheck, Clock, Search, Loader2 } from "lucide-react";

const tabs = [["submitted", "Received", Inbox], ["in_review", "Under Review", Clock], ["done", "Done Archive", CheckCircle2], ["all", "All Received", FileText]];
const eventLabels = { sent: "Sent to CHU", review_started: "Review started", review_completed: "Review marked Done" };

export default function ViewReports() {
  const { token, API_URL, user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("submitted");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState("");
  const [detail, setDetail] = useState(null);
  const [markup, setMarkup] = useState("");
  const [events, setEvents] = useState([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [printReady, setPrintReady] = useState(false);
  const frame = useRef(null);

  const request = async (path, options = {}) => reportResponse(await fetch(API_URL + path, {
    ...options, headers: { Authorization: "Bearer " + token, ...options.headers },
  }));
  const loadReports = async (visible = true) => {
    if (visible) setLoading(true);
    try {
      const body = await (await request("/reports")).json();
      if (!body.success) throw new Error(body.detail || "Could not load received reports.");
      setReports((body.data || []).filter((report) => report.submitted_at)
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)));
    } catch (err) { setError(err.message); }
    finally { if (visible) setLoading(false); }
  };
  useEffect(() => {
    loadReports();
    const refresh = () => loadReports(false);
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [API_URL, token]);

  const openReport = async (id) => {
    const [dataResponse, documentResponse] = await Promise.all([
      request("/reports/" + encodeURIComponent(id)),
      request("/reports/" + encodeURIComponent(id) + "/download?format=html"),
    ]);
    const [body, document] = await Promise.all([dataResponse.json(), documentResponse.text()]);
    if (!body.success) throw new Error(body.detail || "Could not load report details.");
    setPrintReady(false);
    setDetail(body.data);
    setEvents(body.events || []);
    setMarkup(document);
    setReviewNotes(body.data.review_notes || "");
  };
  const run = async (action, report = detail) => {
    if (busy || !report) return;
    setBusy(action); setError(""); setSuccess("");
    try {
      if (action === "open") { await openReport(report.id); return; }
      if (action === "csv" || action === "html") { await downloadReport(API_URL, token, report.id, action); return; }
      if (action === "complete" && !reviewNotes.trim()) throw new Error("Record your review notes and follow-up decisions before marking Done.");
      const response = await request("/reports/" + encodeURIComponent(report.id) + "/review/" + action, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: action === "complete" ? JSON.stringify({ notes: reviewNotes.trim() }) : undefined,
      });
      const body = await response.json();
      if (!body.success) throw new Error(body.detail || "Could not update review status.");
      setSuccess(action === "complete" ? "Review marked Done and archived. The inspector can see your review outcome." : "Review started. Record your conclusions when ready.");
      await loadReports(false);
      await openReport(report.id);
      if (action === "complete") setTab("done");
    } catch (err) { setError(err.message || "Could not update the report."); }
    finally { setBusy(""); }
  };

  const counts = reports.reduce((result, report) => {
    result[report.review_status] = (result[report.review_status] || 0) + 1; return result;
  }, {});
  const scopes = Array.from(new Set(reports.map((report) => report.barangay || "City-wide"))).sort();
  const filtered = reports.filter((report) => (tab === "all" || report.review_status === tab)
    && (scope === "all" || (report.barangay || "City-wide") === scope)
    && [report.title, report.barangay, report.author_name, report.id].some((value) => value?.toLowerCase().includes(search.toLowerCase())));
  const otherReviewer = detail?.review_started_by && detail.review_started_by !== user?.id && user?.role !== "admin";
  const summary = detail?.snapshot?.summary;

  return <div className="space-y-6 font-sans">
    <header className="flex flex-wrap gap-4 justify-between items-start">
      <div><p className="text-xs font-bold text-blue-600 uppercase tracking-wider">City Health Unit</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Doctor Report Review</h1>
        <p className="text-sm text-slate-500 mt-1">Review submitted water surveillance reports, record decisions, and keep a completed-review archive.</p>
      </div>
      <button disabled={loading || Boolean(busy)} onClick={() => { setError(""); loadReports(); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Refresh
      </button>
    </header>
    {error && !detail && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {success && !detail && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{success}</div>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {tabs.slice(0, 3).map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)}
        className={"rounded-2xl border p-5 text-left bg-white " + (tab === key ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200")}>
        <span className="flex items-center justify-between text-xs font-semibold text-slate-500">{label}<Icon size={18} /></span>
        <span className="block mt-2 text-3xl font-bold text-slate-900">{counts[key] || 0}</span>
        <span className="block mt-1 text-[11px] text-slate-400">{key === "submitted" ? "Awaiting a doctor" : key === "in_review" ? "Review in progress" : "Doctor review completed"}</span>
      </button>)}
    </div>
    <section className="rounded-3xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 sm:p-5 space-y-4 border-b border-slate-100">
        <nav aria-label="Report review queues" className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}
            className={"px-3 py-2 rounded-full text-xs font-semibold " + (tab === key ? "bg-blue-900 text-white" : "bg-slate-100 text-slate-600")}>
            {label} <span className="ml-1 opacity-70">{key === "all" ? reports.length : counts[key] || 0}</span>
          </button>)}
        </nav>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1"><Search size={15} className="absolute left-3 top-3 text-slate-400" />
            <input aria-label="Search received reports" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, author, barangay, or reference..." className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-xs" />
          </label>
          <select aria-label="Filter reports by scope" value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
            <option value="all">All scopes</option>{scopes.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500"><tr>{["Report / Author", "Scope / Period", "Received", "Review status", "Actions"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">Loading report inbox...</td></tr>
            : !filtered.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-400">{tab === "done" ? "No completed reviews match these filters." : "No received reports match this queue. Reports appear after an inspector sends them to CHU."}</td></tr>
            : filtered.map((report) => <tr key={report.id} className="hover:bg-slate-50/70">
              <td className="px-5 py-4"><p className="font-bold text-slate-900">{report.title}</p><p className="text-slate-500 mt-1">{report.author_name || report.submitted_by_name || "Staff author"}</p><p className="text-[10px] text-slate-400 mt-1 font-mono">{report.id.slice(0, 8).toUpperCase()}</p></td>
              <td className="px-5 py-4 text-slate-600"><p className="font-semibold">{report.barangay || "City-wide"}</p><p className="text-[10px] mt-1 whitespace-nowrap">{report.period_start} to {report.period_end}</p></td>
              <td className="px-5 py-4 text-slate-500">{reportDate(report.submitted_at)}</td>
              <td className="px-5 py-4"><span className={"inline-flex rounded-full px-2.5 py-1 font-bold text-[10px] " + reviewStyles[report.review_status]}>{reviewLabels[report.review_status]}</span>
                {report.review_status === "done" ? <p className="mt-1 text-[10px] text-slate-500">{report.reviewed_by_name}<br />{reportDate(report.reviewed_at)}</p>
                  : report.review_started_at && <p className="mt-1 text-[10px] text-slate-500">{report.reviewer_name}</p>}
              </td>
              <td className="px-5 py-4"><div className="flex flex-wrap gap-2">
                <button disabled={Boolean(busy)} onClick={() => run("open", report)} className="inline-flex gap-1 items-center rounded-full bg-blue-900 px-3 py-1.5 text-white font-semibold disabled:opacity-50"><Eye size={14} />{report.review_status === "done" ? "View Review" : "View & Review"}</button>
                <button disabled={Boolean(busy)} onClick={() => run("csv", report)} className="inline-flex gap-1 items-center font-semibold text-blue-700 disabled:opacity-50"><Download size={14} />CSV</button>
              </div></td>
            </tr>)}
        </tbody>
      </table></div>
    </section>
    {detail && <div role="dialog" aria-modal="true" aria-label="Review surveillance report" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm p-2 sm:p-5 flex flex-col">
      <div className="bg-white rounded-t-2xl border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1"><h2 className="text-sm font-bold text-slate-900 truncate">{detail.title}</h2><p className="text-[11px] text-slate-500 mt-0.5">{detail.barangay || "City-wide"} · {detail.period_start} to {detail.period_end}</p></div>
        <div className="flex items-center gap-2">
          <button disabled={!printReady || Boolean(busy)} onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }} className="inline-flex gap-1.5 items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Printer size={14} />Print / Save PDF</button>
          <button disabled={Boolean(busy)} onClick={() => run("html")} className="inline-flex gap-1.5 items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download size={14} />HTML</button>
          <button aria-label="Close report review" disabled={Boolean(busy)} onClick={() => { setDetail(null); setMarkup(""); }} className="p-2 rounded-full hover:bg-slate-100 disabled:opacity-50"><X size={18} /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-white rounded-b-2xl overflow-auto lg:overflow-hidden flex flex-col lg:flex-row">
        <iframe ref={frame} title="Archived surveillance report" srcDoc={markup} sandbox="allow-same-origin allow-modals" onLoad={() => setPrintReady(true)}
          className="w-full h-[55vh] shrink-0 lg:h-full lg:flex-1 lg:w-0 bg-white border-0" />
        <aside className="lg:w-96 shrink-0 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-slate-200 p-5 space-y-5 bg-slate-50">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{success}</p>}
          <div><span className={"inline-flex rounded-full px-3 py-1 text-xs font-bold " + reviewStyles[detail.review_status]}>{reviewLabels[detail.review_status]}</span>
            <p className="mt-2 text-xs text-slate-500">Report reference: <span className="font-mono break-all">{detail.id}</span></p>
            <p className="mt-1 text-xs text-slate-500">Prepared by {detail.author_name || detail.snapshot?.prepared_by}</p>
          </div>
          {summary && <div className="grid grid-cols-3 gap-2 text-center">
            {[["Sources", summary.sources], ["Recorded contaminated", summary.source_status?.contaminated || 0], ["Open inspections", summary.open_inspections]].map(([label, value]) =>
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-2"><strong className="block text-lg text-slate-900">{value}</strong><span className="block text-[10px] text-slate-500">{label}</span></div>)}
          </div>}
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Doctor review</h3>
            {detail.review_status === "submitted" && <>
              <p className="text-xs text-slate-600">Read the report, then start the review to record your assessment and follow-up decisions.</p>
              <button disabled={Boolean(busy)} onClick={() => run("start")} className="w-full inline-flex justify-center gap-2 items-center rounded-full bg-blue-900 text-white py-2.5 text-xs font-bold disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}Start Review</button>
            </>}
            {detail.review_status === "in_review" && (otherReviewer ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">This report is being reviewed by {detail.reviewer_name || "another doctor"}. You can view, download, and print it.</div> : <>
              <p className="text-xs text-slate-500">Reviewing: {detail.reviewer_name}. Record your conclusions and any follow-up instructions.</p>
              <label htmlFor="doctor-review-notes" className="block text-xs font-semibold text-slate-700">Review notes / follow-up decisions</label>
              <textarea id="doctor-review-notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} disabled={Boolean(busy)} rows={6} maxLength={5000}
                placeholder="Summarize the review, data gaps, and any required follow-up..." className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs focus:outline-none focus:border-blue-500" />
              <p className="text-[10px] text-slate-400">Notes are recorded when you mark the review Done.</p>
              <button disabled={Boolean(busy) || !reviewNotes.trim()} onClick={() => run("complete")} className="w-full inline-flex justify-center gap-2 items-center rounded-full bg-emerald-600 text-white py-2.5 text-xs font-bold disabled:opacity-50">{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}Mark Review Done</button>
            </>)}
            {detail.review_status === "done" && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-xs text-emerald-900">
              <p className="font-bold">Review completed by {detail.reviewed_by_name}</p><p>{reportDate(detail.reviewed_at)} (PH)</p><p className="whitespace-pre-wrap leading-relaxed">{detail.review_notes}</p>
            </div>}
          </section>
          <section className="space-y-3 border-t border-slate-200 pt-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Review activity</h3>
            {events.map((event) => <div key={event.id} className="border-l-2 border-blue-200 pl-3 text-xs">
              <p className="font-semibold text-slate-800">{eventLabels[event.event] || event.event}</p><p className="mt-1 text-slate-500">{event.actor_name || "Staff member"}</p><p className="text-[10px] text-slate-400">{reportDate(event.created_at)} (PH)</p>
            </div>)}
          </section>
        </aside>
      </div>
    </div>}
  </div>;
}
