import { useEffect, useRef } from "react";

// Refresh account-wide workflow state when returning to the page and while visible.
export default function useReportRefresh(refresh, apiUrl, token) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") refreshRef.current();
    };
    sync();
    const timer = setInterval(sync, 15000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [apiUrl, token]);
}
