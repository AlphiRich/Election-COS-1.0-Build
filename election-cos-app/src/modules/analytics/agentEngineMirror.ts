/**
 * Election Campaign OS — the seat engine, mirrored into the functions package.
 *
 * WHY A MIRROR (same reasoning as `seedRolesMirror.ts`)
 *
 * `functions/` is a separate npm package with its own tsconfig; it cannot
 * import from `src/`. The Campaign Director agent's deterministic tools
 * (`get_certified_baseline`, `run_schedule1_scenario`) need the authoritative
 * Schedule 1 quota engine and the verified NW405 2021 baseline — the one thing
 * that must never be reimplemented or fabricated. So the engine is copied, not
 * re-written: `npm run gen:agent-engine` copies these source files into
 * `functions/src/agents/campaignDirector/engine/`, rewriting their `@/` imports
 * to local paths, and `agentEngineMirror.test.ts` renders them again and
 * compares byte-for-byte, so a change to the real engine that is not
 * regenerated fails the build.
 *
 * Only the pure chain is mirrored: `seatCalculator.ts` (the Item 12 quota),
 * `municipalRegister.ts` + its annexure JSON (the Schedule-applies guard and
 * delimitation version it depends on), and `nw405Example.ts` (the real,
 * independently-verifiable 2021 result). The ward-level Monte-Carlo scenario
 * tree stays in the app; the agent's scenario tool runs a transparent
 * PR-level swing through this same `allocateSeats`.
 *
 * This module is pure (no fs): the generator and the guard each read and write
 * the files and call `renderMirror`, so there is one rewrite rule and one
 * header, used by both.
 */

export interface MirrorSpec {
  /** Source path, relative to the app package root. */
  src: string;
  /** Destination path, relative to the app package root. */
  dest: string;
  kind: 'ts' | 'json';
  /** Literal import-specifier rewrites applied to a `ts` mirror. */
  rewrites: [from: string, to: string][];
}

export const ENGINE_DIR = 'functions/src/agents/campaignDirector/engine';

export const ENGINE_MIRRORS: MirrorSpec[] = [
  // The annexure data the register reads — copied verbatim (JSON takes no banner).
  {
    src: 'src/data/iec/circular-1-2025-annexure-a.json',
    dest: `${ENGINE_DIR}/circular-1-2025-annexure-a.json`,
    kind: 'json',
    rewrites: [],
  },
  // The register — its only import is the annexure JSON.
  {
    src: 'src/modules/reference/municipalRegister.ts',
    dest: `${ENGINE_DIR}/municipalRegister.ts`,
    kind: 'ts',
    rewrites: [["'@/data/iec/circular-1-2025-annexure-a.json'", "'./circular-1-2025-annexure-a.json'"]],
  },
  // The Schedule 1 quota engine — imports only the register.
  {
    src: 'src/modules/analytics/seatCalculator.ts',
    dest: `${ENGINE_DIR}/seatCalculator.ts`,
    kind: 'ts',
    rewrites: [["'@/modules/reference/municipalRegister'", "'./municipalRegister'"]],
  },
  // The verified NW405 2021 result — no imports.
  {
    src: 'src/modules/analytics/nw405Example.ts',
    dest: `${ENGINE_DIR}/nw405Example.ts`,
    kind: 'ts',
    rewrites: [],
  },
];

function banner(src: string): string {
  return [
    '/**',
    ' * GENERATED — DO NOT EDIT.',
    ` * Mirror of \`${src}\` for the Cloud Functions package, which cannot import`,
    ' * from src/. Regenerate with `npm run gen:agent-engine`; a drift from the',
    ' * source fails `agentEngineMirror.test.ts`.',
    ' */',
    '',
    '',
  ].join('\n');
}

/**
 * Render the mirrored content for a spec. JSON is copied byte-for-byte; a TS
 * mirror gets the banner and has its listed import specifiers rewritten, and
 * must contain no `@/` alias afterwards (an unrewritten alias would not resolve
 * in the functions package — this throws so the generator and the guard both
 * catch it).
 */
export function renderMirror(spec: MirrorSpec, source: string): string {
  if (spec.kind === 'json') return source;
  let out = source;
  for (const [from, to] of spec.rewrites) out = out.split(from).join(to);
  if (out.includes('@/')) {
    throw new Error(`agentEngineMirror: ${spec.src} still contains an unrewritten "@/" import after mirroring.`);
  }
  return banner(spec.src) + out;
}
