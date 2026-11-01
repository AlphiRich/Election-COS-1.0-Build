/**
 * Election Campaign OS — public site, the Electoral Code of Conduct
 *
 * Plain-language summary of Schedule 1 (the Electoral Code of Conduct) and
 * sections 40, 45 and 78 of the Local Government: Municipal Electoral Act
 * 27 of 2000. Written from the text of the Act as published in 2000
 * (polity.org.za), read in full for this build. Every line carries the
 * provision it comes from so a reader can check it, and none is presented
 * as the text of the Act.
 *
 * WHAT TO KEEP IN MIND
 *
 *  - It is the Act as first enacted. It may have been amended since, the
 *    Commission can add provisions to the Code (item 10) and issue other
 *    Codes (section 88), and section 87 binds every party contesting an
 *    election and every party and ward candidate. The page says to read the
 *    current text.
 *  - It is general information, not legal advice (build rule 3).
 *  - Item 4(1)(a) is a duty on parties and candidates to *state* that
 *    everyone has these rights; the lines below are worded that way.
 */
export interface CodeLine {
  /** Where it comes from, as a reader would cite it. */
  ref: string;
  text: string;
}

export const CODE_SOURCE =
  'Local Government: Municipal Electoral Act 27 of 2000, Schedule 1 (Electoral Code of Conduct) and sections 40, 45 and 78, as published in 2000.';

export const CODE_CAVEAT =
  'This is a plain-language summary, not the text of the Act and not legal advice. The Act may have been amended since 2000, and the Electoral Commission can add to the Code (item 10) or issue other Codes (section 88). Read the current text before relying on any line here.';

/** What parties and candidates must publicly say everyone may do. Item 4(1)(a). */
export const STATED_RIGHTS: CodeLine[] = [
  { ref: 'item 4(1)(a)(i)', text: 'Freely express their political beliefs and opinions.' },
  {
    ref: 'item 4(1)(a)(ii)',
    text: 'Challenge and debate the political beliefs and opinions of others.',
  },
  {
    ref: 'item 4(1)(a)(iii)',
    text: 'Publish and distribute election and campaign materials, including notices and advertisements.',
  },
  { ref: 'item 4(1)(a)(iv)', text: 'Lawfully put up banners, billboards, placards and posters.' },
  { ref: 'item 4(1)(a)(v)', text: 'Canvass support for a party or candidate.' },
  { ref: 'item 4(1)(a)(vi)', text: 'Recruit members for a party.' },
  { ref: 'item 4(1)(a)(vii)', text: 'Hold public meetings.' },
  { ref: 'item 4(1)(a)(viii)', text: 'Travel to and attend public meetings.' },
];

/** Protections a voter can lean on. */
export const VOTER_PROTECTIONS: CodeLine[] = [
  {
    ref: 'item 9(1)(a)',
    text: 'No party or candidate may use language or act in a way that may provoke violence during an election, or the intimidation of voters, candidates, members or supporters.',
  },
  {
    ref: 'item 9(2)(a)(iii)',
    text: 'Nobody may offer an inducement or reward to another person to vote or not to vote, or to vote in a particular way.',
  },
  {
    ref: 'item 9(2)(e)',
    text: 'Nobody may abuse a position of power, privilege or influence, including parental, patriarchal, traditional or employment authority, to influence the conduct or outcome of an election.',
  },
  {
    ref: 'item 9(2)(c)',
    text: 'Nobody may unreasonably prevent another person from reaching voters for voter education, collecting signatures, recruiting members, raising funds or canvassing support.',
  },
  {
    ref: 'section 40(2)(c)–(d)',
    text: 'Inside the boundary of a voting station, no party, agent or candidate may try to persuade you to vote for or against a party or candidate, or not to vote.',
  },
  {
    ref: 'item 6',
    text: 'Parties and candidates must respect the right of women to communicate freely with them, and take reasonable steps to ensure women are free to take part in political activity.',
  },
];

/** Voting-day facts that protect a voter. */
export const VOTING_DAY_RIGHTS: CodeLine[] = [
  {
    ref: 'section 45(1)',
    text: 'Unless the Commission determines other hours, a voting station opens at 07:00 and stays open until 21:00.',
  },
  {
    ref: 'section 45(4)',
    text: 'Voting at a station continues until every voter entitled to vote there who reported before closing time has voted.',
  },
  {
    ref: 'section 45(3)',
    text: 'Nobody may be admitted to a voting station to vote after it has closed.',
  },
  {
    ref: 'section 51(2)–(4)',
    text: 'If you are refused a ballot paper you may object. An objection is made in writing, on the prescribed form, and handed to the presiding officer, who must look into it and decide it.',
  },
];

/** What parties and candidates must do. */
export const PARTY_MUST: CodeLine[] = [
  {
    ref: 'items 2–3',
    text: 'Promote the purpose of the Code, publicise it widely in campaigns, support voter education, and instruct and take reasonable steps to make their candidates, office-bearers, representatives, members and supporters comply with the Code and electoral laws.',
  },
  {
    ref: 'item 4(1)(b)',
    text: 'Publicly condemn any action that may undermine the free and fair conduct of elections.',
  },
  { ref: 'item 4(2)', text: 'Accept the result of an election, or challenge it in a court.' },
  {
    ref: 'item 5',
    text: 'Liaise with other parties and try not to call a public meeting, march, demonstration or rally at the same time and place as another party’s.',
  },
  {
    ref: 'item 7',
    text: 'Recognise the Commission’s authority, give effect to its lawful directions, keep lines of communication open with it and with other parties, cooperate in its investigations, and take reasonable steps to keep its staff safe from insult, hazard or threat.',
  },
  {
    ref: 'item 8',
    text: 'Respect the role of the media, not stop journalists attending public political events, and take reasonable steps to make sure journalists are not harassed, intimidated or assaulted by their representatives or supporters.',
  },
  {
    ref: 'item 6',
    text: 'Facilitate the full and equal participation of women in political activities and their free access to political events.',
  },
];

/** What parties and candidates must not do. */
export const PARTY_MUST_NOT: CodeLine[] = [
  {
    ref: 'item 9(1)(a)',
    text: 'Use language or act in a way that may provoke violence or intimidation of candidates, members, representatives, supporters or voters.',
  },
  {
    ref: 'item 9(1)(b)',
    text: 'Publish false or defamatory allegations in connection with an election about a party, its candidates, representatives or members, or about a ward candidate.',
  },
  { ref: 'item 9(1)(c)', text: 'Plagiarise the symbols, colours or acronyms of other parties.' },
  {
    ref: 'item 9(1)(d)',
    text: 'Discriminate on the grounds of race, ethnicity, sex, gender, class or religion in connection with an election or political activity.',
  },
  {
    ref: 'item 9(2)(a)',
    text: 'Offer anybody an inducement or reward to join or not join a party, to attend or not attend an event, to vote or not vote or vote in a particular way, or to refuse a nomination or withdraw as a candidate.',
  },
  {
    ref: 'item 9(2)(b)',
    text: 'Carry or display arms or weapons at a political meeting, march, demonstration, rally or other public political event.',
  },
  {
    ref: 'item 9(2)(d)',
    text: 'Deface, unlawfully remove or destroy another party’s or candidate’s billboards, placards, posters or other election materials.',
  },
];

/** The extra rules inside a voting station. Section 40. */
export const AT_THE_STATION: CodeLine[] = [
  {
    ref: 'section 40(1)',
    text: 'Agents, parties and ward candidates wear the prescribed identification tag at a voting station or counting venue.',
  },
  {
    ref: 'section 40(2)(a)',
    text: 'Do not display or distribute any billboard, poster, placard or pamphlet inside the boundary of a voting station.',
  },
  {
    ref: 'section 40(2)(b)',
    text: 'Do not wear, carry or display clothing or other apparel with any party or candidate writing, picture or sign that is visible, other than the prescribed tag.',
  },
  {
    ref: 'section 40(2)(c)–(d)',
    text: 'Do not try to induce, influence or persuade anyone to vote for or against a party or candidate, or not to vote.',
  },
  {
    ref: 'section 40(3)',
    text: 'Agents and candidates may observe voting, counting and the declaration of results, must not interfere, and may lodge objections or bring alleged irregularities to the presiding or counting officer.',
  },
  {
    ref: 'section 40(5)',
    text: 'Comply with any order from an officer, or from a member of the security services acting on an officer’s instructions.',
  },
];

export const CONSEQUENCES_REF = 'section 78(2)';
export const CONSEQUENCES =
  'The Electoral Court has jurisdiction over complaints about infringements of the Code. If it finds a party or person has contravened it, it may impose an appropriate penalty or sanction, including a formal warning, a fine of up to R200,000, forfeiting a deposit, orders limiting campaigning or excluding agents from voting stations, reducing the votes cast for a party, disqualifying a candidate, or cancelling a party’s registration. Contravening Part 1 of that Chapter of the Act is also an offence (section 79).';

export const ALL_CODE_LINES: CodeLine[] = [
  ...STATED_RIGHTS,
  ...VOTER_PROTECTIONS,
  ...VOTING_DAY_RIGHTS,
  ...PARTY_MUST,
  ...PARTY_MUST_NOT,
  ...AT_THE_STATION,
];
