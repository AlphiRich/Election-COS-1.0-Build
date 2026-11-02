/**
 * Election Campaign OS — Voter sentiment polls (/analytics/polls)
 *
 * Create a poll, share it on any channel, and watch the answers arrive as counts. Read
 * pollModel.ts first: answers carry no identity, the sample is self-selected, small groups are
 * hidden, and no margin of error is shown because none would be honest.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dal } from '@/dal';
import { useSession } from '@/auth/useSession';
import {
  BasisNote,
  Button,
  Card,
  Field,
  PageHeader,
  SectionLabel,
  Table,
  Td,
  Th,
} from '@/components/ui';
import {
  PASTE_ONLY,
  POLL_NOTICE_VERSION,
  buildDashboard,
  pollUrl,
  shareLinks,
  validateDefinition,
  SELF_SELECTED_CAVEAT,
  type PollDefinition,
  type ShareRow,
} from './pollModel';

const SITE_ORIGIN = 'https://electioncos.co.za';
const pct = (f: number) => `${(f * 100).toFixed(0)}%`;
const label = (o: string) =>
  o === 'UNDECIDED' ? 'Undecided' : o === 'PREFER_NOT_TO_SAY' ? 'Prefer not to say' : o;

function Shares({ rows }: { rows: ShareRow[] }) {
  return (
    <Table caption="Answers and their share of the responses in this group.">
      <thead>
        <tr>
          <Th>Answer</Th>
          <Th numeric>Responses</Th>
          <Th numeric>Share</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.option}>
            <Td>{label(r.option)}</Td>
            <Td numeric>{r.count}</Td>
            <Td numeric>{pct(r.share)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function PollDetail({ poll }: { poll: PollDefinition }) {
  const session = useSession();
  const qc = useQueryClient();
  const tally = useQuery({
    queryKey: ['pollTally', session?.tenantId, poll.id],
    queryFn: () => dal.polls.getTally(session!, poll.id),
    enabled: Boolean(session),
    refetchInterval: 30_000,
  });
  const setStatus = useMutation({
    mutationFn: (s: PollDefinition['status']) => dal.polls.setStatus(session!, poll.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['polls'] }),
  });
  const dash = buildDashboard(tally.data?.counts ?? {});
  const links = shareLinks(SITE_ORIGIN, poll.publicId, poll.question);

  return (
    <Card>
      <SectionLabel as="h2">{poll.question}</SectionLabel>
      <p className="text-body-md font-body text-slate mt-1">
        {poll.status} · run by {poll.organiser} ·{' '}
        {poll.tokenMode === 'single' ? 'one answer per link' : 'public link'}
      </p>
      <div className="mt-2 flex gap-2">
        {poll.status !== 'OPEN' && poll.status !== 'CLOSED' && (
          <Button onClick={() => setStatus.mutate('OPEN')}>Open poll</Button>
        )}
        {poll.status === 'OPEN' && (
          <Button variant="ghost" onClick={() => setStatus.mutate('CLOSED')}>
            Close poll
          </Button>
        )}
      </div>

      <div className="mt-4">
        <SectionLabel as="h3">Share it</SectionLabel>
        <p className="text-body-md font-body mt-1">
          Each button opens the platform with the link ready. You choose to send; nothing is sent
          for you.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {links.map((l) => (
            <li key={l.channel}>
              <a className="underline" href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <ul className="mt-2 space-y-1 text-body-md font-body">
          {PASTE_ONLY.map((p) => (
            <li key={p.channel}>
              {p.label}:{' '}
              <span className="font-mono break-all">
                {pollUrl(SITE_ORIGIN, poll.publicId, p.channel)}
              </span>
            </li>
          ))}
          <li>
            In the app and on the website:{' '}
            <span className="font-mono break-all">
              {pollUrl(SITE_ORIGIN, poll.publicId, 'website')}
            </span>
          </li>
        </ul>
      </div>

      <div className="mt-4">
        <SectionLabel as="h3">Responses so far: {dash.total}</SectionLabel>
        <p className="text-caption font-body text-slate mt-1">{SELF_SELECTED_CAVEAT}</p>
        {dash.total < 5 ? (
          <p className="text-body-md font-body mt-2">
            Fewer than 5 responses: no figures are shown yet.
          </p>
        ) : (
          <>
            <Shares rows={dash.overall} />
            <SectionLabel as="h3">By channel</SectionLabel>
            {dash.byChannel.map((c) => (
              <div key={c.channel} className="mt-2">
                <p className="font-mono text-data-mono">
                  {c.channel} · {c.total} responses
                </p>
                {c.rows ? (
                  <Shares rows={c.rows} />
                ) : (
                  <p className="text-body-md text-slate">Hidden: fewer than 5 responses.</p>
                )}
              </div>
            ))}
            {dash.byWard.length > 0 && (
              <>
                <SectionLabel as="h3">By ward</SectionLabel>
                {dash.byWard.map((w) => (
                  <div key={w.ward} className="mt-2">
                    <p className="font-mono text-data-mono">
                      {w.ward} · {w.total} responses
                    </p>
                    {w.rows ? (
                      <Shares rows={w.rows} />
                    ) : (
                      <p className="text-body-md text-slate">Hidden: fewer than 5 responses.</p>
                    )}
                  </div>
                ))}
              </>
            )}
            {dash.suppressedCells > 0 && (
              <p className="text-caption font-body text-slate mt-2">
                {dash.suppressedCells} group(s) are hidden because they have fewer than 5 responses.
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export function PollsPage() {
  const session = useSession();
  const qc = useQueryClient();
  const polls = useQuery({
    queryKey: ['polls', session?.tenantId],
    queryFn: () => dal.polls.list(session!),
    enabled: Boolean(session),
  });
  const [question, setQuestion] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [organiser, setOrganiser] = useState('');
  const [tokenMode, setTokenMode] = useState<'open' | 'single'>('open');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const options = optionsText
        .split('\n')
        .map((o) => o.trim())
        .filter(Boolean);
      validateDefinition({ question, options, organiser });
      return dal.polls.create(session!, {
        question,
        options,
        organiser,
        tokenMode,
        status: 'DRAFT',
      });
    },
    onSuccess: () => {
      setError(null);
      setQuestion('');
      setOptionsText('');
      qc.invalidateQueries({ queryKey: ['polls'] });
    },
    onError: (e) => setError((e as Error).message),
  });

  if (!session) return <p>No active session.</p>;
  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/polls" title="Voter sentiment polls" />
      <BasisNote>
        Answers are counted, not recorded against anyone: no name, number, ID, device or free text
        is collected. {SELF_SELECTED_CAVEAT} Notice wording: {POLL_NOTICE_VERSION}.
      </BasisNote>

      <Card>
        <SectionLabel as="h2">New poll</SectionLabel>
        <div className="grid gap-3 mt-3">
          <Field label="Question">
            {(props) => (
              <input {...props} value={question} onChange={(e) => setQuestion(e.target.value)} />
            )}
          </Field>
          <Field
            label="Options, one per line"
            hint="'Undecided' and 'Prefer not to say' are added for you."
          >
            {(props) => (
              <textarea
                {...props}
                rows={4}
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            )}
          </Field>
          <Field label="Who is running this poll">
            {(props) => (
              <input {...props} value={organiser} onChange={(e) => setOrganiser(e.target.value)} />
            )}
          </Field>
          <Field
            label="Link type"
            hint="One answer per link suits invitations; a public link can be answered by anyone who has it."
          >
            {(props) => (
              <select
                {...props}
                value={tokenMode}
                onChange={(e) => setTokenMode(e.target.value as 'open' | 'single')}
              >
                <option value="open">Public link</option>
                <option value="single">One answer per link</option>
              </select>
            )}
          </Field>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={() => create.mutate()}>Create poll</Button>
          {error && (
            <span role="alert" className="text-body-md text-maroon">
              {error}
            </span>
          )}
        </div>
      </Card>

      {polls.isError && <p role="alert">Polls could not be loaded.</p>}
      {polls.data?.length === 0 && <p className="text-body-md text-slate">No polls yet.</p>}
      {polls.data?.map((p) => (
        <PollDetail key={p.id} poll={p} />
      ))}
    </div>
  );
}
