import { describe, expect, it } from 'vitest';
import {
  MAX_ITERATIONS,
  harnessContextFrom,
  iterationBudgetExhausted,
  requiresHumanApproval,
  type CampaignDirectorStateShape,
} from './state';

describe('harnessContextFrom — fails closed', () => {
  it('builds the context from a verified token', () => {
    const ctx = harnessContextFrom({ uid: 'u1', token: { tenantId: 'jb-marks', caps: ['warroom.view', 'voters.view'] } });
    expect(ctx).toEqual({ tenantId: 'jb-marks', uid: 'u1', capabilities: ['warroom.view', 'voters.view'] });
  });

  it('throws when tenantId is missing, empty, or not a string', () => {
    expect(() => harnessContextFrom({ uid: 'u1', token: {} })).toThrow(/tenantId/i);
    expect(() => harnessContextFrom({ uid: 'u1', token: { tenantId: '  ' } })).toThrow(/tenantId/i);
    expect(() => harnessContextFrom({ uid: 'u1', token: { tenantId: 123 } })).toThrow(/tenantId/i);
  });

  it('throws when uid is missing', () => {
    expect(() => harnessContextFrom({ token: { tenantId: 'jb-marks' } })).toThrow();
    expect(() => harnessContextFrom(undefined)).toThrow();
    expect(() => harnessContextFrom(null)).toThrow();
  });

  it('drops non-string caps and defaults to [] when caps are absent or malformed', () => {
    expect(harnessContextFrom({ uid: 'u', token: { tenantId: 't' } }).capabilities).toEqual([]);
    expect(
      harnessContextFrom({ uid: 'u', token: { tenantId: 't', caps: ['a', 3, null, 'b'] } }).capabilities,
    ).toEqual(['a', 'b']);
    expect(harnessContextFrom({ uid: 'u', token: { tenantId: 't', caps: 'not-an-array' } }).capabilities).toEqual([]);
  });
});

const baseState: CampaignDirectorStateShape = {
  claims: [],
  errors: [],
  municipalityCode: 'NW405',
  wardIds: [],
  scenarioSeed: null,
  iterationCount: 0,
  pendingAction: { type: 'none' },
  approvalStatus: 'pending',
  briefingOutput: null,
};

describe('iterationBudgetExhausted', () => {
  it('is false below the cap and true at or above it', () => {
    expect(iterationBudgetExhausted({ iterationCount: MAX_ITERATIONS - 1 })).toBe(false);
    expect(iterationBudgetExhausted({ iterationCount: MAX_ITERATIONS })).toBe(true);
    expect(iterationBudgetExhausted({ iterationCount: MAX_ITERATIONS + 5 })).toBe(true);
  });
});

describe('requiresHumanApproval', () => {
  it('is true only for an incident dispatch that carries a payload', () => {
    expect(requiresHumanApproval(baseState)).toBe(false);
    expect(requiresHumanApproval({ pendingAction: { type: 'incident_dispatch' } })).toBe(false);
    expect(
      requiresHumanApproval({
        pendingAction: { type: 'incident_dispatch', payload: { incidentId: 'i1', responderId: 'r1', summary: 's' } },
      }),
    ).toBe(true);
  });
});
