/**
 * Election Campaign OS — audit log export
 *
 * One of the three surfaces a supplied IEC-integration note called for
 * ("audit-log exports"): the log, as a file a reviewer can keep.
 *
 * WHAT IS IN IT, AND WHAT IS NOT
 * Time, actor, action, a human description, target type and id. The
 * event `metadata` is deliberately NOT exported: it is free-form, written
 * by server code for debugging, and the one place a phone number or a name
 * could slip into an audit record. The log page does not show it either.
 *
 * WHAT THE FILE SAYS ABOUT ITSELF
 * The same three basis sentences the page carries: this log has no hash
 * chain, is not tamper-evident, and is not a certified record. A file that
 * left that out would be believed to have a property the data lacks.
 */
import type { AuditEvent } from '@/dal/ports/auditLog';
import { toCsv } from '@/lib/csv';
import { AUDIT_INTEGRITY_BASIS, AUDIT_SCOPE_BASIS, describeAction } from './auditTrail';

export function auditCsv(tenantId: string, events: AuditEvent[], exportedAt: Date): string {
  return toCsv([
    ['Election Campaign OS audit log export'],
    ['Tenant', tenantId],
    ['Exported at', exportedAt.toISOString()],
    ['Events', events.length],
    ['Basis', AUDIT_INTEGRITY_BASIS],
    ['Scope', AUDIT_SCOPE_BASIS],
    [],
    ['occurredAt', 'actorUid', 'action', 'description', 'targetType', 'targetId'],
    ...events.map((e) => [
      e.occurredAt,
      e.actorUid,
      e.action,
      describeAction(e.action),
      e.targetType,
      e.targetId,
    ]),
  ]);
}

export const auditExportFilename = (tenantId: string, d: Date) =>
  `audit-log-${tenantId}-${d.toISOString().slice(0, 10)}.csv`;
