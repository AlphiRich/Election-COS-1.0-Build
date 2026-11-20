/**
 * Election Campaign OS — ward-boundary ingestion (the pure logic).
 *
 * WHY THIS EXISTS
 *
 * The app's ward map (SchematicMap) was a deliberate placeholder: §6.1 said "schematic first, no GIS in v1".
 * The owner has now asked for real ward geography — the Municipal Demarcation Board's ward polygons superimposed on
 * Google Maps. This module turns a supplied MDB boundary file into slim, validated, per-municipality GeoJSON that the
 * map component renders. The heavy source file is kept out of Firestore and the repo (owner stores it in Drive); only
 * the processed per-council tiles are served, from a swappable base URL.
 *
 * THE DISCIPLINE (same as iec-data-ingestion)
 *
 *  - Nothing is fabricated. If the file names no ward id we recognise, the ingester lists the properties it DID find
 *    and stops, exactly as the IEC column-mapper does — it never guesses a ward from a filename or a feature order.
 *  - Every feature's ward id must match a ward the build already knows (the 213 councils' wardResults). An unknown
 *    ward id is a hard error, not a dropped row: a boundary file that disagrees with the delimitation is a problem to
 *    surface, not to quietly trim.
 *  - Coverage is reported, not assumed. The ingester says how many of a council's wards got geometry, so a short file
 *    (a filtered or truncated download) is visible rather than silently partial.
 *
 * This file is pure (no I/O): scripts/ingest-ward-boundaries.ts does the reading and writing, and the test drives this
 * with a synthetic three-ward fixture so the validation is proven without shipping any invented geometry.
 */

/** A GeoJSON Feature, narrowed to what we need: a geometry and a property bag. */
export interface BoundaryFeature {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: { type: string; coordinates: unknown } | null;
}
export interface BoundaryCollection {
  type: 'FeatureCollection';
  features: BoundaryFeature[];
}

/**
 * Property names the MDB and common exports use for the 8-digit ward code, most specific first. The ward code (e.g.
 * "64005001") is what this build keys wards on; the ward NUMBER (1..N) is not unique across municipalities and is never
 * used as the identifier.
 */
export const WARD_ID_PROPERTIES = ['WardID', 'WARD_ID', 'WardId', 'wardid', 'CAT_B_WARD', 'WARDNO', 'WardNumber'] as const;

const EIGHT_DIGITS = /^\d{8}$/;

/** The ward-id property to read, or null with the list of properties present so the operator can say which it is. */
export function detectWardProperty(features: BoundaryFeature[]): { property: string } | { property: null; propertiesSeen: string[] } {
  const first = features.find((f) => f.properties && Object.keys(f.properties).length > 0)?.properties ?? {};
  const keys = Object.keys(first);
  // Prefer a known name whose values look like 8-digit ward codes.
  for (const name of WARD_ID_PROPERTIES) {
    if (name in first) {
      const looksRight = features.slice(0, 20).every((f) => {
        const v = f.properties?.[name];
        return v == null || EIGHT_DIGITS.test(String(v));
      });
      if (looksRight) return { property: name };
    }
  }
  // Otherwise, any property whose values are all 8-digit codes.
  for (const name of keys) {
    const vals = features.slice(0, 20).map((f) => f.properties?.[name]).filter((v) => v != null);
    if (vals.length > 0 && vals.every((v) => EIGHT_DIGITS.test(String(v)))) return { property: name };
  }
  return { property: null, propertiesSeen: keys };
}

export interface ValidationResult {
  /** Features keyed by council code, each carrying the ward code on `properties.wardId`. */
  byCouncil: Map<string, BoundaryFeature[]>;
  /** Councils with at least one ward missing geometry: code → the ward codes not covered. */
  shortfall: Map<string, string[]>;
  /** Councils fully covered. */
  complete: string[];
  wardsWithGeometry: number;
}

export class BoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoundaryError';
  }
}

/**
 * Validates a boundary collection against the build's own ward register and groups the features by council.
 *
 * @param fc            the parsed GeoJSON
 * @param wardToCouncil every ward code the build knows → its council code (built from the national results)
 * @param wardProperty  the feature property holding the ward code (from detectWardProperty)
 */
export function validateAndGroup(
  fc: BoundaryCollection,
  wardToCouncil: Map<string, string>,
  wardProperty: string,
): ValidationResult {
  if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new BoundaryError('Not a GeoJSON FeatureCollection.');
  }
  const byCouncil = new Map<string, BoundaryFeature[]>();
  const seen = new Set<string>();
  const unknown: string[] = [];

  for (const f of fc.features) {
    const raw = f.properties?.[wardProperty];
    const wardId = raw == null ? '' : String(raw);
    if (!EIGHT_DIGITS.test(wardId)) {
      throw new BoundaryError(`A feature's ${wardProperty} is "${wardId}", which is not an 8-digit ward code.`);
    }
    if (!f.geometry || !f.geometry.coordinates) {
      throw new BoundaryError(`Ward ${wardId} has no geometry. A boundary file with empty geometry is not usable.`);
    }
    const council = wardToCouncil.get(wardId);
    if (!council) {
      unknown.push(wardId);
      continue;
    }
    if (seen.has(wardId)) throw new BoundaryError(`Ward ${wardId} appears twice in the file.`);
    seen.add(wardId);
    // Normalise the ward code onto a stable property the map reads, without discarding the source properties.
    const feature: BoundaryFeature = { ...f, properties: { ...(f.properties ?? {}), wardId, councilCode: council } };
    const list = byCouncil.get(council) ?? [];
    list.push(feature);
    byCouncil.set(council, list);
  }

  if (unknown.length > 0) {
    const sample = unknown.slice(0, 10).join(', ');
    throw new BoundaryError(
      `${unknown.length} ward code(s) in the file are not in this build's delimitation (e.g. ${sample}). ` +
        'This build keys wards on the 2026 delimitation; a file for a different delimitation cannot be joined to it. ' +
        'Confirm the file is the current MDB ward layer, or say which delimitation it is.',
    );
  }

  // Coverage: compare the wards we got against the wards each council should have.
  const wantByCouncil = new Map<string, Set<string>>();
  for (const [ward, council] of wardToCouncil) {
    const s = wantByCouncil.get(council) ?? new Set<string>();
    s.add(ward);
    wantByCouncil.set(council, s);
  }
  const shortfall = new Map<string, string[]>();
  const complete: string[] = [];
  for (const [council, want] of wantByCouncil) {
    const got = new Set((byCouncil.get(council) ?? []).map((f) => String(f.properties?.wardId)));
    const missing = [...want].filter((w) => !got.has(w));
    if (got.size === 0) continue; // this council simply isn't in the file; not a shortfall, just absent
    if (missing.length > 0) shortfall.set(council, missing.sort());
    else complete.push(council);
  }

  return {
    byCouncil,
    shortfall,
    complete: complete.sort(),
    wardsWithGeometry: seen.size,
  };
}

/** One council's slim tile: a FeatureCollection of its ward polygons, ready to serve. Each feature already carries its
 * own `councilCode` property, so the tile needs only the features. */
export function councilTile(features: BoundaryFeature[]): BoundaryCollection {
  return { type: 'FeatureCollection', features };
}
