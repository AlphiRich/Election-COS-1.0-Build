// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Lge2026ResultsPage } from './Lge2026ResultsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<MemoryRouter><Lge2026ResultsPage /></MemoryRouter>); });
  return el;
}
const click = async (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

describe('LGE 2026 results page', () => {
  it('opens on JB Marks with the Commission’s seats, per-ballot turnout and the district note', async () => {
    const el = await mount();
    expect(el.textContent).toContain('African National Congress');
    expect(el.textContent).toMatch(/67/);
    expect(el.textContent).toContain('never added together');
    expect(el.textContent).toMatch(/Schedule 2[\s\S]*not implement/);
    expect(el.textContent).toMatch(/\b2[\s ]069\b/); // the Commission's quota for NW405
  });
  it('opens a ward’s voting districts for JB Marks', async () => {
    const el = await mount();
    await click(el.querySelector('button[aria-label="Voting districts of ward 1"]')!);
    expect(el.textContent).toContain('UNITING REFORMED CHURCH IN SA');
  });
  it('says plainly when the Item 16 recalculation applied (Mafikeng)', async () => {
    const el = await mount();
    const sel = el.querySelector('select')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, 'NW383');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(el.textContent).toContain('recalculated');
    expect(el.textContent).toMatch(/70/);
  });
});
