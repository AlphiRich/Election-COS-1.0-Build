/**
 * Election Campaign OS — sign-in
 * IC-ECOS-BUILD-2026-V2 §4.3. Session 10 — the app never had a sign-in UI
 * at all before this; every module page just showed "No active session"
 * and there was no way to actually reach a signed-in state. Google
 * Sign-in only (email/password functions exist in firebaseAuth.ts but
 * aren't exposed here — Google was the human's explicit ask).
 *
 * THE EMULATOR BLOCK (session 38)
 *
 * `signInWithPopup` loads apis.google.com, which no emulator can stand in
 * for. That made the whole application unreachable locally: there was no
 * way to get past this screen without a live Google OAuth round trip, so
 * in thirty-seven sessions nobody had ever seen a signed-in screen of
 * this product running.
 *
 * So when — and only when — the app is pointed at the local emulator
 * suite, this screen also offers email sign-in, using the
 * `signUpWithEmail`/`signInWithEmail` functions that have been in
 * `firebaseAuth.ts` and tested since session 3 but were never exposed.
 *
 * `usingEmulators()` returns false in any production build by
 * construction (it checks `import.meta.env.PROD` first), so this block
 * cannot ship. `signInPage.test.ts` asserts that.
 */
import { useState } from 'react';
import { useEffect } from 'react';
import {
  completeEmailLink,
  openedFromEmailLink,
  rememberedEmail,
  sendEmailLink,
  signInWithEmail,
  signInWithProvider,
  signUpWithEmail,
} from './firebaseAuth';
import {
  PROVIDER_LABEL,
  emailLinkEnabled,
  enabledProviders,
  signInErrorMessage,
  type ProviderId,
} from './authProviders';
import { GoogleIcon } from './GoogleIcon';
import { usingEmulators } from '@/dal/adapters/firestore/client';
import { Button, DataLine, Field } from '@/components/ui';
import { NAV_FOOTER_LINE, PRODUCT_NAME } from '@/lib/legalText';

const PROVIDERS = enabledProviders(import.meta.env.VITE_AUTH_PROVIDERS as string | undefined);
const EMAIL_LINK = emailLinkEnabled(import.meta.env.VITE_AUTH_EMAIL_LINK as string | undefined);

export function SignInPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  // Opened from the emailed link: finish on this browser, asking for the email only if it was not remembered.
  const [returning] = useState(() => EMAIL_LINK && openedFromEmailLink());

  async function handleSendLink() {
    setPending(true);
    setError(null);
    try {
      await sendEmailLink(linkEmail.trim());
      setLinkSent(true);
    } catch {
      setError('The sign-in link could not be sent. Check the address and try again.');
    }
    setPending(false);
  }

  async function handleCompleteLink(address: string) {
    setPending(true);
    setError(null);
    try {
      await completeEmailLink(address.trim());
    } catch {
      setPending(false);
      setError('That sign-in link is not valid any more. Request a new one.');
    }
  }

  useEffect(() => {
    const remembered = returning ? rememberedEmail() : null;
    if (remembered) void handleCompleteLink(remembered);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival from the link
  }, []);

  async function handleEmulatorSignIn() {
    setPending(true);
    setError(null);
    try {
      // Sign in if the account exists, create it if it does not. Against
      // an emulator whose state is thrown away on restart, making the
      // developer register first is friction with no benefit.
      try {
        await signInWithEmail({ email, password });
      } catch {
        await signUpWithEmail({ email, password });
      }
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : 'Emulator sign-in failed.');
    }
  }

  async function handleSignIn(provider: ProviderId) {
    setPending(true);
    setError(null);
    try {
      await signInWithProvider(provider);
      // onIdTokenChanged in AuthProvider.tsx picks up the new user; no
      // navigation needed here.
    } catch (err) {
      setPending(false);
      if (err instanceof Error && err.message.includes('Firebase is not configured')) {
        setError('Firebase is not configured for this environment yet — see BUILD-STATUS.md.');
        return;
      }
      setError(signInErrorMessage((err as { code?: string })?.code));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white border border-ink/10 rounded-lg p-8 space-y-6">
        <div>
          {/* IC-ECOS-NAMING-2026-V1 §2.3 fixes this header string exactly. */}
          <h1 className="text-headline-md font-display text-ink">Sign in to {PRODUCT_NAME}</h1>
          <p className="text-body-md font-body text-slate mt-2">
            Choose how you sign in. Use the same method each time. Every role above canvasser then
            confirms with a code sent by SMS to the mobile number on its staff profile.
          </p>
        </div>

        <div className="space-y-3">
          {PROVIDERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => void handleSignIn(id)}
              disabled={pending}
              className="w-full min-h-11 flex items-center justify-center gap-3 border border-ink/20 rounded py-2.5 text-body-md font-body text-ink disabled:opacity-50"
            >
              {id === 'google' && <GoogleIcon />}
              {pending ? 'Signing in…' : `Sign in with ${PROVIDER_LABEL[id]}`}
            </button>
          ))}
        </div>

        {EMAIL_LINK && (
          <div className="border-t border-ink/10 pt-5 space-y-3">
            <p className="text-label-caps font-display uppercase text-slate">Email link</p>
            {linkSent ? (
              <p role="status" className="text-body-md font-body text-ink">
                Check your inbox. We sent a sign-in link to {linkEmail}. Open it on this device.
              </p>
            ) : (
              <>
                <Field label={returning ? 'Confirm your email' : 'Email'}>
                  {(props) => (
                    <input
                      {...props}
                      type="email"
                      autoComplete="email"
                      value={linkEmail}
                      onChange={(e) => setLinkEmail(e.target.value)}
                    />
                  )}
                </Field>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={pending || linkEmail.trim() === ''}
                  onClick={() => void (returning ? handleCompleteLink(linkEmail) : handleSendLink())}
                >
                  {returning ? 'Finish signing in' : 'Send sign-in link'}
                </Button>
              </>
            )}
          </div>
        )}

        {error && <p role="alert" className="text-body-md font-body text-maroon">{error}</p>}

        <p className="text-body-md font-body text-slate">
          Signing in doesn't grant access on its own — an administrator still has to assign you a
          role and geographic scope in Settings → Permissions before you can see any data (§4.4).
        </p>

        {usingEmulators() && (
          <div className="border-t border-ink/10 pt-5 space-y-3">
            <p className="text-label-caps font-display uppercase text-gold">Local emulator</p>
            <p className="text-body-md font-body text-slate">
              This build is pointed at the local Firebase emulator suite, so Google sign-in is
              unavailable. Use any email and password; the account is created on first use and
              discarded when the emulator stops.
            </p>
            <Field label="Email">
              {(props) => (
                <input
                  {...props}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>
            <Field label="Password">
              {(props) => (
                <input
                  {...props}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Button
              variant="secondary"
              className="w-full"
              disabled={pending || email.trim() === '' || password === ''}
              onClick={() => void handleEmulatorSignIn()}
            >
              {pending ? 'Signing in…' : 'Sign in to emulator'}
            </Button>
          </div>
        )}

        {/* Same line, same treatment as the nav footer in Shell.tsx — it
            is the one piece of copy that appears in both places. */}
        <DataLine className="text-center text-slate/60">{NAV_FOOTER_LINE}</DataLine>
      </div>
    </div>
  );
}
