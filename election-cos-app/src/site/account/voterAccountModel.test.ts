import { describe, expect, it } from 'vitest';
import {
  accountStep,
  authErrorMessage,
  isPlausibleEmail,
  maskPhone,
  normaliseSaMobile,
  passwordProblems,
} from './voterAccountModel';

describe('passwordProblems', () => {
  it('accepts a long password with a letter and a number', () => {
    expect(passwordProblems('river-stone-42', 'thandi@example.com')).toEqual([]);
  });

  it('refuses short, letter-only, number-only and common passwords', () => {
    expect(passwordProblems('abc12')).toContain('Use at least 10 characters.');
    expect(passwordProblems('onlyletterswords')).toContain('Use at least one letter and one number.');
    expect(passwordProblems('12345678901')).toContain('Use at least one letter and one number.');
    expect(passwordProblems('password123')).toContain('That password is too common.');
  });

  it('refuses a password built from the email address', () => {
    expect(passwordProblems('thandi2026xx', 'thandi@example.com')).toContain('Do not use your email address in the password.');
  });
});

describe('isPlausibleEmail', () => {
  it('accepts an ordinary address and refuses obvious mistakes', () => {
    expect(isPlausibleEmail('voter@example.co.za')).toBe(true);
    for (const bad of ['voter', 'voter@', '@example.com', 'voter@example', 'a b@example.com']) expect(isPlausibleEmail(bad), bad).toBe(false);
  });
});

describe('normaliseSaMobile', () => {
  it('reads the ways South Africans write a cellphone number', () => {
    for (const v of ['082 449 7310', '0824497310', '27824497310', '+27 82 449 7310', '(082) 449-7310'])
      expect(normaliseSaMobile(v), v).toBe('+27824497310');
  });

  it('refuses landlines, short numbers and other countries', () => {
    for (const v of ['011 123 4567', '082449731', '+44 7700 900123', ''])
      expect(normaliseSaMobile(v), v).toBeNull();
  });
});

describe('maskPhone', () => {
  it('shows enough to recognise the phone and no more', () => {
    expect(maskPhone('+27824497310')).toBe('082 *** 7310');
  });
});

describe('accountStep', () => {
  it('walks register, verify, add phone, ready', () => {
    expect(accountStep(null)).toBe('signed-out');
    expect(accountStep({ emailVerified: false, phoneFactors: 0 })).toBe('verify-email');
    expect(accountStep({ emailVerified: true, phoneFactors: 0 })).toBe('add-phone');
    expect(accountStep({ emailVerified: true, phoneFactors: 1 })).toBe('ready');
  });

  it('never lets a phone stand in for an unverified email', () => {
    expect(accountStep({ emailVerified: false, phoneFactors: 1 })).toBe('verify-email');
  });
});

describe('authErrorMessage', () => {
  it('says the common failures plainly and never shows the raw code', () => {
    expect(authErrorMessage('auth/email-already-in-use')).toMatch(/already uses this email/);
    expect(authErrorMessage('auth/operation-not-allowed')).toMatch(/not switched on yet/);
    expect(authErrorMessage('auth/something-new')).not.toContain('auth/');
  });
});
