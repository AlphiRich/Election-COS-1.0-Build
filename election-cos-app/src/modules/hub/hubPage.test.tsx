// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubPage } from './HubPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<MemoryRouter><HubPage /></MemoryRouter>); });
  return el;
}
const panel = (el: Element) => el.querySelector('div[role="tabpanel"][id^="panel-"]')!.textContent ?? '';
const plain = (t: string | null) => (t ?? '').replace(/\u00a0/g, ' ');
const click = async (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const tab = (el: Element, label: string) => [...el.querySelectorAll('[role="tab"]')].find((t) => t.textContent === label)!;
const button = (el: Element, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === text)!;
const setRange = async (input: HTMLInputElement, v: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('Master hub', () => {
  it('opens on Strategy with the six tabs, six metrics and the list of changes from the master stack', async () => {
    const el = await mount();
    expect([...el.querySelectorAll('[role="tab"]')].filter((t) => t.id.startsWith('tab-')).map((t) => t.textContent)).toEqual(['Strategy & Funnel', 'Media & Campaign Assets', '32-Agent Code Stack', 'Schedule 1 Seat Calculator', 'Legal & Statutory Vault', 'DNS & Deployment Gate']);
    expect(el.textContent).toMatch(/4[\s\u00a0]488/);
    expect(plain(el.textContent)).toContain('2 069');
    expect(el.textContent).toContain('What was changed from the master stack');
    expect(el.textContent).toContain('2026 Bottom-of-Funnel');
  });
  it('toggles the funnel between BOFU and TOFU', async () => {
    const el = await mount();
    await click([...el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('2029 TOFU'))!);
    expect(el.textContent).toContain('Enterprise Platform');
    expect(panel(el)).not.toMatch(/predictive/i);
  });
  it('filters the asset grid by category and shows the real QR on the poster', async () => {
    const el = await mount();
    await click(tab(el, 'Media & Campaign Assets'));
    expect(el.querySelectorAll('[data-testid="asset-grid"] > div')).toHaveLength(6);
    await click(button(el, 'Print collateral'));
    expect(el.querySelectorAll('[data-testid="asset-grid"] > div')).toHaveLength(2);
    expect(el.querySelector('img[alt^="QR code for WhatsApp"]')).not.toBeNull();
    expect(el.textContent).toContain('Customer care and sales line');
  });
  it('generates the newsletter preview in a sandboxed frame with a download link, sending nothing', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    const el = await mount();
    await click(tab(el, 'Media & Campaign Assets'));
    await click(button(el, 'Generate preview'));
    const frame = el.querySelector('iframe')!;
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(frame.getAttribute('srcdoc')).toContain('32810');
    expect(el.querySelector('a[download]')).not.toBeNull();
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
  it('searches the 32 agents and states what each is in this build', async () => {
    const el = await mount();
    await click(tab(el, '32-Agent Code Stack'));
    expect(el.querySelectorAll('[data-testid="agent-grid"] > div')).toHaveLength(32);
    await setRange(el.querySelector('input[type="search"]') as HTMLInputElement, 'quota');
    expect(el.querySelectorAll('[data-testid="agent-grid"] > div').length).toBeLessThan(32);
    expect(el.textContent).toContain('QUOTA_FORMULA_GUARDIAN');
    expect(el.textContent).toContain('In this build:');
  });
  it('recomputes the quota as the sliders move, and says ERR when nothing is left to divide', async () => {
    const el = await mount();
    await click(tab(el, 'Schedule 1 Seat Calculator'));
    expect(plain(el.querySelector('[data-testid="quota-result"]')!.textContent)).toBe('2 069');
    const ranges = [...el.querySelectorAll('input[type="range"]')] as HTMLInputElement[];
    await setRange(ranges[1], '5'); // C = 5: 138568 / 62 + 1
    expect(plain(el.querySelector('[data-testid="quota-result"]')!.textContent)).toBe('2 235');
    expect(el.textContent).toContain('JB Marks 2026');
  });
  it('shows the funding position without ever calling it lawful, and the legal documents with their real status', async () => {
    const el = await mount();
    await click(tab(el, 'Legal & Statutory Vault'));
    expect(el.textContent).toContain('BELOW_WARNING');
    const slider = [...el.querySelectorAll('input[type="range"]')][0] as HTMLInputElement;
    await setRange(slider, '250000');
    expect(el.textContent).toContain('AT_OR_ABOVE_DISCLOSURE');
    expect(panel(el).split('Position relative to the lines')[1]).not.toMatch(/lawful|compliant|permitted/i);
    await click([...el.querySelectorAll('button[role="tab"]')].find((t) => t.textContent === '06. PAIA Manual')!);
    expect(el.textContent).toContain('Not drafted');
    expect(panel(el)).not.toMatch(/PUBLISHED & ACTIVE/i);
  });
  it('sets the DNS specification beside what was observed, and counts the checklist honestly', async () => {
    const el = await mount();
    await click(tab(el, 'DNS & Deployment Gate'));
    expect(el.textContent).toContain('v=spf1 -all');
    expect(el.textContent).toContain('Do NOT replace');
    expect(el.querySelectorAll('[data-testid="discipline-grid"] > div')).toHaveLength(13);
    expect(panel(el)).not.toContain('13/13 PASSED');
  });
});

describe('timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it('the teleprompter lights a block every 2.5 s and stops after the last', async () => {
    const el = await mount();
    await click(tab(el, 'Media & Campaign Assets'));
    await click(button(el, 'Play simulation'));
    expect(el.querySelectorAll('[data-lit="true"]')).toHaveLength(1);
    await act(async () => { vi.advanceTimersByTime(2600); });
    expect([...el.querySelectorAll('[data-lit]')].findIndex((x) => x.getAttribute('data-lit') === 'true')).toBe(1);
    await act(async () => { vi.advanceTimersByTime(12000); });
    expect(el.textContent).toContain('Status: Stopped');
  });
  it('the outbox simulator walks PENDING, IN_FLIGHT, APPLIED through the real state machine', async () => {
    const el = await mount();
    await click(tab(el, '32-Agent Code Stack'));
    await click(button(el, 'Simulate field canvass sync'));
    await act(async () => { vi.advanceTimersByTime(2000); });
    const log = el.querySelector('[data-testid="outbox-log"]')!.textContent!;
    expect(log).toContain('PENDING');
    expect(log).toContain('IN_FLIGHT');
    expect(log).toContain('APPLIED');
    expect(el.querySelector('[data-state="APPLIED"]')!.getAttribute('data-active')).toBe('true');
  });
});
