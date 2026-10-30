export const REPORT_QUEUE_CHANGED = 'waterwatch:report-queue-changed';

export function notifyReportQueueChanged() {
  window.dispatchEvent(new Event(REPORT_QUEUE_CHANGED));
}

export const REPORT_QUEUE_ROUTES = {
  barangay_official: '/validate-reports',
  sanitization_inspector: '/inspections',
  city_health_officer: '/view-reports',
};
