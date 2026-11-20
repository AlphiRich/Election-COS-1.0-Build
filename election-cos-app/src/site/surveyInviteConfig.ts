/**
 * Election Campaign OS — the survey invitation on the landing page.
 *
 * The survey is a Google Form (tools/survey/ecos_google_form_generator.gs creates it; the OWNER runs that script and gets
 * its published address). Until an address is set there is nothing to link to, and a pop-up that links nowhere would be a
 * dead link on the front page, so with no address the invitation does not appear. Set it as the Actions variable
 * VITE_SURVEY_URL; the deploy workflow passes it to the build.
 *
 * Only a Google Forms address is accepted, over https, so a mistyped or hostile value cannot send visitors elsewhere.
 */
export const SURVEY_HOSTS = ['docs.google.com', 'forms.gle', 'forms.google.com'] as const;
export const SURVEY_DISMISS_KEY = 'ecos.surveyInvite.dismissed';
export const SURVEY_DELAY_MS = 6000;

export function resolveSurveyUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    if (!(SURVEY_HOSTS as readonly string[]).includes(u.hostname)) return null;
    if (u.hostname === 'docs.google.com' && !u.pathname.startsWith('/forms/')) return null;
    return u.toString();
  } catch {
    return null;
  }
}
export const SURVEY_URL = resolveSurveyUrl(import.meta.env.VITE_SURVEY_URL as string | undefined);

export function wasDismissed(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(SURVEY_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}
export function rememberDismissal(storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(SURVEY_DISMISS_KEY, '1');
  } catch {
    /* private mode: it simply asks again next visit */
  }
}
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
