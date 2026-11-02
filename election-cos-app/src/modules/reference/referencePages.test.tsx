// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CandidateListPage } from './CandidateListPage';
import { VdLocatorPage } from './VdLocatorPage';
import { VoterStatisticsPage } from './VoterStatisticsPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => {
    createRoot(el).render(<MemoryRouter>{node}</MemoryRouter>);
  });
  return el;
}
const type = async (input: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const click = async (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

describe('Candidates page', () => {
  it('lists the 20 parties and the counts, with no identity numbers', async () => {
    const el = await mount(<CandidateListPage />);
    expect(el.textContent).toContain('African National Congress');
    expect(el.textContent).toContain('Vryheidsfront Plus | Freedom Front Plus');
    expect(el.textContent).toContain('611');
    expect(el.textContent).toContain('on the owner');
    expect(el.textContent).not.toMatch(/\d{6}\s?\*{2,}/);
  });
  it('filters by name and says how many match', async () => {
    const el = await mount(<CandidateListPage />);
    const inputs = [...el.querySelectorAll('input[type="search"]')];
    const q = inputs[inputs.length - 1] as HTMLInputElement;
    await type(q, 'zzzzqq');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('0 candidates');
  });
  it('narrows to one ward', async () => {
    const el = await mount(<CandidateListPage />);
    const wardSelect = [...el.querySelectorAll('select')].find((s) =>
      s.textContent?.includes('All wards'),
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(
        wardSelect,
        '7',
      );
      wardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const rows = [...el.querySelectorAll('tbody tr')].filter((r) =>
      r.textContent?.includes('Ward 7'),
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('Voting-district locator', () => {
  it('finds a station by name and opens its detail with a chart and the roll against the seed', async () => {
    const el = await mount(<VdLocatorPage />);
    await type(el.querySelector('input[type="search"]') as HTMLInputElement, 'uniting reformed');
    expect(el.textContent).toContain('UNITING REFORMED CHURCH IN SA');
    await click(el.querySelector('button[aria-label^="Show detail for UNITING"]')!);
    expect(el.textContent).toContain('Verified voters by age band');
    expect(el.textContent).toContain('different documents');
  });
  it('says plainly when nothing matches', async () => {
    const el = await mount(<VdLocatorPage />);
    await type(el.querySelector('input[type="search"]') as HTMLInputElement, 'zzzzqq');
    expect(el.querySelector('[role="status"]')?.textContent).toBe('No voting district matches.');
  });
});

describe('Voter statistics', () => {
  it('shows the roll total, both numbers for registered voters, and the charts', async () => {
    const el = await mount(<VoterStatisticsPage />);
    expect(el.textContent).toMatch(/131[\s\u00a0]963/);
    expect(el.textContent).toContain('Two numbers for registered voters');
    expect(el.textContent).toContain('Verified voters by age band');
    expect(el.textContent).toContain('Share aged 18 to 29, by ward');
    expect(el.textContent).toContain('Sex cannot be derived');
  });
  it('offers every chart as a table', async () => {
    const el = await mount(<VoterStatisticsPage />);
    const toggle = [...el.querySelectorAll('button')].find(
      (b) => b.textContent === 'View as table',
    )!;
    await click(toggle);
    expect(el.textContent).toContain('Group');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent === 'View as chart')).toBe(
      true,
    );
  });
  it('draws no bar for a hidden cell and never presents it as zero', async () => {
    const { BarChart } = await import('./BarChart');
    const el = await mount(
      <BarChart
        title="t"
        orientation="column"
        valueLabel="v"
        caption="c"
        bars={[
          { label: 'a', value: 50, shown: '50' },
          { label: 'b', value: null, shown: '' },
        ]}
      />,
    );
    const b = el.querySelector('[aria-label^="b:"]') as HTMLElement;
    expect(b.getAttribute('aria-label')).toContain('hidden');
    expect(b.style.height === '0px' || b.style.height === '0').toBe(true);
    await click([...el.querySelectorAll('button')].find((x) => x.textContent === 'View as table')!);
    expect(el.textContent).toContain('Hidden (under 10)');
  });
});
