import { matchesBarangay } from '../utils/barangayScope.js';

export const CATEGORIES = [
  { id: 'natural', label: 'Natural hazards', color: '#7c3aed' },
  { id: 'livestock', label: 'Poultry & livestock', color: '#ea580c' },
  { id: 'sanitation', label: 'Septic tanks & sanitation', color: '#be185d' },
  { id: 'agriculture', label: 'Agriculture', color: '#15803d' },
  { id: 'waste', label: 'Waste & wastewater', color: '#854d0e' },
  { id: 'waterways', label: 'Waterways & drainage', color: '#0284c7' },
  { id: 'other', label: 'Other mapped sources', color: '#475569' },
];

export function hazardCategory(type = '') {
  const value = String(type).toLowerCase().replace(/[_-]/g, ' ');
  if (/poultry|piggery|livestock|animal|cattle|swine|chicken/.test(value)) return 'livestock';
  if (/septic|latrine|toilet|sanitation/.test(value)) return 'sanitation';
  if (/waste|sewage|landfill|dump/.test(value)) return 'waste';
  if (/agricultur|farmland|farm|crop/.test(value)) return 'agriculture';
  if (/river|stream|drain|canal|creek/.test(value)) return 'waterways';
  return 'other';
}

export const SUSCEPTIBILITY = {
  flood: [['LF', 'Low', '#d9c2f0'], ['MF', 'Moderate', '#a947f5'], ['HF', 'High', '#6600ff'], ['VHF', 'Very high', '#082567']],
  landslide: [['LL', 'Low', '#ffff00'], ['ML', 'Moderate', '#008000'], ['HL', 'High', '#ff0000'], ['VHL', 'Very high', '#993300']],
};

// Colors sampled from the supplied study-map body. Flood is a single purple class.
export const STUDY_LEGEND = [
  { code: 'LL', kind: 'landslide', label: 'Low landslide susceptibility', color: '#feeb38' },
  { code: 'ML', kind: 'landslide', label: 'Moderate landslide susceptibility', color: '#70ab4a' },
  { code: 'HL', kind: 'landslide', label: 'High landslide susceptibility', color: '#e93526' },
  { code: 'F', kind: 'flood', label: 'Susceptible to flooding', color: '#63336a' },
  { code: 'OUT', kind: 'coverage', label: 'Outside assessed susceptibility zones', color: '#fb9c4c' },
];

export function filterHazardFeatures(features, { enabled, categories, natural, area, boundaries }) {
  if (!enabled) return [];
  return features.filter(({ properties: p }) => {
    if (!categories.includes(p.category)) return false;
    if (!matchesBarangay(p.barangay, area)) return false;
    if (p.category !== 'natural') return true;
    return p.kind === 'boundary' ? boundaries : natural.includes(p.kind);
  });
}

export function featureBounds(features) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = coords => {
    if (typeof coords[0] === 'number') {
      bounds[0] = Math.min(bounds[0], coords[0]); bounds[1] = Math.min(bounds[1], coords[1]);
      bounds[2] = Math.max(bounds[2], coords[0]); bounds[3] = Math.max(bounds[3], coords[1]);
    } else coords.forEach(visit);
  };
  features.forEach(f => visit(f.geometry.coordinates));
  return Number.isFinite(bounds[0]) ? [[bounds[0], bounds[1]], [bounds[2], bounds[3]]] : null;
}

export function naturalFeatures(data, kind) {
  return (data?.features || []).map(feature => ({ ...feature, properties: {
    ...feature.properties, category: 'natural', kind,
    color: SUSCEPTIBILITY[kind].find(([code]) => code === feature.properties?.code)?.[2] || '#64748b',
  } }));
}

export function sourceFeatures(data) {
  return (data?.features || []).filter(f => f.geometry).map(feature => {
    const category = hazardCategory(feature.properties?.hazard_type);
    return { ...feature, properties: { ...feature.properties, category,
      color: CATEGORIES.find(c => c.id === category).color } };
  });
}
