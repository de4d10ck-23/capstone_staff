import React from "react";

export const riskLabel = (status) => ({ safe: "Low risk", warning: "Moderate risk",
  undrinkable: "High risk", contaminated: "High risk" }[status] || "Unavailable");

export default function MapForecastControls({ forecast }) {
  const { source, setSource, loading, error, retry } = forecast;
  return <section aria-label="Map data source and forecast" className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 md:px-4 md:py-3 space-y-1.5 md:space-y-2">
    <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
      <span className="text-[11px] md:text-xs font-bold text-slate-700 mr-1">Map data</span>
      {[['sanitation', 'Sanitation records'], ['model', 'Model forecast']].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={source === value} onClick={() => setSource(value)}
          className={`rounded-md md:rounded-lg px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-xs font-semibold ${source === value ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}

    </div>
    {source === 'model' && error && <div className="text-xs text-slate-600" aria-live="polite">
      <span className="text-red-700">{error} <button type="button" onClick={retry} className="underline font-semibold">Retry</button></span>
    </div>}
  </section>;
}
