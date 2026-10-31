import React from "react";

export const riskLabel = (status) => ({ safe: "Low risk", warning: "Moderate risk",
  undrinkable: "High risk", contaminated: "High risk" }[status] || "Unavailable");

export default function MapForecastControls({ forecast }) {
  const { source, setSource, error, retry } = forecast;
  return <section aria-label="Map data source and forecast" className="space-y-1.5">
    <div className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
      {[['sanitation', 'Sanitation records'], ['model', 'Model forecast']].map(([value, label]) =>
        <button key={value} type="button" aria-pressed={source === value} onClick={() => setSource(value)}
          className={`rounded-md md:rounded-lg px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-xs font-semibold text-white drop-shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${source === value ? 'bg-blue-600/90 ring-1 ring-white/70 shadow-lg' : 'bg-black/30 hover:bg-black/45'}`}>{label}</button>)}

    </div>
    {source === 'model' && error && <div className="rounded-lg bg-black/60 px-3 py-2 text-xs text-white" aria-live="polite">
      <span>{error} <button type="button" onClick={retry} className="underline font-semibold">Retry</button></span>
    </div>}
  </section>;
}
