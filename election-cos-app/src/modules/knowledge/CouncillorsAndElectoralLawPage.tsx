/**
 * Election Campaign OS — Councillors and the law of a municipal election
 * A static reference page, like the Gatherings advisory: it explains how a
 * South African municipal council is made up, how its seats are allocated,
 * how long it sits, and the code its members are bound by — anchored to the
 * Acts by name and number. Every statutory claim here is one that could be
 * checked against the consolidated Act; nothing is invented. Where the exact
 * sub-section is not stated below, that is deliberate: the Act is named so a
 * reader can find it, rather than a number asserted that might be wrong.
 *
 * Capability requirement: `always` (see routes.tsx) — this is public civics,
 * not tenant data.
 */
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';

export function CouncillorsAndElectoralLawPage() {
  return (
    <Card className="max-w-3xl">
      <PageHeader
        slug="/knowledge/councillors-and-electoral-law"
        title="Councillors and the Law of a Municipal Election"
      />

      <div className="mt-4 space-y-4 text-body-md font-body leading-relaxed text-ink">
        <p>
          A South African municipal council is elected under the{' '}
          <strong>Local Government: Municipal Electoral Act 27 of 2000</strong> — the Act that governs
          the conduct of a local government election, distinct from the Electoral Act 73 of 1998 that
          governs national and provincial elections. The 2026 local government election is run under it.
        </p>

        <h2 className="font-display text-headline-md pt-2">How a Council Is Made Up</h2>
        <p>
          Under the <strong>Local Government: Municipal Structures Act 117 of 1998</strong>, the council
          of a metro or a local municipality is made up of two kinds of councillor in roughly equal
          number:
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li>
            <strong>Ward councillors</strong>, each elected by the voters of one ward on the ward
            ballot — a first-past-the-post contest in that ward alone.
          </li>
          <li>
            <strong>Proportional-representation (PR) councillors</strong>, elected from party lists on
            the proportional ballot, so that each party&rsquo;s total share of the council reflects its
            share of the vote.
          </li>
        </ul>
        <p>
          The number of PR seats is the council size minus the number of wards — a figure the platform
          derives rather than stores, so a PR list of the wrong length cannot be entered. You can see
          the split for any council in{' '}
          <Link to="/analytics/voter-intelligence" className="underline">
            Voter Intelligence
          </Link>
          .
        </p>

        <h2 className="font-display text-headline-md pt-2">How the Seats Are Allocated</h2>
        <p>
          PR seats are allocated by the quota method in <strong>Schedule 1 to the Municipal Structures
          Act</strong>. The quota of votes per seat is the total valid votes divided by one more than
          the number of seats, plus one (Item 12), and seats are awarded by that quota with the largest
          remainders taking the seats left over. The platform computes this exactly — reconciled against
          the Commission&rsquo;s own published seat calculation — in the{' '}
          <Link to="/analytics/seat-calculator" className="underline">
            Vote Calculator
          </Link>
          .
        </p>

        <h2 className="font-display text-headline-md pt-2">How Long a Council Sits</h2>
        <p>
          A municipal council is elected for a term of <strong>five years</strong> (Constitution section
          159; Municipal Structures Act). An election must be held within 90 days of the term expiring,
          and a councillor holds office until the day before the next election&rsquo;s voting day.
        </p>

        <h2 className="font-display text-headline-md pt-2">The Code a Councillor Is Bound By</h2>
        <p>
          Every member of a municipal council is bound by the{' '}
          <strong>Code of Conduct for Councillors</strong>. Since the{' '}
          <strong>Local Government: Municipal Structures Amendment Act 3 of 2021</strong> (effective{' '}
          <strong>1 November 2021</strong>), that Code is{' '}
          <strong>Schedule 7 to the Municipal Structures Act</strong> — it was moved there from the
          Municipal Systems Act, where a separate Code of Conduct for Municipal Staff Members remains.
          The Code covers attendance, declaration and management of conflicts of interest, the handling
          of privileged information, and the consequences of a breach, up to removal from office.
        </p>

        <p className="text-body-sm text-slate pt-2">
          Basis: Local Government: Municipal Electoral Act 27 of 2000; Local Government: Municipal
          Structures Act 117 of 1998, including Schedule 1 (seat allocation) and Schedule 7 (Code of
          Conduct for Councillors, inserted by section 36 of the Municipal Structures Amendment Act 3 of
          2021, with effect from 1 November 2021); Constitution of the Republic of South Africa, 1996,
          section 159. This page is general information for campaign staff, not legal advice; check the
          consolidated Act for the current text before relying on a specific provision.
        </p>
      </div>
    </Card>
  );
}
