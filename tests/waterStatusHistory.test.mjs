import test from 'node:test';
import assert from 'node:assert/strict';
import { indexHistory, snapshotForDay, historyFormValues } from '../src/utils/waterStatusHistory.js';

const first = { id: 'a', effective_date: '2026-10-27', recorded_at: '2026-10-28T01:00:00Z',
  status: 'contaminated', e_coli: false, coliform_bacteria: false, e_coli_count: 0,
  sample_date: '2026-10-27', sample_time: '04:21:00', notes: 'First inspection', bacteriological_exam: 'failed' };
const next = { ...first, id: 'b', effective_date: '2026-10-30', status: 'safe',
  sample_date: '2026-10-30', notes: 'Retested', bacteriological_exam: 'passed' };

test('a gray day carries the previous snapshot, including its actual sample date and notes', () => {
  const index = indexHistory([next, first]);
  assert.equal(index.changes['2026-10-28'], undefined);
  assert.deepEqual(historyFormValues(snapshotForDay(index, '2026-10-28')), {
    status: 'contaminated', e_coli_present: 'not_present', e_coli_count: 0,
    coliform_count: 0, bacteriological_exam: 'failed', sample_date: '2026-10-27',
    sample_time: '04:21:00', description: 'First inspection',
  });
  assert.equal(snapshotForDay(index, '2026-10-31').notes, 'Retested');
});
test('dates before registration never load values from a later day', () => {
  assert.equal(snapshotForDay(indexHistory([first]), '2026-10-26'), null);
  assert.equal(historyFormValues(null).description, '');
  assert.equal(historyFormValues(null).status, 'unknown');
});
test('same-day corrections use the newest revision regardless of input order', () => {
  const corrected = { ...first, id: 'c', recorded_at: '2026-10-28T02:00:00Z', notes: '' };
  const index = indexHistory([corrected, first]);
  assert.equal(historyFormValues(snapshotForDay(index, '2026-10-27')).description, '');
  assert.equal(Object.keys(index.changes).length, 1);
});
test('an unchanged snapshot stays gray; notes-only changes get a recorded day', () => {
  const duplicate = { ...first, id: 'd', effective_date: '2026-10-28' };
  const notes = { ...first, id: 'e', effective_date: '2026-10-29', notes: 'Follow-up' };
  const index = indexHistory([first, duplicate, notes]);
  assert.equal(index.changes['2026-10-28'], undefined);
  assert.equal(index.changes['2026-10-29'].notes, 'Follow-up');
});
test('carry-forward works across years and uses effective day rather than UTC save time', () => {
  const snapshot = { ...first, effective_date: '2025-12-31', recorded_at: '2026-01-02T23:00:00Z' };
  assert.equal(snapshotForDay(indexHistory([snapshot]), '2026-01-01'), snapshot);
});
test('legacy E. coli count is shown correctly without assuming missing boolean means unknown', () => {
  assert.equal(historyFormValues({ status: 'safe', e_coli_count: 0 }).e_coli_present, 'not_present');
  assert.equal(historyFormValues({ status: 'contaminated', e_coli_count: 1 }).e_coli_present, 'present');
});
