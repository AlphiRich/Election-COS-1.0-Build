/**
 * Election Campaign OS — public site, documents and forms for parties
 * (`/for-campaigns/forms`)
 *
 * Lists the prescribed documents the Act itself names, where in the Act
 * each is required, and who issues it. It does NOT reproduce form numbers
 * or the forms: those are set in the Commission’s regulations and on its
 * documents pages, which this build could not open, and a wrong form number
 * on the eve of an election is worse than none. The Commission’s site is
 * linked for the real thing.
 */
import { SiteCard, SiteSection } from '../SiteChrome';
import { PageIntro, SourceNote } from './pageParts';
import { IEC_LINK } from '../officialSources';

const ACT = 'https://www.polity.org.za/polity/govdocs/legislation/2000/act27.pdf';

const ROWS = [
  {
    doc: 'Written proof of appointment of an agent',
    when: 'Before election day: each party may appoint two agents per voting station, and four at a separate counting venue. The agent must be a South African citizen and not a candidate.',
    ref: 's 39(1), (3), (4)',
    issuer: 'Issued by the party, in the prescribed form',
  },
  {
    doc: 'Notice of the appointment',
    when: 'Given to the presiding officer or counting officer in the prescribed manner.',
    ref: 's 39(4)(a)(ii)',
    issuer: 'Prescribed manner set by the Commission',
  },
  {
    doc: 'Identification tag',
    when: 'Worn by agents and candidates at a voting station or counting venue.',
    ref: 's 40(1)',
    issuer: 'Prescribed by the Commission',
  },
  {
    doc: 'Objection concerning voting',
    when: 'On election day, in writing, handed to the presiding officer. Used to object to a voter, a refusal of a ballot, or conduct at the station.',
    ref: 's 51(1)–(4)',
    issuer: 'Prescribed form',
  },
  {
    doc: 'Objection about verification or counting',
    when: 'In writing to the counting officer: before counting starts for verification, and before the result form is completed for sorting and counting.',
    ref: 's 59(1)–(2), s 62(1)–(2)',
    issuer: 'In writing to the counting officer',
  },
  {
    doc: 'Result of the count',
    when: 'Completed by the counting officer for each ballot at the station. Agents should be present and ask for what they are entitled to.',
    ref: 's 63(1)',
    issuer: 'Completed by the counting officer, prescribed form',
  },
];

export function SiteForms() {
  return (
    <>
      <PageIntro
        eyebrow="For Party Election Teams"
        title="Election-Day Documents and Forms"
        lead="The documents an agent needs on election day, what the Act says each is for, and where to get the official versions."
      />
      <SiteSection className="pb-8">
        <SiteCard className="flex max-w-[900px] flex-col gap-3 p-6">
          <h2 className="m-0 font-site-display text-site-h5">
            Get the Official Forms and Documents
          </h2>
          <p className="m-0 text-site-sm">
            The prescribed forms are published by the Electoral Commission. Its forms page lists a
            folder “For Parties and Candidates (Municipal Elections)” and a national and provincial
            one, and opens them by script, so this site could not list the individual forms or their
            numbers. Open the municipal folder there, or collect forms from your local Commission
            office.
          </p>
          <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
            <a href={IEC_LINK.forms} className="text-teal">
              Party and candidate forms →
            </a>
            <a href={IEC_LINK.documentLibrary} className="text-teal">
              Document library →
            </a>
            <a href={IEC_LINK.laws} className="text-teal">
              Laws and regulations →
            </a>
            <a href={IEC_LINK.partyAgents} className="text-teal">
              Party agents →
            </a>
            <a href={IEC_LINK.localOffices} className="text-teal">
              Find a local office →
            </a>
            <a href={ACT} className="text-teal">
              The Municipal Electoral Act (2000 text) →
            </a>
          </p>
          <p className="m-0 text-site-caption text-slate">
            The Commission’s Party agents page names no form numbers either: it says only that the
            party issues an appointment form and gives notice to the presiding officer. Form numbers
            are therefore not listed here.
          </p>
        </SiteCard>
      </SiteSection>
      <SiteSection labelledBy="docs-h" className="pb-8">
        <h2 id="docs-h" className="mb-4 mt-0 font-site-display text-site-h4">
          What the Act Requires, and When
        </h2>
        <div className="relative overflow-x-auto rounded-[10px] border border-line bg-white">
          <table className="w-full min-w-[760px] border-collapse text-site-sm">
            <thead>
              <tr className="bg-ink text-left text-paper">
                <th scope="col" className="px-4 py-3">
                  Document
                </th>
                <th scope="col" className="px-4 py-3">
                  What It Is For
                </th>
                <th scope="col" className="px-4 py-3">
                  Act
                </th>
                <th scope="col" className="px-4 py-3">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.doc} className="border-b border-line align-top">
                  <th scope="row" className="px-4 py-3 text-left font-semibold">
                    {r.doc}
                  </th>
                  <td className="px-4 py-3">{r.when}</td>
                  <td className="px-4 py-3 font-mono text-site-micro">{r.ref}</td>
                  <td className="px-4 py-3 text-slate">{r.issuer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SiteSection>
      <SourceNote>
        Source: Local Government: Municipal Electoral Act 27 of 2000 as published in 2000. It may
        have been amended since, and the Commission’s current regulations govern the forms. This is
        not legal advice.
      </SourceNote>
    </>
  );
}
