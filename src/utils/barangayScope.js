export const UNASSIGNED_BARANGAY = '__unassigned__';

export function barangayKey(value) {
  return String(value || '').trim().toLowerCase()
    .replace(/^(barangay|brgy\.?)\s+/, '')
    .replace(/\s*\(pob\.?\)/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function matchesBarangay(value, area) {
  if (area === 'all') return true;
  if (!area || area === UNASSIGNED_BARANGAY) return false;
  const key = barangayKey(value);
  return Boolean(key) && key === barangayKey(area);
}

export function defaultMapBarangay(user, names = []) {
  if (user?.role !== 'barangay_official') return 'all';
  const assigned = user.barangay?.trim();
  if (!assigned) return UNASSIGNED_BARANGAY;
  return names.find(name => matchesBarangay(name, assigned)) || assigned;
}

// Keep a manual selection across data refreshes, but never inherit it from a
// different account or an earlier barangay assignment while auth is loading.
export function mapScopeOwner(user) {
  return JSON.stringify([user?.id, user?.role, user?.barangay]);
}

export function resolveMapBarangay(user, selection, names) {
  return selection?.owner === mapScopeOwner(user)
    ? selection.value : defaultMapBarangay(user, names);
}
