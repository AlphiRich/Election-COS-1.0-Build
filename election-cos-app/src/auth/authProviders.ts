/**
 * Election Campaign OS — sign-in providers.
 *
 * Which providers are OFFERED is configuration, not code: `VITE_AUTH_PROVIDERS` is a comma list
 * (default "google"). A provider's button appears only when the owner has listed it, because a
 * provider must first be switched on in the Firebase console (with the provider's own app id and
 * secret); a button for one that is not enabled would only fail. Enabling a provider is a console
 * action this code cannot perform.
 *
 * WHAT A SECOND PROVIDER DOES AND DOES NOT CHANGE
 *  - Access is still granted by an administrator assigning a role to a Firebase user id
 *    (functions/src/resolveCapabilities.ts). A sign-in method confers nothing by itself.
 *  - The same person signing in with a different provider is a DIFFERENT user id unless the
 *    accounts are linked, so they would need their own assignment. Linking is deliberately not
 *    automatic here: auto-linking by email lets anyone who controls an unverified email at one
 *    provider take over the account at another. Firebase refuses the sign-in
 *    (`auth/account-exists-with-different-credential`) and we tell the person to use the method
 *    they used before.
 *  - Scopes are the minimum each provider needs to identify an account (email); no friends list,
 *    profile fields, or other data is requested. Name and photo that a provider volunteers are
 *    scrubbed from the Auth record straight after sign-in (firebaseAuth.ts).
 */
export const PROVIDER_IDS = ['google', 'facebook', 'microsoft', 'apple'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  google: 'Google',
  facebook: 'Meta (Facebook)',
  microsoft: 'Microsoft',
  apple: 'Apple',
};

/** Scopes requested, per provider. Email only; never a broader profile. */
export const PROVIDER_SCOPES: Record<ProviderId, string[]> = {
  google: [],
  facebook: ['email'],
  microsoft: ['email'],
  apple: ['email'],
};

/** Parses VITE_AUTH_PROVIDERS. Unknown names are ignored; empty or missing means Google only. */
export function enabledProviders(raw: string | undefined): ProviderId[] {
  const wanted = (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderId => (PROVIDER_IDS as readonly string[]).includes(s));
  return wanted.length ? [...new Set(wanted)] : ['google'];
}

/** A short, honest message for the sign-in failures a person can act on. Null = say nothing. */
export function signInErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists under a different sign-in method. Sign in the way you did before. Ask an administrator if you need the two joined.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method has not been switched on for this site yet.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This address is not authorised for sign-in yet. Tell your administrator.';
    default:
      return 'Sign-in failed. Try again, or contact your administrator if this keeps happening.';
  }
}

/** Email-link sign-in is opt-in like the providers: it must first be switched on in the Firebase console. */
export function emailLinkEnabled(raw: string | undefined): boolean {
  return (raw ?? '').trim().toLowerCase() === 'true';
}
