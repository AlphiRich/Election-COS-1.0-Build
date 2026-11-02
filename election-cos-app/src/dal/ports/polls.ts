/**
 * Election Campaign OS — voter sentiment polls port.
 * Definitions are staff-written; tallies are written only by the `poll` Cloud Function and are
 * counts with no identifiers (src/modules/polls/pollModel.ts).
 */
import type { PollDefinition } from '@/modules/polls/pollModel';
import type { SessionContext } from './session';

export interface PollTally {
  counts: Record<string, number>;
  total: number;
  updatedAt: string | null;
}

export interface PollsRepository {
  list(ctx: SessionContext): Promise<PollDefinition[]>;
  create(
    ctx: SessionContext,
    def: Omit<PollDefinition, 'id' | 'publicId'>,
  ): Promise<PollDefinition>;
  setStatus(ctx: SessionContext, id: string, status: PollDefinition['status']): Promise<void>;
  getTally(ctx: SessionContext, id: string): Promise<PollTally>;
}
