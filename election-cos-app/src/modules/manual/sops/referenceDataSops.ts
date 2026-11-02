/**
 * Election Campaign OS — SOP-13 to SOP-16: the reference data, polls and scenario tools.
 *
 * Written the same day the features shipped (2 Nov 2026). Each states where a number comes from and what it
 * cannot tell you, because these are the screens whose figures get quoted upward and outward. Every claim here
 * is a fact about how the software is built; the tests in manual.test.ts hold the numbers to the data.
 */
import { MIN_CELL as POLL_MIN_CELL } from '@/modules/polls/pollModel';
import type { Sop } from '../manualModel';

export const CANDIDATE_LIST_SOP: Sop = {
  number: 'SOP-13',
  title: 'The candidate list in the application',
  area: 'COMPLIANCE',
  roles: ['party-hq-admin', 'municipal-team-lead', 'ward-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'What the candidate list on the Candidates screen is, where it came from, what it can and cannot be used for, ' +
    'and how to refresh it when the Commission publishes a change.',
  sections: [
    {
      heading: 'What it is',
      body: [
        'The Electoral Commission’s certified list of candidates for North West, as supplemented on 23 October 2026, narrowed to JB Marks: 611 entries, 447 on ward ballots and 164 on party lists, for 20 parties across 34 wards.',
        'It was fetched from the Commission’s own website, hashed, and published into the application on the owner’s instruction. The owner is checking it against the Commission’s own list. The screen says so on its face, with the date and the fingerprint of the file.',
      ],
    },
    {
      heading: 'Reading it',
      steps: [
        'Ward candidates stand in one ward. The ward number is part of the entry.',
        'Party-list candidates have a place on the party’s list. Place 1 is the top of the list.',
        'A person can be on a ward ballot and a party list at the same time. The screen marks them "also on the other ballot", so you do not count them twice.',
        'Filter by ballot, ward, party or part of a name. The count above the table always says how many match.',
      ],
    },
    {
      heading: 'What it cannot tell you',
      body: [
        'It carries names, party and place. It has no identity numbers, addresses or contact details, and it never will: the source column that held identity numbers is not copied.',
        'It is a snapshot. The Commission can publish a supplementary list again, and a candidate can be removed or replaced. Check the date before you quote a name in public.',
        'A party’s count here is the number of entries on this list, not a statement about how serious its campaign is.',
      ],
      warnings: [
        'Do not use this list to build anything about a person. It is public so that voters can see who is standing, and for no other purpose.',
      ],
    },
    {
      heading: 'Refreshing it',
      steps: [
        'When the Commission publishes a new list, re-ingest it into the dataset (see the ingestion notes) and check the counts and the fingerprint.',
        'Run the extract for the municipality: node scripts/extract-reference-candidates.mjs NW405.',
        'Check the counts printed by the extract against the Commission’s own summary before you rely on them.',
        'Write down what you did, with the date, in the change log.',
      ],
    },
  ],
};

export const VOTER_STATISTICS_SOP: Sop = {
  number: 'SOP-14',
  title: 'Voting districts and voter statistics',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead', 'ward-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to use the voting-district locator and the voter statistics without misreading them: where the figures ' +
    'come from, why two numbers for registered voters exist and disagree, and what the hidden cells are for.',
  sections: [
    {
      heading: 'Where the numbers come from',
      body: [
        'They are counts taken from the Commission’s certified voters’ roll for JB Marks (edition LGE2026-CERT-20260807): 131,963 verified voters and 52,176 rejected entries across 106 voting districts and 34 wards. Every district’s count was checked against the Commission’s own printed total for that district, and none differed.',
        'The roll itself is never in this application. Only counts are. Age is read from the date of birth that opens the masked identity number and put into six bands: 18 to 29, 30 to 39, 40 to 49, 50 to 59, 60 to 69 and 70 and over, on polling day.',
      ],
    },
    {
      heading: 'Two numbers for registered voters',
      body: [
        'The roll says 131,963. The ward and district seed built from the delimitation gazette says 122,059. They are different documents made at different times and they are not reconciled here. For a split voting district the seed figure is the ward’s portion, which will differ from the roll’s count for the district.',
      ],
      steps: [
        'Say which document a figure comes from every time you quote it.',
        'Do not average them and do not pick the larger for effect.',
        'If the difference matters for a decision, take it to whoever holds the Commission’s own figure.',
      ],
    },
    {
      heading: 'Hidden cells',
      body: [
        `A count under ${POLL_MIN_CELL} people is hidden, because a very small group in one voting district can be recognised. When exactly one cell in a row would be hidden, a second is hidden with it, because the total is shown and a single gap could otherwise be worked out by subtraction.`,
        'A hidden cell is never shown as zero. It is drawn as no bar and the table says "Hidden (under 10)".',
      ],
      warnings: [
        'Do not try to recover a hidden cell by subtracting. The hiding is deliberate. If you need a number the screen does not show, you do not need that number for the campaign.',
        'Sex is not shown and cannot be worked out: the digits that carry it are masked in the roll.',
      ],
    },
    {
      heading: 'What to do with it',
      body: [
        'Use age profile to plan where to put people and what to say, ward by ward. The ranked chart shows which wards have the largest share aged 18 to 29.',
        'It describes the electorate on the roll. It says nothing about how anybody will vote.',
      ],
    },
  ],
};

export const POLLS_SOP: Sop = {
  number: 'SOP-15',
  title: 'Running a voter sentiment poll',
  area: 'COMPLIANCE',
  roles: ['party-hq-admin', 'municipal-team-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to create, share and read an anonymous poll, and what its results can honestly be used to say.',
  sections: [
    {
      heading: 'What a poll answer is',
      body: [
        'A choice from the options you wrote, plus "Undecided" and "Prefer not to say", a channel tag and optionally a ward. No name, number, identity number, device or free text is collected, so an answer cannot be traced to a person. The server keeps counts, not rows.',
      ],
      warnings: [
        'Do not add a free-text question, ask for a phone number, or link an answer to a person on the roll. The design depends on none of that existing. A version that holds answers against people needs a lawful basis your information officer must approve first.',
      ],
    },
    {
      heading: 'Creating and sharing',
      steps: [
        'Analytics → Voter sentiment polls → New poll. Write the question and at least two options, and name who is running the poll.',
        'Choose a public link (anyone with it can answer) or one answer per link (each invitation works once).',
        'Open the poll. Use the share buttons: each opens WhatsApp, Facebook, X, Telegram, LinkedIn, email or SMS with the link ready. You choose to send it; nothing is sent for you. For Instagram, TikTok and YouTube, paste the link.',
        'Close the poll when you are done.',
      ],
      warnings: [
        'The platform does not send WhatsApp messages to voters. A message to someone who has not asked for it is direct marketing under the law. Share the link yourself, to people who have asked to hear from you.',
      ],
    },
    {
      heading: 'Reading the results',
      body: [
        'The answers come from people who chose to reply. That is not a random sample. The dashboard therefore shows no margin of error, because one would imply a representativeness that is not there, and it never presents a share as a forecast.',
        `A group of fewer than ${POLL_MIN_CELL} is hidden, and with fewer than ${POLL_MIN_CELL} responses in all, no figures are shown.`,
        'Differences between channels mostly show who each channel reached.',
      ],
      warnings: [
        'A public link can be answered many times by someone determined to. Single-answer links cannot. Say which kind a poll was whenever you quote it.',
        'Never quote a poll result as the electorate’s view or as a prediction.',
      ],
    },
  ],
};

export const SCENARIO_RUNNER_SOP: Sop = {
  number: 'SOP-16',
  title: 'The scenario runner and the parties it can model',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to use the scenario runner so it shows how sensitive the council is to your assumptions, without being mistaken for a forecast.',
  sections: [
    {
      heading: 'What it does',
      body: [
        'For each party you set a swing (points of the valid vote) and how unsure you are of it (a spread, in points). The software repeats the Schedule 1 seat calculation across that range, thousands of times, using a fixed seed so the same inputs always give the same answer.',
        'It reports seats per party (5th, median and 95th), how often each party holds a majority across the draws, which wards change hands most often, and which one of your assumptions moves a chosen party’s seats the most.',
      ],
    },
    {
      heading: 'What it is not',
      warnings: [
        'It is not a forecast. The spreads are your beliefs, not estimated from data: the application holds one certified election, and one election cannot estimate how swings are distributed. Nothing has been back-tested.',
        'Every frequency means "in this share of draws from your assumptions". It never means "this will happen".',
      ],
      body: [
        'Each result carries that sentence with it, and so should anything you write down or say that comes from it.',
      ],
    },
    {
      heading: 'Which parties it can model',
      body: [
        'Only parties that appear on the 2026 candidate list for JB Marks and also contested JB Marks in 2021 can be given a swing: African National Congress, Democratic Alliance, Economic Freedom Fighters, Patriotic Alliance and Vryheidsfront Plus | Freedom Front Plus. A swing is a change from a 2021 result.',
        'Fifteen parties on the 2026 list have no 2021 result here. They are not in the projection, and the projection does not say how many votes they take from the others. Four 2021 parties are not on the 2026 list; their 2021 votes stay in the baseline because there is no data on where those voters go.',
      ],
    },
    {
      heading: 'Before you quote it',
      steps: [
        'Write down the swings, spreads and turnout you used. The screen lists them as "inputs in force", each marked sourced or an assumption you set.',
        'Say that they are assumptions.',
        'Do not present a majority frequency as a probability of winning.',
      ],
    },
  ],
};
