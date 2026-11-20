// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CASEWORK_FAQ, CASEWORK_FEATURES, CASE_STEPS, PLACEHOLDER_RE, VAT_NOTE } from '../siteContent';
import { SiteCasework } from './SiteCasework';
import { SiteCaseworkBrochure } from './SiteCaseworkBrochure';
import { readFileSync } from 'node:fs';
import path from 'node:path';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
});

function mount(Page: () => JSX.Element = SiteCaseworkBrochure) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  act(() => createRoot(el).render(<MemoryRouter><Page /></MemoryRouter>));
  return el;
}

describe('the Casework Tracker brochure', () => {
  it('carries the page’s own steps, features, questions, price and contact line', () => {
    const text = mount().textContent ?? '';
    for (const s of CASE_STEPS) expect(text).toContain(s.title);
    for (const f of CASEWORK_FEATURES) expect(text).toContain(f.title);
    expect(text).toContain(CASEWORK_FAQ[0].q); // the one question with a supplied answer
    expect(text).toContain('R2,500 per ward a month');
    expect(text).toContain(VAT_NOTE);
    expect(text).toContain('082 449 7310');
    expect(text).toContain('sales@electioncos.co.za');
  });

  it('never prints an unanswered placeholder, on the brochure or on the Casework page', () => {
    for (const Page of [SiteCaseworkBrochure, SiteCasework]) {
      const text = mount(Page).textContent ?? '';
      expect(text, Page.name).not.toMatch(PLACEHOLDER_RE);
      expect(text, Page.name).not.toContain('How Does Onboarding Work?');
      document.body.replaceChildren();
    }
  });

  it('keeps the no-state-authority line the product insists on', () => {
    expect(mount().textContent).toContain('party document with no state authority');
  });

  it('is what both "Download the Brochure" buttons open, not the contact form', () => {
    const page = readFileSync(path.resolve(__dirname, 'SiteCasework.tsx'), 'utf8');
    const links = [...page.matchAll(/<Link to="([^"]+)"[^>]*>\s*Download the Brochure/g)].map((m) => m[1]);
    expect(links).toEqual(['/casework-tracker/brochure', '/casework-tracker/brochure']);
  });
});
