// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '@/dal';

const { record } = vi.hoisted(() => ({ record: vi.fn(async () => {}) }));
vi.mock('@/dal', () => ({ dal: { pageViews: { record } } }));

import { usePageViews } from './pageViews';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSION: SessionContext = { tenantId: 'jbm-pilot', uid: 'u1', caps: [], geoScope: 'TENANT' };

function mount(session: SessionContext | null, path: string) {
  function Shell() {
    usePageViews(session);
    return <Outlet />;
  }
  const router = createMemoryRouter(
    [{ path: '/', element: <Shell />, children: [{ path: 'wards/:wardCode', element: <p>ward</p> }, { path: 'voters', element: <p>voters</p> }] }],
    { initialEntries: [path] },
  );
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<RouterProvider router={router} />));
  return { router, root };
}

afterEach(() => {
  record.mockClear();
  document.body.innerHTML = '';
});

describe('usePageViews in the Shell', () => {
  it('sends the route pattern, never the ward code or query string, when the page is closed', async () => {
    const { router } = mount(SESSION, '/wards/NW405-W1?vd=86910587');
    await act(() => router.navigate('/voters?vd=86910587'));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(SESSION, { '/wards/:wardCode': 1, '/voters': 1 });
    expect(JSON.stringify(record.mock.calls)).not.toMatch(/NW405|86910587/);
  });

  it('counts nothing and sends nothing without a session', async () => {
    const { router } = mount(null, '/voters');
    await act(() => router.navigate('/wards/NW405-W1'));
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(record).not.toHaveBeenCalled();
  });

  it('keeps nothing on the device', () => {
    mount(SESSION, '/voters');
    expect(document.cookie).toBe('');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
