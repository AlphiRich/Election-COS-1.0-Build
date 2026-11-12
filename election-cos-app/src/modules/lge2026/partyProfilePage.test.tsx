// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PartyProfilePage } from './PartyProfilePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const plain = (t: string | null) => (t ?? '').replace(/\u00a0|\u202f/g, ' ');
async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => createRoot(el).render(<MemoryRouter><PartyProfilePage /></MemoryRouter>));
  return el;
}
const pick = async (el: Element, label: string, value: string) => {
  const sel = [...el.querySelectorAll('select')].find((s) => s.id && el.querySelector(`label[for="${s.id}"]`)?.textContent === label)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Party candidates and result page', () => {
  it('opens on ActionSA in JB Marks with the process, the one-name list, and the unnamed-seats warning', async () => {
    const el = await mount();
    const t = plain(el.textContent);
    expect(t).toContain('How This List Was Obtained and Checked');
    expect(t).toContain('same SHA-256');
    expect(t).toContain('35 in the ingest, 35 in the reference file, 0 differences');
    expect(t).toContain('XOLILE DAVID KHAM');
    expect(t).toContain('4 seats cannot be named from it. No names have been invented.');
    expect(el.querySelectorAll('svg[role="img"]').length).toBe(3);
    expect(el.querySelectorAll('table').length).toBe(2);
  });
  it('switching party re-reads everything: the DA list is complete, so there is no warning', async () => {
    const el = await mount();
    await pick(el, 'Party', 'DEMOCRATIC ALLIANCE');
    const t = plain(el.textContent);
    expect(t).not.toContain('cannot be named from it');
    expect(t).toContain('Democratic Alliance');
  });
  it('switching municipality offers only parties with a candidate list there', async () => {
    const el = await mount();
    await pick(el, 'Municipality', 'NW403');
    expect([...el.querySelectorAll('select')][1].options.length).toBeGreaterThan(3);
    expect(plain(el.textContent)).toContain('Matlosana');
  });
});
