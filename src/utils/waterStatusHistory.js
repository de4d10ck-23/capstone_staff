export const historyDate = (log) => log?.effective_date || log?.sample_date || '';

export const manilaDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const signature = (log) => JSON.stringify([
  log.status === 'undrinkable' ? 'contaminated' : log.status,
  log.e_coli ?? (log.status === 'unknown' ? null : Number(log.e_coli_count || 0) > 0),
  log.coliform_bacteria ?? (log.status === 'unknown' ? null : Number(log.coliform_count || 0) > 0),
  log.bacteriological_exam, log.sample_date || '', log.sample_time || '', log.notes ?? '',
]);

export function indexHistory(history) {
  const daily = {};
  [...history].sort((a, b) => historyDate(a).localeCompare(historyDate(b))
    || (a.recorded_at || '').localeCompare(b.recorded_at || '')
    || String(a.id).localeCompare(String(b.id))).forEach((log) => {
    if (historyDate(log)) daily[historyDate(log)] = log;
  });
  const dates = Object.keys(daily).sort();
  const changes = {};
  let previous;
  for (const date of dates) {
    const value = signature(daily[date]);
    if (value !== previous) changes[date] = daily[date];
    previous = value;
  }
  return { daily, dates, changes };
}

export function snapshotForDay(index, day) {
  let snapshot = null;
  for (const date of index.dates) {
    if (date > day) break;
    snapshot = index.daily[date];
  }
  return snapshot;
}

export function historyFormValues(log) {
  const status = log?.status === 'undrinkable' ? 'contaminated'
    : log?.status === 'pending' ? 'unknown' : (log?.status || 'unknown');
  const known = log && status !== 'unknown' && status !== 'pending';
  const eColi = !known ? null : typeof log.e_coli === 'boolean' ? log.e_coli
    : log.e_coli_count != null ? Number(log.e_coli_count) > 0 : null;
  return {
    status, e_coli_present: eColi === null ? 'unknown' : eColi ? 'present' : 'not_present',
    e_coli_count: eColi ? Number(log.e_coli_count || 1) : 0,
    coliform_count: log?.coliform_count || 0,
    bacteriological_exam: log?.bacteriological_exam || 'untested',
    sample_date: log?.sample_date || '', sample_time: log?.sample_time || '',
    description: log?.notes ?? '',
  };
}
