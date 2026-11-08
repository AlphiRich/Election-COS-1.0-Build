/**
 * Election Campaign OS — second sign-in step (SMS code).
 *
 * Shown after email sign-in to every role above the volunteer / canvasser, until the code is
 * entered. The server (firestore.rules `mfaOK()`) is what actually withholds data; this screen is
 * how a legitimate person gets past it. The number is never shown in full: the server returns a
 * mask of the one on the staff profile, and the person cannot pick a different destination.
 */
import { useState } from 'react';
import { Button, Card, DataLine, Field } from '@/components/ui';
import { NAV_FOOTER_LINE } from '@/lib/legalText';
import { firebaseGateway, type SecondFactorGateway } from './secondFactor';
import { signOut } from './firebaseAuth';

export function SecondFactorStep({
  email,
  gateway = firebaseGateway,
  onSignOut = () => void signOut(),
}: {
  email?: string | null;
  gateway?: SecondFactorGateway;
  onSignOut?: () => void;
}) {
  const [challenge, setChallenge] = useState<{ id: string; masked: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await gateway.request();
    setBusy(false);
    if (r.ok) {
      setChallenge({ id: r.challengeId, masked: r.phoneMasked });
      setCode('');
    } else setError(r.message);
  }

  async function check() {
    if (!challenge) return;
    setBusy(true);
    setError(null);
    const r = await gateway.verify(challenge.id, code);
    setBusy(false);
    if (!r.ok) setError(r.message); // on success the token refresh re-renders the Shell past this screen
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <Card className="w-full max-w-sm space-y-5 p-8">
        <div>
          <h1 className="text-headline-md font-display text-ink">Verify it&rsquo;s you</h1>
          <p className="text-body-md font-body text-slate mt-2">
            {email ? `${email} is signed in. ` : ''}Your role needs a second step: a 6-digit code sent by SMS
            to the mobile number on your staff profile.
          </p>
        </div>

        {!challenge ? (
          <Button className="w-full" disabled={busy} onClick={() => void send()}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <p className="text-body-md font-body text-slate">
              Code sent to <span className="font-mono text-data-mono text-ink">{challenge.masked}</span>. It is valid
              for 5 minutes.
            </p>
            <Field label="6-digit code" mono>
              {(props) => (
                <input
                  {...props}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              )}
            </Field>
            <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? 'Checking…' : 'Verify and continue'}
            </Button>
            <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void send()}>
              Send a new code
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-body-md font-body text-maroon">
            {error}
          </p>
        )}

        <Button variant="ghost" onClick={onSignOut}>
          Sign out
        </Button>
        <DataLine className="text-center text-slate/60">{NAV_FOOTER_LINE}</DataLine>
      </Card>
    </div>
  );
}
