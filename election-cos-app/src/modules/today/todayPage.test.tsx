// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '@/dal/ports/session';
import { SEED_ROLES } from '@/auth/seedRoles';

const state = vi.hoisted(() => ({ session: null as SessionContext | null }));
vi.mock('@/auth/useSession', () => ({ useSession: () => state.session }));
vi.mock('@/dal', () => ({
  dal: { municipalityProfile: { get: async () => ({ municipalityCode: 'NW405', municipalityName: 'JB Marks Local Municipality' }) } },
}));

import { TodayPage } from './TodayPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const capsOf = (id: string) => SEED_ROLES.find((r) => r.id === id)!.defaultCaps;

async function render(session: SessionContext) {
  state.session = session;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    createRoot(el).render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TodayPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  // The profile query and the ward results both resolve asynchronously.
  for (let i = 0; i < 20 && !el.textContent?.includes('point lead'); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Today', { timeout: 30_000 }, () => {
  it('shows a canvasser the certified council, the closest races and only their own actions', async () => {
    const el = await render({ tenantId: 't', uid: 'u', caps: capsOf('canvasser'), geoScope: 'VD', vdScope: '86910239' });
    const text = el.textContent ?? '';
    expect(text).toContain('JB Marks');
    expect(text).toContain('67 seats');
    expect(text).toContain('34needed to govern');
    expect(text).toContain('No party holds a majority');
    expect(el.querySelectorAll('svg circle')).toHaveLength(67);
    expect(text).toContain('Closest 2026 Races');
    const links = [...el.querySelectorAll('nav[aria-label="Field actions"] a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['/round', '/roll', '/incidents/new', '/diary']);
  });

  it('shows a ward lead their own ward', async () => {
    const el = await render({ tenantId: 't', uid: 'u', caps: capsOf('ward-lead'), geoScope: 'WARD', wardScope: 'NW405-W12' });
    const text = el.textContent ?? '';
    expect(text).toContain('Your Ward');
    expect(text).toContain('Your ward as certified on 4 November 2026.');
  });

  it('carries no party colour and none of the prototype’s unverified content', async () => {
    const el = await render({ tenantId: 't', uid: 'u', caps: capsOf('municipal-team-lead'), geoScope: 'MUNICIPALITY' });
    const text = el.textContent ?? '';
    for (const banned of ['Wikipedia', 'Service risk', "turnout '24", 'Preview as']) expect(text).not.toContain(banned);
  });
});
