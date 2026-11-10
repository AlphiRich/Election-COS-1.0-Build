/**
 * Election Campaign OS — official Electoral Commission sources
 *
 * Every address here was supplied by the owner from the Commission's own
 * "Key processes and roleplayers" menu, or read off a Commission page, and
 * was requested on 1 November 2026 before it was listed (build rule 9):
 * each returned 200, or a redirect to a working page on the Commission's
 * own host or its data-free mirror. Two supplied addresses are NOT listed
 * because they failed that probe:
 *
 *  - /pw/StatsData/Political-Parties-Statistics — answered 302 to the
 *    Commission's own error page (ER-500).
 *
 * `officialSources.test.ts` holds this list to https, to an allowed set of
 * hosts, and to no duplicates. It cannot know a page is still up; the next
 * person to touch this file should probe again.
 */
export interface OfficialLink {
  label: string;
  url: string;
  /** One sentence, in our words, about what the page is. */
  about: string;
}

export interface OfficialGroup {
  id: string;
  title: string;
  links: OfficialLink[];
}

const E = 'https://www.elections.org.za/pw';

export const OFFICIAL_HOSTS = [
  'www.elections.org.za',
  'results.elections.org.za',
  'atlas.elections.org.za',
  'maps.elections.org.za',
  'elearning.elections.org.za',
  'online.elections.org.za',
  'real411.org.za',
  'www.dha.gov.za',
  'www.demarcation.org.za',
] as const;

export const OFFICIAL_GROUPS: OfficialGroup[] = [
  {
    id: 'processes',
    title: 'Key Processes and Roleplayers',
    links: [
      {
        label: 'Voting',
        url: `${E}/Elections-And-Results/Voting-Process`,
        about: 'How voting works at a voting station.',
      },
      {
        label: 'Counting',
        url: `${E}/Elections-And-Results/Counting-Process`,
        about: 'How the count works. The page is mostly a diagram.',
      },
      {
        label: 'Objections',
        url: `${E}/Elections-And-Results/Objections`,
        about:
          'How an objection is made and decided. The page describes the 2024 national and provincial process.',
      },
      {
        label: 'Observers',
        url: `${E}/Elections-And-Results/Observers`,
        about: 'Who may observe an election.',
      },
      {
        label: 'Party Agents',
        url: `${E}/Elections-And-Results/Party-Agents`,
        about: 'What a party agent may and may not do at a voting station.',
      },
      {
        label: 'About Voting Districts and Stations',
        url: `${E}/Voters-Roll/About-voting-districts-and-stations`,
        about: 'How voting districts and voting stations relate.',
      },
      {
        label: 'Report Election Disinformation',
        url: `${E}/Elections-And-Results/Report-Election-Disinformation`,
        about: 'Disinformation is reported to Real411, not to the Commission directly.',
      },
      {
        label: 'Report Electoral Fraud',
        url: `${E}/Voter/Report-Electoral-Fraud`,
        about: 'Where to report suspected electoral fraud.',
      },
    ],
  },
  {
    id: 'voters',
    title: 'For Voters',
    links: [
      {
        label: 'Find My Voting Station',
        url: 'https://maps.elections.org.za/vsfinder/',
        about: 'The Commission’s own voting station finder.',
      },
      {
        label: 'Voting Stations List, LGE 2026',
        url: `${E}/Elections-And-Results/Voting-Stations-LGE-2026`,
        about: 'The published list of voting stations for this election.',
      },
      {
        label: 'How to Vote',
        url: `${E}/Voter/How-To-Vote`,
        about: 'Step-by-step voting guidance.',
      },
      {
        label: 'Voter Information',
        url: `${E}/Voter/Voter-Information`,
        about: 'Registration status, special votes and more.',
      },
      {
        label: 'Who Is My Ward Councillor',
        url: `${E}/Voter/Who-Is-My-Ward-Councillor`,
        about: 'Current ward councillors, not the 2026 candidates.',
      },
      {
        label: 'Voter Education',
        url: `${E}/Voter/Voter-Education`,
        about: 'Voter-education material.',
      },
      {
        label: 'e-Learning',
        url: 'https://elearning.elections.org.za/login/index.php',
        about: 'The Commission’s online courses. Needs a login.',
      },
      {
        label: 'About the Voters’ Roll',
        url: `${E}/Voters-Roll/About-Voters-Roll`,
        about: 'What the roll is and how it is kept.',
      },
      {
        label: 'Voters’ Roll FAQ',
        url: `${E}/FAQ/Voters-Roll`,
        about: 'Common questions about the roll.',
      },
      {
        label: 'How Council Seats Are Calculated',
        url: 'https://www.elections.org.za/content/Documents/Voter-education/Continuous-Voter-Education/How-Council-seats-are-calculated/',
        about: 'The Commission’s own explainer for council seats.',
      },
    ],
  },
  {
    id: 'candidates',
    title: 'Candidates and Parties',
    links: [
      {
        label: 'Certified Candidate Lists, LGE 2026',
        url: `${E}/Parties-And-Candidates/Candidate-Lists-LGE-2026`,
        about: 'Supplementary certified lists, one PDF per province, dated 23 October 2026.',
      },
      {
        label: 'Electoral Code of Conduct',
        url: `${E}/Parties-And-Candidates/The-Electoral-Code-Of-Conduct`,
        about:
          'Who the Code binds, what it requires and forbids, and what happens if it is broken.',
      },
      {
        label: 'Party Liaison Committees',
        url: `${E}/Parties-And-Candidates/Party-Liaison-Committees`,
        about: 'How parties and the Commission liaise.',
      },
      {
        label: 'Political Party and Candidate Forms',
        url: `${E}/Downloads/Documents-Forms`,
        about:
          'Forms library. Folders open by script, with municipal forms under “For Parties and Candidates (Municipal Elections)”.',
      },
      {
        label: 'Laws and Regulations',
        url: `${E}/Downloads/Documents-Laws-And-Regulations`,
        about: 'Acts and regulations, including the Electoral Court rules.',
      },
      {
        label: 'Document Library',
        url: `${E}/Downloads/Document-Library`,
        about: 'All of the Commission’s published documents.',
      },
    ],
  },
  {
    id: 'results',
    title: 'Results and Statistics',
    links: [
      {
        label: 'Election Results',
        url: 'https://results.elections.org.za/',
        about: 'The Commission’s results site.',
      },
      {
        label: 'Municipal Local Government Elections Dashboard',
        url: 'https://results.elections.org.za/dashboards/lge',
        about: 'The Commission’s live municipal dashboard.',
      },
      {
        label: 'Voters’ Roll and Statistics',
        url: `${E}/StatsData/Voter-Registration-Statistics`,
        about: 'Registration statistics.',
      },
      {
        label: 'Ward Councillor Statistics',
        url: `${E}/StatsData/List-Of-Current-Ward-Councillors`,
        about: 'Lists of current ward councillors.',
      },
      {
        label: 'Atlas of Results',
        url: 'https://atlas.elections.org.za/atlas/',
        about: 'Maps of past results.',
      },
      {
        label: '2011 Census Maps',
        url: `${E}/Voters-Roll/Census-2011-maps`,
        about: 'Census maps linked to voting districts.',
      },
    ],
  },
  {
    id: 'contact',
    title: 'Contact and Information',
    links: [
      {
        label: 'Contact the Electoral Commission',
        url: `${E}/About-Us/Contact-IEC-South-Africa`,
        about: 'Contact details.',
      },
      {
        label: 'Find Local Offices',
        url: `${E}/About-Us/Find-IEC-Local-Offices`,
        about: 'Where the local offices are.',
      },
      {
        label: 'Access to Information (PAIA)',
        url: `${E}/Information-Centre/Access-to-Information-PAIA`,
        about: 'How to request information from the Commission.',
      },
      {
        label: 'Real411: Elections Page',
        url: 'https://real411.org.za/elections',
        about:
          'Real411\u2019s own page on the 2026 elections: what counts as digital disinformation and an electoral offence, the Commission\u2019s Framework of Co-operation, and a guide for political parties.',
      },
      {
        label: 'Report Disinformation to Real411',
        url: 'https://real411.org.za/complaints/submit',
        about: 'The web form the Commission points to. Complaints cannot be anonymous.',
      },
    ],
  },
];

export const ALL_OFFICIAL_LINKS: OfficialLink[] = OFFICIAL_GROUPS.flatMap((g) => g.links);

/** A named, probed address for the places other pages need to point at. */
export const IEC_LINK = {
  home: `${E}/`,
  partyAgents: `${E}/Elections-And-Results/Party-Agents`,
  objections: `${E}/Elections-And-Results/Objections`,
  counting: `${E}/Elections-And-Results/Counting-Process`,
  voting: `${E}/Elections-And-Results/Voting-Process`,
  codeOfConduct: `${E}/Parties-And-Candidates/The-Electoral-Code-Of-Conduct`,
  candidateLists: `${E}/Parties-And-Candidates/Candidate-Lists-LGE-2026`,
  votingStations: `${E}/Elections-And-Results/Voting-Stations-LGE-2026`,
  stationFinder: 'https://maps.elections.org.za/vsfinder/',
  forms: `${E}/Downloads/Documents-Forms`,
  laws: `${E}/Downloads/Documents-Laws-And-Regulations`,
  results: 'https://results.elections.org.za/',
  lgeDashboard: 'https://results.elections.org.za/dashboards/lge',
  disinformation: `${E}/Elections-And-Results/Report-Election-Disinformation`,
  real411: 'https://real411.org.za/complaints/submit',
  real411Elections: 'https://real411.org.za/elections',
  fraud: `${E}/Voter/Report-Electoral-Fraud`,
  seatsExplainer:
    'https://www.elections.org.za/content/Documents/Voter-education/Continuous-Voter-Education/How-Council-seats-are-calculated/',
  voterStats: `${E}/StatsData/Voter-Registration-Statistics`,
  votingDistricts: `${E}/Voters-Roll/About-voting-districts-and-stations`,
  whoIsMyCouncillor: `${E}/Voter/Who-Is-My-Ward-Councillor`,
  voterEducation: `${E}/Voter/Voter-Education`,
  contact: `${E}/About-Us/Contact-IEC-South-Africa`,
  localOffices: `${E}/About-Us/Find-IEC-Local-Offices`,
  documentLibrary: `${E}/Downloads/Document-Library`,
} as const;

/** What the Commission's Party agents page says, restated and attributed. */
export const PARTY_AGENT_RULES_IEC: string[] = [
  'A party may appoint two agents to attend a voting or counting venue; they must be South African citizens and not candidates in that election.',
  'The party issues the agent an appointment form and gives notice to the presiding officer. Agents wear the prescribed tag naming their party.',
  'Agents may observe at the voters’ roll station, the ballot paper station and the inking station, check that ballot box seals are intact, witness decisions on questionable ballot papers, witness the completion of the result forms, sign them and copy the station’s results.',
  'Agents may lodge objections or raise irregularities with the presiding officer, and must follow the presiding officer’s orders. Talk to the presiding officer or deputy, not to ordinary voting officers.',
  'An agent’s absence does not invalidate the proceedings.',
  'Do not try to influence anyone to vote or not to vote, interfere with voters or the process, or try to watch a voter mark a ballot.',
  'Do not display or distribute party material, or wear or carry anything showing a party logo, picture or sign other than the tag.',
  'No communication with people outside the venue is allowed until the results are finalised.',
];
