// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SeatHistoryCard } from './VoterIntelligencePage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
});

function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<MemoryRouter><SeatHistoryCard /></MemoryRouter>));
  return el;
}

describe('the JB Marks three-council card', () => {
  it('shows 2016, 2021 and 2026 seats per party, with the change since 2021', () => {
    const el = mount();
    const headers = [...el.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toEqual(['Party', '2016', '2021', '2026', '2021 to 2026']);
    const anc = [...el.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.startsWith('African National Congress'))!;
    expect([...anc.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['African National Congress', '34', '33', '22', '-11']);
  });

  it('names its sources and says the 2016 "Independent Councillors" are a party', () => {
    const text = mount().textContent ?? '';
    expect(text).toContain('2016 North West party results');
    expect(text).toContain('registered party, not independent candidates');
    expect(text).toContain('A majority is 34 seats');
  });
});
