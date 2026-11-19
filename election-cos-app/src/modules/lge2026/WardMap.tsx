/**
 * Election Campaign OS — the ward map.
 *
 * Real Municipal Demarcation Board 2026 ward polygons on Google Maps, each ward shaded by how close it was in the
 * certified LGE 2026 result. Geometry is fetched on demand from the ward-boundary tiles
 * (scripts/ingest-ward-boundaries.ts → site-assets/ward-boundaries/<CODE>.geojson), served as static files — never from
 * Firestore, so the tenant database carries no geometry.
 *
 * Honest states, both built in:
 *  - No Google Maps key configured → GoogleMapsWrapper renders a "map unavailable" message, not a broken frame.
 *  - A council whose tile is not deployed → an explicit notice, never a blank map or invented shapes.
 *
 * Shading is by the leader's share tier, using design tokens (never a party-brand hex): the map shows WHERE the contest
 * was close; the tap panel names WHO led. This keeps the palette inside the design system while staying informative.
 */
import { useEffect, useMemo, useState } from 'react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { GoogleMapsWrapper } from '@/components/GoogleMapsWrapper';
import { BasisNote, Card, Pill, SectionLabel } from '@/components/ui';
import { tokens } from '@/design/tokens';
import { partyLabel } from './councilResults';
import { TIER_COLOR, wardTileUrl } from './wardMapData';
import type { VoterIntelligence, WardLine, WardTier } from './voterIntelligence';

const C = tokens.color;

function WardLayer({ vi, onSelect, onError }: { vi: VoterIntelligence; onSelect: (w: WardLine | null) => void; onError: (e: boolean) => void }) {
  const map = useMap();
  const byWardId = useMemo(() => new Map(vi.wards.map((w) => [w.wardId, w])), [vi.wards]);

  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    onError(false);
    onSelect(null);
    const clear = () => map.data.forEach((f) => map.data.remove(f));

    fetch(wardTileUrl(vi.code))
      .then((r) => (r.ok ? (r.json() as Promise<object>) : Promise.reject(new Error(String(r.status)))))
      .then((fc) => {
        if (cancelled) return;
        clear();
        map.data.addGeoJson(fc);
        map.data.setStyle((feature) => {
          const w = byWardId.get(String(feature.getProperty('wardId') ?? ''));
          return { fillColor: w ? TIER_COLOR[w.tier] : C.slate, fillOpacity: 0.55, strokeColor: C.paper, strokeWeight: 1 };
        });
        const bounds = new google.maps.LatLngBounds();
        map.data.forEach((f) => f.getGeometry()?.forEachLatLng((ll) => bounds.extend(ll)));
        if (!bounds.isEmpty()) map.fitBounds(bounds, 16);
      })
      .catch(() => {
        if (!cancelled) onError(true);
      });

    const listener = map.data.addListener('click', (e: google.maps.Data.MouseEvent) => {
      onSelect(byWardId.get(String(e.feature.getProperty('wardId') ?? '')) ?? null);
    });
    return () => {
      cancelled = true;
      listener.remove();
      clear();
    };
  }, [map, vi.code, byWardId, onSelect, onError]);

  return null;
}

export function WardMap({ vi }: { vi: VoterIntelligence }) {
  const [selected, setSelected] = useState<WardLine | null>(null);
  const [error, setError] = useState(false);

  return (
    <Card>
      <SectionLabel as="h2">Ward map</SectionLabel>
      <p className="mt-1 text-body-md font-body text-ink">
        Every ward in {vi.name}, drawn from the Municipal Demarcation Board&rsquo;s 2026 boundaries and shaded by how
        close the ward was. Tap a ward for who led and by how much.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(Object.keys(TIER_COLOR) as WardTier[]).map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-body-sm font-ui text-slate">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: TIER_COLOR[t] }} aria-hidden /> {t}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <GoogleMapsWrapper>
          <div className="w-full overflow-hidden rounded-xl border border-ink/10" style={{ height: 460 }}>
            <GoogleMap defaultCenter={{ lat: -29, lng: 25 }} defaultZoom={5} gestureHandling="cooperative" clickableIcons={false}>
              <WardLayer vi={vi} onSelect={setSelected} onError={setError} />
            </GoogleMap>
          </div>
        </GoogleMapsWrapper>
      </div>
      {error && (
        <p role="status" className="mt-2 text-body-md font-body text-maroon">
          The ward boundaries for {vi.name} could not be loaded. The map shows once the ward-boundary tiles are deployed.
        </p>
      )}
      {selected && (
        <div className="mt-3">
          <Pill className="bg-ink/5 text-ink">Ward {selected.ward}</Pill>
          <p className="mt-1 text-body-md font-body text-ink">
            {partyLabel(selected.leader)} led with {selected.leaderShare.toFixed(1)}%
            {selected.runnerUp ? `, ${selected.margin.toFixed(1)} points over ${partyLabel(selected.runnerUp)}` : ''}. Tier:{' '}
            {selected.tier}.
          </p>
        </div>
      )}
      <BasisNote>
        Ward boundaries: Municipal Demarcation Board, MDBWards2026. Shading is the leader&rsquo;s share of the ward&rsquo;s
        valid votes in the certified LGE 2026 result; it is not a forecast.
      </BasisNote>
    </Card>
  );
}
