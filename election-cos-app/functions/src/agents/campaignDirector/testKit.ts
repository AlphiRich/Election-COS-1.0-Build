/**
 * Election Campaign OS — Campaign Director: LangGraph primitives for worker-side tests.
 *
 * The worker must never import LangGraph itself (see runAgent.ts): its bundle
 * would then carry a second copy, and two copies break `interrupt`/`Command`.
 * Worker TESTS need a few primitives to script a model and resume a run, so
 * they take them from here — the same single copy the production bundle uses.
 * No production code imports this file. `worker/src/singleCopy.test.ts` guards
 * the rule for the worker's production files.
 */
export { Command } from '@langchain/langgraph';
export { AIMessage, HumanMessage, type BaseMessage } from '@langchain/core/messages';
export { memoryThreadLease } from './threadLease';

import { AIMessage as AIMessageClass } from '@langchain/core/messages';
import type { ProvenanceClaim } from './scenarioPolicy';

/** A scripted model reply that delivers a briefing the only way the graph accepts. */
export function submitBriefing(briefing: string, claims: ProvenanceClaim[] = [], id = 'submit-1') {
  return new AIMessageClass({ content: '', tool_calls: [{ name: 'submit_briefing', args: { briefing, claims }, id }] });
}

/** A cost meter that allows every call (tests that are not about the meter). */
export const freeMeter = async (): Promise<void> => undefined;
