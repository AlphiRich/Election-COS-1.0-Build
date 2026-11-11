/**
 * Title Case for every heading, label, button and navigation item on the
 * public site and in the application (house style, 11 Nov 2026):
 *
 *   "139 of 213 councils have no majority" → "139 of 213 Councils Have No Majority"
 *   "How a municipal council is made up"   → "How a Municipal Council Is Made Up"
 *
 * Rules (headline style):
 *  - every word starts with a capital, except the short words below, which
 *    stay lower case unless they open or close the text or follow a colon,
 *    dash or opening bracket;
 *  - verbs are never "short words": Is, Are, Be, Has and Do are capitalised;
 *  - each part of a hyphenated word is treated as a word (Councillors-Elect,
 *    Add-On); a short word inside a compound stays lower case (Bottom-of-Funnel);
 *  - nothing is ever lowered: acronyms and codes (IEC, PR, POPIA, NW405),
 *    brand spellings with an inner capital (eThekwini, iPhone), numbers,
 *    URLs and e-mail addresses are left exactly as written.
 *
 * Body text (sentences and paragraphs) stays in sentence case.
 */
export const MINOR_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for',
  'as', 'at', 'by', 'in', 'of', 'on', 'per', 'to', 'via', 'vs', 'vs.',
]);

/** Leave alone: anything with a digit, an inner capital, a dot inside, an @ or a slash. */
function untouchable(word: string): boolean {
  return /\d/.test(word) || /^[a-z]+[A-Z]/.test(word) || /\w\.\w/.test(word) || /[@/]/.test(word);
}

function capitalise(part: string): string {
  const i = part.search(/[A-Za-zÀ-ÿ]/);
  if (i < 0) return part;
  return part.slice(0, i) + part.charAt(i).toUpperCase() + part.slice(i + 1);
}

export function titleCase(text: string): string {
  const tokens = text.split(/(\s+)/);
  const words = tokens.filter((t) => t.trim() !== '');
  let wordIndex = -1;
  let afterBreak = true; // the first word, and the first after ":", "—", "–", "(" or "?"
  return tokens
    .map((token) => {
      if (token.trim() === '') return token;
      wordIndex += 1;
      const first = afterBreak;
      const last = wordIndex === words.length - 1;
      afterBreak = /[:—–?!]$/.test(token) || /^[—–]$/.test(token);
      if (/^[—–-]$/.test(token)) return token;
      const opensBracket = /^[(“"‘']/.test(token);
      const parts = token.split('-');
      return parts
        .map((part, j) => {
          if (untouchable(part)) return part;
          const bare = part.replace(/^[(“"‘']+|[)”"’',.;:!?…]+$/g, '').toLowerCase();
          const lastPart = j === parts.length - 1;
          const minor =
            MINOR_WORDS.has(bare) &&
            (j === 0 ? !first && !last && !opensBracket : !lastPart); // Bottom-of-Funnel, but Add-On
          return minor ? part : capitalise(part);
        })
        .join('-');
    })
    .join('');
}

/** True when `text` is already in house Title Case. */
export function isTitleCase(text: string): boolean {
  return titleCase(text) === text;
}
