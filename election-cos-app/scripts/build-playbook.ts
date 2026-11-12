/**
 * Election Campaign OS — "Ward Candidate Playbook" (4-page A4), from the Marketing Asset Architecture.
 * Facts come from the repo (PACKAGES, SITE, the PPFA figures in src/site/explainers.ts), not retyped.
 * It is marketing collateral, not legal advice: it says so on page 4 and states no legal conclusion.
 * Run: npx vite-node scripts/build-playbook.ts   ->  marketing/print/ward-candidate-playbook.docx
 */
import { createRequire } from 'node:module';
// `docx` is installed in the build environment, not a project dependency.
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageBreak, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} = createRequire(import.meta.url)('docx') as typeof import('docx');
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { tokens } from '../src/design/tokens';
import { PACKAGES, SITE } from '../src/site/siteContent';

const hex = (c: string) => c.replace('#', '');
const INK = hex(tokens.color.ink), GOLD = hex(tokens.color.gold), PAPER = hex(tokens.color.paper);
const BODY = 'Public Sans', DISPLAY = 'Archivo Narrow', MONO = 'IBM Plex Mono';

const p = (text: string, o: { bold?: boolean; size?: number; color?: string; after?: number; font?: string; italics?: boolean } = {}) =>
  new Paragraph({ spacing: { after: o.after ?? 120, line: 300 }, children: [new TextRun({ text, font: o.font ?? BODY, size: o.size ?? 22, bold: o.bold, color: o.color ?? INK, italics: o.italics })] });
const h1 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t })] });
const h2 = (t: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t })] });
const bullet = (lead: string, rest: string) =>
  new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 80, line: 290 }, children: [new TextRun({ text: lead, bold: true, font: BODY, size: 22, color: INK }), new TextRun({ text: ' ' + rest, font: BODY, size: 22, color: INK })] });
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const callout = (figure: string, label: string) =>
  new Table({
    width: { size: 9026, type: WidthType.DXA }, columnWidths: [2600, 6426],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 2600, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: INK }, margins: { top: 140, bottom: 140, left: 160, right: 160 },
        borders: { top: none, bottom: none, left: none, right: none },
        children: [new Paragraph({ children: [new TextRun({ text: figure, font: MONO, size: 34, bold: true, color: GOLD })] })] }),
      new TableCell({ width: { size: 6426, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: PAPER }, margins: { top: 140, bottom: 140, left: 200, right: 160 },
        borders: { top: none, bottom: none, left: none, right: none },
        children: [new Paragraph({ children: [new TextRun({ text: label, font: BODY, size: 21, color: INK })] })] }),
    ] })],
  });
const gap = () => new Paragraph({ spacing: { after: 160 }, children: [] });
const brk = () => new Paragraph({ children: [new PageBreak()] });

const ward = PACKAGES[0];
const doc = new Document({
  creator: 'Election Campaign OS', title: 'Ward Candidate Playbook',
  numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
  styles: {
    default: { document: { run: { font: BODY, size: 22, color: INK } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: DISPLAY, size: 52, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 160 }, keepNext: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: DISPLAY, size: 30, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: GOLD, space: 6 } }, children: [new TextRun({ text: `Election-COS  ·  electioncos.co.za  ·  ${SITE.entity}, ${SITE.registration}`, font: BODY, size: 16, color: tokens.color.slate.replace('#', '') })] })] }) },
    children: [
      // PAGE 1
      new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'ELECTION-', font: DISPLAY, size: 28, bold: true, color: INK, characterSpacing: 40 }), new TextRun({ text: 'COS', font: DISPLAY, size: 28, bold: true, color: GOLD, characterSpacing: 40 })] }),
      new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: GOLD, space: 8 } }, spacing: { after: 360 }, children: [] }),
      h1('The Ward Candidate Playbook'),
      p('Three rules decide whether a ward campaign is run well or run into trouble: how you handle voters’ personal information, how you handle money, and how you read the seat arithmetic. This playbook sets out each in plain terms and shows how Election Campaign OS carries the load.', { size: 24, after: 240 }),
      callout('Comply before you campaign', 'The order matters. Consent, donations and seat maths are far cheaper to get right on day one than to repair in the final week.'),
      gap(),
      h2('Who this is for'),
      p('Independent ward candidates, ward campaign managers, and small parties contesting selected wards. If you are managing a municipal or provincial structure, see the packages on page 4.'),
      h2('What is inside'),
      bullet('Page 2.', 'Voter information and POPIA consent: the risk, and what the app does about it.'),
      bullet('Page 3.', 'Donations and the PPFA lines: what must be disclosed, and the running total nobody wants to keep by hand.'),
      bullet('Page 4.', 'The seat formula in Schedule 1, and what a ward licence costs.'),
      // PAGE 2
      brk(),
      h1('Voter information and POPIA'),
      p('A canvasser with a clipboard, a spreadsheet and a WhatsApp group is processing personal information. The responsible party carries the burden of showing that consent was given. “We asked at the door” is not a record.', { after: 160 }),
      h2('Where campaigns get caught out'),
      bullet('Consent that exists only in memory.', 'Nothing links a voter record to when, how and by whom consent was obtained.'),
      bullet('Contact lists that travel.', 'Phone numbers pasted into group chats and personal spreadsheets, outside anyone’s control.'),
      bullet('Everyone sees everything.', 'A canvasser can open records for the whole ward when they need one street.'),
      bullet('Polling that identifies people.', 'Free-text answers and small groups let a reader work out who said what.'),
      gap(),
      h2('What Election-COS does'),
      bullet('Records consent with the voter.', 'A record is created only when consent is captured at the door, with the method and time.'),
      bullet('Scopes every account.', 'Canvassers see their own voting district; ward leads their ward.'),
      bullet('Keeps ID numbers out.', 'The app does not store full identity numbers.'),
      bullet('Polls without identifying anyone.', 'Closed-choice, anonymous questions. Counts only; groups below five responses are suppressed.'),
      gap(),
      callout('< 5', 'Responses in any poll group or answer category are suppressed, so a small number can never point to a person.'),
      // PAGE 3
      brk(),
      h1('Donations and the PPFA'),
      p('The Political Party Funding Act sets a line above which a donation must be disclosed, and a ceiling on what one donor may give in a year. Both were revised in 2025.', { after: 160 }),
      callout('R200,000', 'Disclosure line. A donation above this must be disclosed. The line applies to a donor’s payments added together, not to each payment on its own.'),
      gap(),
      callout('R30 million', 'The most a single donor may give a party in a financial year.'),
      gap(),
      p('Source: Government Gazette 53182 of 18 August 2025. Both figures are under court challenge and the software is updated if they change. Earlier figures (R100,000 and R15 million, and before that R80,000) still appear in material published before August 2025.', { size: 19, italics: true, color: tokens.color.slate.replace('#', '') }),
      h2('The problem is the running total'),
      p('The question is rarely whether one payment crossed the line. It is whether a donor has crossed it across several payments over a period. That is a running total, and somebody has to keep it, correctly, for every donor, every day.'),
      h2('What Election-COS does'),
      bullet('Aggregates by donor.', 'Each donation adds to that donor’s total for the period.'),
      bullet('Warns before the line.', 'Thresholds are configurable, so the warning arrives while there is still time to act.'),
      bullet('Separates duties.', 'Entering a donation and changing thresholds are different permissions, held by different roles.'),
      p('The donor-tracking add-on is priced by consultation.', { italics: true }),
      // PAGE 4
      brk(),
      h1('Seat arithmetic, and what it costs'),
      h2('How council seats are allocated'),
      p('For the proportional (PR) seats, Schedule 1 of the Municipal Structures Act divides the votes by a quota. In the Election-COS engine the quota is:'),
      new Paragraph({ spacing: { before: 60, after: 160 }, shading: { type: ShadingType.CLEAR, fill: PAPER }, indent: { left: 200, right: 200 }, children: [new TextRun({ text: 'Q = floor( A / (B − C − D) ) + 1', font: MONO, size: 26, bold: true, color: INK })] }),
      p('where A is the votes (PR and ward) counted for the parties on the PR list, B the seats on the council, C the seats won by independents, and D the ward seats won by parties without a PR list. A party’s PR seats follow from how many quotas its votes contain; ward seats it has already won are set off against its entitlement.'),
      p('Election-COS’s scenario runner starts from the certified 2026 results of the 18 local municipalities in North West. It describes and models; it does not calculate official seat allocations, which are the Electoral Commission’s.', { after: 160 }),
      h2('What a ward licence costs'),
      callout(ward.price, `per ward licence. ${PACKAGES[2].buyer}: ${PACKAGES[2].price} ${PACKAGES[2].unit}.`),
      gap(),
      p(`To book a demo: ${SITE.whatsApp.display} on WhatsApp (${SITE.whatsApp.role.toLowerCase()}), or electioncos.co.za.`, { bold: true, after: 200 }),
      p('This playbook is general information about a software product. It is not legal advice and states no legal conclusion about your campaign. Take advice on consent, donations and disclosure from your own attorney.', { size: 19, italics: true, color: tokens.color.slate.replace('#', '') }),
    ],
  }],
});
Packer.toBuffer(doc).then((b) => writeFileSync(path.resolve(__dirname, '../marketing/print/ward-candidate-playbook.docx'), b));
