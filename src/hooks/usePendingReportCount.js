import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REPORT_QUEUE_CHANGED, REPORT_QUEUE_ROUTES } from '../utils/reportQueueEvents';
import { fetchSidebarActionCounts } from '../utils/pendingReportCount';

export default function usePendingReportCount(user, token, apiUrl) {
  const { pathname } = useLocation();
  const route = REPORT_QUEUE_ROUTES[user?.role];
  const owner = JSON.stringify([user?.id, user?.role, user?.barangay, token, apiUrl]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!token || !route) return;
    let controller;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const counts = await fetchSidebarActionCounts(apiUrl, token,
          { role: user.role, barangay: user.barangay }, request.signal);
        if (!request.signal.aborted) setResult({ owner, counts });
      } catch {
        // Missing data is not a zero count; never display another account's count.
        if (!request.signal.aborted) setResult({ owner, counts: {} });
      }
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener(REPORT_QUEUE_CHANGED, refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller?.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(REPORT_QUEUE_CHANGED, refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [apiUrl, token, user?.id, user?.role, user?.barangay, route, owner, pathname]);

  return result?.owner === owner ? result.counts : {};
}
