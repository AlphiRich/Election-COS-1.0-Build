import { describe, expect, it } from 'vitest';
import { SURVEY_DISMISS_KEY, rememberDismissal, resolveSurveyUrl, wasDismissed } from './surveyInvite';

describe('the survey address', () => {
  it('accepts a Google Forms address over https', () => {
    expect(resolveSurveyUrl('https://docs.google.com/forms/d/e/abc/viewform')).toBe('https://docs.google.com/forms/d/e/abc/viewform');
    expect(resolveSurveyUrl('https://forms.gle/AbC123')).toBe('https://forms.gle/AbC123');
  });
  it('is off when nothing is set, and rejects anything that is not a Google Form', () => {
    expect(resolveSurveyUrl(undefined)).toBeNull();
    expect(resolveSurveyUrl('')).toBeNull();
    for (const bad of ['http://forms.gle/x', 'https://evil.example/forms/d/e/x', 'https://docs.google.com/document/d/1', 'javascript:alert(1)', 'not a url', 'https://forms.gle.evil.example/x']) {
      expect(resolveSurveyUrl(bad), bad).toBeNull();
    }
  });
});

describe('dismissal', () => {
  it('is remembered, and survives storage that throws', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(wasDismissed(store)).toBe(false);
    rememberDismissal(store);
    expect(mem.get(SURVEY_DISMISS_KEY)).toBe('1');
    expect(wasDismissed(store)).toBe(true);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(wasDismissed(broken)).toBe(false);
    expect(() => rememberDismissal(broken)).not.toThrow();
  });
});

describe('the live survey form', () => {
  it('is accepted by the allow-list, query string and all', () => {
    const u = 'https://docs.google.com/forms/d/e/1FAIpQLSfGqRP3v4rSkAmElNyxafKT6BreVtsCRHQq8sPwjQtBCFr87w/viewform?usp=header';
    expect(resolveSurveyUrl(u)).toBe(u);
  });
});
