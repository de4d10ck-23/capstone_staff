
/**
 * Calculates great-circle distance between two [lng, lat] points in meters.
 */
export function haversineDistance(coord1, coord2) {
  if (!coord1 || !coord2) return Infinity;
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds nearest water station to a hazard geometry and returns station + distance in meters.
 */
export function findNearestStation(coords, geomType, locations = []) {
  if (!locations.length || !coords) return null;

  // Determine representative anchor point
  let anchor = [0, 0];
  if (geomType === "Point") {
    anchor = coords;
  } else if (geomType === "LineString" && Array.isArray(coords) && coords.length > 0) {
    anchor = coords[0];
  } else if (geomType === "Polygon" && Array.isArray(coords) && coords[0]?.length > 0) {
    anchor = coords[0][0];
  } else {
    return null;
  }

  let minDistance = Infinity;
  let nearest = null;

  locations.forEach((loc) => {
    if (!loc.latitude || !loc.longitude) return;
    const dist = haversineDistance(anchor, [loc.longitude, loc.latitude]);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = loc;
    }
  });

  if (!nearest) return null;

  return {
    station: nearest,
    distanceMeters: Math.round(minDistance),
  };
}

