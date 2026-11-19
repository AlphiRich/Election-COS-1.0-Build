/**
 * Election Campaign OS — page-view counts adapter
 *
 * One callable, `recordPageViews`. The tenant is read from the token on the server; `ctx` is taken
 * only because every port method takes it (§5.2), and nothing from it is sent.
 */
import { httpsCallable } from 'firebase/functions';
import type { PageViewsRepository } from '@/dal/ports/pageViews';
import { getFunctionsClient } from './client';

export const pageViewsRepository: PageViewsRepository = {
  async record(_ctx, counts) {
    const call = httpsCallable<{ counts: Record<string, number> }, { recorded: number }>(
      getFunctionsClient(),
      'recordPageViews',
    );
    await call({ counts });
  },
};
