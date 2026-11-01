/**
 * Election Campaign OS — personal-data scan for generated output.
 *
 * Used by the export sweep (`src/exportSweep.test.ts`): every file the application generates
 * for a person to keep must carry aggregates and codes, not contact details or ID numbers.
 * It looks for a 13-digit run (the length of a South African ID number) and for South African
 * phone formats written with or without spaces. It is a tripwire, not a classifier: it errs
 * toward flagging.
 */
export interface PiiHit {
  kind: 'id-number' | 'phone';
  text: string;
}

const PATTERNS: Array<[PiiHit['kind'], RegExp]> = [
  ['id-number', /(?<!\d)\d{13}(?!\d)/g],
  ['phone', /(?<!\d)(?:\+27|0027|0)[\s-]?[1-8]\d[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g],
];

export function findPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const [kind, re] of PATTERNS)
    for (const m of text.matchAll(re)) hits.push({ kind, text: m[0] });
  return hits;
}
