// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DrillDownPage } from '@/modules/drilldown/DrillDownPage';
import { AnalystPage } from './AnalystPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(node: React.ReactElement) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => {
    createRoot(el).render(<MemoryRouter>{node}</MemoryRouter>);
  });
  return el;
}
const setValue = async (input: HTMLElement, value: string) =>
  act(async () => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const click = async (el: Element) =>
  act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
const byText = (el: Element, sel: string, t: string) =>
  [...el.querySelectorAll(sel)].find((b) => b.textContent?.includes(t))!;

const CSV = 'ward,party,votes,contact\nW1,ANC,100,0821234567\nW2,DA,40,0731112222\nW3,ANC,80,0841110000\nW4,DA,70,0822223333\n';

describe('Data analyst page', () => {
  it('removes a column of phone numbers, runs a segments question, and never prints the numbers', async () => {
    const el = await mount(<AnalystPage />);
    const paste = el.querySelectorAll('textarea')[0] as HTMLTextAreaElement;
    await setValue(paste, CSV);
    await click(byText(el, 'button', 'Add Pasted Data'));
    expect(el.textContent).toContain('contact in pasted-1.csv');
    expect(el.textContent).toContain('Removed.');
    await setValue(el.querySelectorAll('textarea')[1] as HTMLTextAreaElement, 'What are the top segments by value?');
    await click(byText(el, 'button', 'Run Analysis'));
    expect(el.textContent).toContain('votes by');
    expect(el.textContent).toContain('removed: contact');
    expect(el.textContent).not.toContain('0821234567');
    expect(el.textContent).toContain('No model was fitted');
  });
  it('profiles only the cleaned table: a summary shows neither the removed column nor its values', async () => {
    const el = await mount(<AnalystPage />);
    await setValue(el.querySelectorAll('textarea')[0] as HTMLTextAreaElement, CSV);
    await click(byText(el, 'button', 'Add Pasted Data'));
    await setValue(el.querySelectorAll('textarea')[1] as HTMLTextAreaElement, 'Summarize the key trends in this data.');
    await click(byText(el, 'button', 'Run Analysis'));
    const table = el.querySelector('table[aria-label], table')!;
    expect(table.textContent).toContain('party');
    expect(table.textContent).not.toContain('contact');
    expect(el.textContent).not.toMatch(/0821234567|0731112222/);
  });
  it('says plainly when the question is outside what it can do', async () => {
    const el = await mount(<AnalystPage />);
    await setValue(el.querySelectorAll('textarea')[0] as HTMLTextAreaElement, CSV);
    await click(byText(el, 'button', 'Add Pasted Data'));
    await setValue(el.querySelectorAll('textarea')[1] as HTMLTextAreaElement, 'Who will win ward 7?');
    await click(byText(el, 'button', 'Run Analysis'));
    expect(el.textContent).toMatch(/cannot answer that question/i);
  });
  it('will not run with no data or no question', async () => {
    const el = await mount(<AnalystPage />);
    expect((byText(el, 'button', 'Run Analysis') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Drill-down page', () => {
  it('shows 122,059, all wards, and opens a ward with its voting districts', async () => {
    const el = await mount(<DrillDownPage />);
    expect(el.textContent).toMatch(/122[\s\u00a0]059/);
    expect(el.textContent).toContain('not a forecast');
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(34);
    await click(el.querySelector('button[aria-label="Open ward 1"]')!);
    expect(el.textContent).toContain('Voting districts in ward 1');
    expect(el.textContent).toContain('UNITING REFORMED CHURCH IN SA');
    expect(el.textContent).not.toMatch(/131[\s\u00a0]?963/);
  });
});
