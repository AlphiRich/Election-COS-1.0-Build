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
    const run = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Run scenarios')!;
    await click(run);
    expect(el.textContent).toMatch(/Seats across 2[\s\u00a0]?000 draws/);
    expect(el.textContent).toContain('Outright majority, within these assumptions');
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
    await click([...el.querySelectorAll('button')].find((b) => b.textContent === 'Run scenarios')!);
    expect(el.querySelector('[role="alert"]')?.textContent).toMatch(/draws must be/);
    expect(el.textContent).not.toContain('Seats across');
  });
  it('offers swings only for parties on the 2026 list, and says who cannot be modelled', async () => {
    const el = await mount();
    const labels = [...el.querySelectorAll('label')].map((l) => l.textContent ?? '');
    for (const id of ['ANC', 'DA', 'EFF', 'PA', 'VFP']) {
      expect(labels.some((t) => t.startsWith(`${id} swing`))).toBe(true);
    }
    for (const id of ['ABC', 'ATM', 'BLF', 'F4SD']) {
      expect(labels.some((t) => t.startsWith(`${id} swing`))).toBe(false);
    }
    expect(el.textContent).toContain('Umkhonto Wesizwe Party');
    expect(el.textContent).toContain('Abantu Batho Congress');
    expect(el.textContent).toContain('not yet confirmed');
  });
});
