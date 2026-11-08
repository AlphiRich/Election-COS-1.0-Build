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
        'Registered voters are the gazetted baseline for JB Marks: 122,059, from the Electoral Commission’s Circular 1 of 2025, split by ward and voting district in the delimitation seed. That is the only voter count the application shows.',
        'The age mix is a percentage read from the Commission’s certified voters’ roll (edition LGE2026-CERT-20260807), as the share of voters in each band on polling day. No count from the roll is kept. The roll itself is never in this application. Age is read from the date of birth that opens the masked identity number and put into six bands: 18 to 29, 30 to 39, 40 to 49, 50 to 59, 60 to 69 and 70 and over.',
      ],
    },
    {
      heading: 'Reading the figures',
      body: [
        'A voting district shared between wards is listed once for each ward, with that ward’s portion of the registered voters. The portions add up to the ward total and the ward totals add up to 122,059.',
        'A few districts have no age mix. They have no matching entry in the roll, or too few people to show. The page says so; it never fills the gap with an estimate.',
      ],
      steps: [
        'Quote registered voters as 122,059 for the municipality and say it is the gazetted baseline.',
        'Quote an age figure as a percentage of voters, never as a head count.',
        'Do not apply a percentage to a different total to get a head count; the percentage describes the roll’s age-placed entries, not the registered total.',
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

export const ANALYST_SOP: Sop = {
  number: 'SOP-17',
  title: 'The data analyst',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead', 'ward-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to ask a question of a spreadsheet you hold, what the analyst can and cannot answer, and how it keeps personal information out.',
  sections: [
    {
      heading: 'What it does',
      body: [
        'You give it a CSV file, or paste CSV text, and ask one of three kinds of question: a summary of the data, the top groups by a number, or anything unusual (outliers, duplicate rows, mostly empty columns).',
        'The file is read inside your browser tab. It is not uploaded, and no AI model writes the answer. Every figure is counted, summed or ranked from your rows, and each report says how. That is slower to write than a model’s prose and it means a report can be checked by repeating the sum.',
      ],
    },
    {
      heading: 'Personal information',
      body: [
        'Before anything is read, the analyst looks at each column. A column whose values look like ID numbers or phone numbers is removed and cannot be put back. A column whose name looks personal, such as a surname or an address, is removed unless you tick that it is not about people.',
      ],
      warnings: [
        'Ticking “not about people” is your statement, recorded on the report. Do not tick it for a column that holds names of voters, volunteers or donors.',
        'Do not use the analyst on the certified voters’ roll or on any list of named people. This build does not hold the roll.',
      ],
    },
    {
      heading: 'What it cannot do',
      body: [
        'It does not forecast, fit a model, or explain causes. “Who will win ward 7?” is outside it and the analyst says so. Outliers are prompts to look, not proof of an error. If you stage several files, only the first is analysed and joins are not done.',
      ],
      steps: [
        'Say which file and which question a figure came from whenever you quote it.',
        'Keep what you need: runs are held in the tab only and disappear when it is closed.',
      ],
    },
  ],
};

export const DRILL_DOWN_SOP: Sop = {
  number: 'SOP-18',
  title: 'Drill-down by ward and voting district',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead', 'ward-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to read the ward table without treating a 2021 margin as a 2026 prediction.',
  sections: [
    {
      heading: 'Two vintages on one page',
      body: [
        'The result in each row is the 2021 ward ballot on the 2021 wards: who won, who came second, and by how many points. The registered voters are the 2026 baseline, 122,059 in all. Wards are matched by their Commission number. A ward with the same number may not have the same boundary, so the match is a statement, not a fact.',
        'The 2021 record keeps only the winner and runner-up for each ward, so a ward is shown as a two-party contest. Votes for other parties, about one in nine, are not broken down.',
      ],
    },
    {
      heading: 'Close wards',
      body: [
        'A ward is marked “close” when its 2021 margin is under the number of points you set (5 to start). Swing to flip is half the margin: the two-party swing that would have changed the 2021 result. Both are facts about a past result.',
      ],
      warnings: [
        'Do not describe a close ward as likely to change hands. The page has no model that could say that. To test an assumption, use the scenario runner and say that it is an assumption.',
      ],
    },
    {
      heading: 'Voting districts',
      body: [
        'Opening a ward lists its voting districts with registered voters and shows the ward’s age mix as percentages (SOP-14). 2021 results are not held per voting district, so none are shown.',
      ],
    },
  ],
};

export const LGE2026_SOP: Sop = {
  number: 'SOP-19',
  title: 'The 2026 results, and the models that start from them',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead', 'ward-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to read the Commission’s 4 November 2026 results for the North West in the application, and how the scenario runner, the coalition tool and the swing figures use them.',
  sections: [
    {
      heading: 'Where the figures come from',
      body: [
        'They are the Electoral Commission’s own published result files for the 18 North West local municipalities (402 wards), reduced to counts. Seats are Schedule 1 applied to those counts, and they agree with the Commission’s own Seat Calculation Detail report for every one of the 18, including the four municipalities where a party won more ward seats than its entitlement (Mafikeng, Ditsobotla, Ramotshere Moiloa and Greater Taung).',
        'Where the Commission’s municipality files and its province-wide file differ (three voting districts in Rustenburg, changed late on 7 November), the later municipality file is used and the difference is recorded with the data.',
      ],
    },
    {
      heading: 'Turnout and the registered figure',
      body: [
        'Turnout is shown per ballot: the votes cast on that ballot (valid plus spoilt) divided by the voters the Commission lists as registered. The two ballots are never added together. The registered figure here is the Commission’s own for the election, which for JB Marks is higher than the gazetted baseline of 122,059 used elsewhere in the application; dividing by the gazetted figure would overstate turnout.',
      ],
    },
    {
      heading: 'District councils',
      body: [
        'A district council’s directly elected seats are voted on through the 40% ballot in each local municipality, so a district’s votes are the sum over its members. Its seats are allocated under Schedule 2, which this build does not implement, so only votes are shown for districts.',
      ],
    },
    {
      heading: 'The models',
      body: [
        'The scenario runner starts from the certified 2026 result of the municipality you choose. A zero swing returns the Commission’s own council exactly. The runner is a sensitivity instrument over the swings and spreads you set; it is not a forecast.',
        'The swing table for JB Marks shows what actually moved between 2021 and 2026 on the same definition of a party’s vote. It is one election pair. The ward-level spreads can be copied into the runner as a starting point, and you may change them.',
      ],
      warnings: [
        'Do not describe a close ward as likely to change hands, or the 2021 to 2026 swing as what will happen next. Both are descriptions of past results.',
        'Independents are published merged into one row per voting district. A ward they lead is counted as one independent win; it cannot be said to belong to a single named candidate.',
      ],
    },
  ],
};

export const MASTER_HUB_SOP: Sop = {
  number: 'SOP-20',
  title: 'The master command and media hub',
  area: 'WAR_ROOM',
  roles: ['party-hq-admin', 'municipal-team-lead'],
  requiresAnyCapability: ['analytics.view'],
  purpose:
    'How to use the hub’s six sections, and how to read the places where it differs from the master code stack it was built from.',
  sections: [
    {
      heading: 'The six sections',
      body: [
        'Strategy and funnel (the 2026 and 2029 campaigns, channel targets, the roadmap); media and campaign assets (the asset catalogue, voice profile, Canva prompt, teleprompter, and the daily ground intelligence newsletter); the 32-agent code stack with an offline outbox simulator; the Schedule 1 seat calculator; the legal and statutory vault with a funding threshold check; and the DNS and deployment gate with the build discipline checklist.',
      ],
    },
    {
      heading: 'What differs from the master stack',
      body: [
        'Every difference is listed on the hub under “What was changed from the master stack, and why”. In short: invented performance and forecast numbers were replaced by labelled targets or by certified results; the funding lines are the gazetted R200,000 and R30 million; legal documents show their real status (none is published); the checklist shows what enforces each rule instead of a pass count; and the agent catalogue says what implements each responsibility in this build, which runs on Firebase rather than AWS.',
      ],
      warnings: [
        'The marketing targets are not results. No campaign has run. Replace them with measured figures once one has.',
        'The DNS tab compares the specified records with a snapshot taken on 8 November 2026. Do not replace the SPF record with “v=spf1 -all”: that would stop the company mailboxes sending.',
      ],
    },
  ],
};
