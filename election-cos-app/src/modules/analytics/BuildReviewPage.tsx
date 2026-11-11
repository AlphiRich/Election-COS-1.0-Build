/**
 * Election Campaign OS — build review (NW405)
 * Capability: `analytics.view`; the field-usage block also needs `roll.view`.
 *
 * The functionality of the supplied "master build dashboard", built from
 * live sources instead of copied figures: the Schedule 1 quota and seat
 * table recomputed from the 2021 IEC result, the delimitation's ward-size
 * band, the field roll's usage tally, and a reconciliation of what the
 * supplied page claimed. See `buildReview.ts` for the checks.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dal } from '@/dal';
import { useSession } from '@/auth/useSession';
import { summariseUsage } from '@/modules/roll/rollCapture';
import {
  BarMeter,
  BasisNote,
  Card,
  PageHeader,
  Pill,
  StatTile,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { nw405Register, nw405Seats2021, reconcile, type ReviewStatus } from './buildReview';

const TONE: Record<ReviewStatus, string> = {
  MATCHES: 'bg-teal/15 text-teal',
  CONTRADICTED: 'bg-maroon/15 text-maroon',
  UNRECONCILED: 'bg-gold/20 text-ink',
  UNSOURCED: 'bg-ink/10 text-ink',
  OUT_OF_SCOPE: 'bg-ink/10 text-ink',
};

export function BuildReviewPage() {
  const session = useSession();
  const reg = nw405Register();
  const seats = useMemo(() => nw405Seats2021(), []);
  const rows = useMemo(() => reconcile(), []);
  const canSeeUsage = Boolean(session?.caps.includes('roll.view'));

  const usage = useQuery({
    queryKey: ['roll-usage', session?.tenantId, session?.wardScope, session?.vdScope],
    queryFn: () => dal.roll.listUsage(session!),
    enabled: Boolean(session && canSeeUsage),
  });
  const stats = useMemo(() => summariseUsage(usage.data ?? []), [usage.data]);
  const parties = seats.parties
    .filter((p) => p.totalSeats > 0)
    .sort((a, b) => b.totalSeats - a.totalSeats);
  const maxSeats = Math.max(1, ...parties.map((p) => p.totalSeats));

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader slug="/analytics/build-review" title="Build Review — JB Marks (NW405)" />
      <BasisNote>
        Every figure here is computed from a source in this build, or labelled as not having one.
        The roll figures appear only once a roll is loaded.
      </BasisNote>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Council Seats"
          value={reg.councillors}
          sub={`${reg.wards} ward · ${reg.councillors - (reg.wards ?? 0)} PR`}
        />
        <StatTile label="Registered (Annexure A)" value={reg.registeredVoters.toLocaleString()} />
        <StatTile
          label="Ward Norm"
          value={reg.norm?.toLocaleString() ?? '—'}
          sub={`band ${reg.minNorm?.toLocaleString()}–${reg.maxNorm?.toLocaleString()}`}
        />
        <StatTile
          label="2021 Quota"
          value={seats.quota.toLocaleString()}
          sub="2021 result, not 2026"
        />
      </div>

      <Card>
        <p className="font-display mb-2">Schedule 1 seats — 2021 IEC result, recomputed here</p>
        <div className="space-y-2">
          {parties.map((p) => (
            <div key={p.id} className="grid grid-cols-[8rem_1fr_6rem] items-center gap-3 font-body">
              <span>{p.id}</span>
              <BarMeter
                value={p.totalSeats}
                max={maxSeats}
                label={`${p.name}: ${p.totalSeats} seats`}
              />
              <span className="text-right">
                {p.totalSeats} ({p.wardSeatsWon}W/{p.prSeats}PR)
              </span>
            </div>
          ))}
        </div>
        <p className="text-body-md font-body text-ink/70 mt-2">
          This is the last certified result, on the superseded 2021 delimitation. It is not a 2026
          projection; use the Vote Calculator and Ward Comparison for scenarios you set yourself.
        </p>
      </Card>

      {canSeeUsage && (
        <Card>
          <p className="font-display mb-2">Voters’ roll — field usage in your scope</p>
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Confirmed" value={stats.verify} />
            <StatTile label="Recorded With Consent" value={stats.capture} />
            <StatTile
              label="Consent Rate"
              value={stats.captureRate === null ? '—' : `${Math.round(stats.captureRate * 100)}%`}
            />
          </div>
        </Card>
      )}

      <Card>
        <p className="font-display mb-2">What the supplied dashboard claimed, checked</p>
        <Table caption="Dashboard claims reconciled against this build">
          <thead>
            <tr>
              <Th>Claim</Th>
              <Th>Status</Th>
              <Th>Why</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td>{r.claim}</Td>
                <Td>
                  <Pill className={TONE[r.status]}>{r.status.replace('_', ' ')}</Pill>
                </Td>
                <Td>{r.note}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
