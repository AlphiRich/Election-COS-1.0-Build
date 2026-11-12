// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { SEED_ROLES } from './seedRoles';
import {
  secondFactorSatisfied,
  type SecondFactorGateway,
} from './secondFactor';
import { SecondFactorStep } from './SecondFactorStep';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const REPO = path.resolve(__dirname, '..', '..');

describe('who has cleared the second step', () => {
  it('is satisfied by mfaRequired:false or a live mfaUntil, and fails closed otherwise', () => {
    const now = 1_700_000_000_000;
    expect(secondFactorSatisfied({ mfaRequired: false }, now)).toBe(true);
    expect(secondFactorSatisfied({ mfaRequired: true }, now)).toBe(false);
    expect(secondFactorSatisfied({ mfaRequired: true, mfaUntil: now / 1000 + 60 }, now)).toBe(true);
    expect(secondFactorSatisfied({ mfaRequired: true, mfaUntil: now / 1000 - 1 }, now)).toBe(false);
    expect(secondFactorSatisfied({}, now)).toBe(false); // claim absent = required
  });
  it('the server stamps mfaRequired from requiresSecondFactor, which exempts only the canvasser', () => {
    const src = readFileSync(path.join(REPO, 'functions/src/resolveCapabilities.ts'), 'utf8');
    expect(src).toContain('mfaRequired: requiresSecondFactor(after.roleId)');
    const fn = readFileSync(path.join(REPO, 'functions/src/secondFactor.ts'), 'utf8');
    expect(fn).toMatch(/SECOND_FACTOR_EXEMPT_ROLES: readonly string\[\] = \['canvasser'\]/);
    expect(SEED_ROLES.map((r) => r.id)).toContain('canvasser');
  });
});

describe('firestore.rules enforces it', () => {
  const rules = readFileSync(path.join(REPO, 'firestore.rules'), 'utf8');
  it('tenantOK, the gate every tenant collection passes, requires mfaOK()', () => {
    expect(/function tenantOK\(tid\) \{[^}]*&& mfaOK\(\);/.test(rules)).toBe(true);
  });
  it('mfaOK fails closed on a missing claim and otherwise needs a live mfaUntil', () => {
    const body = /function mfaOK\(\) \{([^}]*)\}/.exec(rules)![1];
    expect(body).toContain("get('mfaRequired', true) == false");
    expect(body).toContain("get('mfaUntil', 0) > request.time.toMillis() / 1000");
  });
});

function gateway(over: Partial<SecondFactorGateway> = {}): SecondFactorGateway {
  return {
    request: vi.fn(async () => ({ ok: true as const, challengeId: 'c1', phoneMasked: '082 •••• 567', expiresAt: 0 })),
    verify: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
}
async function mount(g: SecondFactorGateway) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => createRoot(el).render(<SecondFactorStep email="a@b.co" gateway={g} onSignOut={() => {}} />));
  return el;
}
const btn = (el: Element, t: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === t)!;
const click = (e: Element) => act(async () => void e.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (i: HTMLInputElement, v: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(i, v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('the code screen', () => {
  it('asks to send first, shows only a masked number, then verifies the typed code', async () => {
    const g = gateway();
    const el = await mount(g);
    expect(el.querySelector('input')).toBeNull();
    await click(btn(el, 'Send code'));
    expect(el.textContent).toContain('082 •••• 567');
    const input = el.querySelector('input') as HTMLInputElement;
    expect(btn(el, 'Verify and continue').hasAttribute('disabled')).toBe(true);
    await type(input, '12a345 6');
    expect(input.value).toBe('123456');
    await click(btn(el, 'Verify and continue'));
    expect(g.verify).toHaveBeenCalledWith('c1', '123456');
  });
  it('shows the reason when the code cannot be sent or is wrong', async () => {
    const el = await mount(gateway({ request: async () => ({ ok: false, message: 'Sign-in codes are not available on this deployment yet.' }) }));
    await click(btn(el, 'Send code'));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('not available');
    const el2 = await mount(gateway({ verify: async () => ({ ok: false, message: 'That code is not right. 4 tries left.' }) }));
    await click(btn(el2, 'Send code'));
    await type(el2.querySelector('input') as HTMLInputElement, '111111');
    await click(btn(el2, 'Verify and continue'));
    expect(el2.querySelector('[role="alert"]')?.textContent).toContain('4 tries left');
  });
});
