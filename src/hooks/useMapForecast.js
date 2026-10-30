import { useEffect, useMemo, useState } from "react";

export const manilaToday = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

export function useMapForecast(API_URL, records, barangay) {
  const [source, setSource] = useState("sanitation");
  const [day, setDay] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState(manilaToday);
  useEffect(() => {
    const timer = setInterval(() => setToday(manilaToday()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (source !== "model") return;
    const refresh = () => setAttempt((value) => value + 1);
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [source]);
  const dates = useMemo(() => Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(`${today}T00:00:00+08:00`);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
      value: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(date),
      label: `${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", weekday: "long" }).format(date)} ${new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", day: "numeric" }).format(date)}`,
    };
  }), [today]);
  const date = dates[day].value;
  const key = `${date}:${barangay}`;
  useEffect(() => {
    if (source !== "model") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ forecast_date: date });
    if (barangay !== "all") params.set("barangay", barangay);
    fetch(`${API_URL}/forecast/map?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok || !body.success) throw new Error(body.detail || "Forecast unavailable.");
        if (!controller.signal.aborted) setResponse({ key, data: body.data });
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message || "Could not load forecasts.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [API_URL, source, date, barangay, key, attempt]);
  const data = response?.key === key ? response.data : null;
  const locations = useMemo(() => {
    if (source === "sanitation") return records;
    const predictions = new Map((data?.results || []).map((item) => [String(item.station_id), item]));
    return records.map((record) => {
      const forecast = predictions.get(String(record.id));
      return { ...record, status: forecast?.predicted_status || "unknown", forecast };
    });
  }, [records, source, data]);
  return { source, setSource, day, setDay, dates, date, locations, loading, error,
    saved: Boolean(data), updatedAt: data?.oldest_generated_at,
    staleCount: data?.stale_count || 0, availableCount: data?.results?.length || 0,
    unavailable: data?.unavailable_station_ids?.length || 0,
    retry: () => setAttempt((value) => value + 1) };
}
