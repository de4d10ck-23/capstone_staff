
export function countWaterSourceActions(rows, user) {
  const closed = ['done', 'registered', 'approved', 'resolved', 'completed', 'dismissed', 'rejected'];
  const area = (user.barangay || '').trim().toLowerCase();
  return rows.filter(row => (row.type === 'unregistered_source' || row.category === 'unregistered_source')
    && (user.role !== 'barangay_official' || (area && (!row.barangay || row.barangay.trim().toLowerCase() === area)))
    && !closed.includes((row.status || '').trim().toLowerCase())).length;
}

export async function fetchSidebarActionCounts(apiUrl, token, user, signal, fetcher = fetch) {
  const options = { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal };
  const read = async path => {
    const response = await fetcher(apiUrl + path, options);
    const body = await response.json();
    if (!response.ok || !body.success || !Array.isArray(body.data)) throw new Error('Action queue unavailable');
    return body.data;
  };
  if (user.role === 'barangay_official') {
    if (!user.barangay?.trim()) return {};
    const rows = await read('/resident-reports');
    return { '/validate-reports': countReportsNeedingAction(rows, user),
      '/water-sources': countWaterSourceActions(rows, user) };
  }
  if (user.role === 'sanitization_inspector') {
    // One unavailable queue must not hide the other queue's badge.
    const results = await Promise.allSettled([read('/inspections'), read('/resident-reports')]);
    return { '/inspections': results[0].status === 'fulfilled' ? countReportsNeedingAction(results[0].value, user) : null,
      '/water-sources': results[1].status === 'fulfilled' ? countWaterSourceActions(results[1].value, user) : null };
  }
  if (user.role === 'city_health_officer') {
    return { '/view-reports': countReportsNeedingAction(await read('/reports'), user) };
  }
  return {};
}

export function countReportsNeedingAction(rows, user) {
  if (user.role === 'barangay_official') {
    const area = (user.barangay || '').trim().toLowerCase();
    if (!area) return 0;
    return rows.filter(row => (row.barangay || '').trim().toLowerCase() === area
      && row.type !== 'unregistered_source' && row.category !== 'unregistered_source'
      && (!row.status || row.status === 'pending')).length;
  }
  if (user.role === 'sanitization_inspector') {
    return rows.filter(row => !row.status || ['pending', 'assigned'].includes(row.status)).length;
  }
  if (user.role === 'city_health_officer') {
    return rows.filter(row => row.submitted_at && row.review_status === 'submitted').length;
  }
  return 0;
}

