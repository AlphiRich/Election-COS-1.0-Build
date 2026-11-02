/**
 * Election Campaign OS — the 60-second tour, as a page
 *
 * A NotebookLM outline (and two screenshots of an earlier landing build)
 * proposed a 60-second video with six chapters. No video exists, and this
 * build cannot record one, so the tour is a chapter-by-chapter page that can
 * also be read aloud as the script. Each chapter says only what this
 * software does.
 *
 * WHAT THE OUTLINE CLAIMED THAT IS NOT HERE, AND WHY
 *   - Card scanning "under 1.8 seconds" with AI OCR: there is no scanner.
 *   - "Predictive seat forecasting" and "Droop/Hare quotas": the calculator
 *     applies Schedule 1 to numbers the user enters; it forecasts nothing,
 *     and the statutory quota is not a Droop quota.
 *   - The R100,000 disclosure limit: superseded; the line is R200,000 and the
 *     annual cap R30 million (Government Gazette 53182), under court challenge.
 *   - A "CampaignToken wallet": not part of this build.
 *   - "POPIA §4.3": the section reference cannot be verified here.
 *   - The screenshots' sandbox log-ins, named personas, "412 active
 *     canvassers", "3,842 votes per seat" and a ward map of invented
 *     strongholds. Any figure on this page that is not a fact about the law
 *     is labelled as an invented example.
 */
import { SEED_ROLES } from '@/auth/seedRoles';

export interface TryIt {
  label: string;
  href: string;
}

export interface Chapter {
  id: string;
  /** Seconds into the tour. */
  start: number;
  end: number;
  title: string;
  lead: string;
  points: string[];
  tryIt?: TryIt;
}

const SCOPE_WORDS: Record<string, string> = {
  TENANT: 'the whole campaign',
  MUNICIPALITY: 'one municipality',
  WARD: 'one ward',
  VD: 'one voting district',
};

export const ROLE_LINES = SEED_ROLES.map((r) => ({
  label: r.label,
  sees: SCOPE_WORDS[r.geoScope] ?? r.geoScope,
}));

export const TOUR_SECONDS = 60;

export const CHAPTERS: Chapter[] = [
  {
    id: 'roles',
    start: 0,
    end: 10,
    title: 'Seven roles. Each sees only its own ground.',
    lead: 'A person signs in and the software knows their role and their place on the map. It shows them that, and refuses the rest.',
    points: [
      ...ROLE_LINES.map((r) => `${r.label}: ${r.sees}`),
      'The refusal is made by the database rules, not only by the screen. A hidden button is not a lock.',
    ],
  },
  {
    id: 'command',
    start: 10,
    end: 20,
    title: 'One view of the campaign.',
    lead: 'The command view reads running totals the software keeps as work happens, so it does not rescan every record to draw a screen.',
    points: [
      'People recorded with consent, and how they said they lean.',
      'Doors worked, by how each was left.',
      'Incidents logged, by what has happened to them.',
      'Counts only. Nothing on it names a voter.',
    ],
  },
  {
    id: 'capture',
    start: 20,
    end: 30,
    title: 'Capture at the door, with consent.',
    lead: 'A canvasser confirms who lives there, asks, and records the person only if they agree out loud.',
    points: [
      'The canvasser types the person’s name back before the record button works, so a mis-tap cannot create consent.',
      'A refusal stores nothing. There is no list of people who said no.',
      'How the person leans is one of five: Strong Opposition, Lean Opposition, Undecided, Lean Support, Strong Support.',
      'The voters’ roll is a target list. A person enters the voter records only when they consent.',
    ],
  },
  {
    id: 'offline',
    start: 30,
    end: 40,
    title: 'Works where the signal does not.',
    lead: 'Work is kept on the phone and sent when signal returns.',
    points: [
      'The screen shows what is still waiting on the phone, so “saved here” is never mistaken for “received”.',
      'If two people changed the same record, the clash is shown to a person. It is not quietly decided.',
      'Clearing the browser’s data removes anything not yet sent. The app says so.',
    ],
  },
  {
    id: 'seats',
    start: 40,
    end: 50,
    title: 'From votes to seats.',
    lead: 'The seat calculator applies Schedule 1 of the Municipal Structures Act to the numbers you enter.',
    points: [
      'On the Electoral Commission’s published 2021 result for JB Marks it gives the published quota (1,515) and all 67 seats, to the seat.',
      'A tie that cannot be settled fairly is flagged and the seat is left open. It never guesses.',
      'It forecasts nothing. You set the scenario; it shows what that scenario means.',
      'A majority of 67 is 34.',
    ],
    tryIt: { label: 'Try the seat tool', href: '/tools/how-seats-are-calculated' },
  },
  {
    id: 'rules',
    start: 50,
    end: 60,
    title: 'The funding and privacy rules, built in.',
    lead: 'The rules a treasurer and an information officer worry about are checks in the software, not memory.',
    points: [
      'A donor’s payments are added up, because the disclosure line applies to the total: R200,000. The annual cap is R30 million. (Government Gazette 53182; both are under court challenge, and the software is updated if they change.)',
      'A request from a person about their own data is tracked against a 30-day response target.',
      'The software is bookkeeping and record-keeping help. It is not legal advice and does not file anything for you.',
    ],
    tryIt: { label: 'Try the funding checker', href: '/tools/party-funding-checker' },
  },
];

export const TOUR_NOTE =
  'There is no recorded video yet. This is the tour, chapter by chapter, and it can be read aloud as the script. Where a figure appears that is not a fact about the law, it is an invented example.';
