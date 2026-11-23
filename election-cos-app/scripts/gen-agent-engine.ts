/**
 * Election Campaign OS — regenerate the agent's copy of the seat engine
 *
 *   npm run gen:agent-engine
 *
 * See `src/modules/analytics/agentEngineMirror.ts` for why a mirror exists.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ENGINE_DIR, ENGINE_MIRRORS, renderMirror } from '@/modules/analytics/agentEngineMirror';

const root = process.cwd();
mkdirSync(path.resolve(root, ENGINE_DIR), { recursive: true });

for (const spec of ENGINE_MIRRORS) {
  const source = readFileSync(path.resolve(root, spec.src), 'utf-8').replace(/\r\n/g, '\n');
  writeFileSync(path.resolve(root, spec.dest), renderMirror(spec, source));
  console.log(`✓ ${spec.dest}`);
}
