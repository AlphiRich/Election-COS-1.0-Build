/**
 * Election Campaign OS — voter accounts on electioncos.co.za (pure parts)
 *
 * OWNER DECISION, 18 Nov 2026: voters may register with an email address and a password; the account is confirmed by a
 * verification email from noreply@electioncos.co.za; every later sign-in also asks for a one-time code sent by SMS to the
 * voter's cellphone. Accounts live on the PUBLIC SITE, for results, the coalition tools, My Ward and surveys. They give no
 * access to the campaign application: no role or tenant is ever assigned to a voter account, and `firestore.rules` refuses
 * every tenant read to a token without one.
 *
 * The flow is Firebase Authentication end to end (wiring: `src/auth/voterAccount.ts`):
 *   1. register: email + password + consent -> account created, verification email sent;
 *   2. verify: the voter opens the link; Firebase marks the email verified;
 *   3. add phone: an SMS code enrols the cellphone as the second sign-in step (Firebase requires a verified email first);
 *   4. sign in later: email + password, then the SMS code.
 *
 * What is stored, and where: the email, a password hash and the cellphone number, in Firebase Authentication (Google, not
 * africa-south1; the privacy notice says so, as it already does for staff sign-in). Nothing about a voter is written to the
 * campaign database.
 */

/** Bumped whenever the consent wording below materially changes. */
export const ACCOUNT_CONSENT_VERSION = '[V1.0]';

export const ACCOUNT_CONSENT_TEXT =
  'I agree that Election-COS may keep my email address and cellphone number to run my voter account: to verify my email, ' +
  'to send sign-in codes to my phone, and to let me use the results, coalition tools and surveys. They are not used for ' +
  'marketing or shared with any party or candidate. I can delete the account at any time.';

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

const COMMON = new Set(['password', 'password1', 'password123', '1234567890', '0123456789', 'qwertyuiop', 'electioncos', 'letmein123']);

/** Reasons a password is refused, in plain words. Empty when it is acceptable. */
export function passwordProblems(password: string, email = ''): string[] {
  const out: string[] = [];
  if (password.length < MIN_PASSWORD) out.push(`Use at least ${MIN_PASSWORD} characters.`);
  if (password.length > MAX_PASSWORD) out.push(`Use at most ${MAX_PASSWORD} characters.`);
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) out.push('Use at least one letter and one number.');
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && password.toLowerCase().includes(local)) out.push('Do not use your email address in the password.');
  if (COMMON.has(password.toLowerCase())) out.push('That password is too common.');
  return out;
}

export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * A South African cellphone number in international form (`+27821234567`), or null when it is not one. Accepts `082 123
 * 4567`, `0821234567`, `27821234567` and `+27 82 123 4567`. Mobile ranges start 6, 7 or 8 after the 0.
 */
export function normaliseSaMobile(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  let national: string | null = null;
  if (/^\+27\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^27\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  if (!national || !/^[678]\d{8}$/.test(national)) return null;
  return `+27${national}`;
}

/** `+27821234567` -> `082 *** 4567`, for showing which phone a code went to. */
export function maskPhone(e164: string): string {
  const m = e164.match(/^\+27(\d{2})\d{3}(\d{4})$/);
  return m ? `0${m[1]} *** ${m[2]}` : 'your cellphone';
}

export type AccountStep = 'signed-out' | 'verify-email' | 'add-phone' | 'ready';

/** Where a voter is in the flow, from what Firebase reports about the signed-in user. */
export function accountStep(user: { emailVerified: boolean; phoneFactors: number } | null): AccountStep {
  if (!user) return 'signed-out';
  if (!user.emailVerified) return 'verify-email';
  if (user.phoneFactors === 0) return 'add-phone';
  return 'ready';
}

/** Firebase Auth error codes, said plainly. Unknown codes get a generic line, never the raw code. */
export function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account already uses this email. Sign in instead, or reset the password.';
    case 'auth/invalid-email':
      return 'That email address does not look right.';
    case 'auth/weak-password':
      return 'Choose a stronger password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'The email or password is not right.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is not right. Check the SMS and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Ask for a new one.';
    case 'auth/invalid-phone-number':
      return 'That cellphone number does not look right.';
    case 'auth/requires-recent-login':
      return 'For your safety, sign in again and then repeat this step.';
    case 'auth/unverified-email':
      return 'Verify your email address first. Check your inbox for the link.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'Voter accounts are not switched on yet. Please try again later.';
    case 'auth/network-request-failed':
      return 'No connection. Check your signal and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/** Where the verification email's link returns the voter to. */
export const VERIFY_RETURN_PATH = '/account?verified=1';
