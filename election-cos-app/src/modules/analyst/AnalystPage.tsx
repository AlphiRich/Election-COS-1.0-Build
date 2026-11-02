/**
 * Election Campaign OS — War Room analyst (/analytics/analyst)
 *
 * Read analystEngine.ts first. The file is read and analysed in this browser tab: it is not uploaded, and no model
 * writes the report. Personal-information columns are removed before anything is profiled.
 */
import { useMemo, useState } from 'react';
import { BarChart } from '@/modules/reference/BarChart';
import {
  BasisNote,
  Button,
  Card,
  Field,
  PageHeader,
  Pill,
  SectionLabel,
  StatTile,
  Table as UiTable,
  Td,
  Th,
} from '@/components/ui';
import {
  EXAMPLE_QUESTIONS,
  MAX_BYTES,
  parseCsv,
  profile,
  runAnalysis,
  screenColumns,
  withoutColumns,
  type Report,
  type Table,
} from './analystEngine';

interface Run {
  id: number;
  at: string;
  report: Report;
}

export function AnalystPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [question, setQuestion] = useState('');
  const [measure, setMeasure] = useState('');
  const [dimension, setDimension] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);

  const screens = useMemo(
    () => tables.flatMap((t) => screenColumns(t).map((s) => ({ ...s, file: t.name }))),
    [tables],
  );
  const drop = useMemo(() => {
    const d = new Set<string>();
    for (const s of screens) if (s.level === 'blocked' || !kept.has(`${s.file}::${s.column}`)) d.add(`${s.file}::${s.column}`);
    return d;
  }, [screens, kept]);
  const cleaned = useMemo(
    () => tables.map((t) => withoutColumns(t, new Set([...drop].filter((k) => k.startsWith(`${t.name}::`)).map((k) => k.slice(t.name.length + 2))))),
    [tables, drop],
  );
  const prof = useMemo(() => (cleaned[0] ? profile(cleaned[0]) : []), [cleaned]);
  const report = runs.find((r) => r.id === viewing)?.report ?? null;

  const add = (t: Table) => {
    setError(null);
    setTables((ts) => [...ts.filter((x) => x.name !== t.name), t]);
  };
  const onFiles = async (files: FileList | null) => {
    for (const f of Array.from(files ?? [])) {
      if (!/\.csv$/i.test(f.name)) {
        setError(`${f.name} is not a .csv file.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is ${(f.size / 1048576).toFixed(1)} MB; the limit is ${MAX_BYTES / 1048576} MB.`);
        continue;
      }
      try {
        add(parseCsv(await f.text(), f.name));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };
  const onPaste = () => {
    try {
      add(parseCsv(pasted, `pasted-${tables.length + 1}.csv`));
      setPasted('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const run = () => {
    const r = runAnalysis(cleaned, question, [...drop].map((k) => k.split('::')[1]), new Date(), {
      measure: measure || undefined,
      dimension: dimension || undefined,
    });
    const id = runs.length + 1;
    setRuns((rs) => [{ id, at: new Date().toISOString().slice(0, 16).replace('T', ' '), report: r }, ...rs]);
    setViewing(id);
  };

  const numeric = prof.filter((c) => c.type === 'number');
  const groupable = prof.filter((c) => c.type === 'text' && c.distinct >= 2 && c.distinct <= 50);
  const canRun = cleaned.length > 0 && question.trim().length > 0;

  return (
    <div className="space-y-6">
      <PageHeader slug="/analytics/analyst" title="Data analyst" />
      <BasisNote>
        Ask a question of a CSV. The file is read in this browser tab and is not uploaded anywhere, and no
        AI model writes the answer: every figure is counted or summed from your rows, and the page says
        how. It answers three kinds of question: a summary, the top segments by a number, and anomalies.
        Columns that look like ID numbers or phone numbers are removed before anything is read (SOP-17).
      </BasisNote>

      <Card>
        <SectionLabel as="h2">1. Data</SectionLabel>
        <Field label="CSV file" hint={`Up to ${MAX_BYTES / 1048576} MB each. Stays on this device.`}>
          {(props) => (
            <input {...props} type="file" accept=".csv,text/csv" multiple onChange={(e) => void onFiles(e.target.files)} />
          )}
        </Field>
        <Field label="Or paste CSV text" hint="First row is the header.">
          {(props) => <textarea {...props} rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} />}
        </Field>
        <div className="mt-2">
          <Button variant="ghost" disabled={!pasted.trim()} onClick={onPaste}>
            Add pasted data
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-body-md font-body text-maroon mt-2">
            {error}
          </p>
        )}
        {tables.length > 0 && (
          <ul className="mt-3 space-y-1">
            {tables.map((t) => (
              <li key={t.name} className="flex items-center justify-between gap-3 text-body-md font-body">
                <span className="font-mono">{t.name}</span>
                <span className="text-slate">
                  {t.rows.length.toLocaleString('en-ZA')} rows, {t.headers.length} columns
                </span>
                <button type="button" className="min-h-11 px-2 underline" onClick={() => setTables((ts) => ts.filter((x) => x.name !== t.name))}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {screens.length > 0 && (
        <Card>
          <SectionLabel as="h2">Personal information check</SectionLabel>
          <div role="alert">
            {screens.map((s) => {
              const key = `${s.file}::${s.column}`;
              return (
                <div key={key} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-ink/10">
                  <p className="text-body-md font-body min-w-0">
                    <span className="font-mono">{s.column}</span> in {s.file}: {s.reason}.{' '}
                    <strong>{s.level === 'blocked' || !kept.has(key) ? 'Removed.' : 'Kept.'}</strong>
                  </p>
                  {s.level === 'flagged' && (
                    <label className="flex items-center gap-2 min-h-11 text-body-md font-body">
                      <input
                        type="checkbox"
                        checked={kept.has(key)}
                        onChange={(e) =>
                          setKept((k) => {
                            const n = new Set(k);
                            if (e.target.checked) n.add(key);
                            else n.delete(key);
                            return n;
                          })
                        }
                      />
                      This column is not about people, keep it
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-body-md font-body text-slate mt-2">
            A column whose values look like an ID or phone number can never be kept. Keeping a flagged
            column is your statement that it describes places or things, not people.
          </p>
        </Card>
      )}

      <Card>
        <SectionLabel as="h2">2. Your question</SectionLabel>
        <Field label="Question">
          {(props) => <textarea {...props} rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />}
        </Field>
        <div className="flex flex-wrap gap-2 mt-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button key={q} type="button" className="min-h-11 px-3 border border-ink/20 rounded text-body-md font-body text-left" onClick={() => setQuestion(q)}>
              {q}
            </button>
          ))}
        </div>
        {(numeric.length > 1 || groupable.length > 1) && (
          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <Field label="Total this number (segments)">
              {(props) => (
                <select {...props} value={measure} onChange={(e) => setMeasure(e.target.value)}>
                  <option value="">First numeric column</option>
                  {numeric.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Group by (segments)">
              {(props) => (
                <select {...props} value={dimension} onChange={(e) => setDimension(e.target.value)}>
                  <option value="">First suitable text column</option>
                  {groupable.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <Button disabled={!canRun} onClick={run}>
            Run analysis
          </Button>
          <span className="text-body-md font-body text-slate">
            {!cleaned.length ? 'Add a CSV first.' : !question.trim() ? 'Write a question.' : 'Runs here, on this device.'}
          </span>
        </div>
      </Card>

      {report && (
        <Card>
          <div aria-live="polite">
            <Pill>{report.kind === 'unsupported' ? 'Limited' : 'Done'}</Pill>
            <h2 className="text-headline-md font-display text-ink mt-2">{report.title}</h2>
            <p className="text-body-md font-body mt-1">{report.summary}</p>
          </div>
          {report.insights.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
              {report.insights.map((i) => (
                <StatTile key={i.title} label={i.title} value={i.value} sub={i.metric} />
              ))}
            </div>
          )}
          <ul className="mt-3 space-y-1 text-body-md font-body">
            {report.insights.map((i) => (
              <li key={i.title}>
                <strong>{i.title}.</strong> {i.detail}
              </li>
            ))}
          </ul>
          {report.chart && (
            <div className="mt-4">
              <BarChart
                title={report.chart.title}
                bars={report.chart.bars}
                orientation="row"
                valueLabel={report.chart.valueLabel}
                caption={report.chart.title}
              />
            </div>
          )}
          {report.table && (
            <div className="mt-4">
              <UiTable caption={report.table.title}>
                <thead>
                  <tr>
                    {report.table.columns.map((c, i) => (
                      <Th key={c} numeric={i > 0 && /^[\d.,\s-]+$/.test(report.table!.rows[0]?.[i] ?? '')}>
                        {c}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.table.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, i) => (
                        <Td key={i} numeric={i > 0 && /^[\d.,\s-]+$/.test(c)}>
                          {c}
                        </Td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </UiTable>
            </div>
          )}
          <SectionLabel as="h3">How this was done</SectionLabel>
          <p className="text-body-md font-body">{report.methodology}</p>
          <SectionLabel as="h3">Limits</SectionLabel>
          <ul className="list-disc pl-5 text-body-md font-body">
            {report.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="text-body-md font-body text-slate mt-2">
            {report.dataset} · {report.generatedAt}
            {report.excludedColumns.length > 0 && ` · removed: ${report.excludedColumns.join(', ')}`}
          </p>
        </Card>
      )}

      {runs.length > 0 && (
        <Card>
          <SectionLabel as="h2">This session&rsquo;s runs</SectionLabel>
          <p className="text-body-md font-body text-slate">
            Kept in this tab only. Closing or reloading the page clears them.
          </p>
          <ul className="mt-2">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2 border-b border-ink/10">
                <span className="text-body-md font-body min-w-0">
                  <span className="font-mono">run_{String(r.id).padStart(3, '0')}</span> · {r.at} · {r.report.title}
                </span>
                <button type="button" className="min-h-11 px-2 underline" onClick={() => setViewing(r.id)}>
                  Open
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
