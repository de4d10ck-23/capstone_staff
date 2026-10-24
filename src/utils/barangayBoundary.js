import maasinBarangaysGeoJson from "../data/maasin_barangays.json";

// Alias mapping for minor nomenclature differences
const ALIASES = {
  pinaskuhan: "pinascohan",
  sisi: "soro-soro",
  zaragosa: "acasia",
};

/**
 * Clean & normalize barangay names for robust matching
 */
export const cleanBarangayName = (str) => {
  if (!str) return "";
  let cleaned = str
    .toLowerCase()
    .replace(/^brgy\.?\s+/i, "")
    .replace(/^barangay\s+/i, "")
    .replace(/\s*\(pob\.?\)/gi, "")
    .replace(/\s*\(capital\)/gi, "")
    .replace(/[^a-z0-9]/g, "");

  if (ALIASES[cleaned]) {
    cleaned = ALIASES[cleaned];
  }
  return cleaned;
};

/**
 * Format ADM4_EN into a clean human display name
 */
export const formatBarangayName = (adm4) => {
  if (!adm4) return "";
  return adm4.replace(/\s*\(pob\.?\)/gi, "").replace(/\s*\(capital\)/gi, "").trim();
};

/**
 * Find GeoJSON feature for a given barangay name
 */
export const getBarangayFeature = (barangayName) => {
  if (!barangayName || !maasinBarangaysGeoJson?.features) return null;
  const target = cleanBarangayName(barangayName);

  return (
    maasinBarangaysGeoJson.features.find((f) => {
      const featName = cleanBarangayName(f.properties?.ADM4_EN || f.properties?.name || "");
      return featName === target;
    }) || null
  );
};

/**
 * Get bounding box [[minLng, minLat], [maxLng, maxLat]] for a GeoJSON feature
 */
export const getBarangayBounds = (feature) => {
  if (!feature || !feature.geometry) return null;

  let minLng = 180;
  let minLat = 90;
  let maxLng = -180;
  let maxLat = -90;

  const extractCoords = (coords) => {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (const c of coords) {
        extractCoords(c);
      }
    }
  };

  extractCoords(feature.geometry.coordinates);

  if (minLng > maxLng || minLat > maxLat) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};

/**
 * Get center point [centerLng, centerLat] for a GeoJSON feature
 */
export const getBarangayCenter = (feature) => {
  const bounds = getBarangayBounds(feature);
  if (!bounds) return null;
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
};

/**
 * Standard ray-casting point-in-polygon check
 */
export const isPointInRing = (point, ring) => {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Point distance to segment in approximate planar degrees
 */
const distToSegmentSq = (p, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return (p[0] - px) ** 2 + (p[1] - py) ** 2;
};

/**
 * Check if point is inside a polygon (strict ray-casting, zero buffer)
 */
export const isPointInGeometry = (point, geometry, toleranceDeg = 0) => {
  if (!geometry) return false;
  const { type, coordinates } = geometry;

  const checkPolygon = (rings) => {
    if (!rings || !rings.length) return false;
    const outerRing = rings[0];
    if (isPointInRing(point, outerRing)) {
      // Check interior holes if any
      for (let h = 1; h < rings.length; h++) {
        if (isPointInRing(point, rings[h])) return false;
      }
      return true;
    }

    // Check buffer tolerance along boundary if specified
    if (toleranceDeg > 0) {
      const tolSq = toleranceDeg * toleranceDeg;
      for (let i = 0; i < outerRing.length - 1; i++) {
        if (distToSegmentSq(point, outerRing[i], outerRing[i + 1]) <= tolSq) {
          return true;
        }
      }
    }
    return false;
  };

  if (type === "Polygon") {
    return checkPolygon(coordinates);
  } else if (type === "MultiPolygon") {
    return coordinates.some((poly) => checkPolygon(poly));
  }
  return false;
};

/**
 * Verify if coordinates fall inside the designated barangay and identify containing barangay
 */
export const checkBarangayJurisdiction = (lng, lat, targetBarangayName) => {
  const targetFeature = getBarangayFeature(targetBarangayName);
  const point = [lng, lat];

  let isInsideTarget = false;
  if (targetFeature) {
    isInsideTarget = isPointInGeometry(point, targetFeature.geometry, 0);
  }

  // Scan all barangays in Maasin to detect where the pin currently resides
  let detectedFeature = null;
  if (maasinBarangaysGeoJson?.features) {
    detectedFeature = maasinBarangaysGeoJson.features.find((f) =>
      isPointInGeometry(point, f.geometry, 0)
    );
  }

  const detectedName = detectedFeature
    ? formatBarangayName(detectedFeature.properties?.ADM4_EN)
    : null;

  return {
    isInsideTarget,
    detectedBarangay: detectedName,
    targetFeature,
  };
};

export default {
  cleanBarangayName,
  formatBarangayName,
  getBarangayFeature,
  getBarangayBounds,
  getBarangayCenter,
  isPointInGeometry,
  checkBarangayJurisdiction,
};
