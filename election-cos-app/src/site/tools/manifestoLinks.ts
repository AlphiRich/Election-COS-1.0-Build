/**
 * Election Campaign OS — public site, manifesto search links
 *
 * Treats every party identically: the same two searches, built from the
 * name typed. It does not hold or recommend any party's website, because a
 * link this build has not been able to check is a link that can be wrong,
 * and a hand-picked list is not neutral. The Electoral Commission's own
 * voter-education videos are one search away for the same reason.
 */
export interface ManifestoLinks {
  web: string;
  video: string;
}

export function manifestoLinks(party: string): ManifestoLinks | null {
  const name = party.trim().replace(/\s+/g, ' ');
  if (name.length < 2) return null;
  const q = encodeURIComponent(`${name} manifesto 2026 local government elections`);
  return {
    web: `https://www.google.com/search?q=${q}`,
    video: `https://www.youtube.com/results?search_query=${q}`,
  };
}

export const IEC_VOTER_EDUCATION_VIDEOS =
  'https://www.youtube.com/results?search_query=' +
  encodeURIComponent('Electoral Commission of South Africa voter education');
