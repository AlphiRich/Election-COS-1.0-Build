/**
 * Election Campaign OS — Campaign Director: give LangGraph its run context on every runtime.
 *
 * LangGraph finds the current run's config through LangChain's
 * AsyncLocalStorage singleton; `interrupt()` (the human-approval pause) depends
 * on it. Under Node, LangGraph's Node entry initialises that singleton. But
 * `@langchain/langgraph` also exports a `browser` build, and Cloudflare's bundler
 * resolves the `browser` condition — so on the worker the singleton is never
 * initialised, LangChain falls back to a mock store, and every `interrupt()`
 * throws "Called interrupt() outside the context of a graph". The approval gate
 * silently fails to pause.
 *
 * Found by running the agent under workerd (stage 2); Node tests could not see
 * it. Fixed by doing what the Node entry does, here, for every runtime.
 * `initializeGlobalInstance` only sets the instance when none exists, so under
 * Node it is a no-op. `nodejs_compat` provides `node:async_hooks` on the worker.
 *
 * Imported for its side effect by graph.ts, so no graph can be built without
 * it. `asyncContext.test.ts` guards that import.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { AsyncLocalStorageProviderSingleton } from '@langchain/core/singletons';

AsyncLocalStorageProviderSingleton.initializeGlobalInstance(new AsyncLocalStorage());
