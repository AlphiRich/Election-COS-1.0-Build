import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AsyncLocalStorageProviderSingleton, MockAsyncLocalStorage } from '@langchain/core/singletons';
import './graph';

describe('LangGraph run context is initialised on every runtime', () => {
  it('graph.ts imports asyncContext before anything from LangGraph', () => {
    const src = readFileSync(path.join(__dirname, 'graph.ts'), 'utf8');
    const ctxAt = src.indexOf("import './asyncContext';");
    const lgAt = src.indexOf("from '@langchain/langgraph'");
    expect(ctxAt).toBeGreaterThanOrEqual(0);
    expect(ctxAt).toBeLessThan(lgAt);
  });

  it('the singleton holds a real AsyncLocalStorage, not the mock interrupt() cannot use', () => {
    expect(AsyncLocalStorageProviderSingleton.getInstance()).not.toBeInstanceOf(MockAsyncLocalStorage);
  });
});
