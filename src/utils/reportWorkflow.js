export const reviewLabels = {
  ready: 'Ready to send', submitted: 'Received by CHU', in_review: 'Under review', done: 'Done',
};
export const reviewStyles = {
  ready: 'bg-slate-100 text-slate-700', submitted: 'bg-blue-100 text-blue-800',
  in_review: 'bg-amber-100 text-amber-800', done: 'bg-emerald-100 text-emerald-800',
};
export const reportDate = (value) => value ? new Date(value).toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
}) : 'Not recorded';
