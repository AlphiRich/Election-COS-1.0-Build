/**
 * Election Campaign OS — voter accounts, Firebase wiring
 *
 * The decisions are in `src/site/account/voterAccountModel.ts`; this file only calls Firebase Authentication. It lives
 * under `src/auth/` because that is where the Firebase SDK may be imported (ESLint boundary), and it reuses the app's one
 * Firebase app (`dal/adapters/firestore/client.ts`), so there is still exactly one `initializeApp`.
 *
 * The site loads this file lazily, only on the account pages, so no page without an account form pulls in Firebase.
 *
 * SMS CODES. Sent by Firebase Authentication (Identity Platform SMS multi-factor), behind an invisible reCAPTCHA, which is
 * Firebase's own abuse protection for phone codes. No other SMS provider is involved.
 *
 * THE VERIFICATION EMAIL is Firebase's, sent from the address set in the Firebase console's email templates. Making that
 * noreply@electioncos.co.za is a console step (custom sender domain with DNS records); this code cannot set the sender.
 */
import {
  type MultiFactorResolver,
  type User,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  deleteUser,
  getMultiFactorResolver,
  multiFactor,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type MultiFactorError,
} from 'firebase/auth';
import { firebaseConfigured, getFirebaseAuth } from '@/dal/adapters/firestore/client';
import { VERIFY_RETURN_PATH } from '@/site/account/voterAccountModel';

export interface VoterUser {
  email: string;
  emailVerified: boolean;
  phoneFactors: number;
  /** The enrolled phone as Firebase reports it (already masked by Firebase, e.g. +********7310). */
  phoneHint: string | null;
}

export const voterAccountsAvailable = (): boolean => firebaseConfigured();

const toVoter = (u: User | null): VoterUser | null => {
  if (!u) return null;
  const factors = multiFactor(u).enrolledFactors.filter((f) => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
  const hint = factors[0] as { phoneNumber?: string } | undefined;
  return { email: u.email ?? '', emailVerified: u.emailVerified, phoneFactors: factors.length, phoneHint: hint?.phoneNumber ?? null };
};

export function watchVoter(cb: (u: VoterUser | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), (u) => cb(toVoter(u)));
}

const returnUrl = () => `${window.location.origin}${VERIFY_RETURN_PATH}`;

/** Creates the account and sends the verification email. */
export async function registerVoter(email: string, password: string): Promise<void> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  await sendEmailVerification(cred.user, { url: returnUrl() });
}

export async function resendVerification(): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (u && !u.emailVerified) await sendEmailVerification(u, { url: returnUrl() });
}

/** Re-reads the user, so a verification done in another tab or on the phone's mail app shows here. */
export async function refreshVoter(): Promise<VoterUser | null> {
  const u = getFirebaseAuth().currentUser;
  if (!u) return null;
  await reload(u);
  return toVoter(getFirebaseAuth().currentUser);
}

let verifier: RecaptchaVerifier | null = null;
function recaptcha(containerId: string): RecaptchaVerifier {
  verifier?.clear();
  verifier = new RecaptchaVerifier(getFirebaseAuth(), containerId, { size: 'invisible' });
  return verifier;
}

/** Step 3: sends an SMS code to the phone being added. Returns the id the code is checked against. */
export async function startPhoneEnrolment(e164: string, recaptchaContainerId: string): Promise<string> {
  const u = getFirebaseAuth().currentUser;
  if (!u) throw Object.assign(new Error('signed out'), { code: 'auth/requires-recent-login' });
  const session = await multiFactor(u).getSession();
  return new PhoneAuthProvider(getFirebaseAuth()).verifyPhoneNumber({ phoneNumber: e164, session }, recaptcha(recaptchaContainerId));
}

export async function finishPhoneEnrolment(verificationId: string, code: string): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (!u) throw Object.assign(new Error('signed out'), { code: 'auth/requires-recent-login' });
  const assertion = PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(verificationId, code.trim()));
  await multiFactor(u).enroll(assertion, 'Cellphone');
}

export type SignInResult = { kind: 'signed-in' } | { kind: 'needs-code'; phoneHint: string };

let pending: MultiFactorResolver | null = null;

/** Step 4, first half: email and password. A voter with a phone then needs the SMS code. */
export async function signInVoter(email: string, password: string): Promise<SignInResult> {
  try {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    return { kind: 'signed-in' };
  } catch (e) {
    if ((e as { code?: string }).code !== 'auth/multi-factor-auth-required') throw e;
    pending = getMultiFactorResolver(getFirebaseAuth(), e as MultiFactorError);
    const hint = pending.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID) as { phoneNumber?: string } | undefined;
    return { kind: 'needs-code', phoneHint: hint?.phoneNumber ?? 'your cellphone' };
  }
}

/** Step 4, second half: sends the SMS code for the sign-in in progress. */
export async function sendSignInCode(recaptchaContainerId: string): Promise<string> {
  if (!pending) throw Object.assign(new Error('no sign-in in progress'), { code: 'auth/code-expired' });
  const hint = pending.hints.find((h) => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID);
  if (!hint) throw Object.assign(new Error('no phone on the account'), { code: 'auth/invalid-phone-number' });
  return new PhoneAuthProvider(getFirebaseAuth()).verifyPhoneNumber(
    { multiFactorHint: hint, session: pending.session },
    recaptcha(recaptchaContainerId),
  );
}

export async function finishSignIn(verificationId: string, code: string): Promise<void> {
  if (!pending) throw Object.assign(new Error('no sign-in in progress'), { code: 'auth/code-expired' });
  await pending.resolveSignIn(PhoneMultiFactorGenerator.assertion(PhoneAuthProvider.credential(verificationId, code.trim())));
  pending = null;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim(), { url: `${window.location.origin}/account/sign-in` });
}

export async function signOutVoter(): Promise<void> {
  pending = null;
  await signOut(getFirebaseAuth());
}

/** POPIA: the voter can remove the account and everything Firebase holds for it. */
export async function deleteVoterAccount(): Promise<void> {
  const u = getFirebaseAuth().currentUser;
  if (u) await deleteUser(u);
}
