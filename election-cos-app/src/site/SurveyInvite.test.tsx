// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SurveyInvite } from './SurveyInvite';
import { SURVEY_DISMISS_KEY } from './surveyInvite';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const URL_OK = 'https://forms.gle/AbC123';
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function mount(props: { url?: string | null; delayMs?: number }) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => createRoot(el).render(<MemoryRouter><SurveyInvite {...props} /></MemoryRouter>));
  return el;
}
beforeEach(() => window.localStorage.clear());
afterEach(() => { document.body.innerHTML = ''; });

describe('the survey invitation', () => {
  it('never appears without a survey address (no dead link on the front page)', async () => {
    const el = await mount({ url: null, delayMs: 10 });
    await wait(60);
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
  it('appears after the delay as a labelled dialog that says where the answers go and when consent is asked', async () => {
    const el = await mount({ url: URL_OK, delayMs: 10 });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    await wait(60);
    const d = el.querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-labelledby')).toBe('survey-invite-title');
    const t = d.textContent ?? '';
    expect(t).toContain('Google stores the answers');
    expect(t).toContain('consent is asked at the bottom of the form');
    expect(t).toContain('We do not sell personal information (POPIA)');
    const a = d.querySelector('a[href]') as HTMLAnchorElement;
    expect(a.href).toBe(URL_OK);
    expect(a.rel).toContain('noopener');
    expect(d.querySelector('video')!.getAttribute('autoplay')).toBeNull();
  });
  it('Escape closes it and it is not shown again', async () => {
    const el = await mount({ url: URL_OK, delayMs: 10 });
    await wait(60);
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(window.localStorage.getItem(SURVEY_DISMISS_KEY)).toBe('1');
    const el2 = await mount({ url: URL_OK, delayMs: 10 });
    await wait(60);
    expect(el2.querySelector('[role="dialog"]')).toBeNull();
  });
  it('"Not now" closes it', async () => {
    const el = await mount({ url: URL_OK, delayMs: 10 });
    await wait(60);
    const b = [...el.querySelectorAll('button')].find((x) => x.textContent === 'Not now')!;
    await act(async () => b.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});
