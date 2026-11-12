import { describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

const signInWithPopupMock = vi.fn();
const updateProfileMock = vi.fn();

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
    updateProfile: (...args: unknown[]) => updateProfileMock(...args),
  };
});

vi.mock('@/dal/adapters/firestore/client', () => ({
  getFirebaseAuth: () => ({ __fake: 'auth-instance' }),
}));

const { assertMinimalAuthPayload, toMinimalAuthRecord, signInWithGoogle, PERMITTED_AUTH_FIELDS } =
  await import('./firebaseAuth');

// IC-ECOS-BUILD-2026-V2 §4.3: "Write a test that asserts this and run it in
// CI. It is the kind of rule that erodes silently." This is that test.
describe('Firebase Auth minimal-footprint rule (§4.3)', () => {
  it('permits exactly uid, email, emailVerified', () => {
    expect(PERMITTED_AUTH_FIELDS).toEqual(['uid', 'email', 'emailVerified']);
    expect(() =>
      assertMinimalAuthPayload({ uid: 'abc', email: 'a@example.org', emailVerified: true }),
    ).not.toThrow();
  });

  it.each([
    'firstName',
    'lastName',
    'displayName',
    'phoneNumber',
    'idNumber',
    'photoURL',
    'wardScope',
    'roleId',
  ])('rejects a payload containing "%s"', (forbiddenKey) => {
    expect(() => assertMinimalAuthPayload({ uid: 'abc', [forbiddenKey]: 'anything' })).toThrow();
  });

  it('rejects an entire StaffProfile-shaped object being spread into an Auth write', () => {
    const staffLike = {
      uid: 'abc',
      tenantId: 'tenant-1',
      firstName: 'Thabo',
      lastName: 'Molefe',
      phone: '+27821234567',
      roleId: 'canvasser',
      wardScope: 'NW405-W12',
    };
    expect(() => assertMinimalAuthPayload(staffLike)).toThrow(/tenants\/\{tenantId\}\/staff/);
  });

  it('toMinimalAuthRecord projects a Firebase User down to permitted fields only', () => {
    const fakeUser = {
      uid: 'uid-123',
      email: 'staff@example.org',
      emailVerified: true,
      displayName: 'Should Never Be Here',
      phoneNumber: '+27821234567',
    } as unknown as User;

    const record = toMinimalAuthRecord(fakeUser);
    expect(Object.keys(record).sort()).toEqual(['email', 'emailVerified', 'uid']);
    expect(record).not.toHaveProperty('displayName');
    expect(record).not.toHaveProperty('phoneNumber');
  });
});

describe('signInWithGoogle — scrubs the profile fields Firebase auto-populates from Google', () => {
  it('calls updateProfile to clear displayName/photoURL when Google populated them', async () => {
    const fakeUser = {
      uid: 'uid-456',
      email: 'staff@example.org',
      emailVerified: true,
      displayName: 'Thabo Molefe',
      photoURL: 'https://lh3.googleusercontent.com/a/photo.jpg',
    } as unknown as User;
    signInWithPopupMock.mockResolvedValueOnce({ user: fakeUser });
    updateProfileMock.mockResolvedValueOnce(undefined);

    const result = await signInWithGoogle();

    expect(signInWithPopupMock).toHaveBeenCalledTimes(1);
    expect(updateProfileMock).toHaveBeenCalledWith(fakeUser, { displayName: null, photoURL: null });
    expect(result).toBe(fakeUser);
  });

  it('skips the updateProfile call when Google returned no name/photo to begin with', async () => {
    updateProfileMock.mockClear();
    const fakeUser = {
      uid: 'uid-789',
      email: 'staff@example.org',
      emailVerified: true,
      displayName: null,
      photoURL: null,
    } as unknown as User;
    signInWithPopupMock.mockResolvedValueOnce({ user: fakeUser });

    await signInWithGoogle();

    expect(updateProfileMock).not.toHaveBeenCalled();
  });
});

describe('signInWithProvider — Meta, Microsoft and Apple', () => {
  const user = (over: object = {}) =>
    ({
      uid: 'u',
      email: 'a@b.org',
      emailVerified: true,
      displayName: null,
      photoURL: null,
      ...over,
    }) as unknown as User;

  it("uses Facebook's provider with the email scope only, and scrubs the name and photo Meta supplies", async () => {
    const { signInWithProvider } = await import('./firebaseAuth');
    updateProfileMock.mockClear();
    signInWithPopupMock.mockClear();
    const u = user({ displayName: 'Thabo M', photoURL: 'https://graph.facebook.com/x.jpg' });
    signInWithPopupMock.mockResolvedValueOnce({ user: u });
    updateProfileMock.mockResolvedValueOnce(undefined);
    await signInWithProvider('facebook');
    const provider = signInWithPopupMock.mock.calls[0][1] as {
      providerId: string;
      getScopes(): string[];
    };
    expect(provider.providerId).toBe('facebook.com');
    expect(provider.getScopes()).toEqual(['email']);
    expect(updateProfileMock).toHaveBeenCalledWith(u, { displayName: null, photoURL: null });
  });

  it('maps Microsoft and Apple to their Firebase provider ids', async () => {
    const { signInWithProvider } = await import('./firebaseAuth');
    for (const [id, pid] of [
      ['microsoft', 'microsoft.com'],
      ['apple', 'apple.com'],
    ] as const) {
      signInWithPopupMock.mockClear();
      signInWithPopupMock.mockResolvedValueOnce({ user: user() });
      await signInWithProvider(id);
      expect((signInWithPopupMock.mock.calls[0][1] as { providerId: string }).providerId).toBe(pid);
    }
  });

  it('passes a provider error straight through, so the page can map its code, and links nothing', async () => {
    const { signInWithProvider } = await import('./firebaseAuth');
    const err = Object.assign(new Error('exists'), {
      code: 'auth/account-exists-with-different-credential',
    });
    signInWithPopupMock.mockRejectedValueOnce(err);
    await expect(signInWithProvider('facebook')).rejects.toBe(err);
  });
});
