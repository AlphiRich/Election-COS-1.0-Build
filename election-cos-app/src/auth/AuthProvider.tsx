/**
 * Election Campaign OS — session context provider
 * IC-ECOS-BUILD-2026-V2 §4.2, §4.4.
 *
 * Reads tenantId/roleId/caps/geoScope/wardScope/vdScope from the verified
 * ID token's custom claims (set server-side by
 * functions/src/resolveCapabilities.ts, never computed here) and exposes
 * them as a SessionContext. Client-side use of `caps` is for RENDERING
 * ONLY (§4.4) — the real gate is firestore.rules + the DAL, both of which
 * re-check the token server-side on every request.
 *
 * Hooks (useAuthState, useSession) live in ./useSession.ts, not here —
 * see that file's header for why.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '@/dal/adapters/firestore/client';
import type { Capability, GeoScope } from './types';
import type { SessionContext } from '@/dal/ports/session';
import { AuthContext, type AuthState } from './useSession';
import { claimsWorkerConfig, ensureTenantClaims } from './claimsApi';

const CLAIMS = claimsWorkerConfig(import.meta.env as Record<string, string | undefined>);
// One attempt per uid per page load, so someone with no staff record does
// not loop: request claims, token changes, request again.
const claimsAttempted = new Set<string>();

function claimsToSession(user: User, claims: Record<string, unknown>): SessionContext | null {
  const tenantId = claims.tenantId as string | undefined;
  const caps = claims.caps as Capability[] | undefined;
  const geoScope = claims.geoScope as GeoScope | undefined;
  if (!tenantId || !caps || !geoScope) return null; // token not yet stamped by resolveCapabilities
  return {
    tenantId,
    uid: user.uid,
    caps,
    geoScope,
    wardScope: claims.wardScope as string | undefined,
    vdScope: claims.vdScope as string | undefined,
    mfaRequired: typeof claims.mfaRequired === 'boolean' ? claims.mfaRequired : undefined,
    mfaUntil: typeof claims.mfaUntil === 'number' ? claims.mfaUntil : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, session: null });

  useEffect(() => {
    let auth;
    try {
      auth = getFirebaseAuth();
    } catch {
      // Firebase not configured yet (no live project — see BUILD-STATUS.md).
      setState({ status: 'signed-out', user: null, session: null });
      return;
    }
    return onIdTokenChanged(auth, async (user) => {
      if (!user) {
        setState({ status: 'signed-out', user: null, session: null });
        return;
      }
      let result = await user.getIdTokenResult();
      if (CLAIMS && !result.claims.tenantId && !claimsAttempted.has(user.uid)) {
        claimsAttempted.add(user.uid);
        if (await ensureTenantClaims(user, CLAIMS)) result = await user.getIdTokenResult(true);
      }
      const session = claimsToSession(user, result.claims);
      setState({ status: 'signed-in', user, session });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
