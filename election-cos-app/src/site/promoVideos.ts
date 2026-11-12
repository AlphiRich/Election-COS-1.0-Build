/**
 * Election Campaign OS — the promotional videos supplied 12 Nov 2026, as they are used on the site.
 *
 * A SEPARATE REGISTRY from explainerVideos.ts on purpose: that one is held to a design-source export
 * (video-src/explainers) word for word. These are finished promotional cuts, each with the poster and caption file the
 * site needs, and each held to the claims the product can back.
 *
 * ONLY WHAT IS TRUE IS HERE. Eight further videos were supplied and are NOT hosted, with the reason recorded in
 * HELD so the decision is visible and a test keeps it from being undone quietly:
 *  - four Gemini-generated clips: they advertise "Start Free Trial" (there is no trial), show "OFFLINE WHATSAPP ENGINE
 *    LIVE" (there is no live WhatsApp engine), show a price that does not match the published one, carry garbled
 *    on-screen text, and show a realistic person who is not real with no disclosure;
 *  - the dashboard promo: it says "10-year turnout trends", and this build holds 2021 and 2026 only;
 *  - one byte-identical duplicate, and the 1080x1920 explainer already published as who-governs-your-council.
 */
export interface PromoVideo {
  id: string;
  title: string;
  /** Orientation decides the player's shape. */
  shape: 'portrait' | 'landscape';
  seconds: number;
  /** The video's words, as text, shown under it so nobody has to watch. */
  readIt: string;
}

export const PROMO_VIDEOS: PromoVideo[] = [
  {
    id: 'who-governs-your-council',
    title: 'Who Governs Your Council?',
    shape: 'portrait',
    seconds: 15,
    readIt:
      'After the 2026 elections, 139 of 213 councils have no majority. Councillors must now agree who governs. See your council at electioncos.co.za. Calculated by Election-COS from the Electoral Commission’s certified results; coalition scenarios are what-if arithmetic, not forecasts.',
  },
  {
    id: 'landing-survey',
    title: 'Share Your Ward’s Priorities',
    shape: 'landscape',
    seconds: 15,
    readIt:
      'Share your ward’s priorities in the 4-minute voter survey. Enter your email, municipality and ward, or locate it with Google Maps. Consent comes first.',
  },
];

export const promoUrls = (id: string) => ({ video: `/videos/${id}.mp4`, captions: `/videos/${id}.vtt`, poster: `/videos/${id}.jpg` });

export const HELD: ReadonlyArray<{ file: string; reason: string }> = [
  { file: 'gemini_generated_video_2528af3b.mp4', reason: 'AI-generated: invented app screens with figures, no disclosure, no captions' },
  { file: 'gemini_generated_video_7ba04028.mp4', reason: 'AI-generated: "Start Free Trial" (there is no trial), garbled on-screen text, no disclosure' },
  { file: 'gemini_generated_video_55a68bdb.mp4', reason: 'AI-generated: a realistic person who is not real with no disclosure; a price that must be checked against the published list' },
  { file: 'gemini_generated_video_aef0f24f.mp4', reason: 'AI-generated: "OFFLINE WHATSAPP ENGINE LIVE" (no such engine is live), garbled text, design-token labels visible' },
  { file: 'ecos-landing-dashboard-1920x1080.mp4', reason: 'says "10-year turnout trends"; this build holds 2021 and 2026 only' },
  { file: 'gemini_generated_video_6761348a.mp4', reason: 'byte-identical to gemini_generated_video_7ba04028.mp4' },
  { file: 'ecos-launch-v1-1080x1920.mp4', reason: 'published as who-governs-your-council' },
];
