/**
 * Election Campaign OS — role × capability matrix (read-only view model)
 *
 * Source of truth is SEED_ROLES + ALL_CAPABILITIES; nothing here is a second
 * list. The Access-console design shows this as a grid; deriving it from
 * those two lists means it can never disagree with `resolveEffectiveCapabilities`
 * or `firestore.rules`.
 */
import type { Capability, Role } from '@/auth/types';

export interface MatrixRow {
  capability: Capability;
  /** Module prefix, e.g. `ppfa` for `ppfa.edit`. */
  group: string;
  /** One entry per role, in the order the roles were given. */
  held: boolean[];
}

export function buildRoleMatrix(roles: Role[], capabilities: Capability[]): MatrixRow[] {
  return capabilities.map((capability) => ({
    capability,
    group: capability.split('.')[0],
    held: roles.map((r) => r.defaultCaps.includes(capability)),
  }));
}

/** Capabilities no role holds by default: reachable only through a per-user grant. */
export function unassignedCapabilities(matrix: MatrixRow[]): Capability[] {
  return matrix.filter((row) => !row.held.some(Boolean)).map((row) => row.capability);
}
