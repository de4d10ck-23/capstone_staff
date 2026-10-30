import test from 'node:test';
import assert from 'node:assert/strict';
import { hazardCategory, naturalFeatures, sourceFeatures, filterHazardFeatures, featureBounds, STUDY_LEGEND } from '../src/components/hazardLayers.js';

test('categorizes database types and preserves unknown types as other', () => {
  for (const [type, expected] of Object.entries({ poultry_farm: 'livestock', piggery: 'livestock',
    septic_tank: 'sanitation', latrine: 'sanitation', wastewater: 'waste', landfill: 'waste',
    agricultural_land: 'agriculture', farmland: 'agriculture', drainage: 'waterways', river: 'waterways',
    unknown: 'other' })) assert.equal(hazardCategory(type), expected);
});

test('master switch, study area, hazard subtypes and boundary controls filter independently', () => {
  const features = [
    { category: 'natural', kind: 'landslide', barangay: 'Batuan' },
    { category: 'natural', kind: 'flood', barangay: 'Rizal' },
    { category: 'natural', kind: 'coverage', barangay: 'Batuan' },
    { category: 'natural', kind: 'boundary', barangay: 'Batuan' },
    { category: 'livestock', barangay: 'Rizal' },
  ].map(properties => ({ properties }));
  const settings = { enabled: true, categories: ['natural', 'livestock'], natural: ['landslide', 'flood'], area: 'Batuan', boundaries: true };
  assert.deepEqual(filterHazardFeatures(features, settings), [features[0], features[3]]);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, enabled: false }), []);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, boundaries: false, natural: ['coverage'] }), [features[2]]);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, categories: ['livestock'] }), []);
});

test('zoom bounds handle polygon holes and multipolygons without inventing coordinates', () => {
  assert.equal(featureBounds([]), null);
  assert.deepEqual(featureBounds([{ geometry: { type: 'MultiPolygon', coordinates: [
    [[[124.81, 10.13], [124.82, 10.14], [124.81, 10.13]]],
    [[[124.84, 10.20], [124.85, 10.23], [124.84, 10.20]]],
  ] } }]), [[124.81, 10.13], [124.85, 10.23]]);
  assert.equal(STUDY_LEGEND.find(item => item.code === 'OUT').kind, 'coverage');
  assert.equal(STUDY_LEGEND.filter(item => item.kind === 'flood').length, 1);
});

test('estimated icon continuations are included and obey barangay and category filters', () => {
  const features = [
    { category: 'natural', kind: 'landslide', barangay: 'Hantag' },
    { category: 'natural', kind: 'landslide', barangay: 'Hantag', inferred: true },
    { category: 'natural', kind: 'landslide', barangay: 'Rizal', inferred: true },
    { category: 'natural', kind: 'flood', barangay: 'Hantag' },
  ].map(properties => ({ properties }));
  const settings = { enabled: true, categories: ['natural'], natural: ['landslide', 'flood'], area: 'Hantag' };
  assert.deepEqual(filterHazardFeatures(features, settings), [features[0], features[1], features[3]]);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, natural: ['flood'] }), [features[3]]);
  assert.deepEqual(filterHazardFeatures(features, { ...settings, area: 'Bilibol' }), []);
});

test('preserves mapped point, line and polygon geometries and source properties', () => {
  const features = [
    { type: 'Point', coordinates: [124.8, 10.1] },
    { type: 'LineString', coordinates: [[124.8, 10.1], [124.9, 10.2]] },
    { type: 'Polygon', coordinates: [[[124.8, 10.1], [124.9, 10.1], [124.9, 10.2], [124.8, 10.1]]] },
  ].map(geometry => ({ type: 'Feature', geometry, properties: { hazard_type: 'septic_tank', notes: 'Survey required' } }));
  const result = sourceFeatures({ features });
  assert.equal(result.length, 3);
  result.forEach((f, i) => {
    assert.deepEqual(f.geometry, features[i].geometry);
    assert.equal(f.properties.category, 'sanitation');
    assert.equal(f.properties.notes, 'Survey required');
  });
  assert.equal(features[0].properties.category, undefined);
});

test('natural legend palette uses codes without changing susceptibility or source data', () => {
  const feature = { type: 'Feature', properties: { code: 'HF', risk_level: 'High Flood', color: '#ef4444' } };
  const [result] = naturalFeatures({ features: [feature] }, 'flood');
  assert.equal(result.properties.color, '#6600ff');
  assert.equal(result.properties.risk_level, 'High Flood');
  assert.equal(feature.properties.color, '#ef4444');
  assert.deepEqual(sourceFeatures(null), []);
});
