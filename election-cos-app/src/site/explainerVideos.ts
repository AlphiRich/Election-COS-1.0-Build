/**
 * Election Campaign OS — the short video explainers.
 *
 * ONE IDEA PER VIDEO, TEN TO THIRTY SECONDS. Voters and campaign staff will not read a manual,
 * so each explainer is a short video with its words on screen. The words are also kept here as
 * `readIt`, shown under the video, so nobody has to watch to know what it says and a screen reader
 * gets the same content.
 *
 * NO VIDEO IS FAKED. A video is `hosted` only when its files are in `site-assets/videos/` (a test checks);
 * otherwise `youtubeId` is null until a video has actually been recorded and uploaded to YouTube. A null id never produces a player; the page shows the text and says plainly that
 * the video is not out yet. Videos live on YouTube so the static site stays light; the player
 * is loaded only AFTER a click, from youtube-nocookie.com, so visiting the page sends nothing to
 * YouTube (no cookie, no IP) before the person asks for the video.
 *
 * Every claim here is a fact about this software and is held to the same lint as the rest of
 * the marketing source (no party names, no forbidden claims). Examples use invented data.
 */
export type Audience = 'voters' | 'parties';

export interface Explainer {
  id: string;
  audience: Audience;
  title: string;
  /** Target running time in seconds. Short on purpose. */
  seconds: number;
  /** The video's words, as text. */
  readIt: string;
  /** 11-character YouTube video id, or null while no video exists. */
  youtubeId: string | null;
  /**
   * True when the finished video, its caption file and its poster are served from this site, at
   * `/videos/<id>.mp4`, `.vtt` and `.jpg` (source: `site-assets/videos/`). Preferred over YouTube: nothing
   * leaves the site. A test fails if a hosted explainer is missing any of the three files.
   */
  hosted: boolean;
}

export const hostedUrls = (id: string) => ({
  video: `/videos/${id}.mp4`,
  captions: `/videos/${id}.vtt`,
  poster: `/videos/${id}.jpg`,
});

export const MAX_SECONDS = 60;

export const EXPLAINERS: Explainer[] = [
  {
    id: 'canvasser-knocks',
    audience: 'voters',
    title: 'When a Canvasser Knocks',
    seconds: 20,
    readIt:
      'They must ask your permission before they record anything about you. You can say no. If you say no, nothing is stored, and there is no list of people who said no.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'poll-answer',
    audience: 'voters',
    title: 'Your Answer to a Poll',
    seconds: 20,
    readIt:
      'A poll asks for a choice and nothing else: no name, number or ID. Your answer is counted with others and is not linked to you. You can pick "Prefer not to say".',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'seats-won',
    audience: 'voters',
    title: 'How Seats Are Won',
    seconds: 30,
    readIt:
      'Some seats are won in wards, the rest from the party vote. Schedule 1 of the Municipal Structures Act turns votes into seats. The calculator shows the working, with the law cited.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'roles',
    audience: 'parties',
    title: 'Seven Roles, Each Sees Only Its Own Ground',
    seconds: 12,
    readIt:
      'A ward lead sees a ward. A canvasser sees a voting district. The refusal is made by the database rules, not only by the screen.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'command-view',
    audience: 'parties',
    title: 'One View of the Campaign',
    seconds: 10,
    readIt:
      'People recorded with consent, doors worked, incidents open. Counts only. Nothing on it names a voter.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'capture-consent',
    audience: 'parties',
    title: 'Capture With Consent',
    seconds: 11,
    readIt:
      'The canvasser types the person’s name back before the record button works, so a mis-tap cannot create consent. A refusal stores nothing.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'offline',
    audience: 'parties',
    title: 'Offline in a Dead Zone',
    seconds: 15,
    readIt:
      'Work is kept on the phone and sent when signal returns. The screen shows what is still waiting. Clearing the browser’s data removes anything not yet sent, and the app says so.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'funding-30-day',
    audience: 'parties',
    title: 'Funding Line and the 30-Day Clock',
    seconds: 14,
    readIt:
      'A donor’s payments are added up against the R200,000 disclosure line (Government Gazette 53182, under court challenge). A person’s request about their own data is tracked against a 30-day target.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'sentiment-polls',
    audience: 'parties',
    title: 'Sentiment Polls: What They Can and Cannot Tell You',
    seconds: 30,
    readIt:
      'Answers come from people who chose to reply to a link. They are not a random sample, so there is no margin of error and no forecast. Groups under five answers are hidden.',
    youtubeId: null,
    hosted: true,
  },
  {
    id: 'scenario-runner',
    audience: 'parties',
    title: 'The Scenario Runner: Your Assumptions, Run Many Times',
    seconds: 30,
    readIt:
      'You set the swing and how unsure you are. The software repeats the seat calculation across that range and shows which assumption matters most. It is not a prediction.',
    youtubeId: null,
    hosted: true,
  },
];

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export const isYoutubeId = (id: string | null | undefined): id is string =>
  typeof id === 'string' && YOUTUBE_ID_RE.test(id);

/**
 * The player address, or null when there is no valid id. Always the privacy-enhanced host;
 * captions on by default; related videos limited to the same channel; autoplay because it is only
 * ever requested after the person has pressed play.
 */
export function embedUrl(id: string | null | undefined): string | null {
  if (!isYoutubeId(id)) return null;
  const q = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    cc_load_policy: '1',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${q.toString()}`;
}

export const byAudience = (a: Audience) => EXPLAINERS.filter((e) => e.audience === a);

export const fmtSeconds = (s: number) => `0:${String(s).padStart(2, '0')}`;
