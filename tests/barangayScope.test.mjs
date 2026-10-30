import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMapBarangay, matchesBarangay, mapScopeOwner, resolveMapBarangay, UNASSIGNED_BARANGAY } from '../src/utils/barangayScope.js';
import { filterHazardFeatures, sourceFeatures } from '../src/components/hazardLayers.js';

const official = { id: 1, role: 'barangay_official', barangay: ' Hantag ' };

test('barangay accounts default to assigned area even without study-map coverage', () => {
  assert.equal(defaultMapBarangay(official), 'Hantag');
  assert.equal(defaultMapBarangay({ ...official, barangay: 'Basak' }, ['Hantag']), 'Basak');
  assert.equal(defaultMapBarangay({ ...official, barangay: ' ' }), UNASSIGNED_BARANGAY);
  assert.equal(defaultMapBarangay({ role: 'city_health_officer' }), 'all');
  assert.equal(defaultMapBarangay({ role: 'sanitization_inspector', barangay: 'Hantag' }), 'all');
});

test('async auth and account/assignment changes select the current barangay without resetting a manual choice on refresh', () => {
  assert.equal(resolveMapBarangay(null, null), 'all');
  assert.equal(resolveMapBarangay(official, null), 'Hantag');
  const selection = { owner: mapScopeOwner(official), value: 'all' };
  assert.equal(resolveMapBarangay({ ...official }, selection), 'all');
  assert.equal(resolveMapBarangay({ ...official, id: 2, barangay: 'Rizal' }, selection), 'Rizal');
  assert.equal(resolveMapBarangay({ ...official, barangay: 'Batuan' }, selection), 'Batuan');
});

test('barangay names match prefixes, case, spacing, hyphens and Pob suffix without partial matches', () => {
  assert.equal(matchesBarangay('Brgy. HANTAG', 'Hantag'), true);
  assert.equal(matchesBarangay('Malapoc-Norte', 'Malapoc Norte'), true);
  assert.equal(matchesBarangay('Tagnipa (Pob.)', 'Tagnipa'), true);
  assert.equal(matchesBarangay('San Isidro', 'San'), false);
  assert.equal(matchesBarangay(null, 'Hantag'), false);
  assert.equal(matchesBarangay(null, UNASSIGNED_BARANGAY), false);
});

test('all potential-source categories use their designated barangay and exclude unknown assignments', () => {
  const types = ['poultry_farm', 'septic_tank', 'farmland', 'wastewater', 'river', 'other'];
  const features = sourceFeatures({ features: types.flatMap(hazard_type => ['Hantag', 'Rizal', null].map(barangay => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [124.83, 10.18] },
    properties: { hazard_type, barangay },
  }))) });
  const settings = { enabled: true, area: 'Hantag', categories: ['livestock', 'sanitation', 'agriculture', 'waste', 'waterways', 'other'], natural: [], boundaries: true };
  const visible = filterHazardFeatures(features, settings);
  assert.equal(visible.length, types.length);
  assert.ok(visible.every(f => f.properties.barangay === 'Hantag'));
  assert.equal(filterHazardFeatures(features, { ...settings, area: 'all' }).length, 18);
});

test('barangays with no data never fall back to another natural hazard area', () => {
  const features = ['landslide', 'flood', 'coverage', 'boundary'].map(kind => ({ properties: { category: 'natural', barangay: 'Hantag', kind } }));
  const settings = { enabled: true, area: 'Basak', categories: ['natural'], natural: ['landslide', 'flood', 'coverage'], boundaries: true };
  assert.deepEqual(filterHazardFeatures(features, settings), []);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, area: UNASSIGNED_BARANGAY }), []);
});
