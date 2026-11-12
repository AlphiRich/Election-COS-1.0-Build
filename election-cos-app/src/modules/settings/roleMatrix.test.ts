import { describe, expect, it } from 'vitest';
import { SEED_ROLES } from '@/auth/seedRoles';
import { ALL_CAPABILITIES } from '@/auth/allCapabilities';
import { buildRoleMatrix, unassignedCapabilities } from './roleMatrix';

describe('role matrix', () => {
  const matrix = buildRoleMatrix(SEED_ROLES, ALL_CAPABILITIES);

  it('has one row per capability and one cell per role', () => {
    expect(matrix).toHaveLength(ALL_CAPABILITIES.length);
    for (const row of matrix) expect(row.held).toHaveLength(SEED_ROLES.length);
  });

  it('agrees with every role default, in both directions', () => {
    SEED_ROLES.forEach((role, i) => {
      const fromMatrix = matrix.filter((r) => r.held[i]).map((r) => r.capability);
      expect([...fromMatrix].sort()).toEqual([...role.defaultCaps].sort());
    });
  });

  it('groups by module prefix', () => {
    expect(matrix.find((r) => r.capability === 'ppfa.edit')?.group).toBe('ppfa');
  });

  it('reports capabilities no role holds', () => {
    const none = unassignedCapabilities(matrix);
    for (const cap of none) {
      expect(SEED_ROLES.some((r) => r.defaultCaps.includes(cap))).toBe(false);
    }
  });
});
