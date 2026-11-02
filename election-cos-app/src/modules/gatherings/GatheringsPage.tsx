/**
 * Election Campaign OS — planned gatherings and the notice countdown
 * IC-ECOS-BUILD-2026-V2 §6.3, Regulation of Gatherings Act 205 of 1993 s 3.
 *
 * Reached from the Field Diary and the gatherings advisory rather than
 * from the primary nav, which §3.2 fixes at nine items.
 *
 * The countdown is computed here from the clock, every minute, and never
 * stored; the hourly sweep independently raises one alert per stage, and
 * `rgaCountdown.test.ts` keeps the two in agreement. The word on each row
 * carries the state — the tone only repeats it.
 */
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dal } from '@/dal';
import { useSession } from '@/auth/useSession';
import { TONE_PILL_CLASSES } from '@/design/toneClasses';
import { Button, Card, EmptyState, Field, PageHeader, Pill } from '@/components/ui';
import { describeCountdown } from './rgaCountdown';

const MINUTE = 60_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(t);
  }, []);
  return now;
}

function localInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * MINUTE).toISOString().slice(0, 16);
}

export function GatheringsPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const now = useNow();
  const formId = useId();

  const [title, setTitle] = useState('');
  const [wardCode, setWardCode] = useState(session?.wardScope ?? '');
  const [startsAt, setStartsAt] = useState(() => localInputValue(new Date(Date.now() + 7 * 24 * 3_600_000)));

  const listQuery = useQuery({
    queryKey: ['gatherings', session?.tenantId, session?.wardScope],
    queryFn: () => dal.gatherings.list(session!, { pageSize: 50 }),
    enabled: Boolean(session),
  });
  const alertsQuery = useQuery({
    queryKey: ['gatheringAlerts', session?.tenantId, session?.wardScope],
    queryFn: () => dal.gatherings.listAlerts(session!, 10),
    enabled: Boolean(session),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gatherings'] });

  const create = useMutation({
    mutationFn: () =>
      dal.gatherings.create(session!, {
        id: crypto.randomUUID(),
        title: title.trim(),
        wardCode: wardCode.trim(),
        startsAt: new Date(startsAt).toISOString(),
      }),
    onSuccess: () => {
      setTitle('');
      void refresh();
    },
  });
  const lodge = useMutation({
    mutationFn: (id: string) => dal.gatherings.markNoticeLodged(session!, id),
    onSuccess: () => void refresh(),
  });

  if (!session) {
    return (
      <Card className="max-w-lg">
        <PageHeader slug="/gatherings" title="Gatherings" />
        <p className="mt-3 text-body-md font-body text-slate">No active session.</p>
      </Card>
    );
  }

  const canEdit = session.caps.includes('diary.edit');
  const valid = title.trim().length > 0 && wardCode.trim().length > 0 && !Number.isNaN(Date.parse(startsAt));

  const rows = (listQuery.data?.items ?? [])
    .filter((g) => !g.deletedAt && Date.parse(g.startsAt) > now - 24 * 3_600_000)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader slug="/gatherings" title="Gatherings" />

      <p className="text-body-md font-body text-slate">
        Written notice of a gathering is due to the responsible officer not later than seven days
        before it. This page counts down to that point and to 48 hours, under which the officer may
        prohibit it.{' '}
        <Link to="/knowledge/gatherings-advisory" className="underline">
          Read the advisory
        </Link>
        . It records what you tell it; it does not show that notice was received or accepted.
      </p>

      {canEdit && (
        <Card className="space-y-4">
          <h2 className="text-headline-md font-display text-ink" id={formId}>
            Add a gathering
          </h2>
          <form
            aria-labelledby={formId}
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) create.mutate();
            }}
          >
            <div className="sm:col-span-2">
              <Field label="What is it" required>
                {(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} />}
              </Field>
            </div>
            <Field label="Ward code" required mono hint={session.wardScope ? undefined : 'Enter the ward this is in.'}>
              {(p) => (
                <input {...p} value={wardCode} readOnly={Boolean(session.wardScope)} onChange={(e) => setWardCode(e.target.value)} />
              )}
            </Field>
            <Field label="Starts" required>
              {(p) => <input {...p} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />}
            </Field>
            <div className="sm:col-span-2 flex items-center gap-3">
              <Button type="submit" disabled={!valid || create.isPending}>
                {create.isPending ? 'Adding…' : 'Add gathering'}
              </Button>
              {create.isError && (
                <p role="alert" className="text-body-md font-body text-maroon">
                  Could not add it. You may not have access to that ward.
                </p>
              )}
            </div>
          </form>
        </Card>
      )}

      {listQuery.isLoading ? (
        <p className="text-body-md font-body text-slate">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No upcoming gatherings">
          Add a rally, march or public meeting and this page will count down to its notice deadline.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((g) => {
            const c = describeCountdown(g.startsAt, g.noticeStatus, now);
            return (
              <li key={g.id}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-headline-md font-display text-ink">{g.title}</p>
                      <p className="text-data-mono font-mono text-slate">
                        Ward {g.wardCode} · {new Date(g.startsAt).toLocaleString('en-ZA')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Pill className={TONE_PILL_CLASSES[c.tone]}>{c.label}</Pill>
                      {c.remaining && <p className="mt-1 text-data-mono font-mono text-ink">{c.remaining} to go</p>}
                    </div>
                  </div>
                  <p className="text-body-md font-body text-slate">{c.detail}</p>
                  {canEdit && g.noticeStatus === 'NOT_LODGED' && Date.parse(g.startsAt) > now && (
                    <Button variant="ghost" onClick={() => lodge.mutate(g.id)} disabled={lodge.isPending}>
                      Record that notice was lodged
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {(alertsQuery.data?.length ?? 0) > 0 && (
        <Card className="space-y-2">
          <h2 className="text-headline-md font-display text-ink">Alerts raised</h2>
          <ul className="space-y-2">
            {alertsQuery.data!.map((a) => (
              <li key={a.id} className="text-body-md font-body text-ink">
                <span className="font-semibold">{a.title}</span> — {a.stage.replace('_', ' ').toLowerCase()}
                {a.basis === 'HOUSE_POLICY' ? ' (house policy)' : ''} · {new Date(a.createdAt).toLocaleString('en-ZA')}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
