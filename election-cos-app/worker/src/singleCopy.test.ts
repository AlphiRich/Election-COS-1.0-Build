// @vitest-environment node
/**
 * The worker bundle must hold ONE copy of LangGraph: every LangGraph / LangChain
 * import lives under functions/src, and the worker reaches the agent only
 * through it (runAgent.ts explains why — two copies break interrupt/Command).
 * This fails if a production file in worker/src imports `@langchain/*` itself.
 * Comments are blanked first so a file explaining the rule cannot trip it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = __dirname;
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
export const directLangchainImport = (src: string) =>
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@langchain\//.test(stripComments(src));

describe('worker/src production files never import LangGraph directly', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

  it('finds the worker sources (guards the scan itself)', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'agentRoute.ts']));
  });

  for (const f of files) {
    it(`${f} has no direct @langchain import`, () => {
      expect(directLangchainImport(readFileSync(path.join(DIR, f), 'utf8'))).toBe(false);
    });
  }

  it('the detector catches the forms it must, and ignores comments', () => {
    expect(directLangchainImport("import { Command } from '@langchain/langgraph';")).toBe(true);
    expect(directLangchainImport("const m = await import('@langchain/core/messages');")).toBe(true);
    expect(directLangchainImport("// import x from '@langchain/langgraph'")).toBe(false);
    expect(directLangchainImport("/* see '@langchain/langgraph' */ const a = 1;")).toBe(false);
    expect(directLangchainImport("import { runAgent } from '../../functions/src/agents/campaignDirector/runAgent';")).toBe(false);
  });
});
