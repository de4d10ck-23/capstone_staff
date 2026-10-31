import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, STUDY_LEGEND, filterHazardFeatures, featureBounds, sourceFeatures } from './hazardLayers';

import { matchesBarangay, UNASSIGNED_BARANGAY } from '../utils/barangayScope';

const SOURCE = 'staff-hazard-overlay';
const LAYERS = ['staff-hazard-fill', 'staff-hazard-line', 'staff-hazard-point', 'staff-hazard-boundary'];

export default function HazardOverlay({ mapRef, apiUrl, token, refreshKey, area, onAreaChange, barangays }) {
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState(['natural']);
  const [natural, setNatural] = useState(['flood', 'landslide', 'coverage']);
  const [study, setStudy] = useState(null);
  const [studyStatus, setStudyStatus] = useState('loading');
  const [boundaries, setBoundaries] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState('loading');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react/set-state-in-effect
    setStudyStatus('loading');
    fetch(`${import.meta.env.BASE_URL}data/maasin_study_hazards.geojson`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable');
        const data = await response.json();
        if (!Array.isArray(data.features) || !Array.isArray(data.metadata?.barangays)) throw new Error('Invalid map');
        setStudy(data); setStudyStatus('ready');
      }).catch(error => {
        if (error.name !== 'AbortError') { setStudy(null); setStudyStatus('error'); }
      });
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    // This effect synchronizes request status with the remote hazard inventory.
    // eslint-disable-next-line react/set-state-in-effect
    setStatus('loading');
    fetch(`${apiUrl}/hazards`, { signal: controller.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async response => {
        if (!response.ok) throw new Error('Unavailable');
        const result = await response.json();
        if (!result.success || !Array.isArray(result.geojson?.features)) throw new Error('Unavailable');
        setSources(sourceFeatures(result.geojson));
        setStatus('ready');
      }).catch(error => {
        if (error.name !== 'AbortError') { setSources([]); setStatus('error'); }
      });
    return () => controller.abort();
  }, [apiUrl, token, refreshKey]);

  const all = useMemo(() => [...(study?.features || []), ...sources], [study, sources]);
  const scoped = useMemo(() => all.filter(f => matchesBarangay(f.properties.barangay, area)), [all, area]);
  const hasNaturalData = scoped.some(f => f.properties.category === 'natural' && f.properties.kind !== 'boundary');
  const activeSelected = selected?.area === area ? selected.properties : null;
  const visible = useMemo(() => filterHazardFeatures(all, { enabled, categories, natural, area, boundaries }),
    [enabled, all, categories, natural, area, boundaries]);
  const bounds = useMemo(() => featureBounds((study?.features || []).filter(f =>
    f.properties.kind === 'boundary' && matchesBarangay(f.properties.barangay, area))), [study, area]);
  const fitStudy = () => {
    if (bounds && mapRef.current) mapRef.current.fitBounds(bounds, { padding: 55, maxZoom: 15.5, pitch: 0, bearing: 0 });
  };
  useEffect(() => {
    if (enabled && bounds && mapRef.current) mapRef.current.fitBounds(bounds,
      { padding: 55, maxZoom: 15.5, pitch: 0, bearing: 0 });
  }, [enabled, bounds, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = { type: 'FeatureCollection', features: visible };
    const sync = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getSource(SOURCE)) {
        map.getSource(SOURCE).setData(data);
        map.setPaintProperty(LAYERS[0], 'fill-opacity', opacity);
        return;
      }
      map.addSource(SOURCE, { type: 'geojson', data });
      const color = ['get', 'color'];
      map.addLayer({ id: LAYERS[0], type: 'fill', source: SOURCE,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'kind'], 'boundary']],
        layout: { 'fill-sort-key': ['coalesce', ['get', 'draw_order'], 10] },
        paint: { 'fill-color': color, 'fill-opacity': opacity } });
      map.addLayer({ id: LAYERS[1], type: 'line', source: SOURCE,
        filter: ['all', ['!=', ['geometry-type'], 'Point'], ['!=', ['get', 'kind'], 'boundary']],
        paint: { 'line-color': color, 'line-width': 0.5, 'line-opacity': 0.6 } });
      map.addLayer({ id: LAYERS[2], type: 'circle', source: SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-color': color, 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: LAYERS[3], type: 'line', source: SOURCE,
        filter: ['==', ['get', 'kind'], 'boundary'],
        paint: { 'line-color': '#3a8038', 'line-width': 2, 'line-opacity': 0.95 } });
    };
    const click = event => {
      const ids = LAYERS.slice(0, 3).filter(id => map.getLayer(id));
      if (!ids.length) return;
      const features = map.queryRenderedFeatures(event.point, { layers: ids });
      if (features.length) setSelected({ area, properties: features.sort((a, b) =>
        (b.properties.draw_order ?? 10) - (a.properties.draw_order ?? 10))[0].properties });
    };
    sync();
    map.on('style.load', sync);
    // Also handles state changes while a style/source is still loading.
    map.once('idle', sync);
    map.on('click', click);
    return () => {
      map.off('style.load', sync); map.off('idle', sync); map.off('click', click);
    };
  }, [mapRef, visible, opacity, area]);

  const toggle = (id, setter) => {
    setSelected(null);
    setter(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  return <div className="absolute top-3 left-3 md:top-4 md:left-4 z-20 w-64 max-w-[calc(100%-5rem)] rounded-2xl border border-slate-200 bg-white/95 shadow-lg text-xs">
    <button type="button" role="switch" aria-checked={enabled} aria-controls="hazard-options"
      onClick={() => { setEnabled(value => !value); setSelected(null); }}
      className="flex w-full items-center justify-between gap-3 p-3 font-bold text-slate-800">
      Hazard map <span className={`rounded-full px-3 py-1 ${enabled ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{enabled ? 'ON' : 'OFF'}</span>
    </button>
    {enabled && <div id="hazard-options" className="max-h-[45vh] overflow-y-auto border-t border-slate-200 p-3 space-y-3">
      <p className="font-semibold text-slate-800">Barangay hazards</p>
      <label className="block space-y-1">Hazard barangay
        <select aria-label="Hazard barangay" value={area} onChange={e => { onAreaChange(e.target.value); setSelected(null); }}
          className="block w-full rounded-lg border border-slate-300 bg-white p-2">
          <option value="all">All Barangays</option>
          {area === UNASSIGNED_BARANGAY && <option value={UNASSIGNED_BARANGAY}>No assigned barangay</option>}
          {(barangays || []).map(name => <option key={name}>{name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!bounds} onClick={fitStudy} className="text-indigo-700 underline disabled:opacity-40">Zoom to selected area</button>
      <label className="block">Zone opacity: {Math.round(opacity * 100)}%
        <input className="block w-full" aria-label="Hazard zone opacity" type="range" min="0.15" max="1" step="0.05" value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-2 font-semibold">Show categories</legend>
        {CATEGORIES.map(category => <div key={category.id}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={categories.includes(category.id)} onChange={() => toggle(category.id, setCategories)} />
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: category.color }} />
            <span>{category.label} ({scoped.filter(f => f.properties.category === category.id && f.properties.kind !== 'boundary' && !f.properties.inferred).length})</span>
          </label>
          {category.id === 'natural' && categories.includes('natural') && <div className="ml-5 mt-2 space-y-2">
            {[['landslide', 'Landslide zones'], ['flood', 'Flood zones'], ['coverage', 'Outside assessed zones']].map(([kind, label]) => <div key={kind}>
              <label className="flex items-center gap-2"><input type="checkbox" checked={natural.includes(kind)} onChange={() => toggle(kind, setNatural)} />{label}</label>
              {natural.includes(kind) && <div className="mt-1 space-y-1 text-[10px]">
                {STUDY_LEGEND.filter(item => item.kind === kind).map(item =>
                  <span key={item.code} className="flex items-center gap-1"><span className="h-2.5 w-3 shrink-0 border border-slate-300" style={{ background: item.color }} />{item.label}</span>)}
              </div>}
            </div>)}
            <label className="flex items-center gap-2"><input type="checkbox" checked={boundaries} onChange={e => setBoundaries(e.target.checked)} />Barangay boundaries</label>
          </div>}
          {category.id !== 'natural' && categories.includes(category.id) && status === 'ready' && !scoped.some(f => f.properties.category === category.id) &&
            <p className="ml-5 mt-1 text-[10px] text-slate-500">No mapped locations for this barangay.</p>}
        </div>)}
      </fieldset>
      {studyStatus === 'loading' && <p role="status">Loading study hazard map...</p>}
      {studyStatus === 'error' && <p role="alert" className="text-amber-800">Study hazard map unavailable. Use the map refresh button to retry.</p>}
      {status === 'loading' && <p role="status">Loading mapped sources…</p>}
      {status === 'error' && <p role="alert" className="text-amber-800">Mapped sources unavailable. Use the map refresh button to retry.</p>}
      {studyStatus === 'ready' && !hasNaturalData && <p role="status">No natural-hazard data for {area === UNASSIGNED_BARANGAY ? 'an unassigned barangay' : area}. No natural-hazard overlay is shown.</p>}
      {!visible.length && <p>No features to show for this selection.</p>}
      <p className="text-[10px] text-slate-600">Potential sources and transport pathways, not confirmed contamination. Unmapped areas are not necessarily hazard-free. The barangay selector filters water sources and every hazard category. Sources without a designated barangay appear only under All Barangays.</p>
      <p className="text-[10px] text-slate-600">Approximate zones digitized from your map images. Gaps beneath printed water-source icons use estimated continuations of nearby colors. Flood uses the supplied GIS layer. Orange means outside assessed zones, not safe. Publication date unverified.</p>
      <a className="text-indigo-700 underline" href="https://hazardhunter.georisk.gov.ph/map" target="_blank" rel="noreferrer">Check official HazardHunterPH maps</a>
      {activeSelected && <div className="border-t border-slate-200 pt-2 space-y-1">
        <button className="float-right p-1" aria-label="Close hazard details" onClick={() => setSelected(null)}>×</button>
        <p className="font-bold">{activeSelected.name || activeSelected.risk_level || 'Mapped hazard'}</p>
        <p>{activeSelected.description || activeSelected.hazard_type}</p>
        {activeSelected.barangay && <p>Barangay: {activeSelected.barangay}</p>}
        {activeSelected.inferred && <p className="text-amber-800">Estimated continuation beneath a printed water-source icon, based on nearby visible colors. Not a verified hazard assessment.</p>}
        {activeSelected.notes && <p>{activeSelected.notes}</p>}
        {activeSelected.source_image && <p>Reference: {activeSelected.source_image}. {activeSelected.approximate ? 'Approximate image-derived boundary.' : 'Supplied GIS geometry.'}</p>}
        <p className="text-[10px]">{activeSelected.category === 'natural' ? 'Source: supplied Maasin_LandFlood map images' : 'Source: mapped hazard inventory; field verification required'}</p>
      </div>}
    </div>}
  </div>;
}
