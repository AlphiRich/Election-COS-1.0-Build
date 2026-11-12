/**
 * A7: masking sweep. Every generated export is built from hostile input (personal data placed in
 * every free-text field the generator is handed) and the output is scanned. Adding a new
 * generator without adding it here is the gap; the list is checked against the files that
 * import the download helper so a new exporter cannot slip past unnoticed.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPii } from '@/lib/piiScan';
import { auditCsv } from '@/modules/settings/auditExport';
import { buildStatement, statementCsv } from '@/modules/roll/usageStatement';
import {
  buildGroundIntelligence,
  groundIntelligenceHtml,
} from '@/modules/analytics/groundIntelligence';
import { buildSignoff, signoffHtml } from '@/modules/voters/dailySignoff';

const ID = '8001015009087';
const PHONE = '082 449 7310';
const DIRTY = `${ID} ${PHONE} 0824497310 +27824497310`;
const NOW = new Date('2026-11-05T10:00:00Z');

describe('the scanner', () => {
  it('finds an ID number and each phone format, and leaves codes alone', () => {
    expect(findPii(DIRTY).map((h) => h.kind)).toEqual(
      expect.arrayContaining(['id-number', 'phone']),
    );
    expect(findPii('NW405-W31 86999001 R184,500 2026-11-05T10:00:00Z 122,059')).toEqual([]);
  });
});

describe('generated exports carry no ID number or phone number', () => {
  it('audit log CSV (metadata and free text hostile)', () => {
    const csv = auditCsv(
      't1',
      [
        {
          id: 'e',
          tenantId: 't1',
          actorUid: 'u',
          action: 'voter.phone.unmask',
          targetType: 'voter',
          targetId: 'v1',
          occurredAt: '2026-11-04T08:00:00Z',
          metadata: { phone: PHONE, id: ID, note: DIRTY },
        },
      ],
      NOW,
    );
    expect(findPii(csv)).toEqual([]);
  });

  it('usage statement CSV', () => {
    const s = buildStatement(
      { tenantId: 't1', geoScope: 'TENANT' },
      [
        {
          id: 'VERIFY::e1',
          tenantId: 't1',
          kind: 'VERIFY',
          rollEntryId: 'e1',
          rollEdition: 'E1',
          wardCode: 'NW405-W31',
          vdCode: '86999001',
          uid: 'u1',
          at: '2026-11-04T08:00:00Z',
          note: DIRTY,
        } as never,
      ],
      '2026-11',
      NOW,
    );
    expect(findPii(statementCsv(s))).toEqual([]);
  });

  it('ground intelligence HTML', () => {
    const incidents = Array.from({ length: 6 }, (_, i) => ({
      id: `i${i}`,
      wardCode: 'NW405-W31',
      category: 'WATER_SANITATION',
      createdAt: '2026-11-03T08:00:00Z',
      description: DIRTY,
      reporterName: DIRTY,
    })) as never;
    expect(
      findPii(groundIntelligenceHtml(buildGroundIntelligence(incidents, '2026-11', NOW))),
    ).toEqual([]);
  });

  it('daily sign-off HTML', () => {
    const voters = [
      {
        wardCode: 'NW405-W31',
        vdCode: '86999001',
        createdAt: '2026-11-04T08:00:00Z',
        sentiment: 'POSITIVE',
        popiaConsentGiven: true,
        deletedAt: null,
        fullName: DIRTY,
        idNumber: ID,
        phone: PHONE,
      },
    ] as never;
    const html = signoffHtml(
      buildSignoff({
        day: '2026-11-04',
        wardCode: 'NW405-W31',
        vdCode: '86999001',
        households: [],
        voters,
        incidents: [],
        pendingSync: 0,
        now: NOW,
      }),
    );
    expect(findPii(html)).toEqual([]);
  });
});

describe('no exporter is missing from this sweep', () => {
  const KNOWN = new Set([
    'modules/settings/AuditLogPage.tsx',
    'modules/settings/SubscriptionPage.tsx',
    'modules/voters/RoundPage.tsx',
    'modules/analytics/ScheduledReportsPage.tsx',
    'site/pages/SiteAgentTool.tsx',
  ]);
  /**
   * PDF downloads. Not text-swept here: the bytes are compressed, and each one carries personal
   * data by design (a referral names the complainant; a subject-access report is that person's own
   * data; the PR list names candidates, with ID numbers masked by the document model). Their
   * contents are covered by their own document-model tests, not by this scan. Stated, not hidden.
   */
  const PDF_BY_DESIGN = new Set([
    'modules/candidates/CandidatesPage.tsx',
    'modules/incidents/referral/ReferralPrepareModal.tsx',
    'modules/incidents/report/IncidentReportPage.tsx',
    'modules/settings/SubjectAccessModal.tsx',
  ]);
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  }
  it('lists every file that triggers a download', () => {
    const root = path.resolve(__dirname);
    const users = walk(root)
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
      .filter((f) =>
        /\bdownloadText\(|\bdownloadBlob\(|URL\.createObjectURL/.test(readFileSync(f, 'utf-8')),
      )
      .map((f) => path.relative(root, f).split(path.sep).join('/'))
      .filter((f) => f !== 'lib/csv.ts');
    const unknown = users.filter((f) => !KNOWN.has(f) && !PDF_BY_DESIGN.has(f));
    expect(unknown, 'new downloader: add its generator to the sweep, then to KNOWN').toEqual([]);
  });
});
