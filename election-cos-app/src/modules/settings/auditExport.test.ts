import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '@/dal/ports/auditLog';
import { auditCsv, auditExportFilename } from './auditExport';

const ev = (over: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'e1',
  tenantId: 't1',
  actorUid: 'u1',
  action: 'ppfa.export',
  targetType: 'report',
  targetId: 'r1',
  occurredAt: '2026-11-04T08:00:00Z',
  metadata: { phone: '0824497310', note: 'secret' },
  ...over,
});

describe('audit log export', () => {
  const csv = auditCsv(
    't1',
    [ev(), ev({ id: 'e2', actorUid: '=HYPERLINK("http://x")' })],
    new Date('2026-11-05T00:00:00Z'),
  );
  it('carries the log’s own caveat about what it is not, and the event count', () => {
    expect(csv).toMatch(/hash chain|tamper|certified/i);
    expect(csv).toContain('"Events",2');
  });
  it('never exports event metadata, where a phone number could sit', () => {
    expect(csv).not.toContain('0824497310');
    expect(csv).not.toContain('secret');
  });
  it('defuses a formula in an attacker-controlled field', () => {
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
  it('carries a chain status per row, defaulting to not chained', () => {
    const c = auditCsv('t1', [ev(), ev({ id: 'e2' })], new Date('2026-11-05T00:00:00Z'), [
      'verified',
      'BROKEN',
    ]);
    expect(c).toContain('"chain"');
    expect(c).toMatch(/"verified"/);
    expect(c).toMatch(/"BROKEN"/);
    expect(csv).toMatch(/"not chained"/);
  });
  it('names the file by tenant and date', () => {
    expect(auditExportFilename('t1', new Date('2026-11-05T10:00:00Z'))).toBe(
      'audit-log-t1-2026-11-05.csv',
    );
  });
});
