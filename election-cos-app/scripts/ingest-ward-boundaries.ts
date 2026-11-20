/**
 * Turns a supplied MDB ward-boundary file into slim, validated, per-municipality GeoJSON tiles.
 *
 *   npx vite-node scripts/ingest-ward-boundaries.ts --in <wards.geojson> --list      # just print the feature properties
 *   npx vite-node scripts/ingest-ward-boundaries.ts --in <wards.geojson>             # dry run: validate + report coverage
 *   npx vite-node scripts/ingest-ward-boundaries.ts --in <wards.geojson> --write     # write site-assets/ward-boundaries/<CODE>.geojson
 *   npx vite-node scripts/ingest-ward-boundaries.ts --in <wards.geojson> --ward-prop WardID
 *
 * Input is GeoJSON (FeatureCollection). A shapefile or KML must be converted first (e.g. `mapshaper wards.shp -o wards.geojson`
 * or `ogr2ogr -f GeoJSON wards.geojson wards.shp`) — this script does not parse binary GIS formats, so that the conversion
 * (and any projection choice) is explicit and auditable rather than hidden.
 *
 * It never fabricates: an unknown ward code, a missing geometry or an unidentifiable ward property stops the run with a
 * message you can act on. The heavy input file is NOT committed; keep it in Drive. Only the slim per-council outputs ship.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { detectWardProperty, validateAndGroup, councilTile, type BoundaryCollection } from '../src/modules/wards/wardBoundaries';
import { PROVINCE_CODES, loadProvince } from '../src/modules/lge2026/nationalResults';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const inPath = flag('--in');
const write = args.includes('--write');
const listOnly = args.includes('--list');
const forcedProp = flag('--ward-prop');

if (!inPath) {
  console.error('Give --in <wards.geojson>. See the header for how to convert a shapefile/KML to GeoJSON first.');
  process.exit(2);
}

const fc = JSON.parse(readFileSync(inPath, 'utf8')) as BoundaryCollection;
if (fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
  console.error(`${inPath} is not a GeoJSON FeatureCollection.`);
  process.exit(1);
}
console.log(`${fc.features.length} features in ${path.basename(inPath)}.`);

const detected = forcedProp ? { property: forcedProp } : detectWardProperty(fc.features);
if (!detected.property) {
  console.error(
    'Could not identify the ward-code property. The properties present are:\n  ' +
      detected.propertiesSeen.join('\n  ') +
      '\nRe-run with --ward-prop <name> naming the one that holds the 8-digit ward code (e.g. 64005001).',
  );
  process.exit(1);
}
console.log(`Ward code is in property "${detected.property}".`);
if (listOnly) process.exit(0);

// Build the ward-code → council-code map from the build's own certified results, the one source of truth for which
// wards exist and which council each belongs to.
const wardToCouncil = new Map<string, string>();
for (const prov of PROVINCE_CODES) {
  const file = await loadProvince(prov);
  for (const [code, c] of Object.entries(file.municipalities)) {
    for (const w of c.wardResults) wardToCouncil.set(w.wardId, code);
  }
}
console.log(`${wardToCouncil.size} wards across ${new Set(wardToCouncil.values()).size} councils in the build's delimitation.`);

const result = validateAndGroup(fc, wardToCouncil, detected.property);
console.log(
  `\nCoverage: ${result.wardsWithGeometry} wards with geometry across ${result.byCouncil.size} councils.` +
    `\n  ${result.complete.length} councils fully covered.` +
    `\n  ${result.shortfall.size} councils partially covered${result.shortfall.size ? ':' : '.'}`,
);
for (const [council, missing] of result.shortfall) console.log(`    ${council}: missing ${missing.length} ward(s) — ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`);

if (!write) {
  console.log('\nDry run. Nothing written. Add --write to produce the per-council tiles.');
  process.exit(0);
}

const outDir = path.resolve(__dirname, '..', 'site-assets', 'ward-boundaries');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
let bytes = 0;
for (const [council, features] of result.byCouncil) {
  const tile = councilTile(features);
  const json = JSON.stringify(tile);
  writeFileSync(path.join(outDir, `${council}.geojson`), json);
  bytes += json.length;
}
const manifest = { generatedAt: new Date().toISOString().slice(0, 10), councils: [...result.byCouncil.keys()].sort(), wards: result.wardsWithGeometry };
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${result.byCouncil.size} council tiles + manifest.json to ${outDir} (${(bytes / 1024).toFixed(0)} KB total, unsimplified).`);
console.log('Next: simplify geometry if the tiles are large (mapshaper -simplify), and point VITE_WARD_TILES_BASE_URL at where they are served.');
