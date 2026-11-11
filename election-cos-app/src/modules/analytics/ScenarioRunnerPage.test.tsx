// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { RUNNER_CAVEAT } from './scenarioRunner';
import { ScenarioRunnerPage } from './ScenarioRunnerPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <ScenarioRunnerPage />
      </MemoryRouter>,
    );
  });
  return el;
}
const click = async (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

describe('Scenario Runner page', () => {
  it('states the conditional caveat before anything is run, and shows no results yet', async () => {
    const el = await mount();
    expect(el.textContent).toContain(RUNNER_CAVEAT);
    expect(el.textContent).not.toContain('Outright majority');
  });
  it('runs, shows the seat table, majority frequencies with sampling error, and the caveat again', async () => {
    const el = await mount();
    const run = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Run Scenarios')!;
    await click(run);
    expect(el.textContent).toMatch(/Seats across 2[\s\u00a0]?000 draws/i);
    expect(el.textContent).toContain('Outright Majority, Within These Assumptions');
    expect(el.textContent).toMatch(/Sampling error on each figure is at most/);
    expect(el.textContent).toContain('not a forecast');
    expect(el.textContent).toContain('No ward changes hands in any draw');
  });
  it('shows a plain error instead of results when the draws are out of range', async () => {
    const el = await mount();
    const draws = [...el.querySelectorAll('input')].find((i) => i.value === '2000')!;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(draws, '5');
      draws.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click([...el.querySelectorAll('button')].find((b) => b.textContent === 'Run Scenarios')!);
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/draws must be/);
    expect(el.textContent).not.toContain('Seats Across');
  });
  it('starts from the certified 2026 result and offers a swing for every party with at least 2% of the party votes', async () => {
    const el = await mount();
    expect(el.textContent).toContain('JB Marks, 2026');
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent ?? '');
    for (const id of ['ANC', 'DA', 'EFF', 'VFP', 'ACTIONSA']) {
      expect(labels.some((t) => t.startsWith(`${id} swing`)), id).toBe(true);
    }
    expect(labels.some((t) => t.startsWith('ABC swing'))).toBe(false); // a 2021 party, not on the 2026 ballot
    expect(el.textContent).toContain('a change from the certified 2026 result');
  });
  it('shows what moved between 2021 and 2026 and can copy the observed ward spreads, which the person may then change', async () => {
    const el = await mount();
    expect(el.textContent).toContain('What Moved Between 2021 and 2026 in JB Marks');
    expect(el.textContent).toContain('One election pair, described and not modelled');
    await click([...el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Use these spreads'))!);
    const spread = [...el.querySelectorAll('input')].find((i) => i.id && el.querySelector(`label[for="${i.id}"]`)?.textContent === 'ANC spread')!;
    expect(Number(spread.value)).toBeGreaterThan(0);
  });
  it('can still start from the 2021 result, with the 2021 party notice', async () => {
    const el = await mount();
    const year = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('2021 (superseded'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(year, '2021');
      year.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent ?? '');
    for (const id of ['ANC', 'DA', 'EFF', 'PA', 'VFP']) expect(labels.some((t) => t.startsWith(`${id} swing`)), id).toBe(true);
    expect(el.textContent).toContain('Abantu Batho Congress');
  });
  it('can start from another North West municipality, and the seats still add up to its council', async () => {
    const el = await mount();
    const sel = [...el.querySelectorAll('select')].find((x) => x.textContent?.includes('NW372'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, 'NW372');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(el.textContent).toContain('Madibeng, 2026');
    expect(el.textContent).toContain('82 council seats');
    await click([...el.querySelectorAll('button')].find((b) => b.textContent === 'Run Scenarios')!);
    expect(el.textContent).toMatch(/Seats across 2[\s\u00a0]?000 draws/i);
  });
});
