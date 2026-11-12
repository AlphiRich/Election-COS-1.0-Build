// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// The page asks the election database first. Tests run without one, so it answers "nothing" and the bundled results are used.
vi.mock('@/dal/adapters/firestore/electionData', () => ({ fetchCouncilWards: async () => null }));
import { VoterIntelligencePage } from './VoterIntelligencePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const plain = (t: string | null) => (t ?? '').replace(/\u00a0|\u202f/g, ' ');
const settle = async (until?: (t: string) => boolean) => {
  for (let i = 0; i < 40; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
    if (!until || until(plain(document.body.textContent))) return;
  }
};
async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => createRoot(el).render(<MemoryRouter><VoterIntelligencePage /></MemoryRouter>));
  await settle((t) => t.includes('Hung council') || t.includes('One party holds'));
  return el;
}

describe('Voter Intelligence page', () => {
  it('opens on JB Marks with the real seats, a coalition table and the honest "does not have" list', async () => {
    const el = await mount();
    const t = plain(el.textContent);
    expect(t).toContain('Hung council: a coalition is required');
    expect(t).toContain('African National Congress');
    expect(t).toContain('Coalition arithmetic');
    expect(t).toContain('What this instrument does not have');
    expect(t).toContain('Safe: 10');
    expect(el.querySelectorAll('select')[0].options.length).toBe(213);
  });
  it('switches council: another council reads its own result', async () => {
    const el = await mount();
    const sel = el.querySelector('select')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sel, 'BUF');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle((t) => t.includes('Buffalo City has'));
    expect(plain(el.textContent)).toContain('Buffalo City has 100 seats; 51 are needed');
  });
});
