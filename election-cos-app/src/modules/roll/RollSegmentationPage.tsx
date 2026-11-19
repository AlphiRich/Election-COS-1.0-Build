/**
 * Election Campaign OS — voters'-roll segmentation (enterprise view)
 * Module `voter-verification`. Capability: `roll.segment` (HQ Admin,
 * Municipal Team Lead). TENANT/MUNICIPALITY scope + a passed second factor.
 *
 * The planner's aggregate of their OWN lawfully-held roll: counts and
 * distributions by ward, voting district and address density. It reads the
 * same in-scope `roll_addresses` `roll.view` already allows and computes
 * everything in `rollSegmentation.ts`. No individual's name, masked ID or
 * isolated address is ever shown — small cells are suppressed. The CSV is
 * aggregate-only and formula-safe.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dal } from '@/dal';
import { useSession } from '@/auth/useSession';
import { useEntitlements } from '@/auth/useEntitlements';
import { resolveAccess } from '@/auth/entitlements';
import { BasisNote, Button, Card, EmptyState, PageHeader, StatTile } from '@/components/ui';
import { downloadText } from '@/lib/csv';
import { summariseUsage } from './rollCapture';
import { SegmentationRefused, segmentCoverage, segmentRollFor, segmentationCsv } from './rollSegmentation';

export function RollSegmentationPage() {
  const session = useSession();
  const { entitlements } = useEntitlements();

  const access = session ? resolveAccess(session.caps, entitlements ?? [], 'roll.segment') : null;
  const allowed =
    session && (entitlements === undefined ? session.caps.includes('roll.segment') : access?.allowed);

  const edition = useQuery({
    queryKey: ['roll-edition', session?.tenantId],
    queryFn: () => dal.roll.activeEdition(session!),
    enabled: Boolean(allowed),
  });
  const addresses = useQuery({
    queryKey: ['roll-addresses-all', session?.tenantId, edition.data],
    queryFn: () => dal.roll.listAddresses(session!, edition.data!),
    enabled: Boolean(allowed && edition.data),
  });
  const usage = useQuery({
    queryKey: ['roll-usage-all', session?.tenantId],
    queryFn: () => dal.roll.listUsage(session!),
    enabled: Boolean(allowed),
  });

  // Compute only when the guardrails pass; a refusal (e.g. second factor not
  // yet passed) is shown as a message, never a thrown render.
  const result = useMemo(() => {
    if (!session || !edition.data || !addresses.data) return null;
    try {
      return { seg: segmentRollFor(session, addresses.data, edition.data), refusal: null as string | null };
    } catch (e) {
      if (e instanceof SegmentationRefused) return { seg: null, refusal: e.message };
      throw e;
    }
  }, [session, edition.data, addresses.data]);

  const coverage = useMemo(
    () => (result?.seg ? segmentCoverage(result.seg, summariseUsage(usage.data ?? [])) : []),
    [result?.seg, usage.data],
  );

  if (!session) return null;
  if (!allowed) {
    return (
      <Card className="max-w-lg">
        <PageHeader slug="/analytics/roll-segmentation" title="Roll Segmentation" />
        <p className="text-body-md font-body">
          {access?.reason || 'Roll segmentation is available to tenant and municipality leads only.'}
        </p>
      </Card>
    );
  }

  const seg = result?.seg ?? null;

  return (
    <div className="space-y-4">
      <PageHeader
        slug="/analytics/roll-segmentation"
        title="Roll Segmentation"
        action={
          seg ? (
            <Button
              variant="ghost"
              onClick={() =>
                downloadText(
                  `roll-segmentation-${seg.edition}.csv`,
                  'text/csv',
                  segmentationCsv(seg, coverage),
                )
              }
            >
              Export CSV
            </Button>
          ) : undefined
        }
      />
      <p className="text-body-md font-body max-w-prose">
        The shape of your own roll — how registered voters are spread across wards, voting districts
        and addresses — so you can plan where the doors are. This view shows <strong>counts only</strong>;
        it never lists a person. Small cells are withheld, and an address is named only where many
        voters are registered at it.
      </p>

      {edition.isSuccess && !edition.data && (
        <EmptyState title="No Roll Loaded">
          No roll edition is active for your campaign yet. Ask your campaign administrator.
        </EmptyState>
      )}

      {result?.refusal && (
        <Card className="max-w-lg">
          <p className="text-body-md font-body text-maroon">{result.refusal}</p>
        </Card>
      )}

      {addresses.isError && (
        <p className="text-body-md font-body text-maroon">
          Could not load the roll. If your role is not tenant- or municipality-wide, that refusal is
          the permission model working.
        </p>
      )}

      {seg && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Wards" value={seg.totals.wards} />
            <StatTile label="Voting Districts" value={seg.totals.vds} />
            <StatTile label="Addresses" value={seg.totals.addresses.toLocaleString('en-ZA')} />
            <StatTile label="Registered Voters" value={seg.totals.voters.toLocaleString('en-ZA')} />
          </div>

          <Card>
            <h2 className="font-display text-headline-md mb-3">By Ward</h2>
            {seg.byWard.length === 0 ? (
              <p className="font-body text-ink/70">No ward has enough voters to report.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-md font-body tabular-nums">
                  <thead>
                    <tr className="text-left text-ink/60">
                      <th className="py-1 pr-4">Ward</th>
                      <th className="py-1 pr-4 text-right">Addresses</th>
                      <th className="py-1 pr-4 text-right">Voters</th>
                      <th className="py-1 text-right">Voters / address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seg.byWard.map((w) => (
                      <tr key={w.wardCode} className="border-t border-ink/10">
                        <td className="py-1 pr-4 font-mono">{w.wardCode}</td>
                        <td className="py-1 pr-4 text-right">{w.addresses.toLocaleString('en-ZA')}</td>
                        <td className="py-1 pr-4 text-right">{w.voters.toLocaleString('en-ZA')}</td>
                        <td className="py-1 text-right">{w.votersPerAddress.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-headline-md mb-3">Address Density</h2>
            <p className="font-body text-body-md text-ink/70 mb-2">
              How many addresses carry how many registered voters — single dwellings through to
              hostels, complexes and homes.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-body-md font-body tabular-nums">
                <thead>
                  <tr className="text-left text-ink/60">
                    <th className="py-1 pr-4">Band</th>
                    <th className="py-1 pr-4 text-right">Addresses</th>
                    <th className="py-1 text-right">Voters</th>
                  </tr>
                </thead>
                <tbody>
                  {seg.density.map((d) => (
                    <tr key={d.label} className="border-t border-ink/10">
                      <td className="py-1 pr-4">{d.label}</td>
                      <td className="py-1 pr-4 text-right">{d.addresses.toLocaleString('en-ZA')}</td>
                      <td className="py-1 text-right">{d.voters.toLocaleString('en-ZA')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {coverage.length > 0 && (
            <Card>
              <h2 className="font-display text-headline-md mb-3">Canvass Coverage</h2>
              <p className="font-body text-body-md text-ink/70 mb-2">
                How much of each ward’s roll your team has worked — doorstep-verified and recorded
                with consent — as a share of the registered voters on the roll. Send people where the
                roll is least worked.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-body-md font-body tabular-nums">
                  <thead>
                    <tr className="text-left text-ink/60">
                      <th className="py-1 pr-4">Ward</th>
                      <th className="py-1 pr-4 text-right">Roll Voters</th>
                      <th className="py-1 pr-4 text-right">Verified</th>
                      <th className="py-1 pr-4 text-right">Captured</th>
                      <th className="py-1 pr-4 text-right">Verified %</th>
                      <th className="py-1 text-right">Captured %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coverage.map((c) => (
                      <tr key={c.wardCode} className="border-t border-ink/10">
                        <td className="py-1 pr-4 font-mono">{c.wardCode}</td>
                        <td className="py-1 pr-4 text-right">{c.rollVoters.toLocaleString('en-ZA')}</td>
                        <td className="py-1 pr-4 text-right">{c.verified.toLocaleString('en-ZA')}</td>
                        <td className="py-1 pr-4 text-right">{c.captured.toLocaleString('en-ZA')}</td>
                        <td className="py-1 pr-4 text-right">{c.verifiedPct.toFixed(1)}%</td>
                        <td className="py-1 text-right">{c.capturedPct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {seg.concentratedAddresses.length > 0 && (
            <Card>
              <h2 className="font-display text-headline-md mb-3">
                Concentrated Sites ({seg.concentratedAddresses.length})
              </h2>
              <p className="font-body text-body-md text-ink/70 mb-2">
                Addresses with 25 or more registered voters — the operational targets for a canvass
                team. Listed because they are places, not people.
              </p>
              <ul className="space-y-1 font-body text-body-md">
                {seg.concentratedAddresses.slice(0, 50).map((a, i) => (
                  <li key={`${a.wardCode}-${a.vdCode}-${i}`} className="border-t border-ink/10 py-1">
                    <span className="font-mono text-ink/70">{a.wardCode}</span> · {a.addressRaw}{' '}
                    <span className="text-ink/60">— {a.voterCount} voters</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {seg.suppressedCells > 0 && (
            <p className="font-body text-body-md text-ink/70">
              {seg.suppressedCells} ward or voting-district cell
              {seg.suppressedCells === 1 ? ' was' : 's were'} withheld for carrying too few voters to
              report safely. Their voters remain in the totals.
            </p>
          )}

          <BasisNote>
            Computed from your campaign’s own loaded roll addresses (counts only), never the IEC’s
            register. No individual record leaves this screen; small cells are suppressed per the
            platform’s POPIA minimisation.
          </BasisNote>
        </>
      )}
    </div>
  );
}
