/**
 * Election Campaign OS — the roll at the door
 * Module `voter-verification`. Capabilities: `roll.view` to read the
 * roll for your own district, `roll.capture` to verify and capture.
 *
 * Reads the people the certified roll lists at an address in the
 * caller's own ward + voting district (the token narrows the query, the
 * rules refuse anything wider), lets the canvasser confirm a person lives
 * there, and — only if that person consents aloud and the canvasser names
 * them back — records them. Rules for all of it are in `rollCapture.ts`.
 *
 * Every verification and capture is one counted instance; the screen says
 * so before the canvasser presses anything, and shows the day's tally.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dal } from "@/dal";
import { useSession } from "@/auth/useSession";
import { useEntitlements } from "@/auth/useEntitlements";
import { resolveAccess } from "@/auth/entitlements";
import type { RollAddress, RollEntry } from "@/dal/ports/roll";
import {
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  StatTile,
} from "@/components/ui";
import {
  CaptureRefused,
  buildCapture,
  buildVerification,
  findAddresses,
  spokenName,
  summariseUsage,
} from "./rollCapture";

const SHOWN = 40;

export function RollFieldPage() {
  const session = useSession();
  const { entitlements } = useEntitlements();
  const qc = useQueryClient();
  const [fragment, setFragment] = useState("");
  const [selected, setSelected] = useState<RollAddress | null>(null);

  const access = session
    ? resolveAccess(session.caps, entitlements ?? [], "roll.view")
    : null;
  // `undefined` entitlements = still loading or failed: the rules decide.
  const allowed =
    session &&
    (entitlements === undefined
      ? session.caps.includes("roll.view")
      : access?.allowed);

  const edition = useQuery({
    queryKey: ["roll-edition", session?.tenantId],
    queryFn: () => dal.roll.activeEdition(session!),
    enabled: Boolean(allowed),
  });
  const addresses = useQuery({
    queryKey: [
      "roll-addresses",
      session?.tenantId,
      edition.data,
      session?.wardScope,
      session?.vdScope,
    ],
    queryFn: () => dal.roll.listAddresses(session!, edition.data!),
    enabled: Boolean(allowed && edition.data),
  });
  const usage = useQuery({
    queryKey: [
      "roll-usage",
      session?.tenantId,
      session?.wardScope,
      session?.vdScope,
    ],
    queryFn: () => dal.roll.listUsage(session!),
    enabled: Boolean(allowed),
  });

  const stats = useMemo(() => summariseUsage(usage.data ?? []), [usage.data]);
  const shown = useMemo(
    () => findAddresses(addresses.data ?? [], fragment).slice(0, SHOWN),
    [addresses.data, fragment],
  );

  if (!session) return null;
  if (!allowed) {
    return (
      <Card className="max-w-lg">
        <PageHeader slug="/roll" title="Voters’ roll" />
        <p className="text-body-md font-body">
          {access?.reason || "Your role does not include the voters’ roll."}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader slug="/roll" title="Voters’ roll" action={undefined} />
      <p className="text-body-md font-body max-w-prose">
        You see only the roll for your own district. Each person you{" "}
        <strong>confirm</strong> and each person you <strong>record</strong> is
        counted once for your party’s usage. Nobody is recorded unless they
        agree out loud.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Confirmed today" value={stats.verify} />
        <StatTile label="Recorded with consent" value={stats.capture} />
        <StatTile
          label="Consent rate"
          value={
            stats.captureRate === null
              ? "—"
              : `${Math.round(stats.captureRate * 100)}%`
          }
        />
      </div>

      {edition.isSuccess && !edition.data && (
        <EmptyState title="No roll loaded">
          The roll for your district has not been loaded yet. Ask your campaign
          administrator.
        </EmptyState>
      )}

      {edition.data && !selected && (
        <>
          <div className="max-w-md">
            <Field label="Find an address">
              {(props) => (
                <input
                  {...props}
                  placeholder="Street or stand number"
                  value={fragment}
                  onChange={(e) => setFragment(e.target.value)}
                />
              )}
            </Field>
          </div>
          {addresses.isError && (
            <p className="text-body-md font-body text-maroon">
              Could not load the roll. If you are not assigned to a district
              yet, that refusal is the permission model working.
            </p>
          )}
          <ul className="space-y-2">
            {shown.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="w-full min-h-11 text-left rounded border border-ink/20 px-4 py-2 font-body"
                  onClick={() => setSelected(a)}
                >
                  {a.addressRaw}{" "}
                  <span className="text-ink/60">
                    · {a.voterCount} on the roll
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {(addresses.data?.length ?? 0) > SHOWN && (
            <p className="text-body-md font-body text-ink/70">
              Showing the first {SHOWN}. Type more of the address to narrow it.
            </p>
          )}
        </>
      )}

      {edition.data && selected && (
        <AddressPanel
          edition={edition.data}
          address={selected}
          canCapture={session.caps.includes("roll.capture")}
          onBack={() => setSelected(null)}
          onCounted={() => qc.invalidateQueries({ queryKey: ["roll-usage"] })}
        />
      )}
    </div>
  );
}

function AddressPanel({
  edition,
  address,
  canCapture,
  onBack,
  onCounted,
}: {
  edition: string;
  address: RollAddress;
  canCapture: boolean;
  onBack: () => void;
  onCounted: () => void;
}) {
  const session = useSession()!;
  const entries = useQuery({
    queryKey: ["roll-entries", session.tenantId, edition, address.id],
    queryFn: () => dal.roll.listEntriesAtAddress(session, edition, address.id),
  });
  return (
    <div className="space-y-3">
      <Button variant="ghost" onClick={onBack}>
        ← Back to addresses
      </Button>
      <Card>
        <p className="font-display">{address.addressRaw}</p>
      </Card>
      {entries.isLoading && <p className="font-body">Loading…</p>}
      {entries.data?.map((e) => (
        <PersonCard
          key={e.id}
          entry={e}
          address={address}
          canCapture={canCapture}
          onCounted={onCounted}
        />
      ))}
    </div>
  );
}

type Step = "LISTED" | "CONFIRMED" | "RECORDED" | "DECLINED";

function PersonCard({
  entry,
  address,
  canCapture,
  onCounted,
}: {
  entry: RollEntry;
  address: RollAddress;
  canCapture: boolean;
  onCounted: () => void;
}) {
  const session = useSession()!;
  const [step, setStep] = useState<Step>("LISTED");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: () =>
      dal.roll.recordVerification(
        session,
        buildVerification(session, entry, new Date()),
      ),
    onSuccess: () => {
      setStep("CONFIRMED");
      onCounted();
    },
    onError: (e) =>
      setError(e instanceof Error ? e.message : "Could not save."),
  });
  const capture = useMutation({
    mutationFn: () =>
      dal.roll.captureWithConsent(
        session,
        buildCapture(
          session,
          entry,
          address,
          { consentGiven: consent, confirmedName: name },
          new Date(),
        ),
      ),
    onSuccess: () => {
      setStep("RECORDED");
      onCounted();
    },
    onError: (e) =>
      setError(
        e instanceof CaptureRefused
          ? e.message
          : "Could not save. Nothing was recorded.",
      ),
  });

  return (
    <Card>
      <p className="font-display">{spokenName(entry)}</p>
      <p className="font-mono text-body-md text-ink/70">
        {entry.idNumberMasked}
      </p>

      {step === "LISTED" && canCapture && (
        <>
          <p className="text-body-md font-body my-2">
            Is this person here? Confirming counts as one verification.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
              Yes, lives here
            </Button>
            <Button variant="ghost" onClick={() => setStep("DECLINED")}>
              Not here
            </Button>
          </div>
        </>
      )}

      {step === "CONFIRMED" && (
        <div className="space-y-2 mt-2">
          <p className="text-body-md font-body">
            Ask: “May we record you as a supporter and contact you about the
            campaign?” If the answer is no, press “No” — nothing is saved.
          </p>
          <label className="flex items-center gap-2 font-body min-h-11">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            They said yes, out loud
          </label>
          <Field
            label={`Type their name to confirm it was them (${spokenName(entry)})`}
          >
            {(props) => (
              <input
                {...props}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            )}
          </Field>
          {error && <p className="text-maroon font-body">{error}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => capture.mutate()}
              disabled={capture.isPending || !consent || !name.trim()}
            >
              Record with consent
            </Button>
            <Button variant="ghost" onClick={() => setStep("DECLINED")}>
              No
            </Button>
          </div>
        </div>
      )}

      {step === "RECORDED" && (
        <p className="font-body text-ink mt-2">Recorded. Thank you.</p>
      )}
      {step === "DECLINED" && (
        <p className="font-body text-ink/70 mt-2">Nothing recorded.</p>
      )}
      {step === "LISTED" && !canCapture && (
        <p className="font-body text-ink/70 mt-2">
          Your role can read the roll but not record people.
        </p>
      )}
    </Card>
  );
}
