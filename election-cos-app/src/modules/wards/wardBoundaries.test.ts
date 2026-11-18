import { describe, expect, it } from 'vitest';
import { BoundaryError, detectWardProperty, validateAndGroup, type BoundaryCollection, type BoundaryFeature } from './wardBoundaries';

/** A synthetic polygon — a unit square — so the validation is proven without any real (or invented) geography. */
const square = (): BoundaryFeature['geometry'] => ({ type: 'Polygon', coordinates: [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]] });
const feat = (props: Record<string, unknown>, geometry: BoundaryFeature['geometry'] = square()): BoundaryFeature => ({ type: 'Feature', properties: props, geometry });

// Three synthetic wards across two councils. Codes are made up; the map below is the only source of truth in the test.
const wardToCouncil = new Map<string, string>([
  ['99990001', 'ZZ999'],
  ['99990002', 'ZZ999'],
  ['88880001', 'YY888'],
]);

const fc = (features: BoundaryFeature[]): BoundaryCollection => ({ type: 'FeatureCollection', features });

describe('detectWardProperty', () => {
  it('finds a known MDB property whose values look like 8-digit ward codes', () => {
    const got = detectWardProperty([feat({ WardID: '99990001', WardName: 'A' }), feat({ WardID: '99990002', WardName: 'B' })]);
    expect(got).toEqual({ property: 'WardID' });
  });
  it('finds an unusually-named property if its values are all 8-digit codes', () => {
    expect(detectWardProperty([feat({ code8: '99990001' })])).toEqual({ property: 'code8' });
  });
  it('lists the properties it saw, and stops, when nothing looks like a ward code', () => {
    const got = detectWardProperty([feat({ name: 'Ward 1', pop: 3200 })]);
    expect(got).toEqual({ property: null, propertiesSeen: ['name', 'pop'] });
  });
});

describe('validateAndGroup', () => {
  it('groups features by council and reports full coverage', () => {
    const r = validateAndGroup(fc([feat({ WardID: '99990001' }), feat({ WardID: '99990002' }), feat({ WardID: '88880001' })]), wardToCouncil, 'WardID');
    expect(r.wardsWithGeometry).toBe(3);
    expect(r.byCouncil.get('ZZ999')).toHaveLength(2);
    expect(r.complete).toEqual(['YY888', 'ZZ999']);
    expect(r.shortfall.size).toBe(0);
    expect(r.byCouncil.get('ZZ999')![0].properties).toMatchObject({ wardId: '99990001', councilCode: 'ZZ999' });
  });
  it('reports a council as short when a ward is missing, rather than pretending it is complete', () => {
    const r = validateAndGroup(fc([feat({ WardID: '99990001' })]), wardToCouncil, 'WardID');
    expect(r.complete).toEqual([]);
    expect(r.shortfall.get('ZZ999')).toEqual(['99990002']);
  });
  it('refuses a ward code the build does not know (a different delimitation), naming it', () => {
    expect(() => validateAndGroup(fc([feat({ WardID: '12345678' })]), wardToCouncil, 'WardID')).toThrow(/not in this build's delimitation/);
  });
  it('refuses a feature with no geometry', () => {
    expect(() => validateAndGroup(fc([feat({ WardID: '99990001' }, null)]), wardToCouncil, 'WardID')).toThrow(BoundaryError);
    expect(() => validateAndGroup(fc([feat({ WardID: '99990001' }, null)]), wardToCouncil, 'WardID')).toThrow(/no geometry/);
  });
  it('refuses a non-8-digit ward code', () => {
    expect(() => validateAndGroup(fc([feat({ WardID: '123' })]), wardToCouncil, 'WardID')).toThrow(/not an 8-digit ward code/);
  });
  it('refuses the same ward twice', () => {
    expect(() => validateAndGroup(fc([feat({ WardID: '99990001' }), feat({ WardID: '99990001' })]), wardToCouncil, 'WardID')).toThrow(/appears twice/);
  });
});
