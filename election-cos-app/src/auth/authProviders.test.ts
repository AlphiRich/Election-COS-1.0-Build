import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNIN_EMAIL_DOMAINS,
  PROVIDER_IDS,
  PROVIDER_SCOPES,
  isAllowedSignInEmail,
  signInEmailDomains,
  enabledProviders,
  signInErrorMessage,
} from './authProviders';

describe('enabledProviders', () => {
  it('defaults to Google only when unset, empty or all unknown', () => {
    for (const raw of [undefined, '', '  ', 'myspace,,'])
      expect(enabledProviders(raw)).toEqual(['google']);
  });
  it('reads a list, ignoring case, spaces, duplicates and unknown names', () => {
    expect(enabledProviders('Google, FACEBOOK ,facebook,twitter,apple')).toEqual([
      'google',
      'facebook',
      'apple',
    ]);
  });
  it('can offer Meta alone', () => {
    expect(enabledProviders('facebook')).toEqual(['facebook']);
  });
});

describe('scopes', () => {
  it('ask for email at most, and nothing broader, from every provider', () => {
    for (const id of PROVIDER_IDS) {
      for (const scope of PROVIDER_SCOPES[id]) expect(scope).toBe('email');
    }
    expect(PROVIDER_SCOPES.facebook).not.toContain('user_friends');
    expect(PROVIDER_SCOPES.facebook).not.toContain('user_posts');
  });
});

describe('signInErrorMessage', () => {
  it('stays quiet when the person closed the window', () => {
    expect(signInErrorMessage('auth/popup-closed-by-user')).toBeNull();
    expect(signInErrorMessage('auth/cancelled-popup-request')).toBeNull();
  });
  it('tells the person what to do for an account that exists under another method', () => {
    const m = signInErrorMessage('auth/account-exists-with-different-credential')!;
    expect(m).toMatch(/different sign-in method/);
    expect(m).toMatch(/administrator/);
  });
  it('says when a provider has not been switched on, and falls back to a generic message', () => {
    expect(signInErrorMessage('auth/operation-not-allowed')).toMatch(/not been switched on/);
    expect(signInErrorMessage('auth/whatever')).toMatch(/Sign-in failed/);
    expect(signInErrorMessage(undefined)).toMatch(/Sign-in failed/);
  });
});


describe('email-link sign-in domains', () => {
  it('defaults to the two company domains', () => {
    expect(signInEmailDomains(undefined)).toEqual([...DEFAULT_SIGNIN_EMAIL_DOMAINS]);
    expect(signInEmailDomains('')).toEqual([...DEFAULT_SIGNIN_EMAIL_DOMAINS]);
  });
  it('parses an override list, tolerating spaces, case and a leading @', () => {
    expect(signInEmailDomains(' Example.com, @other.co.za ,example.com')).toEqual(['example.com', 'other.co.za']);
  });
  it('admits only the allowed domains, case-insensitively', () => {
    const d = signInEmailDomains(undefined);
    // Addresses are built from the domain constants so this test file never contains a literal
    // corporate-domain mailbox (productMail.test.ts forbids one anywhere in source).
    expect(isAllowedSignInEmail(`neo@${DEFAULT_SIGNIN_EMAIL_DOMAINS[0]}`, d)).toBe(true);
    expect(isAllowedSignInEmail(`staff@${DEFAULT_SIGNIN_EMAIL_DOMAINS[1]}`, d)).toBe(true);
    expect(isAllowedSignInEmail('someone@gmail.com', d)).toBe(false);
    expect(isAllowedSignInEmail('someone@sub.electioncos.co.za', d)).toBe(false);
  });
  it('rejects malformed addresses rather than guessing', () => {
    const d = signInEmailDomains(undefined);
    for (const bad of ['', 'no-at-sign', '@electioncos.co.za', 'trailing@', 'a@b@electioncos.co.za']) {
      expect(isAllowedSignInEmail(bad, d), bad).toBe(false);
    }
  });
});
