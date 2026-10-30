import test from 'node:test';
import assert from 'node:assert/strict';
import { countReportsNeedingAction, countWaterSourceActions, fetchSidebarActionCounts } from '../src/utils/pendingReportCount.js';

const user = { role: 'barangay_official', barangay: 'Hantag' };
const rows = ['pending', 'pending', 'done', 'in_progress', 'done'].map(status => ({ status, barangay: 'Hantag', type: 'water_quality' }));
const response = (status, body) => ({ status, ok: status === 200, json: async () => body });

test('two pending reports produce a sidebar count of two, excluding processed and other barangays', () => {
  assert.equal(countReportsNeedingAction([...rows,
    { status: 'pending', barangay: 'Rizal' },
    { status: 'pending', barangay: 'Hantag', type: 'unregistered_source' }], user), 2);
  assert.equal(countReportsNeedingAction(rows, { ...user, barangay: null }), 0);
  assert.equal(countReportsNeedingAction(rows.map(row => ({ ...row, status: 'done' })), user), 0);
});

test('inspector and doctor badges follow their own actionable queues', () => {
  assert.equal(countReportsNeedingAction(['pending', 'assigned', 'in_progress', 'completed', 'cancelled']
    .map(status => ({ status })), { role: 'sanitization_inspector' }), 2);
  assert.equal(countReportsNeedingAction([
    { review_status: 'submitted', submitted_at: '2026-10-30' },
    { review_status: 'in_review', submitted_at: '2026-10-30' },
    { review_status: 'done', submitted_at: '2026-10-30' },
    { review_status: 'submitted', submitted_at: null },
  ], { role: 'city_health_officer' }), 1);
});

test('sidebar gets both counts from the same queue used by the pages', async () => {
  const submissions = [null, 'pending', 'validated', 'registered', 'dismissed', 'done'].map(status =>
    ({ status, type: 'unregistered_source', barangay: 'Hantag' }));
  const calls = [];
  const counts = await fetchSidebarActionCounts('/api', 'test-token', user, undefined, async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return response(200, { success: true, data: [...rows, ...submissions] });
  });
  assert.deepEqual(counts, { '/validate-reports': 2, '/water-sources': 3 });
  assert.deepEqual(calls, ['/api/resident-reports']);
  assert.equal(countWaterSourceActions([{type:'unregistered_source', barangay:'Rizal', status:'pending'}], user), 0);
});

test('inspector uses two independent queues and preserves report count when registry fails', async () => {
  const counts = await fetchSidebarActionCounts('/api', 'token', { role: 'sanitization_inspector' }, undefined,
    async url => url.endsWith('/inspections') ? response(200, { success: true, data: [{status:'pending'}, {status:'assigned'}] }) : response(503, {}));
  assert.deepEqual(counts, { '/inspections': 2, '/water-sources': null });
});

test('doctor queue and zero counts retain the correct sidebar route', async () => {
  const counts = await fetchSidebarActionCounts('/api', 'token', {role:'city_health_officer'}, undefined,
    async url => {
      assert.equal(url, '/api/reports');
      return response(200, {success:true, data:[]});
    });
  assert.deepEqual(counts, {'/view-reports':0});
});

test('unassigned accounts do not fetch city-wide data; failed queues do not become zero', async () => {
  const counts = await fetchSidebarActionCounts('/api', 'token', {...user, barangay:null}, undefined,
    async () => { throw new Error('Must not fetch'); });
  assert.deepEqual(counts, {});
  await assert.rejects(fetchSidebarActionCounts('/api', 'token', user, undefined,
    async () => response(503, {success:false})));
});
