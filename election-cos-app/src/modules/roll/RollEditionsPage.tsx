/**
 * Election Campaign OS — voters'-roll editions (admin)
 * Module `voter-verification`. Capability: `roll.manage` (HQ Admin).
 *
 * Shows the roll editions the server-side ingest has written (roll_meta),
 * their load status and counts, and which one is live. An admin can make a
 * LOADED edition the active one — the field screen and segmentation then
 * read it. Activation goes through the `setActiveRollEdition` function (an
 * admin-SDK write; roll_meta is `write: if false` to clients), which also
 * re-checks the capability and the second factor server-side.
 *
 * LOADING a roll is deliberately NOT a browser action: bulk voter records
 * are ingested on the owner's own machine, outside the app, by
 * tools/voters-roll. This screen says so rather than pretending to upload.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dal } from '@/dal';
import { useSession } from '@/auth/useSession';
import { useEntitlements } from '@/auth/useEntitlements';
import { resolveAccess } from '@/auth/entitlements';
import { BasisNote, Button, Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { activateEdition, editionRows } from './rollEditions';

export function RollEditionsPage() {
  const session = useSession();
  const { entitlements } = useEntitlements();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const access = session ? resolveAccess(session.caps, entitlements ?? [], 'roll.manage') : null;
  const allowed =
    session && (entitlements === undefined ? session.caps.includes('roll.manage') : access?.allowed);

  const active = useQuery({
    queryKey: ['roll-active-edition', session?.tenantId],
    queryFn: () => dal.roll.activeEdition(session!),
    enabled: Boolean(allowed),
  });
  const editions = useQuery({
    queryKey: ['roll-editions', session?.tenantId],
    queryFn: () => dal.roll.listEditions(session!),
    enabled: Boolean(allowed),
  });

  const rows = useMemo(
    () => editionRows(editions.data ?? [], active.data ?? null),
    [editions.data, active.data],
  );

  const activate = useMutation({
    mutationFn: (edition: string) => activateEdition(session!, edition),
    onSuccess: (r) => {
      if (r.ok) {
        setError(null);
        qc.invalidateQueries({ queryKey: ['roll-active-edition'] });
        qc.invalidateQueries({ queryKey: ['roll-editions'] });
      } else {
        setError(r.message);
      }
    },
    onError: () => setError('The active edition could not be changed.'),
  });

  if (!session) return null;
  if (!allowed) {
    return (
      <Card className="max-w-lg">
        <PageHeader slug="/settings/roll-editions" title="Voters’ Roll Editions" />
        <p className="text-body-md font-body">
          {access?.reason || 'Managing roll editions is available to the Party HQ Admin only.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader slug="/settings/roll-editions" title="Voters’ Roll Editions" />
      <p className="text-body-md font-body">
        The roll edition that is <strong>live</strong> is the one every canvasser and the segmentation
        read. Make a loaded edition live below. Changing it needs your second sign-in step.
      </p>

      {editions.isSuccess && rows.length === 0 && (
        <EmptyState title="No Roll Loaded">
          No roll edition has been loaded for this campaign yet. Loading is a server-side step — see
          the note below.
        </EmptyState>
      )}

      {error && (
        <p role="status" className="text-body-md font-body text-maroon">
          {error}
        </p>
      )}

      {rows.map((r) => (
        <Card key={r.edition}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-headline-md">
                <span className="font-mono">{r.edition}</span>{' '}
                {r.isActive && <Pill className="bg-green/10 text-green">Live</Pill>}
                {r.status !== 'LOADED' && (
                  <Pill className={r.status === 'FAILED' ? 'bg-maroon/10 text-maroon' : 'bg-ink/5 text-ink'}>
                    {r.status === 'FAILED' ? 'Load failed' : 'Loading'}
                  </Pill>
                )}
              </p>
              <p className="font-body text-body-md text-ink/70 tabular-nums">
                {r.entries.toLocaleString('en-ZA')} entries · {r.addresses.toLocaleString('en-ZA')} addresses
                {r.loadedAt ? ` · loaded ${r.loadedAt.slice(0, 10)}` : ''}
              </p>
              {r.note && <p className="font-body text-body-sm text-ink/60 mt-1">{r.note}</p>}
            </div>
            {r.canActivate && (
              <Button
                onClick={() => activate.mutate(r.edition)}
                disabled={activate.isPending}
              >
                Make Live
              </Button>
            )}
          </div>
        </Card>
      ))}

      <BasisNote>
        Loading a roll is done outside the app, on the campaign’s own machine, with the voters-roll
        ingest (tools/voters-roll) — the browser never uploads voter records. Lawful basis and
        retention for loading the roll are a POPIA decision, recorded separately from this screen.
      </BasisNote>
    </div>
  );
}
