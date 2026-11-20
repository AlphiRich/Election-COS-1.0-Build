import { describe, expect, it } from 'vitest';
import { parseScopedThread } from './firestoreCheckpointer';

describe('parseScopedThread — tenant scoping fails closed', () => {
  it('splits a well-formed <tenantId>:<threadId>', () => {
    expect(parseScopedThread('jb-marks:thread-123')).toEqual({ tenantId: 'jb-marks', threadId: 'thread-123' });
  });

  it('keeps colons inside the threadId (splits on the first only)', () => {
    expect(parseScopedThread('jb-marks:a:b:c')).toEqual({ tenantId: 'jb-marks', threadId: 'a:b:c' });
  });

  it('trims surrounding whitespace on both halves', () => {
    expect(parseScopedThread(' jb-marks : t1 ')).toEqual({ tenantId: 'jb-marks', threadId: 't1' });
  });

  it('throws when there is no colon (cannot know the tenant)', () => {
    expect(() => parseScopedThread('thread-with-no-tenant')).toThrow(/tenant-scoped/i);
  });

  it('throws on an empty tenant or empty thread', () => {
    expect(() => parseScopedThread(':t1')).toThrow(/invalid/i);
    expect(() => parseScopedThread('jb-marks:')).toThrow(/invalid/i);
    expect(() => parseScopedThread('   :   ')).toThrow(/invalid/i);
  });

  it('throws on a non-string thread id', () => {
    expect(() => parseScopedThread(undefined)).toThrow(/tenant-scoped/i);
    expect(() => parseScopedThread(123)).toThrow(/tenant-scoped/i);
    expect(() => parseScopedThread(null)).toThrow(/tenant-scoped/i);
  });
});
